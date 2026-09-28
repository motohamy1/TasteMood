/**
 * scripts/import-photos.ts (v2)
 *
 * Simplified photos import. Skips the cover-image update step (which was
 * triggering repeated Supabase reconnect failures). Inserts only the
 * PlacePhoto rows; cover URLs can be set later by a separate pass.
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

interface PhotoRow {
  place_name: string;
  photo_type: string;
  caption: string;
  date: string;
  photo_url: string;
  thumb_url: string;
  place_maps_url: string;
}

function normalize(s: string): string {
  return (s || '')
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[^\w\u0600-\u06FF\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

let branchCache: Array<{ id: string; norm: string; raw: string }> = [];

async function buildBranchCache(): Promise<void> {
  if (branchCache.length > 0) return;
  console.log('🔍 Loading branches for fuzzy matching...');
  const all = await withRetry(
    () => prisma.branch.findMany({
      select: {
        id: true,
        name: true,
        restaurant: { select: { name: true, nameEn: true } },
      },
    }),
    'load branches'
  );
  branchCache = all.map(b => ({
    id: b.id,
    raw: `${b.name} | ${b.restaurant.name} | ${b.restaurant.nameEn || ''}`,
    norm: normalize(`${b.name} ${b.restaurant.name} ${b.restaurant.nameEn || ''}`),
  }));
  console.log(`   ✓ Loaded ${branchCache.length} branches`);
}

async function findBranchId(placeName: string): Promise<string | null> {
  await buildBranchCache();
  const norm = normalize(placeName);
  if (!norm) return null;

  let match = branchCache.find(b => b.norm.includes(norm) || norm.includes(b.norm));
  if (match) return match.id;

  const tokens = norm.split(' ').filter(t => t.length > 2);
  if (tokens.length > 0) {
    match = branchCache.find(b => {
      const bTokens = new Set(b.norm.split(' ').filter(t => t.length > 2));
      const overlap = tokens.filter(t => bTokens.has(t)).length;
      return overlap >= Math.max(1, Math.floor(tokens.length * 0.5));
    });
  }
  return match?.id ?? null;
}

function parseDate(d: string): Date | null {
  if (!d || !d.trim()) return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(d.trim());
  if (iso) {
    const dt = new Date(`${iso[1]}-${iso[2]}-${iso[3]}T00:00:00Z`);
    return isNaN(dt.getTime()) ? null : dt;
  }
  return null;
}

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
  return records.filter(r => r.place_name && r.place_name.trim() && r.photo_url && r.photo_url.trim());
}

async function main() {
  console.log('\n📷  Importing photos from dakahlia_menus_photos.csv\n');

  const rows = await parseCSV();
  console.log(`📄 Loaded ${rows.length} valid photo rows (with URL)`);

  const byPlace = new Map<string, PhotoRow[]>();
  for (const r of rows) {
    if (!byPlace.has(r.place_name)) byPlace.set(r.place_name, []);
    byPlace.get(r.place_name)!.push(r);
  }
  console.log(`🏪 ${byPlace.size} unique places with photos\n`);

  await buildBranchCache();

  console.log('🔗 Resolving place → branch mappings...');
  const placeToBranch = new Map<string, string | null>();
  for (const placeName of byPlace.keys()) {
    placeToBranch.set(placeName, await findBranchId(placeName));
  }
  const matchedCount = Array.from(placeToBranch.values()).filter(v => v !== null).length;
  console.log(`   ✓ Matched ${matchedCount}/${byPlace.size} places\n`);

  console.log('💾 Inserting photos...');
  let inserted = 0;
  let skipped = 0;
  let errors = 0;
  const unmatchedPlaces: string[] = [];

  for (const [placeName, placeRows] of byPlace) {
    const branchId = placeToBranch.get(placeName);
    if (!branchId) {
      unmatchedPlaces.push(placeName);
      skipped += placeRows.length;
      continue;
    }

    for (const r of placeRows) {
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
          `photo insert`
        );
        inserted++;
      } catch (e: any) {
        errors++;
        const msg = String(e.message || '').split('\n')[0];
        if (!/Unique constraint|foreign key/i.test(msg)) {
          console.log(`   ⚠️  ${placeName}: ${msg}`);
        }
      }
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('SUMMARY');
  console.log('='.repeat(70));
  console.log(`  CSV rows:               ${rows.length}`);
  console.log(`  Places in CSV:          ${byPlace.size}`);
  console.log(`  Places matched:         ${matchedCount}`);
  console.log(`  Places unmatched:       ${byPlace.size - matchedCount}`);
  console.log(`  Photos inserted:        ${inserted}`);
  console.log(`  Photos skipped:         ${skipped}`);
  console.log(`  Errors:                 ${errors}`);

  if (unmatchedPlaces.length > 0 && unmatchedPlaces.length <= 30) {
    console.log(`\n  Unmatched places:`);
    for (const p of unmatchedPlaces.slice(0, 30)) console.log(`    - ${p}`);
    if (unmatchedPlaces.length > 30) console.log(`    ... and ${unmatchedPlaces.length - 30} more`);
  }

  const dbCount = await withRetry(() => prisma.placePhoto.count(), 'final count');
  console.log(`\n  📊 Total PlacePhoto rows in DB: ${dbCount}`);

  await prisma.$disconnect();
}

main().catch(async e => {
  console.error('❌ Failed:', e.message);
  try { await prisma.$disconnect(); } catch {}
  process.exit(1);
});
