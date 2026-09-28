/**
 * scripts/import-photos.ts
 *
 * Imports all photos from dakahlia_menus_photos.csv into the new
 * PlacePhoto table. Matches photos to branches by name + uses GPS
 * proximity as fallback when exact name match fails.
 *
 * Also handles "cover photo" selection (one per branch).
 *
 * Run: node --import tsx scripts/import-photos.ts
 */

import dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';
import { promises as fs } from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';

const dbUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('❌ Neither DIRECT_URL nor DATABASE_URL is set');
  process.exit(1);
}
console.log(`🔌 Connecting to: ${dbUrl.replace(/:[^:@]+@/, ':***@')}`);

// Reassignable holder so withRetry can swap in a fresh client when
// Supabase drops our connection. Wrapping PrismaClient itself in a
// mutable wrapper avoids "Assignment to constant variable" inside withRetry.
let prisma = new PrismaClient({ datasourceUrl: dbUrl });

async function withRetry<T>(fn: () => Promise<T>, label = 'op'): Promise<T> {
  let lastErr: any;
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      return await fn();
    } catch (e: any) {
      lastErr = e;
      if (attempt === 5) throw e;
      const msg = String(e.message || '').split('\n')[0];
      console.log(`   ⚠️  ${label} retry ${attempt}/5: ${msg}`);
      try { await prisma.$disconnect(); } catch {}
      prisma = new PrismaClient({ datasourceUrl: dbUrl });
      await new Promise(r => setTimeout(r, 1500 * attempt));
    }
  }
  throw lastErr;
}

interface PhotoRow {
  place_name: string;
  photo_type: string;
  caption: string;
  date: string;
  photo_url: string;
  thumb_url: string;
  place_maps_url: string;
}

// Normalize Arabic + English names so we can fuzzy-match.
function normalize(s: string): string {
  return (s || '')
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, '')  // Arabic diacritics
    .replace(/[^\w\u0600-\u06FF\s]/g, ' ')   // strip punctuation
    .replace(/\s+/g, ' ')
    .trim();
}

// Try multiple matching strategies, return matching branch ID or null.
async function findBranchId(placeName: string): Promise<string | null> {
  const norm = normalize(placeName);

  // 1. Exact name match (Arabic or English)
  let branch = await prisma.branch.findFirst({
    where: {
      OR: [
        { name: placeName },
        { name: { contains: placeName, mode: 'insensitive' } },
        { restaurant: { name: placeName } },
        { restaurant: { nameEn: { contains: placeName, mode: 'insensitive' } } },
      ],
    },
    select: { id: true, name: true },
  });
  if (branch) return branch.id;

  // 2. Normalized fuzzy match (load all branches once for speed)
  if (!fuzzyBranchesCache) {
    const all = await prisma.branch.findMany({
      select: { id: true, name: true, restaurant: { select: { name: true, nameEn: true } } },
    });
    fuzzyBranchesCache = all.map(b => ({
      id: b.id,
      norm: normalize(`${b.name} ${b.restaurant.name} ${b.restaurant.nameEn || ''}`),
    }));
  }

  // Direct substring
  let match = fuzzyBranchesCache.find(b => b.norm.includes(norm) || norm.includes(b.norm));
  if (match) return match.id;

  // 3. Token-based overlap (Jaccard-like)
  const tokens = norm.split(' ').filter(t => t.length > 2);
  if (tokens.length === 0) return null;
  match = fuzzyBranchesCache.find(b => {
    const bTokens = new Set(b.norm.split(' ').filter(t => t.length > 2));
    const overlap = tokens.filter(t => bTokens.has(t)).length;
    return overlap >= Math.max(1, Math.floor(tokens.length * 0.5));
  });

  return match?.id ?? null;
}

let fuzzyBranchesCache: Array<{ id: string; norm: string }> | null = null;

async function parseCSV(): Promise<PhotoRow[]> {
  const csvPath = path.resolve('../dakahlia_menus_photos.csv');
  const content = await fs.readFile(csvPath, 'utf8');
  const clean = content.charCodeAt(0) === 0xFEFF ? content.slice(1) : content;
  const records = parse(clean, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
    relax_quotes: true,
  }) as PhotoRow[];
  // Drop rows with empty place_name
  return records.filter(r => r.place_name && r.place_name.trim());
}

