/**
 * scripts/add-placeholder-covers.ts
 *
 * Since Wikimedia Commons has no coverage for these local Egyptian
 * restaurants, we generate cuisine-based placeholder cover images using
 * SVG emoji icons served from a static asset path.
 *
 * For each of the 9 newly-imported CSV restaurants, we:
 *   1. Look up the restaurant's cuisine types
 *   2. Pick a representative emoji icon for the cuisine
 *   3. Generate a deterministic gradient + emoji SVG data URI
 *   4. Save it as the coverImageUrl + insert a PlacePhoto entry
 *
 * Real photos would come from manual owner uploads or Google Places API
 * (which requires API key + billing); this script is the free fallback.
 *
 * Run: node --import tsx scripts/add-placeholder-covers.ts
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

// Cuisine → emoji + gradient palette mapping
const CUISINE_VISUALS: Record<string, { emoji: string; colors: [string, string] }> = {
  pizza: { emoji: '🍕', colors: ['#FF6B35', '#F7931E'] },
  burger: { emoji: '🍔', colors: ['#C72C2C', '#8B4513'] },
  shawarma: { emoji: '🌯', colors: ['#D4A574', '#8B5A3C'] },
  'fried-chicken': { emoji: '🍗', colors: ['#F4A460', '#8B4513'] },
  'oriental-grills': { emoji: '🍢', colors: ['#8B4513', '#654321'] },
  syrian: { emoji: '🥙', colors: ['#D4A574', '#8B5A3C'] },
  egyptian: { emoji: '🍚', colors: ['#DAA520', '#CD853F'] },
  lebanese: { emoji: '🥗', colors: ['#228B22', '#006400'] },
  desserts: { emoji: '🍰', colors: ['#FFB6C1', '#FF69B4'] },
  koshary: { emoji: '🍜', colors: ['#DAA520', '#8B4513'] },
  cafe: { emoji: '☕', colors: ['#6F4E37', '#3E2723'] },
  international: { emoji: '🍽️', colors: ['#4682B4', '#1E3A5F'] },
  'foul-falafel': { emoji: '🧆', colors: ['#DAA520', '#8B6914'] },
  seafood: { emoji: '🐟', colors: ['#4682B4', '#191970'] },
  coffee: { emoji: '☕', colors: ['#6F4E37', '#3E2723'] },
  chicken: { emoji: '🍗', colors: ['#F4A460', '#8B4513'] },
  other: { emoji: '🍴', colors: ['#708090', '#2F4F4F'] },
};

function svgDataUri(emoji: string, color1: string, color2: string, label: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${color1}"/>
        <stop offset="100%" stop-color="${color2}"/>
      </linearGradient>
    </defs>
    <rect width="800" height="600" fill="url(#bg)"/>
    <text x="400" y="280" font-size="240" text-anchor="middle" dominant-baseline="middle">${emoji}</text>
    <text x="400" y="450" font-family="system-ui, sans-serif" font-size="32" font-weight="700"
          text-anchor="middle" fill="white" opacity="0.95">${escapeXml(label)}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function pickVisual(cuisineSlugs: string[]): { emoji: string; colors: [string, string] } {
  for (const slug of cuisineSlugs) {
    if (CUISINE_VISUALS[slug]) return CUISINE_VISUALS[slug];
  }
  return CUISINE_VISUALS.other;
}

async function main() {
  console.log('\n🎨  Generating cuisine placeholder cover images\n');

  const restaurants = await withRetry(
    () => prisma.restaurant.findMany({
      where: { source: 'CSV' },
      include: {
        branches: { where: { source: 'CSV' } },
        cuisines: { include: { cuisine: true } },
      },
    }),
    'fetch CSV restaurants'
  );

  console.log(`Found ${restaurants.length} CSV restaurants\n`);

  let updated = 0;
  for (const r of restaurants) {
    const branch = r.branches[0];
    if (!branch) continue;

    const cuisineSlugs = r.cuisines.map(c => c.cuisine.slug);
    const visual = pickVisual(cuisineSlugs);
    const dataUri = svgDataUri(visual.emoji, visual.colors[0], visual.colors[1], r.name);

    try {
      // Update branch cover
      await withRetry(
        () => prisma.branch.update({
          where: { id: branch.id },
          data: { coverImageUrl: dataUri },
        }),
        `update branch ${r.name}`
      );

      // Update restaurant cover
      await withRetry(
        () => prisma.restaurant.update({
          where: { id: r.id },
          data: {
            coverImageUrl: dataUri,
            photoAttribution: `Generated placeholder (${visual.emoji}) for ${r.name}. Real photos pending owner upload.`,
          },
        }),
        `update restaurant ${r.name}`
      );

      // Insert PlacePhoto entry
      await withRetry(
        () => prisma.placePhoto.create({
          data: {
            branchId: branch.id,
            url: dataUri,
            thumbUrl: dataUri,
            caption: `${r.name} cover (placeholder)`,
            photoType: 'cover_photo',
            source: 'GENERATED',
            attribution: `Generated placeholder (${visual.emoji}) for ${r.name}`,
          },
        }),
        `insert photo ${r.name}`
      );

      console.log(`   ✓ ${r.name.padEnd(30)} ${visual.emoji}  ${visual.colors[0]}→${visual.colors[1]}`);
      updated++;
    } catch (e: any) {
      console.log(`   ❌ ${r.name}: ${e.message || JSON.stringify(e).substring(0, 200)}`);
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('SUMMARY');
  console.log('='.repeat(70));
  console.log(`  Restaurants updated:  ${updated}/${restaurants.length}`);
  console.log(`  Cover images:         ${updated} generated SVGs`);
  console.log(`  PlacePhotos added:    ${updated}`);

  const total = await withRetry(() => prisma.placePhoto.count(), 'final count');
  console.log(`\n  📊 Total PlacePhotos in DB: ${total}`);

  await prisma.$disconnect();
}

main().catch(async e => {
  console.error('❌ Failed:', e.message);
  try { await prisma.$disconnect(); } catch {}
  process.exit(1);
});
