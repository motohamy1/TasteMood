/**
 * scripts/import-missing-dishes.ts
 *
 * Fix script: imports the 28 dishes from dakahlia_comprehensive_food_data.csv
 * that are currently NOT connected to any DB restaurant because their names
 * don't match the master CSV (dakahlia_restaurants_cafes.csv).
 *
 * Strategy: create new Restaurant + Branch rows for each of the 9 unmatched
 * restaurants, then insert all 28 dishes with proper menu linkage.
 *
 * Run: npx tsx scripts/import-missing-dishes.ts
 */

import dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';
import { promises as fs } from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { CUISINES } from '../src/importer/taxonomy.js';
import { GOVERNORATE_CITIES } from '../src/importer/geography.js';

// Use DIRECT_URL (port 5432) for reliable connections;
// fall back to DATABASE_URL (pooler port 6543) if DIRECT_URL not set.
const dbUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('❌ Neither DIRECT_URL nor DATABASE_URL is set in .env');
  process.exit(1);
}
console.log(`🔌 Connecting to: ${dbUrl.replace(/:[^:@]+@/, ':***@')}`);

// Retry helper — Supabase occasionally drops idle connections during long scripts.
async function withRetry<T>(fn: () => Promise<T>, label = 'op'): Promise<T> {
  let lastErr: any;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      return await fn();
    } catch (e: any) {
      lastErr = e;
      const msg = String(e.message || '');
      const reconnectable = /Can't reach database server|connection terminated|ECONNRESET|ETIMEDOUT|Connection reset/i.test(msg);
      if (!reconnectable || attempt === 4) throw e;
      console.log(`   ⚠️  ${label} failed (attempt ${attempt}/4): ${msg.split('\n')[0]}. Reconnecting...`);
      try {
        await prisma.$disconnect();
      } catch {}
      prisma = new PrismaClient({ datasourceUrl: dbUrl });
      await new Promise(r => setTimeout(r, 1500 * attempt));
    }
  }
  throw lastErr;
}

let prisma = new PrismaClient({ datasourceUrl: dbUrl });

interface MenuRow {
  restaurantName: string;
  city: string;
  district: string;
  type: string;
  cuisines: string[];
  item: string;
  price: number;
  description: string;
  contact: string;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function parsePrice(priceStr: string): number {
  if (!priceStr) return 0;
  // Handle ranges like "170 to 295 EGP"
  const rangeMatch = priceStr.match(/(\d+)\s*to\s*(\d+)/);
  if (rangeMatch) {
    const a = parseInt(rangeMatch[1]);
    const b = parseInt(rangeMatch[2]);
    return Math.round((a + b) / 2);
  }
  const numMatch = priceStr.match(/(\d+)/);
  return numMatch ? parseInt(numMatch[1]) : 0;
}

function cuisineSlug(name: string): string | null {
  const lower = name.toLowerCase().trim();
  const map: Record<string, string> = {
    'international': 'international',
    'pizza': 'pizza',
    'grill': 'oriental-grills',
    'sandwiches': 'shawarma',
    'syrian': 'syrian',
    'egyptian': 'egyptian',
    'lebanese': 'lebanese',
    'desserts': 'desserts',
    'burger': 'burger',
    'tarts': 'desserts',
    'cakes & chocolates': 'desserts',
    'fried chicken': 'fried-chicken',
    'shawarma & syrian': 'shawarma',
    'drinks & shisha': 'cafe',
    'crepes & waffles': 'desserts',
    'coffee': 'cafe',
    'koshary': 'koshary',
    'juice': 'cafe',
    'chicken': 'fried-chicken',
    'shawarma': 'shawarma',
  };
  return map[lower] ?? null;
}

async function ensureCuisines(): Promise<Map<string, string>> {
  const cuisineBySlug = new Map<string, string>();
  for (const c of CUISINES) {
    const existing = await withRetry(
      () => prisma.cuisine.findUnique({ where: { slug: c.slug } }),
      `findUnique cuisine ${c.slug}`
    );
    if (existing) {
      cuisineBySlug.set(c.slug, existing.id);
    } else {
      const created = await withRetry(
        () => prisma.cuisine.create({ data: c }),
        `create cuisine ${c.slug}`
      );
      cuisineBySlug.set(c.slug, created.id);
    }
  }
  // Ensure 'other' fallback exists
  if (!cuisineBySlug.has('other')) {
    const c = await withRetry(
      () => prisma.cuisine.upsert({
        where: { slug: 'other' },
        create: { slug: 'other', name: 'Other', nameAr: 'أخرى' },
        update: {},
      }),
      `upsert cuisine other`
    );
    cuisineBySlug.set('other', c.id);
  }
  return cuisineBySlug;
}

async function ensureCities(): Promise<Map<string, string>> {
  const cityBySlug = new Map<string, string>();
  // Dakahlia governorate
  const gov = await prisma.governorate.findUnique({ where: { slug: 'dakahlia' } });
  if (!gov) {
    throw new Error('Dakahlia governorate not found - run seed first');
  }
  for (const city of GOVERNORATE_CITIES.dakahlia || []) {
    const c = await prisma.city.upsert({
      where: { governorateId_slug: { governorateId: gov.id, slug: city.slug } },
      create: { ...city, governorateId: gov.id },
      update: { governorateId: gov.id },
    });
    cityBySlug.set(city.slug, c.id);
  }
  return cityBySlug;
}

async function parseCSV(): Promise<MenuRow[]> {
  const csvPath = path.resolve('../dakahlia_comprehensive_food_data.csv');
  const content = await fs.readFile(csvPath, 'utf8');
  // Strip BOM if present
  const cleanContent = content.charCodeAt(0) === 0xFEFF ? content.slice(1) : content;
  // Use a proper CSV parser that handles quoted fields with commas.
  const records = parse(cleanContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  }) as Record<string, string>[];

