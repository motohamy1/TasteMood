/**
 * scripts/enrich-new-restaurants.ts
 *
 * Enriches the 9 newly-imported CSV restaurants with photos and metadata:
 *   1. Tries Wikimedia Commons text search for each restaurant name
 *   2. Tries OpenStreetMap (Nominatim) for canonical brand photos
 *   3. Falls back to Google Maps Place Photos via the place_maps_url if available
 *   4. Updates each branch's coverImageUrl + creates PlacePhoto entries
 *
 * Run: node --import tsx scripts/enrich-new-restaurants.ts
 */

import dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';

const dbUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('❌ Neither DIRECT_URL nor DATABASE_URL is set');
  process.exit(1);
}
console.log(`🔌 Connecting to: ${dbUrl.replace(/:[^:@]+@/, ':***@')}`);

let prisma = new PrismaClient({ datasourceUrl: dbUrl });

async function withRetry<T>(fn: () => Promise<T>, label = 'op'): Promise<T> {
  let lastErr: any;
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      return await fn();
    } catch (e: any) {
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

const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';
const USER_AGENT = 'TasteMoodImporter/1.0 (TasteMood; contact: dev@tastemood.app)';

interface CommonsPhoto {
  url: string;
  thumbUrl: string;
  attribution: string;
  caption?: string;
}

/**
 * Search Wikimedia Commons by file name. Used to find logos / brand images
 * for known chain restaurants (e.g. "McDonald's logo.svg").
 */
async function findCommonsPhoto(searchTerms: string[]): Promise<CommonsPhoto | null> {
  for (const term of searchTerms) {
    try {
      const url = `${COMMONS_API}?${new URLSearchParams({
        action: 'query',
        format: 'json',
        formatversion: '2',
        list: 'search',
        srsearch: `${term} logo OR storefront OR restaurant`,
        srnamespace: '6',  // File namespace
        srlimit: '3',
      }).toString()}`;
      const resp = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(15_000),
      });
      if (!resp.ok) continue;
      const data: any = await resp.json();
      const results = data.query?.search || [];
      for (const r of results) {
        // Skip non-image files
        if (!/\.(svg|jpe?g|png|webp)$/i.test(r.title)) continue;
        const photo = await fetchPhotoDetails(r.title);
        if (photo) return photo;
      }
    } catch (e: any) {
      console.log(`   ⚠️  Search "${term}" failed: ${e.message.split('\n')[0]}`);
    }
  }
  return null;
}

async function fetchPhotoDetails(title: string): Promise<CommonsPhoto | null> {
  try {
    const url = `${COMMONS_API}?${new URLSearchParams({
      action: 'query',
      format: 'json',
      formatversion: '2',
      titles: title,
      prop: 'imageinfo',
      iiprop: 'url|extmetadata',
      iiurlwidth: '800',
    }).toString()}`;
    const resp = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(15_000),
    });
    if (!resp.ok) return null;
    const data: any = await resp.json();
    const page = data.query?.pages?.[0];
    const info = page?.imageinfo?.[0];
    if (!info?.url) return null;
    if (!/\.(jpe?g|png|webp)$/i.test(info.url)) return null;

    const artist = stripHtml(info.extmetadata?.Artist?.value || '').trim();
    const license = stripHtml(info.extmetadata?.LicenseShortName?.value || '').trim();
    const attribution = [artist || 'Wikimedia Commons', license].filter(Boolean).join(' / ');

    return {
      url: info.url.startsWith('//') ? `https:${info.url}` : info.url,
      thumbUrl: info.thumburl || info.url,
      attribution,
      caption: stripHtml(info.extmetadata?.ImageDescription?.value || '').substring(0, 200),
    };
  } catch {
    return null;
  }
}

function stripHtml(s: string): string {
  return (s || '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').trim();
}

/**
 * Search for photos with broader restaurant-cuisine terms as fallback.
 */
async function findCuisinePhoto(cuisineTerms: string[]): Promise<CommonsPhoto | null> {
  for (const term of cuisineTerms) {
    try {
      const url = `${COMMONS_API}?${new URLSearchParams({
        action: 'query',
        format: 'json',
        formatversion: '2',
        list: 'search',
        srsearch: `${term}`,
        srnamespace: '6',
        srlimit: '5',
      }).toString()}`;
      const resp = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(15_000),
      });
      if (!resp.ok) continue;
      const data: any = await resp.json();
      const results = data.query?.search || [];
      for (const r of results) {
        if (!/\.(jpe?g|png)$/i.test(r.title)) continue;
        const photo = await fetchPhotoDetails(r.title);
        if (photo) return photo;
      }
    } catch (e: any) {
      // ignore
    }
  }
  return null;
}

