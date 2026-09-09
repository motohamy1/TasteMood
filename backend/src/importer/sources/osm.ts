import { makePlace, mapOsmCuisines, parseOpeningHours } from '../normalize.js';
import type { PlaceKind } from '../taxonomy.js';
import type { NormalizedPlace } from '../types.js';

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];

const FETCH_ATTEMPTS_PER_ENDPOINT = 2;
const RETRY_BACKOFF_MS = 25_000;

const FOOD_AMENITY = 'restaurant|cafe|fast_food|ice_cream|food_court|pub|bar';
const FOOD_SHOP = 'bakery|pastry|coffee|confectionery|deli';

interface OverpassElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

interface OverpassResponse {
  elements?: OverpassElement[];
}

/**
 * Fetch every food/drink POI inside an OSM admin area (e.g. an Egyptian
 * governorate, admin_level=4). Tries the primary Overpass mirror first and
 * falls back to the secondary on rate-limit/timeout.
 */
export async function fetchOsmPlaces(governorateNameEn: string, governorateNameAr: string): Promise<NormalizedPlace[]> {
  const query = `[out:json][timeout:180];
area["admin_level"="4"]["name"~"^(${escapeRegex(governorateNameAr)}|${escapeRegex(governorateNameEn)})$"]->.a;
(
  nwr["amenity"~"^(${FOOD_AMENITY})$"](area.a);
  nwr["shop"~"^(${FOOD_SHOP})$"](area.a);
);
out center tags;`;

  let lastError: unknown;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    for (let attempt = 1; attempt <= FETCH_ATTEMPTS_PER_ENDPOINT; attempt += 1) {
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ data: query }).toString(),
          signal: AbortSignal.timeout(200_000),
        });
        if (response.status === 429 || response.status === 504) {
          throw new Error(`Overpass ${endpoint} rate-limited (${response.status})`);
        }
        if (!response.ok) {
          throw new Error(`Overpass ${endpoint} responded ${response.status}`);
        }
        const payload = (await response.json()) as OverpassResponse;
        return (payload.elements ?? [])
          .filter((el) => centerOf(el) !== null)
          .map((el) => mapElement(el, centerOf(el)!));
      } catch (error) {
        lastError = error;
        if (attempt < FETCH_ATTEMPTS_PER_ENDPOINT) {
          await new Promise((resolve) => setTimeout(resolve, RETRY_BACKOFF_MS));
        }
      }
    }
  }
  throw new Error(`All Overpass mirrors failed: ${String(lastError)}`);
}

function centerOf(el: OverpassElement): { lat: number; lon: number } | null {
  if (typeof el.lat === 'number' && typeof el.lon === 'number') return { lat: el.lat, lon: el.lon };
  if (el.center) return el.center;
  return null;
}

function mapElement(el: OverpassElement, center: { lat: number; lon: number }): NormalizedPlace {
  const tags = el.tags ?? {};
  const amenity = tags.amenity ?? null;
  const shop = tags.shop ?? null;
  const street = tags['addr:street'] ?? null;
  const housenumber = tags['addr:housenumber'] ?? null;
  const city = tags['addr:city'] ?? null;
  const addressParts = [housenumber, street, city].filter(Boolean).join(' ').trim();

  return makePlace({
    externalId: `osm/${el.type}/${el.id}`,
    source: 'OSM',
    name: tags.name ?? null,
    nameEn: tags['name:en'] ?? null,
    latitude: center.lat,
    longitude: center.lon,
    phone: tags.phone ?? tags['contact:phone'] ?? tags['contact:mobile'] ?? null,
    website: tags.website ?? tags['contact:website'] ?? null,
    address: addressParts || null,
    street,
    cuisineSlugs: mapOsmCuisines(tags.cuisine ?? null, amenity, shop),
    placeKind: detectKind(amenity, shop),
    openingHours: parseOpeningHours(tags.opening_hours ?? null),
  });
}

function detectKind(amenity: string | null, shop: string | null): PlaceKind {
  switch (amenity) {
    case 'restaurant':
      return 'restaurant';
    case 'cafe':
      return 'cafe';
    case 'fast_food':
      return 'fast_food';
    case 'ice_cream':
      return 'ice_cream';
    case 'food_court':
      return 'food_court';
    case 'bar':
    case 'pub':
      return 'bar';
    default:
      if (shop === 'bakery' || shop === 'pastry' || shop === 'coffee' || shop === 'confectionery') return 'bakery';
      return 'other';
  }
}

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
