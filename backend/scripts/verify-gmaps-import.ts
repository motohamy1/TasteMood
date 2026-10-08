import dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';

const db = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });

async function main() {
  const source = 'GMAPS_PLAYWRIGHT';

  const total = await db.branch.count({ where: { source } });
  const dupes = await db.$queryRawUnsafe<[{ n: bigint }]>(
    `SELECT COUNT(*) - COUNT(DISTINCT "externalId") AS n FROM branches WHERE source = $1 AND "externalId" IS NOT NULL`,
    source,
  );
  console.log('branches from scrape:', total);
  console.log('duplicate externalIds:', Number(dupes[0].n));

  const byKind = await db.branch.groupBy({ by: ['placeKind'], _count: { _all: true } });
  console.log('\nby placeKind (all sources):');
  for (const r of byKind.sort((a, b) => b._count._all - a._count._all)) {
    console.log(`  ${(r.placeKind ?? 'NULL').padEnd(12)} ${r._count._all}`);
  }

  const nullKindBySource = await db.branch.groupBy({ by: ['source'], _count: { _all: true } });
  const nulls = await db.branch.count({ where: { placeKind: null } });
  console.log(`\nbranches with NULL placeKind: ${nulls} (pre-existing sources, not this scrape)`);
  void nullKindBySource;

  const noCoords = await db.$queryRawUnsafe<{ n: bigint }[]>(
    `SELECT COUNT(*) AS n FROM branches WHERE source = $1 AND (latitude IS NULL OR longitude IS NULL)`,
    source,
  );
  const noName = await db.branch.count({ where: { source, name: '' } });
  const noCity = await db.branch.count({ where: { source, cityId: null } });
  const withRating = await db.branch.count({ where: { source, rating: { not: null } } });
  console.log(`\nmissing coordinates: ${Number(noCoords[0].n)}`);
  console.log(`empty names: ${noName}`);
  console.log(`rural / no city: ${noCity} (still discoverable by coordinates)`);
  console.log(`with rating: ${withRating}/${total} (optional - the rest must still show)`);

  // The app must be able to show every place with no rating at all.
  const unrated = await db.branch.findMany({
    where: { source, rating: null },
    take: 3,
    select: {
      name: true,
      placeKind: true,
      rating: true,
      city: { select: { nameEn: true } },
      restaurant: { select: { name: true, cuisines: { select: { cuisine: { select: { slug: true } } } } } },
    },
  });
  console.log('\nsample unrated places (must still be displayable):');
  console.log(JSON.stringify(unrated, null, 2));

  const rated = await db.branch.findMany({
    where: { source, rating: { not: null } },
    take: 2,
    select: {
      name: true,
      rating: true,
      reviewsCount: true,
      googleMapsUrl: true,
      sourceAcquiredAt: true,
      city: { select: { nameEn: true } },
    },
  });
  console.log('\nsample rated places:');
  console.log(JSON.stringify(rated, null, 2));

  // Cuisine coverage: taste mode needs a cuisine to match on.
  const noCuisine = await db.restaurant.count({
    where: { source, cuisines: { none: {} } },
  });
  const restTotal = await db.restaurant.count({ where: { source } });
  console.log(`\nrestaurants from scrape: ${restTotal}`);
  console.log(`  with no cuisine tag: ${noCuisine}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());