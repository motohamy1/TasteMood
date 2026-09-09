import { FOURSQUARE_CATEGORY_MAP } from '../taxonomy.js';
import { makePlace } from '../normalize.js';
import type { NormalizedPlace, OpeningHour } from '../types.js';

const FSQ_SEARCH_URL = 'https://api.foursquare.com/v3/places/search';
/** Foursquare v3 category root for "Dining and Drinking" (includes cafés & bars). */
const DINING_CATEGORY_ROOT = '13065';

interface FsqCategory {
  id: number;
  name: string;
}

interface FsqPlace {
  fsq_id: string;
  name: string;
  categories?: FsqCategory[];
  geocodes?: { main?: { latitude?: number; longitude?: number } };
  location?: {
    address?: string;
    formatted_address?: string;
    locality?: string;
    region?: string;
  };
  tel?: string;
  website?: string;
  hours?: {
    open?: Array<{ day?: number; open?: string; close?: string }>;
    regular?: Array<{ day?: number; open?: string; close?: string }>;
  };
  price?: number;
}

interface FsqSearchResponse {
  results?: FsqPlace[];
  context?: { geo_bounds?: { circle?: { center?: unknown } } };
}

export interface FoursquareFetchResult {
  places: NormalizedPlace[];
  duplicates: number;
}

/**
 * Fetch dining POIs in a bbox from the Foursquare free tier and map them onto
 * the canonical taxonomy. Used both as an extra source and for enrichment.
 */
export async function fetchFoursquarePlaces(
  apiKey: string,
  bbox: { south: number; west: number; north: number; east: number },
  maxPages = 8
): Promise<FoursquareFetchResult> {
  const places: NormalizedPlace[] = [];
  let duplicates = 0;
  const seen = new Set<string>();
  let cursor: string | undefined;

  for (let page = 0; page < maxPages; page += 1) {
    const params = new URLSearchParams({
      sw: `${bbox.south},${bbox.west}`,
      ne: `${bbox.north},${bbox.east}`,
      categories: DINING_CATEGORY_ROOT,
      limit: '50',
      fields: 'fsq_id,name,categories,geocodes,location,tel,website,hours,price',
    });
    if (cursor) params.set('cursor', cursor);

    const response = await fetch(`${FSQ_SEARCH_URL}?${params.toString()}`, {
      headers: {
        Authorization: apiKey,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(30_000),
    });
    if (response.status === 429 || response.status >= 500) {
      throw new Error(`Foursquare responded ${response.status}`);
    }
    if (!response.ok) {
      throw new Error(`Foursquare responded ${response.status} ${await safeText(response)}`);
    }

    const payload = (await response.json()) as FsqSearchResponse;
    for (const raw of payload.results ?? []) {
      const lat = raw.geocodes?.main?.latitude;
      const lon = raw.geocodes?.main?.longitude;
      if (typeof lat !== 'number' || typeof lon !== 'number') continue;
      if (seen.has(raw.fsq_id)) {
        duplicates += 1;
        continue;
      }
      seen.add(raw.fsq_id);
      places.push(mapFsqPlace(raw, lat, lon));
    }

    cursor = undefined;
    const linkHeader = response.headers.get('link') ?? '';
    const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
    if (nextMatch) {
      const nextUrl = new URL(nextMatch[1]);
      cursor = nextUrl.searchParams.get('cursor') ?? undefined;
    }
    if (!cursor) break;
  }

  return { places, duplicates };
}

function mapFsqPlace(raw: FsqPlace, lat: number, lon: number): NormalizedPlace {
  const categoryNames = (raw.categories ?? []).map((c) => c.name);
  const cuisineSlugs = new Set<string>();
  for (const name of categoryNames) {
    for (const [pattern, slug] of FOURSQUARE_CATEGORY_MAP) {
      if (pattern.test(name.toLowerCase())) cuisineSlugs.add(slug);
    }
  }
  if (cuisineSlugs.size === 0) cuisineSlugs.add('other');

  const hours = parseFoursquareHoursContainer(raw.hours);
  const street = raw.location?.address ?? null;

  return makePlace({
    externalId: `fsq/${raw.fsq_id}`,
    source: 'FOURSQUARE',
    name: raw.name ?? null,
    nameEn: raw.name ?? null,
    latitude: lat,
    longitude: lon,
    phone: raw.tel ?? null,
    website: raw.website ?? null,
    address: raw.location?.formatted_address ?? null,
    street,
    cuisineSlugs: [...cuisineSlugs],
    placeKind: categoryNames.some((n) => /coffee|café|cafe/i.test(n)) ? 'cafe' : 'restaurant',
    priceTier: typeof raw.price === 'number' ? raw.price : null,
    openingHours: hours,
  });
}

/** FSQ hours arrive as "HHmm" or "HH:mm" strings; normalize to OpeningHour rows. */
function parseFoursquareHoursContainer(hours: FsqPlace['hours']): OpeningHour[] | null {
  const rows = hours?.open ?? hours?.regular;
  if (!rows || rows.length === 0) return null;
  const parsed: OpeningHour[] = [];
  for (const row of rows) {
    if (typeof row.day !== 'number' || !row.open || !row.close) continue;
    const openTime = normalizeClock(row.open);
    const closeTime = normalizeClock(row.close);
    if (!openTime || !closeTime) return null;
    parsed.push({ dayOfWeek: row.day % 7, openTime, closeTime, isClosed: false, isSplitShift: false });
  }
  return parsed.length > 0 ? parsed : null;
}

function normalizeClock(raw: string): string | null {
  const compact = raw.replace(':', '');
  if (!/^\d{4}$/.test(compact)) return null;
  const h = Number(compact.slice(0, 2));
  const m = Number(compact.slice(2));
  if (h > 23 || m > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

async function safeText(response: Response): Promise<string> {
  try {
    return (await response.text()).slice(0, 200);
  } catch {
    return '';
  }
}
