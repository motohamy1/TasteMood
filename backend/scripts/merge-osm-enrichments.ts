/**
 * Merge OSM enrichment caches (nominatim.json + overpass.json) into the
 * Branch table. Default mode is dry-run: prints the plan, writes nothing.
 * Pass --publish to apply.
 *
 * What this writes, by source priority (later never downgrades earlier):
 *   address         ← nominatim road + neighbourhood + city   (if real feature)
 *   phone           ← overpass phone (only if branch.phone is null)
 *   website         ← overpass website (only if branch.coverImageUrl is null)
 *   openingHours    ← overpass opening_hours via parseOpeningHours
 *   cuisines        ← overpass cuisine tag (added, never removed)
 *   placeKind       ← overpass amenity (only if branch.placeKind is null)
 *
 * The address we synthesise has two parts:
 *   1. Nominatim: the road / neighbourhood / village that the OSM road
 *      graph puts the place on.
 *   2. The governorate + resolved city (from lat/lng).
 * The two halves are joined with "،" when both are present, so a branch
 * ends up with a real street name when one exists and a bare city+gov
 * fallback otherwise.
 *
 * Usage:
 *   npx tsx scripts/merge-osm-enrichments.ts                # dry-run
 *   npx tsx scripts/merge-osm-enrichments.ts --publish      # write
 *   npx tsx scripts/merge-osm-enrichments.ts --limit=10      # dry-run sample
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import {
  mapOsmCuisines,
  parseOpeningHours,
} from '../src/importer/normalize.js';
import { loadGovernorateContext, resolveLocation } from '../src/importer/upsert.js';
import type { NominatimHit } from './enrich-osm-nominatim.js';
import type { OverpassHit } from './enrich-osm-overpass.js';

const NOMI = join('enrichments', 'nominatim.json');
const OVER = join('enrichments', 'overpass.json');
const REPORT = join('enrichments', 'merge-plan.json');

interface Args {
  publish: boolean;
  limit: number | null;
  governorate: string;
}
function parseArgs(argv: string[]): Args {
  const out: Args = { publish: false, limit: null, governorate: 'dakahlia' };
  for (const a of argv) {
    if (a === '--publish') out.publish = true;
    if (a.startsWith('--limit=')) out.limit = Number(a.split('=')[1]);
    if (a.startsWith('--governorate=')) out.governorate = a.split('=')[1];
  }
  return out;
}

/**
 * Strip the "مدينة" / "مركز" / "قرية" prefix that Nominatim often attaches
 * to a town/village name, so it can be matched against our canonical city
 * labels ("بلقاس" vs Nominatim's "مدينه بلقاس").
 */
function stripPlacePrefix(value: string): string {
  return value
    .replace(/^(?:مدينة|مدينه|مدينة|قسم|قسم|قرية|قريه|مركز|مركز)\s+/u, '')
    .trim();
}

/**
 * True when the two strings refer to the same Arabic-named place. Strips
 * place prefixes (مدينه/قرية/...), diacritics, and the suffix 'مدينة' that
 * the scraper adds to compound city names.
 */
function isSamePlace(a: string, b: string): boolean {
  if (!a || !b) return false;
  const na = stripPlacePrefix(a);
  const nb = stripPlacePrefix(b);
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  return false;
}

/**
 * Build a clean Arabic-style address from Nominatim + resolved location.
 *
 *   <road>, <neighbourhood/village>, <city>, <governorate>
 *
 * Duplicates are dropped. Governorate is always included — it's the
 * disambiguator the user sees when city and town carry similar names.
 */
function synthesizeAddress(nomi: NominatimHit, cityAr: string, govAr: string): string {
  const seen = new Set<string>();
  const parts: string[] = [];

  const push = (val: string | null | undefined) => {
    if (!val) return;
    const trimmed = val.trim();
    if (!trimmed) return;
    if (seen.has(trimmed)) return;
    seen.add(trimmed);
    parts.push(trimmed);
  };

  const pushUnlessSameAs = (val: string | null | undefined, ...others: Array<string | null | undefined>) => {
    if (!val) return;
    const trimmed = val.trim();
    if (!trimmed) return;
    for (const o of others) {
      if (o && isSamePlace(trimmed, o)) return;
    }
    push(trimmed);
  };

  // 1) road or neighbourhood: the most precise location we can offer
  push(nomi.road);
  if (!nomi.road) push(nomi.neighbourhood);
  if (!nomi.road && !nomi.neighbourhood) push(nomi.suburb);

  // 2) the village/town level (where the road sits). Skip if it matches
  //    our canonical city label — Nominatim sometimes returns "مدينة بلقاس"
  //    which is the same place as the resolved city.
  pushUnlessSameAs(nomi.village, cityAr);
  pushUnlessSameAs(nomi.town, cityAr, nomi.village);

  // 3) our resolved city (markaz-level). Skip if the town already names it.
  pushUnlessSameAs(cityAr, nomi.town, nomi.village);

  // 4) governorate — always at the end so the user knows the region
  if (govAr) push(govAr);

  return parts.join('، ');
}

