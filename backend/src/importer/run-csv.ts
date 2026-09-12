import dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';
import { groupPlaces } from './dedup.js';
import { namesMatch, slugify } from './normalize.js';
import { ensureReferenceData, loadGovernorateContext, upsertGroup } from './upsert.js';
import { readMenuCsv, readPlaceCsv } from './sources/csv.js';

const db = new PrismaClient(process.env.DIRECT_URL ? { datasourceUrl: process.env.DIRECT_URL } : undefined);
const governorate = process.argv.find((arg) => arg.startsWith('--governorate='))?.split('=')[1] ?? 'dakahlia';
const publish = process.argv.includes('--publish');
const placesFile = process.argv.find((arg) => arg.startsWith('--places='))?.split('=')[1] ?? '../dakahlia_restaurants_cafes.csv';
const menuFile = process.argv.find((arg) => arg.startsWith('--menus='))?.split('=')[1] ?? '../dakahlia_comprehensive_food_data.csv';

async function main() {
  await ensureReferenceData(db);
  const context = await loadGovernorateContext(db, governorate);
  const places = await readPlaceCsv(placesFile);
  const groups = groupPlaces(places);
  const summary = { restaurantsCreated: 0, restaurantsUpdated: 0, branchesCreated: 0, branchesUpdated: 0, branchesDeactivated: 0 };

  for (const group of groups) {
    await upsertGroup(db, group, context, { publish }, summary);
  }

  const menuRows = await readMenuCsv(menuFile);
  let dishesWritten = 0;
  const unmatchedRestaurants = new Set<string>();
  for (const row of menuRows) {
    const restaurant = await findRestaurant(row.restaurantName);
    if (!restaurant) {
      unmatchedRestaurants.add(row.restaurantName);
      continue;
    }
    const menu = await db.menu.upsert({
      where: { id: `${restaurant.id}-csv-menu` },
      create: { id: `${restaurant.id}-csv-menu`, restaurantId: restaurant.id, name: 'CSV menu import', source: 'CSV', status: publish ? 'ACTIVE' : 'DRAFT' },
      update: { status: publish ? 'ACTIVE' : 'DRAFT' },
    });
    const existing = await db.dish.findFirst({ where: { menuId: menu.id, name: row.itemName } });
    const data = {
      name: row.itemName,
      slug: `${slugify(row.itemName) || 'dish'}-${menu.id.slice(0, 6)}`,
      description: row.description,
      price: row.price,
      currency: 'EGP',
      status: publish ? ('ACTIVE' as const) : ('DRAFT' as const),
      verificationStatus: 'NEEDS_REVIEW' as const,
      source: 'CSV',
    };
    if (existing) await db.dish.update({ where: { id: existing.id }, data });
    else await db.dish.create({ data: { ...data, menuId: menu.id, priceHistory: { create: { price: row.price, currency: 'EGP', source: 'CSV' } } } });
    dishesWritten += 1;
  }

  console.log(`CSV import complete: ${places.length} places, ${groups.length} groups, ${dishesWritten}/${menuRows.length} menu rows matched.`);
  if (unmatchedRestaurants.size > 0) {
    console.log('Menu rows without a matching coordinate-backed place:', [...unmatchedRestaurants].join(', '));
    console.log('Keep these rows pending until their place coordinates and source identity are verified.');
  }
  console.log(`Records are ${publish ? 'ACTIVE' : 'DRAFT + NEEDS_REVIEW'}; use --publish only after review.`);
}

async function findRestaurant(name: string) {
  const candidates = await db.restaurant.findMany({ where: { source: 'CSV_PLACES' }, select: { id: true, name: true, nameEn: true } });
  return candidates.find((candidate) => namesMatch(candidate.name, name) || namesMatch(candidate.nameEn ?? '', name)) ?? null;
}

main().catch((error) => {
  console.error('CSV import failed:', error);
  process.exitCode = 1;
}).finally(() => db.$disconnect());