/**
 * Google Maps (Playwright scrape) source for Dakahlia.
 *
 * The scraper in `dakahlia_food/scraper/scrape.js` writes rows with:
 *   name, category, rating, reviews, address, lat, lng,
 *   place_id, google_maps_url, city_source, query_lang
 *
 * Two things this file corrects, because the raw scrape cannot be trusted:
 *
 *  1. `city_source` is the QUERY label, not the place's real location. The
 *     `Gamasa_suburb_south` query returns places all over the governorate
 *     (197 of 727 rows sit >25km from the centre their label names). City is
 *     therefore left to `resolveLocation`, which assigns by coordinates.
 *
 *  2. `category` and `address` came back empty for all 727 rows (the scraper's
 *     DOM heuristics never matched). `placeKind` and `cuisineSlugs` are instead
 *     inferred from the place name, which Google usually includes, because the
 *     app groups places by kind and taste mode needs a cuisine to match on.
 *
 * `rating` / `reviews` are carried through as provenance. They are optional and
 * nothing in the app may require them.
 */

import { readFile } from 'node:fs/promises';

import type { NormalizedPlace, OpeningHour } from '../types.js';
import type { PlaceKind } from '../taxonomy.js';
import { DEFAULT_CUISINE_SLUG } from '../taxonomy.js';
import { normalizeNameKey } from '../normalize.js';

/** Provenance tag for this file, so its rows stay separately auditable. */
export const SOURCE = 'GMAPS_PLAYWRIGHT' as const;

/** One raw row as written by the scraper. Empty strings mean "not scraped". */
export interface DakahliaFoodRow {
  name: string;
  category: string;
  rating: string;
  reviews: string;
  address: string;
  lat: string | number;
  lng: string | number;
  place_id: string;
  google_maps_url: string;
  city_source: string;
  query_lang: string;
}

export interface DakahliaFoodFile {
  rows: DakahliaFoodRow[];
  /** Rows dropped, with the reason, so the run reports its own losses. */
  rejected: Array<{ row: number; reason: string }>;
  /** Query labels present in the file, for the run summary. */
  labels: string[];
}

/**
 * Name keywords that identify what kind of place this is. Google almost always
 * repeats the venue type inside the name, in Arabic or English.
 * Order matters: the first pattern that matches wins, so specific kinds
 * (ice cream, bakery) are tested before the generic `cafe`/`restaurant`.
 */
// Venue types are matched loosely on purpose. Egyptian shopfront names
// misspelt English constantly ("Cafee", "Coffe", "cofee", "restorant"), and a
// strict pattern files real coffee shops under "restaurant", which is exactly
// the mislabelling the app must not ship.
const KIND_PATTERNS: Array<[RegExp, PlaceKind]> = [
  [/آيس كريم|ايس كريم|ice\s*cream|gelat|مثلجات/i, 'ice_cream'],
  [/مخبز|حلويات|معجنات|فرن|bakery|pastry|sweets|patisserie|donut/i, 'bakery'],
  [/food\s*court|فود كورت/i, 'food_court'],
  [/\bpub\b|\bbar\b|بار|ملهى/i, 'bar'],
  [/كافيتريا|كفتريا|فاست فود|fast\s*food|برجر|burgers?\b|فود|ساندوتش|sandwich|shawarma|شاورما/i, 'fast_food'],
  // كاف covers كافيه / كافي / كافى / كوفي, all common transliterations.
  [/كاف|كوب|caff|caf[eé]|coff?e|coffee|espresso/i, 'cafe'],
  [/مطعم|restaurant|restorant|restorant|bistro|brasserie|pizzeria|بيتزا|كوزينة/i, 'restaurant'],
];

