/**
 * Import the Dakahlia Google Maps scrape into the Place catalogue.
 *
 * Usage (from `backend/`):
 *   npx tsx src/importer/run-gmaps-playwright.ts --dry-run
 *   npx tsx src/importer/run-gmaps-playwright.ts --publish
 *
 * Flags:
 *   --file=<path>      default ../dakahlia_food/dakahlia_food.json
 *   --governorate=<s>  default dakahlia
 *   --publish          promote to ACTIVE (otherwise leaves DRAFT)
 *   --dry-run          report what would happen, write nothing
 *   --limit=<n>        cap rows, for iterating
 *
 * Re-running is safe: `externalId` is stable per Google place, so a second run
 * updates rather than duplicates.
 */

import dotenv from 'dotenv';
dotenv.config();

import { Prisma, PrismaClient } from '@prisma/client';

import { slugify } from './normalize.js';
import {
  ensureReferenceData,
  loadGovernorateContext,
  resolveLocation,
} from './upsert.js';
import {
  SOURCE,
  externalIdFor,
  groupByExactName,
  normalizeDakahliaFood,
  parseRating,
  parseReviews,
  readDakahliaFoodFile,
} from './sources/gmaps-playwright.js';
import type { DakahliaFoodRow } from './sources/gmaps-playwright.js';

interface Args {
  file: string;
  governorate: string;
  publish: boolean;
  dryRun: boolean;
  limit: number | null;
}

/** Rows per transaction. Small enough that a dropped connection loses little. */
const BATCH_SIZE = 25;

function parseArgs(argv: string[]): Args {
  const args: Args = {
    file: '../dakahlia_food/dakahlia_food.json',
    governorate: 'dakahlia',
    publish: false,
    dryRun: false,
    limit: null,
  };
  for (const arg of argv) {
    if (arg.startsWith('--file=')) args.file = arg.split('=').slice(1).join('=');
    else if (arg.startsWith('--governorate=')) args.governorate = arg.split('=')[1];
    else if (arg.startsWith('--limit=')) args.limit = Number(arg.split('=')[1]);
    else if (arg === '--publish') args.publish = true;
    else if (arg === '--dry-run') args.dryRun = true;
  }
  return args;
}

/**
 * The Supabase pooler drops long-lived interactive transactions, and this run
 * holds one open per batch. Each batch is therefore retried on a fresh
 * connection. Writes are idempotent (`externalId` is the natural key), so a
 * retried batch that had partially applied is safe.
 */
