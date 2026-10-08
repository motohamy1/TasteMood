import dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

async function main() {
  const [
    restaurants,
    branches,
    activeBranches,
    cities,
    governorates,
    cuisines,
    menus,
    dishes,
    placePhotos,
  ] = await Promise.all([
    db.restaurant.count(),
    db.branch.count(),
    db.branch.count({ where: { status: 'ACTIVE' } }),
    db.city.count(),
    db.governorate.count(),
    db.cuisine.count(),
    db.menu.count(),
    db.dish.count(),
    db.placePhoto.count(),
  ]);

  console.log('--- counts ---');
  console.log({ restaurants, branches, activeBranches, cities, governorates, cuisines, menus, dishes, placePhotos });

  console.log('\n--- branches by source ---');
  const bySource = await db.branch.groupBy({ by: ['source'], _count: { _all: true } });
  console.log(bySource.map((r) => ({ source: r.source, n: r._count._all })));

  console.log('\n--- branches by status ---');
  const byStatus = await db.branch.groupBy({ by: ['status'], _count: { _all: true } });
  console.log(byStatus.map((r) => ({ status: r.status, n: r._count._all })));

  console.log('\n--- cities with places ---');
  const grouped = await db.branch.groupBy({
    by: ['cityId'],
    _count: { _all: true },
  });
  const cityRows = await db.city.findMany({
    select: { id: true, nameEn: true, nameAr: true, slug: true },
  });
  const byCityId = new Map(cityRows.map((c) => [c.id, c]));
  const lines = grouped
    .map((g) => {
      const c = byCityId.get(g.cityId ?? '');
      return `${c ? `${c.nameEn} (${c.slug})` : 'NO CITY'}: ${g._count._all}`;
    })
    .sort();
  console.log(lines.join('\n'));

  const noCity = grouped.find((g) => g.cityId === null);
  console.log(`\nrural branches with no city: ${noCity?._count._all ?? 0}`);

  console.log('\n--- sample branches ---');
  const sample = await db.branch.findMany({
    take: 5,
    select: {
      name: true,
      address: true,
      latitude: true,
      longitude: true,
      externalId: true,
      source: true,
      city: { select: { nameEn: true } },
      restaurant: { select: { name: true } },
    },
  });
  console.log(JSON.stringify(sample, null, 2));
}

main()
  .catch((e) => {
    console.error(e.message);
    process.exit(1);
  })
  .finally(() => db.$disconnect());