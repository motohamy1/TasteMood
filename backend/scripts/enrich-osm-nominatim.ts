/**
 * Reverse-geocode the 727 Dakahlia places via OSM Nominatim.
 *
 * Output: enrichments/nominatim.json — keyed by Branch.externalId.
 *
 * Usage:
 *   npx tsx scripts/enrich-osm-nominatim.ts            # full 727 (1 req/sec → ~12 min)
 *   npx tsx scripts/enrich-osm-nominatim.ts --limit=10 # probe
 *
 * Honors the public Nominatim usage policy: 1 req/sec, descriptive UA,
 * no parallel requests, no bulk-decode of a single multi-coord request.
 *
 * The data the API returns is real OSM data; provenance is recorded as
 * `OSM` so downstream merge logic treats it as authoritative, not estimated.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';

const CACHE_PATH = join('enrichments', 'nominatim.json');
const NOMINATIM = 'https://nominatim.openstreetmap.org/reverse';
const UA = 'TasteMood-enrichment/1.0 (educational; contact: eltohamy@tastemood.app)';
const SLEEP_MS = 1100; // 1 req/sec, slightly above the policy floor
const MAX_RETRIES = 3;

type Args = { limit: number | null };
function parseArgs(argv: string[]): Args {
  const out: Args = { limit: null };
  for (const a of argv) {
    if (a.startsWith('--limit=')) out.limit = Number(a.split('=')[1]);
  }
  return out;
}

interface NominatimResponse {
  lat?: string;
  lon?: string;
  address?: Record<string, string>;
  display_name?: string;
  type?: string;
  category?: string;
  error?: string;
}

export interface NominatimHit {
  /** "Yes" only when Nominatim found a real feature (road, suburb, village, …). */
  hit: boolean;
  displayName: string | null;
  road: string | null;
  neighbourhood: string | null;
  suburb: string | null;
  village: string | null;
  town: string | null;
  cityDistrict: string | null;
  county: string | null;
  state: string | null;
  country: string | null;
  /** OSM category/type, used downstream to refuse "no public feature" matches. */
  category: string | null;
  type: string | null;
  fetchedAt: string;
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchOne(
  lat: number,
  lng: number,
  attempt = 1
): Promise<NominatimResponse | null> {
  const url = new URL(NOMINATIM);
  url.searchParams.set('lat', String(lat));
  url.searchParams.set('lon', String(lng));
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('zoom', '18'); // building / street level
  url.searchParams.set('accept-language', 'ar,en');

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, 'Accept-Language': 'ar,en' },
    });
    if (res.status === 429 || res.status >= 500) {
      if (attempt < MAX_RETRIES) {
        const wait = SLEEP_MS * attempt * 2;
        console.log(`  [${res.status}] retry in ${wait}ms (${attempt}/${MAX_RETRIES})`);
        await sleep(wait);
        return fetchOne(lat, lng, attempt + 1);
      }
      return null;
    }
    if (!res.ok) return null;
    return (await res.json()) as NominatimResponse;
  } catch (e) {
    if (attempt < MAX_RETRIES) {
      await sleep(SLEEP_MS * attempt);
      return fetchOne(lat, lng, attempt + 1);
    }
    console.error('  fetch error:', e instanceof Error ? e.message : String(e));
    return null;
  }
}

function normalize(raw: NominatimResponse): NominatimHit {
  const a = raw.address ?? {};
  // Nominatim returns a feature that is "a real public place" when `category`
  // is one of these; anything else is an approximate region match and we
  // should not trust the road name.
  const keepRoad = ['place', 'highway', 'building', 'amenity', 'shop', 'tourism', 'office'].includes(
    raw.category ?? ''
  );
  return {
    hit: Boolean(raw.display_name),
    displayName: raw.display_name ?? null,
    road: keepRoad ? a.road ?? null : null,
    neighbourhood: a.neighbourhood ?? a.quarter ?? null,
    suburb: a.suburb ?? null,
    village: a.village ?? a.hamlet ?? null,
    town: a.town ?? null,
    cityDistrict: a.city_district ?? null,
    county: a.county ?? null,
    state: a.state ?? null,
    country: a.country ?? null,
    category: raw.category ?? null,
    type: raw.type ?? null,
    fetchedAt: new Date().toISOString(),
  };
}

async function loadCache(): Promise<Record<string, NominatimHit>> {
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
    select: { id: true, externalId: true, name: true, latitude: true, longitude: true, address: true },
    orderBy: { externalId: 'asc' },
  });
  const slice = args.limit ? branches.slice(0, args.limit) : branches;

  console.log(`[nominatim] target: ${slice.length} places (cache has ${Object.keys(cache).length})`);

  let fetched = 0;
  let cached = 0;
  let failed = 0;
  const start = Date.now();

  for (let i = 0; i < slice.length; i += 1) {
    const b = slice[i];
    if (!b.externalId) continue;

    if (cache[b.externalId]) {
      cached += 1;
      continue;
    }

    process.stdout.write(`  [${i + 1}/${slice.length}] ${b.name?.slice(0, 40).padEnd(40)} `);
    const res = await fetchOne(b.latitude, b.longitude);
    if (!res) {
      console.log('FAILED');
      failed += 1;
      cache[b.externalId] = {
        hit: false,
        displayName: null,
        road: null,
        neighbourhood: null,
        suburb: null,
        village: null,
        town: null,
        cityDistrict: null,
        county: null,
        state: null,
        country: null,
        category: null,
        type: null,
        fetchedAt: new Date().toISOString(),
      };
    } else {
      cache[b.externalId] = normalize(res);
      console.log(`ok (${cache[b.externalId].hit ? 'hit' : 'miss'}) ${res.category ?? '?'}/${res.type ?? '?'}`);
      fetched += 1;
    }

    // Persist after every request so a long run is restartable.
    await writeFile(CACHE_PATH, JSON.stringify(cache, null, 2), 'utf8');
    if (i < slice.length - 1) await sleep(SLEEP_MS);

    if ((i + 1) % 50 === 0) {
      const elapsed = ((Date.now() - start) / 1000).toFixed(0);
      console.log(`  … ${i + 1} done in ${elapsed}s, ${fetched} fetched, ${cached} cached, ${failed} failed`);
    }
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(0);
  console.log(`\n[nominatim] done in ${elapsed}s — fetched ${fetched}, cached ${cached}, failed ${failed}`);
  console.log(`[nominatim] cache written: ${CACHE_PATH}`);
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