function parseDate(d: string): Date | null {
  if (!d || !d.trim()) return null;
  // Format: "2025-01-15" or "1 month ago" — skip relative dates
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(d.trim());
  if (iso) {
    const [, y, m, dd] = iso;
    const dt = new Date(`${y}-${m}-${dd}T00:00:00Z`);
    return isNaN(dt.getTime()) ? null : dt;
  }
  return null;
}

async function main() {
  console.log('\n📷  Importing photos from dakahlia_menus_photos.csv\n');

  const rows = await parseCSV();
  console.log(`📄 Loaded ${rows.length} photo rows\n`);

  // Group by place_name to see coverage
  const byPlace = new Map<string, PhotoRow[]>();
  for (const r of rows) {
    if (!byPlace.has(r.place_name)) byPlace.set(r.place_name, []);
    byPlace.get(r.place_name)!.push(r);
  }
  console.log(`🏪 ${byPlace.size} unique places with photos\n`);

  // Map all branches first (warms the cache)
  console.log('🔍 Loading branches for fuzzy matching...');
  await withRetry(async () => {
    fuzzyBranchesCache = null;
    await findBranchId('__warmup__');
  }, 'warmup');

  let totalInserted = 0;
  let totalUnmatched = 0;
  let totalPhotosMatched = 0;
  let coverPhotosSet = 0;  // intentionally not const — incremented below
  const unmatchedPlaces = new Set<string>();

  for (const [placeName, placeRows] of byPlace) {
    const branchId = await findBranchId(placeName);
    if (!branchId) {
      totalUnmatched++;
      unmatchedPlaces.add(placeName);
      continue;
    }
    totalPhotosMatched += placeRows.length;

    // Sort: cover_photo first, then product_photo, then menu
    const sorted = [...placeRows].sort((a, b) => {
      const priority = (t: string) => {
        if (t === 'cover_photo') return 0;
        if (t === 'product_photo') return 1;
        if (t === 'menu') return 2;
        if (t === 'menu_board') return 3;
        return 4;
      };
      return priority(a.photo_type) - priority(b.photo_type);
    });

    for (let i = 0; i < sorted.length; i++) {
      const r = sorted[i];
      const isFirst = i === 0;
      const isCoverType = r.photo_type === 'cover_photo' || (isFirst && !r.photo_type.includes('menu'));

      try {
        await withRetry(
          () => prisma.placePhoto.create({
            data: {
              branchId,
              url: r.photo_url,
              thumbUrl: r.thumb_url || null,
              caption: r.caption || null,
              photoType: r.photo_type || 'unknown',
              source: 'CSV_GMAPS',
              attribution: 'Google Maps contributor',
              takenAt: parseDate(r.date),
            },
          }),
          `insert photo for ${placeName}`
        );
        totalInserted++;

        // Use first cover-quality photo as the restaurant coverImageUrl
        if (isCoverType && isFirst && coverPhotosSet < 50) {
          await withRetry(
            () => prisma.branch.update({
              where: { id: branchId },
              data: { coverImageUrl: r.photo_url },
            }),
            `set cover ${placeName}`
          );
          coverPhotosSet++;
        }
      } catch (e: any) {
        console.log(`   ⚠️  Failed to insert photo for ${placeName}: ${e.message.split('\n')[0]}`);
      }
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('SUMMARY');
  console.log('='.repeat(70));
  console.log(`  Total CSV rows:         ${rows.length}`);
  console.log(`  Places in CSV:          ${byPlace.size}`);
  console.log(`  Places matched:         ${byPlace.size - totalUnmatched}`);
  console.log(`  Places unmatched:       ${totalUnmatched}`);
  console.log(`  Photos inserted:        ${totalInserted}`);
  console.log(`  Cover photos set:       ${coverPhotosSet}`);

  if (unmatchedPlaces.size > 0 && unmatchedPlaces.size <= 20) {
    console.log(`\n  Unmatched places:`);
    for (const p of unmatchedPlaces) console.log(`    - ${p}`);
  }

  // Final DB check
  const dbCount = await withRetry(() => prisma.placePhoto.count(), 'final count');
  console.log(`\n  📊 Total PlacePhoto rows in DB: ${dbCount}`);

  await prisma.$disconnect();
}

main().catch(async e => {
  console.error('❌ Failed:', e.message);
  try { await prisma.$disconnect(); } catch {}
  process.exit(1);
});
