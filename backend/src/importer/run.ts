import dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';
import { GOVERNORATE_BBOXES } from './geography.js';
import { synthesizeName } from './normalize.js';
import { groupPlaces } from './dedup.js';
import { fetchOsmPlaces } from './sources/osm.js';
import { fetchFoursquarePlaces } from './sources/foursquare.js';
import { fetchOverturePlaces } from './sources/overture.js';
import { findCommonsPhoto } from './photos/wikimedia.js';
import {
  deactivateMissingBranches,
  ensureReferenceData,
  loadGovernorateContext,
  resolveLocation,
  upsertGroup,
} from './upsert.js';
import type { GovernorateContext } from './upsert.js';
import type { ImportSource, NormalizedPlace } from './types.js';

interface CliArgs {
  governorate: string;
  sources: ImportSource[];
  photos: boolean;
  publish: boolean;
  dryRun: boolean;
  setupOnly: boolean;
  limit: number | null;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    governorate: 'dakahlia',
    sources: ['OSM', 'FOURSQUARE'],
    photos: false,
    publish: false,
    dryRun: false,
    setupOnly: false,
    limit: null,
  };
  for (const arg of argv) {
    if (arg.startsWith('--governorate=')) args.governorate = arg.split('=')[1];
    else if (arg === '--setup-only') args.setupOnly = true;
    else if (arg === '--photos') args.photos = true;
    else if (arg === '--publish') args.publish = true;
    else if (arg === '--dry-run') args.dryRun = true;
    else if (arg.startsWith('--sources=')) {
      args.sources = arg
        .split('=')[1]
        .split(',')
        .map((s) => s.trim().toUpperCase())
        .filter((s): s is ImportSource => s === 'OSM' || s === 'OVERTURE' || s === 'FOURSQUARE');
    } else if (arg.startsWith('--limit=')) args.limit = Number(arg.split('=')[1]) || null;
  }
  return args;
}

// Batch scripts use the session-mode connection (DIRECT_URL) — the transaction
// pooler on 6543 has proven flaky for long-running jobs, and batches don't need it.
const db = new PrismaClient(
  process.env.DIRECT_URL ? { datasourceUrl: process.env.DIRECT_URL } : undefined
);

