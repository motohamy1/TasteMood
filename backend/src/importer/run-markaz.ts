import dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';
import type { RecordStatus } from '@prisma/client';
import { slugify } from './normalize.js';
import {
  atmosphereSlugsFor,
  buildMarkazClusters,
  distanceKm,
  isNonFoodPlace,
  latinPortion,
  readMarkazCsv,
  resolveCity,
  sameBrand,
} from './sources/markaz-csv.js';
import type { MarkazCluster, MarkazRow } from './sources/markaz-csv.js';

/** Provenance tag for this file, so the rows stay separately auditable. */
const SOURCE = 'GMAPS_MARKAZ';
/** Two records this close with the same brand name are the same restaurant. */
const MERGE_RADIUS_KM = 2;

const ATMOSPHERE_TAGS = [
  { slug: 'wheelchair-accessible', name: 'Wheelchair Accessible', description: 'Step-free access and facilities for wheelchair users, as listed by the source' },
  { slug: 'hearing-loop', name: 'Hearing Loop', description: 'Assistive hearing loop reported by the source' },
];

interface Args {
  file: string;
  governorate: string;
  publish: boolean;
  dryRun: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { file: '../dakahlia_all_18_markaz_exhaustive_data.csv', governorate: 'dakahlia', publish: false, dryRun: false };
  for (const arg of argv) {
    if (arg.startsWith('--file=')) args.file = arg.split('=').slice(1).join('=');
    else if (arg.startsWith('--governorate=')) args.governorate = arg.split('=')[1];
    else if (arg === '--publish') args.publish = true;
    else if (arg === '--dry-run') args.dryRun = true;
  }
  return args;
}

type Db = PrismaClient;

interface CityRef {
  id: string;
  nameAr: string;
  nameEn: string;
}

interface RestaurantCandidate {
  restaurantId: string;
  names: string[];
  latitude: number;
  longitude: number;
}

const summary = {
  rowsRead: 0,
  skippedNonFood: 0,
  skippedInvalid: 0,
  citiesCreated: 0,
  citiesReused: 0,
  restaurantsCreated: 0,
  restaurantsMerged: 0,
  branchesCreated: 0,
  branchesUpdated: 0,
  coordinateConflicts: 0,
  ruralUnassigned: 0,
};

async function ensureCities(db: Db, governorateId: string, clusters: MarkazCluster[]): Promise<Map<string, CityRef>> {
  const byMarkaz = new Map<string, CityRef>();
  for (const cluster of clusters) {
    const existing = await db.city.findFirst({ where: { governorateId, slug: cluster.slug } });
    if (existing) {
      byMarkaz.set(cluster.markaz, { id: existing.id, nameAr: existing.nameAr, nameEn: existing.nameEn });
      summary.citiesReused += 1;
      continue;
    }
    // The export labels these areas in Latin script only, so the Arabic name is
    // recorded as supplied rather than as a translation we would be inventing.
    const created = await db.city.create({
      data: {
        governorateId,
        slug: cluster.slug,
        nameEn: cluster.markaz,
        nameAr: cluster.markaz,
        latitude: Number(cluster.latitude.toFixed(7)),
        longitude: Number(cluster.longitude.toFixed(7)),
      },
    });
    byMarkaz.set(cluster.markaz, { id: created.id, nameAr: created.nameAr, nameEn: created.nameEn });
    summary.citiesCreated += 1;
  }
  return byMarkaz;
}

async function ensureAtmosphereTags(db: Db): Promise<Map<string, string>> {
  const bySlug = new Map<string, string>();
  for (const tag of ATMOSPHERE_TAGS) {
    const existing = await db.atmosphereTag.upsert({ where: { slug: tag.slug }, create: tag, update: { name: tag.name, description: tag.description } });
    bySlug.set(tag.slug, existing.id);
  }
  return bySlug;
}