  const rows: MenuRow[] = [];
  for (const r of records) {
    const restaurantName = (r['Restaurant Name'] || '').trim();
    const item = (r['Menu Item'] || '').trim();
    if (!restaurantName || !item) continue;
    const cuisines = (r['Cuisines/Categories'] || '')
      .split(',')
      .map(c => c.trim())
      .filter(Boolean);
    rows.push({
      restaurantName,
      city: (r['City/Town'] || '').trim(),
      district: (r['District/Area'] || '').trim(),
      type: (r['Type'] || '').trim(),
      cuisines,
      item,
      price: parsePrice(r['Price'] || ''),
      description: (r['Description'] || '').trim(),
      contact: (r['Contact/Phone'] || '').trim(),
    });
  }
  return rows;
}

async function main() {
  console.log('🍽️  Importing missing dishes from dakahlia_comprehensive_food_data.csv\n');

  const rows = await parseCSV();
  console.log(`📄 Loaded ${rows.length} menu rows from CSV`);

  // Group by restaurant
  const byRestaurant = new Map<string, MenuRow[]>();
  for (const row of rows) {
    if (!byRestaurant.has(row.restaurantName)) byRestaurant.set(row.restaurantName, []);
    byRestaurant.get(row.restaurantName)!.push(row);
  }
  console.log(`📊 ${byRestaurant.size} unique restaurants in menu data\n`);

  // Pre-load reference data
  const cuisineBySlug = await ensureCuisines();
  const cityBySlug = await ensureCities();

  let restaurantsCreated = 0;
  let branchesCreated = 0;
  let menusCreated = 0;
  let dishesCreated = 0;
  let dishesUpdated = 0;

  for (const [restaurantName, restaurantRows] of byRestaurant) {
    console.log(`\n🏪 Processing: ${restaurantName} (${restaurantRows.length} dishes)`);

    // Check if restaurant exists
    let restaurant = await prisma.restaurant.findFirst({
      where: {
        OR: [
          { name: restaurantName },
          { nameEn: restaurantName },
        ],
      },
    });

    if (!restaurant) {
      // Create new restaurant
      const slug = `${slugify(restaurantName)}-${Date.now().toString(36)}`;
      restaurant = await prisma.restaurant.create({
        data: {
          name: restaurantName,
          nameEn: restaurantName,
          slug,
          description: `Imported from Dakahlia comprehensive food CSV`,
          source: 'CSV',
          status: 'ACTIVE',
          verificationStatus: 'NEEDS_REVIEW',
        },
      });
      restaurantsCreated++;
      console.log(`   ✓ Restaurant created: ${restaurant.id}`);

      // Add cuisines (dedupe by slug)
      const uniqueCuisineSlugs = new Set<string>();
      for (const row of restaurantRows) {
        for (const c of row.cuisines) {
          const slug = cuisineSlug(c);
          if (slug) uniqueCuisineSlugs.add(slug);
        }
      }
      // Always include 'other' as fallback
      uniqueCuisineSlugs.add('other');

      for (const cuisineSlug of uniqueCuisineSlugs) {
        const cuisineId = cuisineBySlug.get(cuisineSlug);
        if (cuisineId) {
          await prisma.restaurantCuisine.create({
            data: { restaurantId: restaurant.id, cuisineId },
          }).catch(() => {}); // ignore duplicate
        }
      }
      console.log(`   ✓ Added ${uniqueCuisineSlugs.size} cuisines`);
    } else {
      console.log(`   ↻ Restaurant already exists: ${restaurant.id}`);
    }

    // Create or find city for the branch
    const firstRow = restaurantRows[0];
    const citySlug = slugify(firstRow.city);
    const cityId = cityBySlug.get(citySlug);
    if (!cityId) {
      console.log(`   ⚠️  City not found: ${firstRow.city} (slug: ${citySlug})`);
    }

    // Create branch
    const branch = await prisma.branch.upsert({
      where: { id: `${restaurant.id}-csv-import` },
      create: {
        id: `${restaurant.id}-csv-import`,
        restaurantId: restaurant.id,
        name: `${restaurantName} - ${firstRow.city}`,
        address: `${firstRow.district || ''}, ${firstRow.city}, Dakahlia`,
        latitude: 0,  // Placeholder - we don't have GPS from menu CSV
        longitude: 0,
        phone: firstRow.contact || null,
        source: 'CSV',
        status: 'ACTIVE',
        verificationStatus: 'NEEDS_REVIEW',
        cityId: cityId || null,
      },
      update: {},
    });
    branchesCreated++;
    console.log(`   ✓ Branch: ${branch.id} (${firstRow.city})`);

    // Create menu
    const menu = await prisma.menu.upsert({
      where: { id: `${restaurant.id}-csv-menu` },
      create: {
        id: `${restaurant.id}-csv-menu`,
        restaurantId: restaurant.id,
        name: 'CSV menu import',
        source: 'CSV',
        status: 'ACTIVE',
      },
      update: { status: 'ACTIVE' },
    });
    menusCreated++;
    console.log(`   ✓ Menu: ${menu.id}`);

    // Create dishes
    for (const row of restaurantRows) {
      const existing = await prisma.dish.findFirst({
        where: { menuId: menu.id, name: row.item },
      });
      const dishData = {
        name: row.item,
        slug: `${slugify(row.item) || 'dish'}-${menu.id.slice(0, 6)}`,
        description: row.description || null,
        price: row.price,
        currency: 'EGP',
        status: 'ACTIVE' as const,
        verificationStatus: 'NEEDS_REVIEW' as const,
        source: 'CSV',
      };
      if (existing) {
        await prisma.dish.update({ where: { id: existing.id }, data: dishData });
        dishesUpdated++;
      } else {
        await prisma.dish.create({
          data: {
            ...dishData,
            menuId: menu.id,
            priceHistory: { create: { price: row.price, currency: 'EGP', source: 'CSV' } },
          },
        });
        dishesCreated++;
      }
    }
    console.log(`   ✓ Dishes: ${restaurantRows.length} (created: ${dishesCreated - (dishesUpdated)}, updated: 0)`);
  }

  console.log('\n' + '='.repeat(70));
  console.log('SUMMARY');
  console.log('='.repeat(70));
  console.log(`  Restaurants created: ${restaurantsCreated}`);
  console.log(`  Branches created:    ${branchesCreated}`);
  console.log(`  Menus created:       ${menusCreated}`);
  console.log(`  Dishes created:      ${dishesCreated}`);
  console.log(`  Dishes updated:      ${dishesUpdated}`);
  console.log(`  Total dish count now in DB: ${await prisma.dish.count()}`);
  console.log(`  Total restaurant count now: ${await prisma.restaurant.count()}`);
  console.log(`  Total branch count now:     ${await prisma.branch.count()}`);

  await prisma.$disconnect();
}

main().catch(e => {
  console.error('❌ Failed:', e);
  process.exit(1);
});
