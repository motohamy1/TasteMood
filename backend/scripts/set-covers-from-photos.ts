/**
 * scripts/set-covers-from-photos.ts
 *
 * For each branch that has PlacePhoto entries, sets the branch's
 * coverImageUrl to the best available photo:
 *   1. Existing cover_photo (if any)
 *   2. First menu_board photo (highest visibility)
 *   3. First product_photo
 *   4. First photo overall
 *
 * Run: node --import tsx scripts/set-covers-from-photos.ts
 */

import dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';

const dbUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
let prisma = new PrismaClient({ datasourceUrl: dbUrl });

async function withRetry<T>(fn: () => Promise<T>, label = 'op'): Promise<T> {
  let lastErr: any;
  for (let attempt = 1; attempt <= 5; attempt++) {
    try { return await fn(); }
    catch (e: any) {
      lastErr = e;
      const msg = String(e.message || '').split('\n')[0];
      const isConnError = /Can't reach|ECONNRESET|ETIMEDOUT|connection terminated/i.test(msg);
      if (!isConnError || attempt === 5) throw e;
      console.log(`   ⚠️  ${label} retry ${attempt}/5: ${msg}`);
      try { await prisma.$disconnect(); } catch {}
      prisma = new PrismaClient({ datasourceUrl: dbUrl });
      await new Promise(r => setTimeout(r, 1500 * attempt));
    }
  }
  throw lastErr;
}

const TYPE_PRIORITY = [
  'cover_photo',
  'product_photo',
  'menu_board',
  'menu',
  'summary',
  'menu_link',
];

async function main() {
  console.log('\n🖼️  Setting branch cover images from existing photos\n');

  // Find all branches that have photos but no cover
  const branches = await withRetry(
    () => prisma.branch.findMany({
      where: {
        coverImageUrl: null,
        photos: { some: {} },
      },
      select: { id: true, name: true, restaurant: { select: { name: true } } },
    }),
    'fetch branches'
  );

  console.log(`Found ${branches.length} branches with photos but no cover\n`);

  let updated = 0;
  let skipped = 0;

  for (const branch of branches) {
    // Get all photos for this branch, sorted by priority
    const photos = await withRetry(
      () => prisma.placePhoto.findMany({
        where: { branchId: branch.id },
        select: { url: true, photoType: true, caption: true, attribution: true },
      }),
      `fetch photos for ${branch.name}`
    );

    if (photos.length === 0) {
      skipped++;
      continue;
    }

    // Sort by type priority, then by caption length desc (more descriptive)
    photos.sort((a, b) => {
      const pa = TYPE_PRIORITY.indexOf(a.photoType);
      const pb = TYPE_PRIORITY.indexOf(b.photoType);
      const ai = pa === -1 ? 99 : pa;
      const bi = pb === -1 ? 99 : pb;
      if (ai !== bi) return ai - bi;
      return (b.caption?.length || 0) - (a.caption?.length || 0);
    });

    const best = photos[0];
    const caption = (best.caption || '').slice(0, 100);

    try {
      await withRetry(
        () => prisma.branch.update({
          where: { id: branch.id },
          data: {
            coverImageUrl: best.url,
            photoAttribution: best.attribution || 'Google Maps contributor',
          },
        }),
        `set cover ${branch.name}`
      );

      const label = `${branch.restaurant.name} / ${branch.name}`.padEnd(40);
      console.log(`   ✓ ${label} → ${best.photoType}${caption ? ` (${caption})` : ''}`);
      updated++;
    } catch (e: any) {
      console.log(`   ❌ ${branch.name}: ${e.message.split('\n')[0]}`);
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('SUMMARY');
  console.log('='.repeat(70));
  console.log(`  Branches updated:  ${updated}/${branches.length}`);
  console.log(`  Branches skipped:  ${skipped}`);

  // Stats: how many branches have covers now?
  const withCover = await withRetry(() => prisma.branch.count({ where: { coverImageUrl: { not: null } } }), 'with cover');
  const totalActive = await withRetry(() => prisma.branch.count({ where: { status: 'ACTIVE' } }), 'total active');
  console.log(`\n  📊 Active branches with cover: ${withCover}/${totalActive} (${Math.round(withCover*100/totalActive)}%)`);

  await prisma.$disconnect();
}

main().catch(async e => {
  console.error('❌ Failed:', e.message);
  try { await prisma.$disconnect(); } catch {}
  process.exit(1);
});
