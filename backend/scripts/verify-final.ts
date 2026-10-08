import dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';

const db = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } });
const SOURCE = 'GMAPS_PLAYWRIGHT';

async function main() {
  const branches = await db.branch.count({ where: { source: SOURCE } });
  const active = await db.branch.count({ where: { source: SOURCE, status: 'ACTIVE' } });
  const restaurants = await db.restaurant.count({ where: { source: SOURCE } });
  const branchRestaurantIds = await db.branch.findMany({
    where: { source: SOURCE },
    select: { restaurantId: true },
  });
  const uniqueIds = new Set(branchRestaurantIds.map((b) => b.restaurantId)).size;

  console.log('--- scrape import, final state ---');
  console.log({ branches, active, restaurants, distinctOwners: uniqueIds });

  console.log('\n--- catalogue overall (the app browses all of it) ---');
  const allActive = await db.branch.count({ where: { status: 'ACTIVE' } });
  const all = await db.branch.count();
  const allRestaurants = await db.restaurant.count();
  console.log({ allBranches: all, activeBranches: allActive, allRestaurants });

  console.log('\n--- active branches by source ---');
  const bySource = await db.branch.groupBy({ by: ['source'], _count: { _all: true } });
  for (const r of bySource.sort((a, b) => b._count._all - a._count._all)) {
    console.log(`  ${r.source.padEnd(18)} ${r._count._all}`);
  }

  console.log('\n--- places by kind (active, whole catalogue) ---');
  const kinds = await db.branch.groupBy({ by: ['placeKind'], _count: { _all: true } });
  for (const r of kinds.sort((a, b) => b._count._all - a._count._all)) {
    console.log(`  ${(r.placeKind ?? 'not classified').padEnd(16)} ${r._count._all}`);
  }

  console.log('\n--- rural places (no city) still active and reachable ---');
  const rural = await db.branch.count({ where: { status: 'ACTIVE', cityId: null } });
  console.log(`  ${rural}`);

  console.log('\n--- top areas by active place count ---');
  const grouped = await db.branch.groupBy({
    by: ['cityId'],
    where: { status: 'ACTIVE' },
    _count: { _all: true },
  });
  const cities = await db.city.findMany({ select: { id: true, nameEn: true, slug: true } });
  const byId = new Map(cities.map((c) => [c.id, c]));
  const lines = grouped
    .map((g) => `${byId.get(g.cityId!)?.nameEn ?? '(rural)'}: ${g._count._all}`)
    .sort((a, b) => Number(b.split(': ')[1]) - Number(a.split(': ')[1]));
  console.log(lines.join('\n'));

  console.log('\n--- does the catalogue need ratings to be shown? ---');
  const unratedActive = await db.branch.count({ where: { status: 'ACTIVE', rating: null } });
  console.log(`  active places with no rating: ${unratedActive} of ${allActive}`);
  console.log('  these must render exactly like rated ones (no blank cards, no hiding)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());