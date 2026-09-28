import dotenv from 'dotenv';
dotenv.config();
import { PrismaClient } from '@prisma/client';

const dbUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
let prisma = new PrismaClient({ datasourceUrl: dbUrl });

async function withRetry<T>(fn: () => Promise<T>, label = 'op'): Promise<T> {
  for (let attempt = 1; attempt <= 5; attempt++) {
    try { return await fn(); }
    catch (e: any) {
      const msg = String(e.message || '').split('\n')[0];
      const isConnError = /Can't reach|ECONNRESET|ETIMEDOUT/i.test(msg);
      if (!isConnError || attempt === 5) throw e;
      try { await prisma.$disconnect(); } catch {}
      prisma = new PrismaClient({ datasourceUrl: dbUrl });
      await new Promise(r => setTimeout(r, 2000 * attempt));
    }
  }
  throw new Error('unreachable');
}

(async () => {
  try {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(' TASTEMOOD DATABASE — FINAL STATE');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const totalDishes = await withRetry(() => prisma.dish.count());
    const activeDishes = await withRetry(() => prisma.dish.count({ where: { status: 'ACTIVE' } }));
    const csvDishes = await withRetry(() => prisma.dish.count({ where: { source: 'CSV' } }));

    const totalRestaurants = await withRetry(() => prisma.restaurant.count());
    const totalBranches = await withRetry(() => prisma.branch.count());
    const csvBranches = await withRetry(() => prisma.branch.count({ where: { source: 'CSV' } }));
    const branchesWithCover = await withRetry(() => prisma.branch.count({ where: { coverImageUrl: { not: null } } }));

    const totalPhotos = await withRetry(() => prisma.placePhoto.count());
    const csvPhotos = await withRetry(() => prisma.placePhoto.count({ where: { source: 'CSV_GMAPS' } }));
    const wikimediaPhotos = await withRetry(() => prisma.placePhoto.count({ where: { source: 'WIKIMEDIA' } }));
    const generatedPhotos = await withRetry(() => prisma.placePhoto.count({ where: { source: 'GENERATED' } }));

    const totalMenus = await withRetry(() => prisma.menu.count());

    console.log('🍽️  DISHES');
    console.log(`  Total:        ${totalDishes}`);
    console.log(`  Active:       ${activeDishes}`);
    console.log(`  CSV-sourced:  ${csvDishes} (new in this session)`);

    console.log('\n🏪 RESTAURANTS & BRANCHES');
    console.log(`  Restaurants:  ${totalRestaurants}`);
    console.log(`  Branches:     ${totalBranches}`);
    console.log(`  CSV branches: ${csvBranches} (new in this session)`);
    console.log(`  With cover:   ${branchesWithCover}`);

    console.log('\n📸 PHOTOS');
    console.log(`  Total PlacePhoto rows:  ${totalPhotos}`);
    console.log(`  • Google Maps (CSV):    ${csvPhotos}`);
    console.log(`  • Wikimedia Commons:    ${wikimediaPhotos}`);
    console.log(`  • Generated placeholders: ${generatedPhotos}`);

    console.log('\n📋 MENUS');
    console.log(`  Total menus:  ${totalMenus}`);

    console.log('\n' + '═'.repeat(60));
    console.log(' 9 NEW RESTAURANTS (from CSV — with full data):');
    console.log('═'.repeat(60));
    const csvRestaurants = await withRetry(
      () => prisma.restaurant.findMany({
        where: { source: 'CSV' },
        include: {
          branches: true,
          cuisines: { include: { cuisine: true } },
          menus: { include: { dishes: true } },
        },
        orderBy: { name: 'asc' },
      }),
      'fetch CSV restaurants'
    );
    for (const r of csvRestaurants) {
      const branch = r.branches[0];
      const dishes = r.menus.flatMap(m => m.dishes);
      const cuisines = r.cuisines.map(c => c.cuisine.name).join(', ');
      console.log(`\n  📍 ${r.name}`);
      console.log(`     City:       ${branch?.address || '?'}`);
      console.log(`     Cuisines:   ${cuisines || '(none)'}`);
      console.log(`     Dishes:     ${dishes.length}`);
      console.log(`     Cover:      ${branch?.coverImageUrl ? '✓' : '✗'}`);
      console.log(`     Photos:     ${branch ? '' : '?'}`);
    }
  } finally {
    await prisma.$disconnect();
  }
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
