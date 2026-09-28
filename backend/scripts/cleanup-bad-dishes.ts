/**
 * scripts/cleanup-bad-dishes.ts
 *
 * Removes the 14 CSV-imported dishes that were created from a buggy parser
 * (which split on commas inside cuisine columns and created dishes like
 * "Pizza", "Egyptian", "Desserts" instead of real menu items).
 *
 * Then runs the corrected import script to re-add the proper 28 dishes.
 */

import dotenv from 'dotenv';
dotenv.config();
import { PrismaClient } from '@prisma/client';

const dbUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
const prisma = new PrismaClient({ datasourceUrl: dbUrl });

async function withRetry<T>(fn: () => Promise<T>, label = 'op'): Promise<T> {
  let lastErr: any;
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      return await fn();
    } catch (e: any) {
      lastErr = e;
      if (attempt === 5) throw e;
      const msg = String(e.message || '').split('\n')[0];
      console.log(`  [${attempt}/5] ${label} retry: ${msg}`);
      await new Promise(r => setTimeout(r, 2000 * attempt));
    }
  }
  throw lastErr;
}

(async () => {
  try {
    // Show before
    const before = await withRetry(
      () => prisma.dish.findMany({
        where: { source: 'CSV' },
        include: { menu: { include: { restaurant: true } } },
      }),
      'fetch CSV dishes'
    );
    console.log(`Found ${before.length} CSV dishes in DB`);

    // Delete all CSV dishes (and their price history, tags, categories)
    const csvDishIds = before.map(d => d.id);
    if (csvDishIds.length === 0) {
      console.log('Nothing to clean.');
      return;
    }

    console.log('\n🧹 Cleaning up bad CSV dishes...');
    await withRetry(() => prisma.dishPriceHistory.deleteMany({ where: { dishId: { in: csvDishIds } } }), 'delete price history');
    await withRetry(() => prisma.dishAttribute.deleteMany({ where: { dishId: { in: csvDishIds } } }), 'delete attributes');
    await withRetry(() => prisma.dishIngredient.deleteMany({ where: { dishId: { in: csvDishIds } } }), 'delete ingredients');
    await withRetry(() => prisma.dishTag.deleteMany({ where: { dishId: { in: csvDishIds } } }), 'delete tags');
    await withRetry(() => prisma.dishCategoryAssignment.deleteMany({ where: { dishId: { in: csvDishIds } } }), 'delete category assignments');
    await withRetry(() => prisma.dish.deleteMany({ where: { id: { in: csvDishIds } } }), 'delete dishes');

    // Also clean up CSV menus and branches for these fake restaurants
    const csvMenus = await withRetry(
      () => prisma.menu.findMany({ where: { source: 'CSV' } }),
      'fetch CSV menus'
    );
    console.log(`Found ${csvMenus.length} CSV menus to remove`);
    await withRetry(() => prisma.menu.deleteMany({ where: { id: { in: csvMenus.map(m => m.id) } } }), 'delete menus');

    const csvBranches = await withRetry(
      () => prisma.branch.findMany({ where: { source: 'CSV' } }),
      'fetch CSV branches'
    );
    console.log(`Found ${csvBranches.length} CSV branches to remove`);
    await withRetry(() => prisma.branch.deleteMany({ where: { id: { in: csvBranches.map(b => b.id) } } }), 'delete branches');

    // Clean up the fake restaurants (those with source=CSV AND no other branches)
    const fakeRestaurants = await withRetry(
      () => prisma.restaurant.findMany({
        where: {
          source: 'CSV',
          branches: { none: {} },
        },
      }),
      'fetch fake restaurants'
    );
    console.log(`Found ${fakeRestaurants.length} fake restaurants (source=CSV, no branches)`);
    if (fakeRestaurants.length > 0) {
      await withRetry(
        () => prisma.restaurant.deleteMany({ where: { id: { in: fakeRestaurants.map(r => r.id) } } }),
        'delete fake restaurants'
      );
    }

    const after = await withRetry(() => prisma.dish.count(), 'count after');
    console.log(`\n✅ Cleanup done. Total dishes now: ${after}`);
  } finally {
    await prisma.$disconnect();
  }
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