/** Cuisine keywords, mapped onto the canonical cuisine slugs in `taxonomy.ts`. */
const CUISINE_PATTERNS: Array<[RegExp, string]> = [
  [/بيتزا|pizzeria|pizza/i, 'pizza'],
  [/كوزي|كشري|koshary|kushari/i, 'koshary'],
  [/فول|طعمية|foul\b|falafel/i, 'foul-falafel'],
  [/شاورما|shawarma|sandwich/i, 'shawarma'],
  [/برجر|burgers?\b|burger\b/i, 'burgers'],
  [/مشاوي|كباب|grill|kebab|kofta/i, 'oriental-grills'],
  [/سمك|جمبري|seafood|fish|shrimp/i, 'seafood'],
  [/صيني|chinese|wok|noodle/i, 'chinese'],
  [/سوشي|sushi|japanese|ramen/i, 'asian'],
  [/اسيوي|asian|thai/i, 'asian'],
  [/إيطالي|italian|pasta/i, 'italian'],
  [/مكسيكي|mexican|taco|burrito/i, 'mexican'],
  [/لبناني|levantine|lebanese|syrian|تركي|turkish/i, 'levantine'],
  [/عصير|juice|مشروبات/i, 'juice'],
  [/سلطة|سلطات|healthy|salad/i, 'healthy'],
  [/كريب|crepe/i, 'street-food'],
];

/** What Google calls a rating, as a number in [0,5]. Null when absent. */
export function parseRating(raw: string): number | null {
  if (!raw) return null;
  const n = Number(String(raw).replace(',', '.').trim());
  if (!Number.isFinite(n) || n < 0 || n > 5) return null;
  return n;
}