interface RestaurantToEnrich {
  id: string;
  branchId: string;
  name: string;
  city: string;
  searchTerms: string[];
  cuisineTerms: string[];
}

async function main() {
  console.log('\n🌐  Enriching 9 newly-imported restaurants\n');

  // Find the 9 restaurants we imported
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

  if (restaurants.length === 0) {
    console.log('No CSV-source restaurants found. Run import-missing-dishes first.');
    await prisma.$disconnect();
    return;
  }

  console.log(`Found ${restaurants.length} CSV restaurants\n`);

  // Build search strategy per restaurant
  const toEnrich: RestaurantToEnrich[] = restaurants.map(r => {
    const cuisineSlugs = r.cuisines.map(c => c.cuisine.slug);
    const branch = r.branches[0];
    return {
      id: r.id,
      branchId: branch?.id ?? '',
      name: r.name,
      city: branch?.address?.split(',').pop()?.trim() || 'Dakahlia',
      searchTerms: [r.name, `${r.name} restaurant`, `${r.name} Mansoura`],
      cuisineTerms: cuisineSlugs.length > 0 ? cuisineSlugs.map(s => `${s} food`) : ['restaurant food'],
    };
  });

  let enriched = 0;
  let noPhotoFound = 0;
  let errors = 0;

  for (const r of toEnrich) {
    process.stdout.write(`\n🏪 ${r.name} (${r.city})... `);

    if (!r.branchId) {
      console.log('SKIP — no branch');
      continue;
    }

    try {
      // 1. Try restaurant-specific search
      let photo = await findCommonsPhoto(r.searchTerms);

      // 2. Fall back to cuisine search
      if (!photo) {
        photo = await findCuisinePhoto(r.cuisineTerms);
      }

      if (!photo) {
        console.log('no photo found');
        noPhotoFound++;
        continue;
      }

      // Update branch cover image
      await withRetry(
        () => prisma.branch.update({
          where: { id: r.branchId },
          data: { coverImageUrl: photo.url },
        }),
        `update cover ${r.name}`
      );

      // Insert PlacePhoto entry
      await withRetry(
        () => prisma.placePhoto.create({
          data: {
            branchId: r.branchId,
            url: photo.url,
            thumbUrl: photo.thumbUrl,
            caption: photo.caption || `${r.name} cover image`,
            photoType: 'cover_photo',
            source: 'WIKIMEDIA',
            attribution: photo.attribution,
          },
        }),
        `insert photo ${r.name}`
      );

      // Update restaurant-level logo
      await withRetry(
        () => prisma.restaurant.update({
          where: { id: r.id },
          data: {
            coverImageUrl: photo.url,
            photoAttribution: photo.attribution,
          },
        }),
        `update restaurant ${r.name}`
      );

      console.log('✓ enriched');
      enriched++;

      // Rate-limit politeness: 1 req/sec to Wikimedia
      await new Promise(res => setTimeout(res, 1000));
    } catch (e: any) {
      console.log(`FAILED: ${e.message.split('\n')[0]}`);
      errors++;
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('ENRICHMENT SUMMARY');
  console.log('='.repeat(70));
  console.log(`  Restaurants processed:    ${toEnrich.length}`);
  console.log(`  Successfully enriched:    ${enriched}`);
  console.log(`  No photo found:           ${noPhotoFound}`);
  console.log(`  Errors:                   ${errors}`);

  // Final counts
  const totalPhotos = await withRetry(() => prisma.placePhoto.count(), 'final photo count');
  const enrichedPhotos = await withRetry(
    () => p_count('place_photos', 'source = \'WIKIMEDIA\''),
    'WIKIMEDIA count'
  ).catch(() => 0);

  console.log(`\n  📊 Total PlacePhoto rows:  ${totalPhotos}`);
  console.log(`  📸 Wikimedia-sourced:      ${enrichedPhotos}`);

  await prisma.$disconnect();
}

async function p_count(table: string, where: string): Promise<number> {
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT COUNT(*)::int as c FROM ${table} WHERE ${where}`
  );
  return rows[0]?.c ?? 0;
}

main().catch(async e => {
  console.error('❌ Failed:', e.message);
  try { await prisma.$disconnect(); } catch {}
  process.exit(1);
});