async function loadCandidates(db: Db, governorateId: string): Promise<RestaurantCandidate[]> {
  const branches = await db.branch.findMany({
    where: { governorateId },
    select: { latitude: true, longitude: true, restaurantId: true, restaurant: { select: { name: true, nameEn: true } } },
  });
  return branches.map((b) => ({
    restaurantId: b.restaurantId,
    names: [b.restaurant.name, b.restaurant.nameEn ?? ''].filter(Boolean),
    latitude: b.latitude,
    longitude: b.longitude,
  }));
}

async function createRestaurant(db: Db, row: MarkazRow, status: RecordStatus): Promise<string> {
  const base = slugify(row.placeName) || 'place';
  let slug = base;
  if (await db.restaurant.findUnique({ where: { slug } })) {
    slug = `${base}-${row.placeId.slice(0, 8)}`;
    if (await db.restaurant.findUnique({ where: { slug } })) slug = `${base}-${Date.now().toString(36)}`;
  }
  const restaurant = await db.restaurant.create({
    data: {
      name: row.placeName,
      nameEn: latinPortion(row.placeName),
      slug,
      source: SOURCE,
      status,
      verificationStatus: 'UNVERIFIED',
    },
  });
  return restaurant.id;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const governorate = await db.governorate.findUnique({ where: { slug: args.governorate } });
  if (!governorate) throw new Error(`Governorate "${args.governorate}" is missing — run \`npm run import:setup\` first.`);
  const governorateId = governorate.id;

  const all = await readMarkazCsv(args.file);
  summary.rowsRead = all.length;

  const invalid = all.filter((r) => Math.abs(r.latitude) > 90 || Math.abs(r.longitude) > 180);
  const nonFood = all.filter((r) => !invalid.includes(r) && isNonFoodPlace(r.placeName));
  const rows = all.filter((r) => !invalid.includes(r) && !isNonFoodPlace(r.placeName));
  summary.skippedInvalid = invalid.length;
  summary.skippedNonFood = nonFood.length;

  const clusters = buildMarkazClusters(rows);

  console.log(`Read ${all.length} rows from ${args.file}`);
  if (invalid.length > 0) {
    console.log(`Skipped ${invalid.length} row(s) with unusable coordinates:`);
    for (const r of invalid) console.log(`  - ${r.placeName} [${r.areaLabel}] (${r.latitude}, ${r.longitude})`);
  }
  if (nonFood.length > 0) {
    console.log(`Excluded ${nonFood.length} row(s) that are not food-and-drink places:`);
    for (const r of nonFood) console.log(`  - ${r.placeName} [${r.areaLabel}]`);
  }
  console.log(`Seeding ${rows.length} places across ${clusters.length} markazes.`);

  const conflicts = rows.filter((r) => resolveCity(r, clusters).contradictsLabel);
  if (conflicts.length > 0) {
    console.log(`\n${conflicts.length} row(s) have coordinates that contradict their area label; coordinates win:`);
    for (const r of conflicts) {
      const target = resolveCity(r, clusters).cluster;
      console.log(`  - ${r.placeName}: labelled "${r.areaLabel}", placed in ${target ? target.markaz : 'no city — beyond every markaz cluster'} `);
    }
  }

  if (args.dryRun) {
    console.log('\nDRY RUN — no records written. Planned cities:');
    for (const cluster of clusters) {
      const existing = await db.city.findFirst({ where: { governorateId, slug: cluster.slug } });
      console.log(`  ${existing ? 'reuse' : 'create'}  ${cluster.slug.padEnd(26)} ${cluster.markaz.padEnd(26)} n=${String(cluster.rows.length).padStart(2)}  ~${cluster.latitude.toFixed(4)}, ${cluster.longitude.toFixed(4)}`);
    }
    return;
  }

  const cities = await ensureCities(db, governorateId, clusters);
  const atmospheres = await ensureAtmosphereTags(db);
  const candidates = await loadCandidates(db, governorateId);

  const status: RecordStatus = args.publish ? 'ACTIVE' : 'DRAFT';
  for (const row of rows) {
    const { cluster, contradictsLabel } = resolveCity(row, clusters);
    const city = cluster ? cities.get(cluster.markaz) ?? null : null;
    if (contradictsLabel) summary.coordinateConflicts += 1;
    if (!city) summary.ruralUnassigned += 1;

    const externalId = `gmaps/place/${row.placeId}`;
    const verification = contradictsLabel ? ('NEEDS_REVIEW' as const) : ('UNVERIFIED' as const);
    const atmosphereIds = atmosphereSlugsFor(row.accessibility)
      .map((slug) => atmospheres.get(slug))
      .filter((id): id is string => Boolean(id));

    const existingBranch = await db.branch.findUnique({ where: { externalId } });
    const restaurantId = existingBranch?.restaurantId ?? (await attachRestaurant(db, row, candidates, status));

    const branchData = {
      name: `فرع ${city?.nameAr ?? governorate.nameAr}`,
      nameEn: `${city?.nameEn ?? governorate.nameEn} Branch`,
      address: `${city?.nameAr ?? governorate.nameAr}، ${governorate.nameAr}`,
      latitude: row.latitude,
      longitude: row.longitude,
      governorateId,
      cityId: city?.id ?? null,
      status,
      verificationStatus: verification,
      source: SOURCE,
    };

    if (existingBranch) {
      await db.branch.update({ where: { id: existingBranch.id }, data: branchData });
      summary.branchesUpdated += 1;
    } else {
      await db.branch.create({
        data: {
          ...branchData,
          restaurantId,
          externalId,
          ...(atmosphereIds.length > 0 ? { atmospheres: { createMany: { data: atmosphereIds.map((atmosphereTagId) => ({ atmosphereTagId })) } } } : {}),
        },
      });
      summary.branchesCreated += 1;
    }

    if (existingBranch && atmosphereIds.length > 0) {
      await db.branchAtmosphere.createMany({
        data: atmosphereIds.map((atmosphereTagId) => ({ branchId: existingBranch.id, atmosphereTagId })),
        skipDuplicates: true,
      });
    }

    // Listings are only served when the restaurant *and* the branch are ACTIVE,
    // so publishing has to promote both. Never demote an existing restaurant.
    if (args.publish) {
      await db.restaurant.update({ where: { id: restaurantId }, data: { status: 'ACTIVE' } });
    }

    candidates.push({ restaurantId, names: [row.placeName, latinPortion(row.placeName) ?? ''].filter(Boolean), latitude: row.latitude, longitude: row.longitude });
  }

  console.log(
    `\nDone. ${summary.citiesCreated} city row(s) created (${summary.citiesReused} reused), ` +
      `restaurants +${summary.restaurantsCreated}/merged-into-existing ${summary.restaurantsMerged}, ` +
      `branches +${summary.branchesCreated}/~${summary.branchesUpdated}. ` +
      `${summary.coordinateConflicts} placed by coordinates over their label, ${summary.ruralUnassigned} left without a city. ` +
      `Records are ${args.publish ? 'ACTIVE' : 'DRAFT and UNVERIFIED'}.`
  );
}

/** Find the restaurant this place belongs to, or create a single-place brand. */
async function attachRestaurant(db: Db, row: MarkazRow, candidates: RestaurantCandidate[], status: RecordStatus): Promise<string> {
  const match = candidates.find(
    (c) => c.names.some((n) => sameBrand(n, row.placeName)) && distanceKm(c.latitude, c.longitude, row.latitude, row.longitude) <= MERGE_RADIUS_KM
  );
  if (match) {
    summary.restaurantsMerged += 1;
    return match.restaurantId;
  }
  summary.restaurantsCreated += 1;
  return createRestaurant(db, row, status);
}

const db = new PrismaClient(process.env.DIRECT_URL ? { datasourceUrl: process.env.DIRECT_URL } : undefined);

main()
  .catch((error) => {
    console.error('Markaz import failed:', error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