/** Google's review count. Null when absent or unparseable. */
export function parseReviews(raw: string): number | null {
  if (!raw) return null;
  const n = Number(String(raw).replace(/[^\d]/g, ''));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** The `ChIJ...` token Google puts in every Maps place URL. */
export function placeIdFromMapsUrl(url: string): string {
  return url.match(/19s([A-Za-z0-9_-]+)/)?.[1] ?? '';
}

/**
 * Stable, source-prefixed join key. `Branch.externalId` is `@unique`, so this
 * decides whether a re-run updates a place or duplicates it.
 *
 * Prefers the `ChIJ` token because the earlier markaz import already used
 * `gmaps/place/<ChIJ>` for 111 Dakahlia places, 75 of which appear in this file.
 * Using the same scheme makes this import merge into those instead of creating
 * near-duplicate branches.
 */
export function externalIdFor(row: DakahliaFoodRow): string {
  const chij = placeIdFromMapsUrl(row.google_maps_url ?? '');
  if (chij) return `gmaps/place/${chij}`;
  const hex = (row.place_id ?? '').trim();
  if (hex) return `gmaps/hex/${hex}`;
  return '';
}

/** Best-effort place kind from the name. Defaults to `restaurant`. */
export function inferPlaceKind(name: string): PlaceKind {
  for (const [pattern, kind] of KIND_PATTERNS) {
    if (pattern.test(name)) return kind;
  }
  return 'restaurant';
}

/**
 * Best-effort cuisines from the name. A name that carries no cuisine keyword
 * falls back to the kind's natural cuisine rather than a flat `other`, so a
 * coffee shop is never tagged `other`.
 */
export function inferCuisines(name: string, kind: PlaceKind): string[] {
  const found: string[] = [];
  for (const [pattern, slug] of CUISINE_PATTERNS) {
    if (slug === 'other') continue;
    if (pattern.test(name) && !found.includes(slug)) found.push(slug);
  }
  if (found.length > 0) return found;
  const byKind: Record<PlaceKind, string> = {
    cafe: 'cafe-bakery',
    bakery: 'cafe-bakery',
    ice_cream: 'cafe-bakery',
    fast_food: 'fast-food',
    restaurant: 'egyptian',
    food_court: 'other',
    bar: 'other',
    other: DEFAULT_CUISINE_SLUG,
  };
  return [byKind[kind]];
}

/**
 * The official name as the source gave it, plus the Latin portion when the name
 * mixes both scripts (e.g. "SAQR - Cafe & Restaurant - صقر كافيه"). The Arabic
 * stays the Official Name; the Latin half becomes the Alternate Name and never
 * replaces it.
 */
function splitName(name: string): { official: string; nameEn: string | null } {
  const official = name.trim();
  const latin = official.match(/[A-Za-z][A-Za-z0-9&'’.\- ]{2,}/)?.[0]?.trim();
  if (!latin) return { official, nameEn: null };
  const key = normalizeNameKey(latin);
  const officialKey = normalizeNameKey(official);
  if (!key || key === officialKey) return { official, nameEn: null };
  return { official, nameEn: latin };
}

/** Read and normalize the scraper's JSON output. */
export async function readDakahliaFoodFile(filePath: string): Promise<DakahliaFoodFile> {
  const raw = JSON.parse(await readFile(filePath, 'utf8')) as DakahliaFoodRow[];
  if (!Array.isArray(raw)) throw new Error('Expected a JSON array of scrape rows');

  const rows: DakahliaFoodRow[] = [];
  const rejected: DakahliaFoodFile['rejected'] = [];
  const labels = new Set<string>();
  const seenIds = new Set<string>();

  raw.forEach((row, i) => {
    const name = (row.name ?? '').trim();
    if (!name) {
      rejected.push({ row: i, reason: 'no name' });
      return;
    }
    const latitude = Number(row.lat);
    const longitude = Number(row.lng);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      rejected.push({ row: i, reason: 'no coordinates' });
      return;
    }
    if (latitude < 30.3 || latitude > 31.8 || longitude < 30.2 || longitude > 32.6) {
      rejected.push({ row: i, reason: `coordinates outside Dakahlia (${latitude}, ${longitude})` });
      return;
    }
    const externalId = externalIdFor(row);
    if (!externalId) {
      rejected.push({ row: i, reason: 'no place id' });
      return;
    }
    if (seenIds.has(externalId)) {
      rejected.push({ row: i, reason: 'duplicate place id' });
      return;
    }
    seenIds.add(externalId);
    if (row.city_source) labels.add(row.city_source);
    rows.push({ ...row, name, lat: latitude, lng: longitude });
  });

  return { rows, rejected, labels: [...labels].sort() };
}

/**
 * Convert scrape rows into importer places.
 *
 * `city_source` is deliberately dropped: it names the query, not the location.
 * `resolveLocation` assigns the city from coordinates at upsert time, which is
 * what CONTEXT.md requires of discovery.
 */
export function normalizeDakahliaFood(rows: DakahliaFoodRow[]): NormalizedPlace[] {
  return rows.map((row) => {
    const { official, nameEn } = splitName(row.name);
    const kind = inferPlaceKind(official);
    return {
      externalId: externalIdFor(row),
      source: SOURCE,
      name: official,
      nameEn,
      latitude: Number(row.lat),
      longitude: Number(row.lng),
      phone: null,
      website: null,
      address: (row.address ?? '').trim() || null,
      street: null,
      cuisineSlugs: inferCuisines(official, kind),
      placeKind: kind,
      priceTier: null,
      openingHours: null as OpeningHour[] | null,
      photoUrl: null,
      photoAttribution: null,
    };
  });
}

/**
 * Group by exact normalized name only.
 *
 * The shared `groupPlaces` uses fuzzy matching (containment + 0.8 Levenshtein)
 * which is safe for a handful of curated rows but wrong at this scale: 727
 * free-text venue names would collapse unrelated neighbours ("كافيه النور" vs
 * "كافيه النور granulated"). Chains that share a name still group correctly,
 * which is the case that actually matters.
 */
export function groupByExactName(places: NormalizedPlace[]) {
  const groups = new Map<string, NormalizedPlace[]>();
  for (const place of places) {
    const key = normalizeNameKey(place.name ?? '') || place.externalId;
    const bucket = groups.get(key);
    if (bucket) bucket.push(place);
    else groups.set(key, [place]);
  }
  return [...groups.entries()].map(([key, grouped]) => ({ key, places: grouped }));
}