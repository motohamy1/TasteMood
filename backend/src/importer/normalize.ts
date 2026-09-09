import {
  DEFAULT_CUISINE_SLUG,
  OSM_AMENITY_MAP,
  OSM_CUISINE_MAP,
  PLACE_KIND_LABELS,
  type PlaceKind,
} from './taxonomy.js';
import type { NormalizedPlace, OpeningHour } from './types.js';

const ARABIC_DIACRITICS = /[\u064B-\u065F\u0670\u0640]/g; // harakat + tatweel
const PUNCTUATION = /[^\p{L}\p{N}\s]/gu;

/** URL-safe slug that keeps Arabic letters. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(ARABIC_DIACRITICS, '')
    .trim()
    .replace(/['’]/g, '')
    .replace(PUNCTUATION, ' ')
    .replace(/\s+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/** Aggressive key for brand matching: diacritic-free, punctuation-free, lowercase. */
export function normalizeNameKey(input: string): string {
  return input
    .toLowerCase()
    .replace(ARABIC_DIACRITICS, '')
    .replace(PUNCTUATION, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function levenshteinRatio(a: string, b: string): number {
  if (a === b) return 1;
  if (!a.length || !b.length) return 0;
  const prev = new Array<number>(b.length + 1);
  const curr = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j += 1) prev[j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j += 1) prev[j] = curr[j];
  }
  const distance = prev[b.length];
  return 1 - distance / Math.max(a.length, b.length);
}

/** Fuzzy brand-name comparison tolerant of Arabic/English variants. */
export function namesMatch(a: string, b: string): boolean {
  const ka = normalizeNameKey(a);
  const kb = normalizeNameKey(b);
  if (!ka || !kb) return false;
  if (ka === kb) return true;
  if (ka.includes(kb) || kb.includes(ka)) return true;
  return levenshteinRatio(ka, kb) >= 0.8;
}

/** Haversine distance in kilometers. */
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function detectPlaceKind(amenity: string | null, shop: string | null): PlaceKind {
  if (amenity && amenity in PLACE_KIND_LABELS) return amenity as PlaceKind;
  if (shop === 'bakery' || shop === 'pastry' || shop === 'coffee' || shop === 'confectionery') return 'bakery';
  return 'other';
}

/** Map OSM cuisine tags (+ amenity/shop fallback) onto the canonical cuisine slugs. */
export function mapOsmCuisines(
  cuisineTag: string | null,
  amenity: string | null,
  shop: string | null
): string[] {
  const found = new Set<string>();
  if (cuisineTag) {
    for (const part of cuisineTag.split(/[;,]/)) {
      const key = part.trim().toLowerCase().replace(/-/g, '_');
      const slug = OSM_CUISINE_MAP[key];
      if (slug) found.add(slug);
    }
  }
  if (found.size === 0) {
    const kind = detectPlaceKind(amenity, shop);
    const fallbackKey = amenity ?? shop;
    const slug =
      (fallbackKey && OSM_AMENITY_MAP[fallbackKey]) ||
      (kind === 'other' ? DEFAULT_CUISINE_SLUG : undefined);
    if (slug) found.add(slug);
  }
  return [...found];
}

const OSM_DAYS = ['su', 'mo', 'tu', 'we', 'th', 'fr', 'sa'] as const;

function parseTime(raw: string): string | null {
  const match = raw.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 24 || m > 59) return null;
  if (h === 24) return '23:59';
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function expandDayPart(part: string): number[] {
  const days: number[] = [];
  for (const token of part.split(',')) {
    const range = token.trim().toLowerCase().match(/^([a-z]{2})-([a-z]{2})$/);
    if (range) {
      const start = OSM_DAYS.indexOf(range[1] as (typeof OSM_DAYS)[number]);
      const end = OSM_DAYS.indexOf(range[2] as (typeof OSM_DAYS)[number]);
      if (start === -1 || end === -1) continue;
      let d = start;
      while (true) {
        days.push(d);
        if (d === end) break;
        d = (d + 1) % 7;
      }
    } else {
      const single = OSM_DAYS.indexOf(token.trim().toLowerCase() as (typeof OSM_DAYS)[number]);
      if (single !== -1) days.push(single);
    }
  }
  return days;
}

