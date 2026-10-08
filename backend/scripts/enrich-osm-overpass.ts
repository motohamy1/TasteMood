/**
 * Enrich Dakahlia branches with OSM Overpass POI data: phone, website,
 * opening_hours, cuisine, amenity, brand.
 *
 * One Overpass call per batch of N places, querying `around:150` of every
 * coordinate. The result is matched to a branch by `nwr_id` ↔ OSM node id
 * when the distance is < 30m. (Heuristic: Google's lat/lng may be off by
 * 5-30m from the OSM node, so we re-check with a generous threshold.)
 *
 * Output: enrichments/overpass.json — keyed by Branch.externalId.
 *
 * Usage:
 *   npx tsx scripts/enrich-osm-overpass.ts
 *   npx tsx scripts/enrich-osm-overpass.ts --limit=10
 *   npx tsx scripts/enrich-osm-overpass.ts --batch=25
 *
 * Honor: 1 request per batch (not per place). Default batch=50 → 15 calls
 * total. Set --batch lower if you see 429s.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';

const CACHE_PATH = join('enrichments', 'overpass.json');
const OVERPASS = 'https://overpass-api.de/api/interpreter';
const UA = 'TasteMood-enrichment/1.0 (educational; contact: eltohamy@tastemood.app)';

const DAY_MAP: Record<string, number> = {
  Mo: 1, Tu: 2, We: 3, Th: 4, Fr: 5, Sa: 6, Su: 0,
};

const DAY_INDEX_TO_OSM: Record<number, string> = {
  0: 'Su', 1: 'Mo', 2: 'Tu', 3: 'We', 4: 'Th', 5: 'Fr', 6: 'Sa',
};

interface Args {
  limit: number | null;
  batch: number;
}
function parseArgs(argv: string[]): Args {
  const out: Args = { limit: null, batch: 50 };
  for (const a of argv) {
    if (a.startsWith('--limit=')) out.limit = Number(a.split('=')[1]);
    if (a.startsWith('--batch=')) out.batch = Number(a.split('=')[1]);
  }
  return out;
}

export interface OverpassHit {
  hit: boolean;
  osmId: number | null;
  osmType: 'node' | 'way' | 'relation' | null;
  amenity: string | null;
  cuisine: string | null;
  shop: string | null;
  phone: string | null;
  website: string | null;
  openingHours: string | null;
  brand: string | null;
  takeAway: boolean | null;
  outdoorSeating: boolean | null;
  indoorSeating: boolean | null;
  wheelchair: string | null;
  distanceM: number | null;
  fetchedAt: string;
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function haversineM(la1: number, lo1: number, la2: number, lo2: number) {
  const R = 6371000;
  const dLa = ((la2 - la1) * Math.PI) / 180;
  const dLo = ((lo2 - lo1) * Math.PI) / 180;
  const a =
    Math.sin(dLa / 2) ** 2 +
    Math.cos((la1 * Math.PI) / 180) *
      Math.cos((la2 * Math.PI) / 180) *
      Math.sin(dLo / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

interface OverpassResponse {
  elements: OverpassElement[];
}

async function fetchBatch(
  points: Array<{ externalId: string; lat: number; lng: number }>,
  attempt = 1
): Promise<OverpassElement[]> {
  // Build a single query: union of `around:R` over every point.
  // Syntax: `nwr(around:R,lat,lng);` is one statement; we AND them with a
  // surrounding union `( ... )` so the server runs them as one set.
  const radius = 100;
  const stmts = points
    .map((p) => `  nwr(around:${radius},${p.lat},${p.lng});`)
    .join('\n');

  const q = `[out:json][timeout:60];
(
${stmts}
);
out tags center 30;`;

  try {
    const res = await fetch(OVERPASS, {
      method: 'POST',
      body: 'data=' + encodeURIComponent(q),
      headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    if (res.status === 429 || res.status === 504 || res.status >= 500) {
      if (attempt < 3) {
        const wait = 4000 * attempt;
        console.log(`  [overpass ${res.status}] retry in ${wait}ms`);
        await sleep(wait);
        return fetchBatch(points, attempt + 1);
      }
      console.error(`  [overpass ${res.status}] giving up on batch of ${points.length}`);
      return [];
    }
    if (!res.ok) {
      console.error(`  [overpass ${res.status}] body: ${(await res.text()).slice(0, 200)}`);
      return [];
    }
    const json = (await res.json()) as OverpassResponse;
    return json.elements ?? [];
  } catch (e) {
    if (attempt < 3) {
      await sleep(4000 * attempt);
      return fetchBatch(points, attempt + 1);
    }
    console.error('  overpass fetch error:', e instanceof Error ? e.message : String(e));
    return [];
  }
}

function elementToHit(
  el: OverpassElement,
  dist: number
): OverpassHit {
  const t = el.tags ?? {};
  return {
    hit: true,
    osmId: el.id,
    osmType: el.type,
    amenity: t.amenity ?? null,
    cuisine: t.cuisine ?? null,
    shop: t.shop ?? null,
    phone: t.phone ?? t['contact:phone'] ?? null,
    website: t.website ?? t['contact:website'] ?? null,
    openingHours: t.opening_hours ?? null,
    brand: t.brand ?? t['name:en'] ?? null,
    takeAway: t.takeaway === 'yes' ? true : t.takeaway === 'no' ? false : null,
    outdoorSeating: t.outdoor_seating === 'yes' ? true : t.outdoor_seating === 'no' ? false : null,
    indoorSeating: t.indoor_seating === 'yes' ? true : t.indoor_seating === 'no' ? false : null,
    wheelchair: t.wheelchair ?? null,
    distanceM: Math.round(dist),
    fetchedAt: new Date().toISOString(),
  };
}

function emptyHit(): OverpassHit {
  return {
    hit: false,
    osmId: null,
    osmType: null,
    amenity: null,
    cuisine: null,
    shop: null,
    phone: null,
    website: null,
    openingHours: null,
    brand: null,
    takeAway: null,
    outdoorSeating: null,
    indoorSeating: null,
    wheelchair: null,
    distanceM: null,
    fetchedAt: new Date().toISOString(),
  };
}

async function loadCache(): Promise<Record<string, OverpassHit>> {
  try {
    return JSON.parse(await readFile(CACHE_PATH, 'utf8'));
  } catch {
    return {};
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const db = new PrismaClient();
  await mkdir('enrichments', { recursive: true });
  const cache = await loadCache();

  const branches = await db.branch.findMany({
    where: { source: 'GMAPS_PLAYWRIGHT' },
    select: { id: true, externalId: true, name: true, latitude: true, longitude: true },
    orderBy: { externalId: 'asc' },
  });
  const targets = args.limit ? branches.slice(0, args.limit) : branches;

  const missing = targets.filter((b) => b.externalId && !cache[b.externalId]);
  console.log(
    `[overpass] target ${targets.length}, cached ${targets.length - missing.length}, to fetch ${missing.length} in batches of ${args.batch}`,
  );

  let fetched = 0;
  const start = Date.now();

  for (let i = 0; i < missing.length; i += args.batch) {
    const batch = missing.slice(i, i + args.batch);
    const points = batch.map((b) => ({
      externalId: b.externalId!,
      lat: b.latitude,
      lng: b.longitude,
    }));
    const elNum = Math.floor(i / args.batch) + 1;
    const totalBatches = Math.ceil(missing.length / args.batch);
    console.log(`  batch ${elNum}/${totalBatches} (${batch.length} places)`);

    const elements = await fetchBatch(points);

    // For each branch in this batch, find the nearest element and assign.
    for (const b of batch) {
      let best: { el: OverpassElement; dist: number } | null = null;
      for (const el of elements) {
        const lat = el.lat ?? el.center?.lat;
        const lon = el.lon ?? el.center?.lon;
        if (lat == null || lon == null) continue;
        const d = haversineM(b.latitude, b.longitude, lat, lon);
        if (d > 50) continue; // 50m threshold — accept tight matches only
        if (!best || d < best.dist) best = { el, dist: d };
      }
      cache[b.externalId!] = best ? elementToHit(best.el, best.dist) : emptyHit();
      if (best) fetched += 1;
    }

    // Persist after each batch so a long run is restartable.
    await writeFile(CACHE_PATH, JSON.stringify(cache, null, 2), 'utf8');
    const elapsed = ((Date.now() - start) / 1000).toFixed(0);
    console.log(`    done in ${elapsed}s, ${fetched} matched so far`);

    if (i + args.batch < missing.length) await sleep(2000); // be polite
  }

  console.log(`\n[overpass] done — ${fetched} matches in ${((Date.now() - start) / 1000).toFixed(0)}s`);
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
