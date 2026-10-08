import dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';
import { normalizeDakahliaFood, readDakahliaFoodFile } from '../src/importer/sources/gmaps-playwright.js';
import { CUISINE_BY_SLUG } from '../src/importer/taxonomy.js';

const db = new PrismaClient();

async function main() {
  const file = await readDakahliaFoodFile('../dakahlia_food/dakahlia_food.json');
  const places = normalizeDakahliaFood(file.rows);

  const kinds = new Map<string, number>();
  for (const p of places) {
    kinds.set(p.placeKind!, (kinds.get(p.placeKind!) ?? 0) + 1);
  }
  console.log('placeKind distribution:');
  for (const [k, n] of [...kinds.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(12)} ${n} (${((n / places.length) * 100).toFixed(1)}%)`);
  }

  const cuisines = new Map<string, number>();
  for (const p of places) {
    for (const c of p.cuisineSlugs) cuisines.set(c, (cuisines.get(c) ?? 0) + 1);
  }
  console.log('\ncuisine distribution (place can carry several):');
  for (const [c, n] of [...cuisines.entries()].sort((a, b) => b[1] - a[1])) {
    const known = CUISINE_BY_SLUG.has(c);
    console.log(`  ${c.padEnd(18)} ${String(n).padStart(4)}  ${known ? '' : '  <-- UNKNOWN SLUG'}`);
  }

  console.log('\nsample of inferred kind + cuisines (first 25):');
  for (const p of places.slice(0, 25)) {
    console.log(`  ${p.placeKind!.padEnd(11)} [${p.cuisineSlugs.join(',')}] ${p.name}`);
  }

  // A name containing "cafe" must not be tagged 'other' as its only cuisine.
  let cafeMislabelled = 0;
  for (const p of places) {
    if (p.placeKind === 'cafe' && !p.cuisineSlugs.some((c) => c === 'cafe-bakery')) cafeMislabelled += 1;
  }
  console.log(`\ncafes not tagged cafe-bakery: ${cafeMislabelled}`);

  const unknown = new Set(db ? [] : []);
  void unknown;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());