async function withRetry<T>(label: string, attempts: number, fn: () => Promise<T>): Promise<T> {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      const transient =
        /Transaction not found|P1001|P1008|P2024|can't reach database|Connection|closed transaction|ECONNRESET|ETIMEDOUT|terminating connection/i.test(
          message,
        );
      if (!transient || attempt === attempts) throw e;
      console.log(`  [${label}] connection dropped (attempt ${attempt}/${attempts}), retrying`);
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }
  throw new Error(`${label}: exhausted retries`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  // The transaction-mode pooler (6543) is what survives a 700-row write loop;
  // the session-mode URL is only for migrations.
  const db = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });

  console.log(`[gmaps-playwright] reading ${args.file}`);
  const file = await readDakahliaFoodFile(args.file);
  const rows: DakahliaFoodRow[] = args.limit ? file.rows.slice(0, args.limit) : file.rows;

  console.log(`  rows kept: ${rows.length}`);
  console.log(`  rows rejected: ${file.rejected.length}`);
  for (const r of file.rejected.slice(0, 10)) {
    console.log(`    row ${r.row}: ${r.reason}`);
  }
  if (file.rejected.length > 10) {
    console.log(`    ... and ${file.rejected.length - 10} more`);
  }

  const ctx = await loadGovernorateContext(db, args.governorate);

  const places = normalizeDakahliaFood(rows);
  const groups = groupByExactName(places);
  const multiBranch = groups.filter((g) => g.places.length > 1);

  console.log(`  brands: ${groups.length} (${multiBranch.length} with more than one branch)`);
  for (const g of multiBranch.slice(0, 10)) {
    console.log(`    ${g.key}: ${g.places.length} places`);
  }

  // Where the coordinates say these places actually are. The scrape's own
  // `city_source` is a query label and is not used for this.
  // Nearest-city distance is the honest quality signal: how far each place sits
  // from the centre `resolveLocation` will file it under. Dakahlia runs roughly
  // 100km corner to corner, so distances up to ~25km are normal for a village.
  const cityCounts = new Map<string, number>();
  const nearest: number[] = [];
  let noCity = 0;
  for (const place of places) {
    const loc = resolveLocation(ctx, place.latitude, place.longitude);
    const name = loc.cityEn ?? '(none)';
    cityCounts.set(name, (cityCounts.get(name) ?? 0) + 1);
    if (!loc.cityId) noCity += 1;
    let best = Number.POSITIVE_INFINITY;
    for (const city of ctx.cities) {
      if (city.latitude == null || city.longitude == null) continue;
      const R = 6371;
      const dLat = ((city.latitude - place.latitude) * Math.PI) / 180;
      const dLon = ((city.longitude - place.longitude) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((place.latitude * Math.PI) / 180) *
          Math.cos((city.latitude * Math.PI) / 180) *
          Math.sin(dLon / 2) ** 2;
      const km = 2 * R * Math.asin(Math.sqrt(a));
      if (km < best) best = km;
    }
    if (Number.isFinite(best)) nearest.push(best);
  }
  nearest.sort((a, b) => a - b);
  const pct = (p: number) => nearest[Math.min(nearest.length - 1, Math.floor(nearest.length * p))];
  console.log(`  resolved cities: ${cityCounts.size} | rural (no city within 25km): ${noCity}`);
  for (const [name, n] of [...cityCounts.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`    ${name}: ${n}`);
  }
  console.log(
    `  distance to assigned city centre: median ${pct(0.5)?.toFixed(2)}km | p90 ${pct(0.9)?.toFixed(2)}km | max ${nearest[nearest.length - 1]?.toFixed(2)}km`,
  );

  // What this run would do, against what is already in the database.
  const externalIds = places.map((p) => p.externalId);
  const existing = await db.branch.findMany({
    where: { externalId: { in: externalIds } },
    select: { externalId: true, source: true },
  });
  const existingIds = new Set(existing.map((b) => b.externalId));
  const toCreate = externalIds.filter((id) => !existingIds.has(id)).length;
  const toUpdate = existingIds.size;
  const fromOtherSources = existing.filter((b) => b.source !== SOURCE).length;
  console.log(`\n  would create: ${toCreate}`);
  console.log(`  would update: ${toUpdate} (of which ${fromOtherSources} carry another source's id)`);

  const withRating = rows.filter((r) => parseRating(r.rating) != null).length;
  const withReviews = rows.filter((r) => parseReviews(r.reviews) != null).length;
  console.log(`  ratings present: ${withRating}/${rows.length} (optional, never required)`);
  console.log(`  review counts present: ${withReviews}/${rows.length}`);

  if (args.dryRun) {
    console.log('\n[dry-run] no writes performed.');
    await db.$disconnect();
    return;
  }

  // Acquired-at is stamped once per run: the moment we read the scrape, which
  // is when this data became visible to us.
  const acquiredAt = new Date();
  const rowById = new Map(rows.map((r) => [externalIdFor(r), r]));
  const wantedCuisines = [...new Set(places.flatMap((p) => p.cuisineSlugs))];
  const cuisineRows = await db.cuisine.findMany({
    where: { slug: { in: wantedCuisines } },
    select: { id: true, slug: true },
  });
  const cuisineIdBySlug = new Map(cuisineRows.map((c) => [c.slug, c.id]));

  let created = 0;
  let updated = 0;
  let done = 0;

  /**
   * The database connection to the remote pooler drops mid-run, so the write
   * loop is resumable by construction: `externalId` is the natural key, rows
   * already present are updated rather than recreated, and each batch is one
   * transaction so a dropped batch simply retries.
   */
  for (let start = 0; start < places.length; start += BATCH_SIZE) {
    const batch = places.slice(start, start + BATCH_SIZE);
    let batchCreated = 0;
    let batchUpdated = 0;

    await withRetry(`batch ${start / BATCH_SIZE + 1}`, 4, () =>
      db.$transaction(
        async (tx) => {
        for (const place of batch) {
          const row = rowById.get(place.externalId)!;
          const loc = resolveLocation(ctx, place.latitude, place.longitude);
          const rating = parseRating(row.rating);
          const reviewsCount = parseReviews(row.reviews);
          const mapsUrl = (row.google_maps_url ?? '').trim() || null;
          const status = args.publish ? ('ACTIVE' as const) : ('DRAFT' as const);

          const shared = {
            nameEn: place.nameEn,
            latitude: place.latitude,
            longitude: place.longitude,
            address: place.address ?? `${loc.cityAr}، ${loc.governorateAr}`,
            placeKind: place.placeKind,
            rating: rating != null ? new Prisma.Decimal(rating) : null,
            reviewsCount,
            googleMapsUrl: mapsUrl,
            sourceAcquiredAt: acquiredAt,
            governorateId: loc.governorateId,
            cityId: loc.cityId,
            status,
          };

          const prior = await tx.branch.findUnique({
            where: { externalId: place.externalId },
            select: { id: true },
          });

          if (prior) {
            // Provenance and verification are never downgraded by a re-run.
            await tx.branch.update({
              where: { id: prior.id },
              data: { ...shared, verificationStatus: 'UNVERIFIED', source: SOURCE },
            });
            batchUpdated += 1;
            continue;
          }

          const brandName = place.name!;
          const base = slugify(brandName) || 'place';
          let slug = base;
          let n = 2;
          while (await tx.restaurant.findUnique({ where: { slug }, select: { id: true } })) {
            slug = `${base}-${n}`;
            n += 1;
          }

          const restaurant = await tx.restaurant.create({
            data: {
              name: brandName,
              nameEn: place.nameEn,
              slug,
              status,
              verificationStatus: 'UNVERIFIED',
              source: SOURCE,
            },
          });

          const cuisineIds = place.cuisineSlugs
            .map((slugName) => cuisineIdBySlug.get(slugName))
            .filter((id): id is string => Boolean(id));
          if (cuisineIds.length > 0) {
            await tx.restaurantCuisine.createMany({
              data: cuisineIds.map((cuisineId) => ({ restaurantId: restaurant.id, cuisineId })),
              skipDuplicates: true,
            });
          }

          await tx.branch.create({
            data: {
              restaurantId: restaurant.id,
              // A branch name the user sees should name the place, not just the city.
              name: place.nameEn ? `${place.name} — ${place.nameEn}` : place.name!,
              ...shared,
              source: SOURCE,
              externalId: place.externalId,
              verificationStatus: 'UNVERIFIED',
            },
          });
          batchCreated += 1;
        }
        },
        { maxWait: 30000, timeout: 60000 },
      ),
    );

    created += batchCreated;
    updated += batchUpdated;
    done += batch.length;
    console.log(`  ${done}/${places.length} written (created ${created}, updated ${updated})`);
  }

  console.log(`\n  branches created: ${created}`);
  console.log(`  branches updated: ${updated}`);
  console.log(`  status: ${args.publish ? 'ACTIVE' : 'DRAFT'}`);
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});