async function main() {
  const args = parseArgs(process.argv.slice(2));

  console.log('Ensuring reference data (cuisines, governorates, cities)…');
  await ensureReferenceData(db);

  if (args.setupOnly) {
    console.log('Reference data ready. Done (--setup-only).');
    return;
  }

  const ctx = await loadGovernorateContext(db, args.governorate);
  console.log(`Importing into ${ctx.governorateEn} (${ctx.governorateAr}) from: ${args.sources.join(', ')}`);

  const allPlaces: NormalizedPlace[] = [];

  if (args.sources.includes('OSM')) {
    process.stdout.write('Fetching OSM (Overpass)…');
    const osmPlaces = await fetchOsmPlaces(ctx.governorateEn, ctx.governorateAr);
    console.log(` ${osmPlaces.length} places`);
    allPlaces.push(...osmPlaces);
  }

  if (args.sources.includes('FOURSQUARE')) {
    const apiKey = process.env.FSQ_API_KEY;
    const bbox = GOVERNORATE_BBOXES[args.governorate];
    if (!apiKey) {
      console.warn('Skipping Foursquare: FSQ_API_KEY is not set.');
    } else if (!bbox) {
      console.warn(`Skipping Foursquare: no bbox defined for "${args.governorate}".`);
    } else {
      process.stdout.write('Fetching Foursquare…');
      try {
        const { places } = await fetchFoursquarePlaces(apiKey, bbox);
        console.log(` ${places.length} places`);
        allPlaces.push(...places);
      } catch (error) {
        console.warn(`Foursquare fetch failed (continuing): ${String(error)}`);
      }
    }
  }

  if (args.sources.includes('OVERTURE')) {
    const bbox = GOVERNORATE_BBOXES[args.governorate];
    if (!bbox) {
      console.warn(`Skipping Overture: no bbox defined for "${args.governorate}".`);
    } else {
      process.stdout.write('Fetching Overture…');
      try {
        const overturePlaces = await fetchOverturePlaces(bbox);
        console.log(` ${overturePlaces.length} places`);
        allPlaces.push(...overturePlaces);
      } catch (error) {
        console.warn(`Overture fetch failed (continuing): ${String(error)}`);
      }
    }
  }

  if (allPlaces.length === 0) {
    console.log('No places fetched — nothing to do.');
    return;
  }

  // Synthesize bilingual names for unnamed places before grouping (Q17).
  let synthesized = 0;
  for (const place of allPlaces) {
    if (place.name || place.nameEn) continue;
    const locality = resolveLocation(ctx, place.latitude, place.longitude);
    const name = synthesizeName(place.placeKind, place.street, {
      nameAr: locality.cityAr,
      nameEn: locality.cityEn,
    });
    place.name = name.ar;
    place.nameEn = name.en;
    synthesized += 1;
  }

  // Wikimedia photos for places that have none yet (Q11/Q28).
  if (args.photos) {
    process.stdout.write('Looking up Wikimedia photos…');
    let found = 0;
    for (const place of allPlaces) {
      if (place.photoUrl) continue;
      try {
        const photo = await findCommonsPhoto(place.latitude, place.longitude);
        if (photo) {
          place.photoUrl = photo.url;
          place.photoAttribution = photo.attribution;
          found += 1;
        }
      } catch {
        // photo lookup is best-effort
      }
      await new Promise((r) => setTimeout(r, 300)); // be polite to the Commons API
    }
    console.log(` ${found} photos found`);
  }

  const groups = groupPlaces(allPlaces);
  const selected = args.limit ? groups.slice(0, args.limit) : groups;
  console.log(
    `Deduped ${allPlaces.length} places → ${groups.length} brands (${synthesized} unnamed renamed).` +
      (args.limit ? ` Processing first ${selected.length}.` : '')
  );

  const bySource = countBy(allPlaces, (p) => p.source);
  console.log('By source:', Object.entries(bySource).map(([k, v]) => `${k}=${v}`).join(' '));

  if (args.dryRun) {
    const byCity = countBy(selected, (g) => resolveLocation(ctx, g.places[0].latitude, g.places[0].longitude).cityEn);
    console.log('DRY RUN — top cities:', Object.entries(byCity).slice(0, 10).map(([k, v]) => `${k}=${v}`).join(' '));
    return;
  }

  const summary = {
    restaurantsCreated: 0,
    restaurantsUpdated: 0,
    branchesCreated: 0,
    branchesUpdated: 0,
    branchesDeactivated: 0,
  };

  let done = 0;
  for (const group of selected) {
    await withRetry(() => upsertGroup(db, group, ctx, { publish: args.publish }, summary), group.key);
    done += 1;
    if (done % 50 === 0) console.log(`  … ${done}/${selected.length} brands written`);
  }

  const seenExternalIds = new Set(allPlaces.map((p) => p.externalId));
  summary.branchesDeactivated = await withRetry(
    () => deactivateMissingBranches(db, args.governorate, args.sources, seenExternalIds),
    'deactivate-missing'
  );

  console.log(
    `\nDone. Restaurants +${summary.restaurantsCreated}/~${summary.restaurantsUpdated}, ` +
      `branches +${summary.branchesCreated}/~${summary.branchesUpdated}, ` +
      `deactivated ${summary.branchesDeactivated}. ` +
      `Records are ${args.publish ? 'ACTIVE' : 'DRAFT + UNVERIFIED (approve in Prisma Studio)'} — ` +
      `run \`npx prisma studio\` to review, or re-run with --publish.`
  );
}

function countBy<T>(items: T[], keyOf: (item: T) => string): Record<string, number> {
  const result: Record<string, number> = {};
  for (const item of items) {
    const key = keyOf(item);
    result[key] = (result[key] ?? 0) + 1;
  }
  return result;
}

/** Retry transient Prisma connection errors (P1001 etc.) — upserts are idempotent. */
async function withRetry<T>(fn: () => Promise<T>, label: string, attempts = 4): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const isConnectionError =
        typeof error === 'object' && error !== null && 'code' in error && (error as { code: string }).code === 'P1001';
      if (!isConnectionError || attempt === attempts) break;
      const delayMs = 10_000 * attempt;
      console.warn(`  connection lost during "${label}", retry ${attempt}/${attempts - 1} in ${delayMs / 1000}s…`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastError;
}

main()
  .catch((error) => {
    console.error('Import failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