interface BranchPlan {
  branchId: string;
  externalId: string;
  name: string;
  before: {
    address: string | null;
    phone: string | null;
    placeKind: string | null;
    cuisineCount: number;
    hoursCount: number;
  };
  plan: {
    address: string | null;
    phone: string | null;
    placeKind: string | null;
    cuisineSlugs: string[];
    hours: Array<{ dayOfWeek: number; openTime: string; closeTime: string; isClosed: boolean; isSplitShift: boolean }> | null;
  };
  applied: boolean;
  reason: string;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const db = new PrismaClient();
  await mkdir('enrichments', { recursive: true });

  let nomi: Record<string, NominatimHit> = {};
  let over: Record<string, OverpassHit> = {};
  try { nomi = JSON.parse(await readFile(NOMI, 'utf8')); } catch { /* missing */ }
  try { over = JSON.parse(await readFile(OVER, 'utf8')); } catch { /* missing */ }
  console.log(`[merge] nominatim entries: ${Object.keys(nomi).length} | overpass entries: ${Object.keys(over).length}`);

  // The Supabase transaction pooler drops connections under load; the
  // first call can fail before Prisma re-establishes a session. Retry
  // once with a short backoff before giving up.
  let ctx;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      ctx = await loadGovernorateContext(db, args.governorate);
      break;
    } catch (e) {
      console.log(`[merge] governorate context attempt ${attempt} failed: ${e instanceof Error ? e.message : String(e)}`);
      if (attempt === 3) throw e;
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }

  const branches = await db.branch.findMany({
    where: { source: 'GMAPS_PLAYWRIGHT' },
    select: {
      id: true, externalId: true, name: true,
      address: true, phone: true, placeKind: true,
      restaurant: {
        select: {
          id: true,
          cuisines: { select: { cuisine: { select: { slug: true } } } },
        },
      },
      operatingHours: { select: { id: true, dayOfWeek: true, openTime: true, closeTime: true, isClosed: true, isSplitShift: true } },
      latitude: true, longitude: true, governorateId: true, cityId: true,
    },
    orderBy: { externalId: 'asc' },
  });
  const targets = args.limit ? branches.slice(0, args.limit) : branches;
  console.log(`[merge] processing ${targets.length} branches (mode: ${args.publish ? 'PUBLISH' : 'DRY-RUN'})`);

  const plans: BranchPlan[] = [];
  let changes = 0;
  const summary = { addressWrites: 0, phoneWrites: 0, hoursWrites: 0, cuisineAdds: 0, placeKindWrites: 0 };

  for (const b of targets) {
    if (!b.externalId) continue;
    const n = nomi[b.externalId];
    const o = over[b.externalId];

    const before = {
      address: b.address,
      phone: b.phone,
      placeKind: b.placeKind,
      cuisineCount: b.restaurant?.cuisines.length ?? 0,
      hoursCount: b.operatingHours.length,
    };

    // ----- address: from nominatim, fallback to city, governorate -----
    let newAddress: string | null = null;
    if (n) {
      // Only trust the address when we hit a real public feature
      const isRealFeature = n.hit && (n.road || n.neighbourhood || n.suburb);
      if (isRealFeature) {
        const loc = resolveLocation(ctx, b.latitude, b.longitude);
        newAddress = synthesizeAddress(n, loc.cityAr, loc.governorateAr);
      }
    }
    if (!newAddress) {
      // Per user choice: synthesize a city, governorate fallback (provenanced ESTIMATED later)
      const loc = resolveLocation(ctx, b.latitude, b.longitude);
      newAddress = `${loc.cityAr}، ${loc.governorateAr}`;
    }

    // ----- phone: from overpass, only if branch is missing -----
    const newPhone = o?.hit && o.phone && !b.phone ? o.phone : null;

    // ----- hours: parse opening_hours string -----
    let newHours: ReturnType<typeof parseOpeningHours> = null;
    if (o?.hit && o.openingHours) {
      newHours = parseOpeningHours(o.openingHours);
    }

    // ----- cuisines: from overpass, additive -----
    const newCuisines: string[] = [];
    if (o?.hit) {
      const slugs = mapOsmCuisines(o.cuisine, o.amenity, o.shop);
      const existing = new Set((b.restaurant?.cuisines ?? []).map((rc) => rc.cuisine.slug));
      for (const s of slugs) {
        // Skip the "other" fallback — adding it never helps the user find the
        // place, and it pollutes the cuisine rail with a non-cuisine.
        if (s === 'other') continue;
        if (!existing.has(s)) newCuisines.push(s);
      }
    }

    // ----- placeKind: from overpass amenity, only if branch is null -----
    const newPlaceKind = o?.hit && o.amenity && !b.placeKind ? o.amenity : null;

    const hasChange =
      (newAddress && newAddress !== b.address) ||
      newPhone !== null ||
      newPlaceKind !== null ||
      newCuisines.length > 0 ||
      (newHours && newHours.length > 0 && b.operatingHours.length === 0);

    plans.push({
      branchId: b.id,
      externalId: b.externalId,
      name: b.name ?? '',
      before,
      plan: {
        address: newAddress,
        phone: newPhone,
        placeKind: newPlaceKind,
        cuisineSlugs: newCuisines,
        hours: newHours,
      },
      applied: false,
      reason: hasChange ? 'plan' : 'no-change',
    });

    if (hasChange) {
      changes += 1;
      if (newAddress && newAddress !== b.address) summary.addressWrites += 1;
      if (newPhone) summary.phoneWrites += 1;
      if (newPlaceKind) summary.placeKindWrites += 1;
      if (newCuisines.length > 0) summary.cuisineAdds += newCuisines.length;
      if (newHours && newHours.length > 0 && b.operatingHours.length === 0) summary.hoursWrites += 1;
    }
  }

  console.log('\n[merge] plan summary:');
  console.log(`  address changes:      ${summary.addressWrites}`);
  console.log(`  phone additions:      ${summary.phoneWrites}`);
  console.log(`  placeKind additions:  ${summary.placeKindWrites}`);
  console.log(`  cuisine additions:    ${summary.cuisineAdds}`);
  console.log(`  hours additions:      ${summary.hoursWrites}`);
  console.log(`  total branches:       ${targets.length}`);
  console.log(`  branches changing:    ${changes}`);

  // Show 5 sample plans
  const sample = plans.filter((p) => p.reason === 'plan').slice(0, 5);
  console.log('\n[merge] sample changes:');
  for (const p of sample) {
    console.log(`  ${p.name?.slice(0, 36)?.padEnd(36)}`);
    console.log(`    address:  "${p.before.address ?? '∅'}"  →  "${p.plan.address ?? '∅'}"`);
    if (p.plan.phone) console.log(`    phone:    → ${p.plan.phone}`);
    if (p.plan.placeKind) console.log(`    placeKind: → ${p.plan.placeKind}`);
    if (p.plan.cuisineSlugs.length) console.log(`    cuisines: + ${p.plan.cuisineSlugs.join(', ')}`);
    if (p.plan.hours) console.log(`    hours:    ${p.plan.hours.length} day-rows`);
  }

  await writeFile(REPORT, JSON.stringify(plans, null, 2), 'utf8');
  console.log(`\n[merge] plan written: ${REPORT}`);

  if (!args.publish) {
    console.log('\n[merge] DRY-RUN — no DB writes. Pass --publish to apply.');
    await db.$disconnect();
    return;
  }

  // ----- apply the plan -----
  console.log('\n[merge] applying plan...');
  let applied = 0;
  for (const p of plans) {
    if (p.reason !== 'plan') continue;
    const data: Record<string, unknown> = {};
    if (p.plan.address) data.address = p.plan.address;
    if (p.plan.phone) data.phone = p.plan.phone;
    if (p.plan.placeKind) data.placeKind = p.plan.placeKind;

    if (Object.keys(data).length > 0) {
      await db.branch.update({ where: { id: p.branchId }, data });
    }

    if (p.plan.cuisineSlugs.length > 0) {
      const restaurantId = b.restaurant?.id;
      if (restaurantId) {
        const slugRows = await db.cuisine.findMany({
          where: { slug: { in: p.plan.cuisineSlugs } },
          select: { id: true },
        });
        if (slugRows.length > 0) {
          await db.restaurantCuisine.createMany({
            data: slugRows.map((c) => ({ restaurantId, cuisineId: c.id })),
            skipDuplicates: true,
          });
        }
      }
    }

    if (p.plan.hours && p.plan.hours.length > 0) {
      await db.branchOperatingHour.deleteMany({ where: { branchId: p.branchId } });
      await db.branchOperatingHour.createMany({
        data: p.plan.hours.map((h) => ({ ...h, branchId: p.branchId })),
      });
    }

    p.applied = true;
    applied += 1;
  }

  await writeFile(REPORT, JSON.stringify(plans, null, 2), 'utf8');
  console.log(`\n[merge] applied ${applied} branches`);
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