/**
 * Best-effort OSM `opening_hours` parser. Covers the common forms:
 * "24/7", "Mo-Su 10:00-01:00", "Mo-Fr 09:00-17:00; Sa 10:00-23:00; Su off",
 * split shifts "Mo-Fr 08:00-14:00,17:00-23:00". Returns null when unparseable.
 */
export function parseOpeningHours(value: string | null | undefined): OpeningHour[] | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (/^24\/7$/.test(trimmed)) {
    return [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
      dayOfWeek,
      openTime: '00:00',
      closeTime: '23:59',
      isClosed: false,
      isSplitShift: false,
    }));
  }

  const perDay = new Map<number, Array<{ openTime: string; closeTime: string }>>();
  for (const rule of trimmed.split(';')) {
    const ruleText = rule.trim();
    if (!ruleText) continue;
    const offMatch = ruleText.match(/^((?:[A-Za-z]{2}(?:-[A-Za-z]{2})?)(?:,[A-Za-z]{2}(?:-[A-Za-z]{2})?)*)\s+off$/i);
    if (offMatch) {
      for (const day of expandDayPart(offMatch[1])) {
        if (!perDay.has(day)) perDay.set(day, []);
      }
      continue;
    }
    const timeMatch = ruleText.match(
      /^((?:[A-Za-z]{2}(?:-[A-Za-z]{2})?)(?:\s*,\s*[A-Za-z]{2}(?:-[A-Za-z]{2})?)*)\s+((?:\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2})(?:\s*,\s*\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2})*)$/
    );
    if (!timeMatch) return null; // unparseable grammar — give up on the whole value
    const days = expandDayPart(timeMatch[1]);
    const ranges = timeMatch[2].split(',').map((r) => r.split('-').map((t) => parseTime(t)));
    if (days.length === 0 || ranges.some(([o, c]) => !o || !c)) return null;
    for (const day of days) {
      const list = perDay.get(day) ?? [];
      for (const [o, c] of ranges as Array<[string, string]>) {
        list.push({ openTime: o, closeTime: c });
      }
      perDay.set(day, list);
    }
  }

  if (perDay.size === 0) return null;
  const hours: OpeningHour[] = [];
  for (let day = 0; day < 7; day += 1) {
    const ranges = perDay.get(day) ?? [];
    if (ranges.length === 0) {
      hours.push({ dayOfWeek: day, openTime: '00:00', closeTime: '00:00', isClosed: true, isSplitShift: false });
      continue;
    }
    for (const range of ranges) {
      hours.push({
        dayOfWeek: day,
        openTime: range.openTime,
        closeTime: range.closeTime,
        isClosed: false,
        isSplitShift: ranges.length > 1,
      });
    }
  }
  return hours;
}

/** Bilingual display name for places without one: "مقهى — شارع الجيش" / "Café — Gehan St". */
export function synthesizeName(
  kind: PlaceKind,
  street: string | null,
  locality: { nameAr: string; nameEn: string }
): { ar: string; en: string } {
  const label = PLACE_KIND_LABELS[kind];
  const suffixAr = street?.trim() || locality.nameAr;
  const suffixEn = street?.trim() || locality.nameEn;
  return { ar: `${label.ar} — ${suffixAr}`, en: `${label.en} — ${suffixEn}` };
}

/** Convenience for building a place with defaults filled in. */
export function makePlace(input: Partial<NormalizedPlace> & Pick<NormalizedPlace, 'externalId' | 'source' | 'latitude' | 'longitude'>): NormalizedPlace {
  return {
    name: null,
    nameEn: null,
    phone: null,
    website: null,
    address: null,
    street: null,
    cuisineSlugs: [],
    placeKind: 'other',
    priceTier: null,
    openingHours: null,
    photoUrl: null,
    photoAttribution: null,
    ...input,
  };
}
