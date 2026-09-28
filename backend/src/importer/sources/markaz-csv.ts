import { readFile } from 'node:fs/promises';
import { parseCsv } from './csv.js';
import { levenshteinRatio, normalizeNameKey, slugify } from '../normalize.js';

/** One `Place Name` row from the 18-markaz Google Maps export. */
export interface MarkazRow {
  placeName: string;
  areaLabel: string;
  markaz: string;
  latitude: number;
  longitude: number;
  accessibility: string[];
  googleMapsUrl: string;
  placeId: string;
}

/** A markaz plus the statistics needed to sanity-check its own coordinates. */
export interface MarkazCluster {
  markaz: string;
  slug: string;
  rows: MarkazRow[];
  latitude: number;
  longitude: number;
  /** Rows whose coordinates contradict the bulk of their own markaz. */
  outliers: Set<MarkazRow>;
}

/** Maximum gap for two places to count as part of the same settled area. */
const LINK_KM = 12;
/** A split markaz is only questioned when the majority side has this many rows. */
const MIN_EVIDENCE_ROWS = 2;

/**
 * Existing `cities` rows already carry Arabic names for these markazes, so the
 * importer reuses them instead of creating near-duplicate geography.
 */
const MARKAZ_CITY_SLUGS: Record<string, string> = {
  Mansoura: 'mansoura',
  Talkha: 'talkha',
  'Mit Ghamr': 'mit-ghamr',
  Belqas: 'belqas',
  Dikirnis: 'dekernes',
  Aga: 'aga',
  Shirbin: 'sherbin',
  'El-Manzala': 'manzala',
  Sinbillawin: 'sinbillawein',
  Nabaroh: 'nabaruh',
  'Mit Salsil': 'mit-salsil',
  'Minyat an-Nasr': 'menyet-el-nasr',
  Gamasa: 'gamsa',
};

/** Spellings the export alternates between for one markaz. */
const MARKAZ_CANONICAL: Record<string, string> = {
  Bilqas: 'Belqas',
};

/**
 * Google Maps reports a post office and a village council unit in this export.
 * They are not food-and-drink places, so they never become Place records.
 */
const NON_FOOD_PATTERNS = [/مكتب\s+بريد/, /الوحدة\s+المحلية/, /مجلس\s+(مدينة|قرية|محلي)/, /محطة\s+وقود/, /مدرسة/, /مستشفى/];

export function isNonFoodPlace(name: string): boolean {
  return NON_FOOD_PATTERNS.some((pattern) => pattern.test(name));
}

/**
 * Collapse the export's area labels onto the markaz they name. Only forms the
 * file itself uses are stripped (`City`, `Markaz …`, `- Rural Villages`, the
 * `Hay Sharq/Gharb` districts of Mansoura, a parenthetical parent such as
 * `Al-Satamoni (Rural Bilqas)`), so no administrative hierarchy is invented.
 */
export function normalizeMarkaz(areaLabel: string): string {
  const label = areaLabel.replace(/\s+/g, ' ').trim();
  const parent = label.match(/\(([^)]+)\)/)?.[1]?.toLowerCase();
  if (parent?.includes('bilqas')) return 'Belqas';
  if (parent?.includes('gamasa')) return 'Gamasa';

  const stripped = label
    .replace(/^Markaz\s+/i, '')
    .replace(/\s*[-–]\s*Rural\s+Villages$/i, '')
    .replace(/\s*[-–]\s*Villages$/i, '')
    .replace(/\s*[-–]\s*Rural$/i, '')
    .replace(/\s*&\s*Resort$/i, '')
    .replace(/\s*[-–]\s*Hay\s+(Sharq|Gharb)$/i, '')
    .replace(/\s+City$/i, '')
    .replace(/[(),]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/[-–]$/g, '')
    .trim();

  return MARKAZ_CANONICAL[stripped] ?? stripped;
}

export function citySlugForMarkaz(markaz: string): string {
  return MARKAZ_CITY_SLUGS[markaz] ?? (slugify(markaz) || 'markaz');
}

/** Split the Google accessibility column into clean Arabic feature phrases. */
function parseAccessibility(raw: string): string[] {
  const parts = raw
    .replace(/[\uE000-\uF8FF\u200E\u200F\uFEFF]/g, '')
    .split('|')
    .map((part) => part.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  // "إمكانية الوصول" is the section heading Google emits before every item.
  const items = parts.filter((part) => part !== 'إمكانية الوصول');
  return items.length > 0 ? items : parts;
}

/** Accessibility facts expressed as atmosphere tags the recommender can filter on. */
export function atmosphereSlugsFor(accessibility: string[]): string[] {
  const text = accessibility.join(' ');
  const slugs: string[] = [];
  if (/الكراسي المتحركة/.test(text)) slugs.push('wheelchair-accessible');
  if (/حلقة سمع|أجهزة الاستماع/.test(text)) slugs.push('hearing-loop');
  return slugs;
}

/** The Latin-script portion of a mixed name, when the source supplied one. */
export function latinPortion(name: string): string | null {
  if (!/[A-Za-z]/.test(name)) return null;
  if (!/[\u0600-\u06FF]/.test(name)) return name.trim();
  const runs = name.match(/[A-Za-z][A-Za-z0-9 .&()'-]*/g) ?? [];
  const longest = runs.map((r) => r.trim().replace(/[-().,&\s]+$/, '').trim()).sort((a, b) => b.length - a.length)[0];
  return longest && longest.length > 1 ? longest : null;
}

export async function readMarkazCsv(filePath: string): Promise<MarkazRow[]> {
  const rows = parseCsv(await readFile(filePath, 'utf8'));
  const headers = rows.shift()?.map((h) => h.trim()) ?? [];
  const indexOf = (name: string) => headers.findIndex((h) => h.toLowerCase() === name.toLowerCase());
  const idx = {
    name: indexOf('Place Name'),
    area: indexOf('Administrative Area / Markaz'),
    lat: indexOf('Latitude'),
    lng: indexOf('Longitude'),
    desc: indexOf('Description / Highlights'),
    maps: indexOf('Google Maps URL'),
  };
  if (Object.values(idx).some((i) => i < 0)) {
    throw new Error('Unexpected header set; expected Place Name, Administrative Area / Markaz, Latitude, Longitude, Description / Highlights, Google Maps URL');
  }

  const seen = new Set<string>();
  const places: MarkazRow[] = [];
  for (const row of rows) {
    const placeName = (row[idx.name] ?? '').trim();
    const latitude = Number(row[idx.lat]);
    const longitude = Number(row[idx.lng]);
    const googleMapsUrl = (row[idx.maps] ?? '').trim();
    const placeId = googleMapsUrl.match(/19s([A-Za-z0-9_-]+)/)?.[1] ?? '';
    if (!placeName || !Number.isFinite(latitude) || !Number.isFinite(longitude) || !placeId) continue;
    if (seen.has(placeId)) continue;
    seen.add(placeId);
    places.push({
      placeName,
      areaLabel: (row[idx.area] ?? '').trim(),
      markaz: normalizeMarkaz(row[idx.area] ?? ''),
      latitude,
      longitude,
      accessibility: parseAccessibility(row[idx.desc] ?? ''),
      googleMapsUrl,
      placeId,
    });
  }
  return places;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

export function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Single-linkage components at `LINK_KM`, so a chain of villages stays together. */
function components(rows: MarkazRow[]): MarkazRow[][] {
  const unseen = new Set(rows);
  const groups: MarkazRow[][] = [];
  while (unseen.size > 0) {
    const seed = unseen.values().next().value as MarkazRow;
    const bucket: MarkazRow[] = [];
    const queue = [seed];
    unseen.delete(seed);
    while (queue.length > 0) {
      const current = queue.pop() as MarkazRow;
      bucket.push(current);
      for (const other of unseen) {
        if (distanceKm(current.latitude, current.longitude, other.latitude, other.longitude) <= LINK_KM) {
          unseen.delete(other);
          queue.push(other);
        }
      }
    }
    groups.push(bucket);
  }
  return groups;
}

/**
 * Build one cluster per markaz and question the rows whose coordinates
 * contradict the bulk of their own markaz. Coordinates stay authoritative: an
 * inconsistent row is re-parented by proximity instead of by its area label.
 */
export function buildMarkazClusters(rows: MarkazRow[]): MarkazCluster[] {
  const byMarkaz = new Map<string, MarkazRow[]>();
  for (const row of rows) {
    const list = byMarkaz.get(row.markaz) ?? [];
    list.push(row);
    byMarkaz.set(row.markaz, list);
  }

  const clusters: MarkazCluster[] = [];
  for (const [markaz, members] of byMarkaz) {
    const parts = components(members).sort((a, b) => b.length - a.length);
    const majority = parts[0] ?? members;
    const split = parts.length > 1 && majority.length >= MIN_EVIDENCE_ROWS;
    const outliers = new Set(split ? members.filter((m) => !majority.includes(m)) : []);
    const kept = split ? majority : members;
    clusters.push({
      markaz,
      slug: citySlugForMarkaz(markaz),
      rows: members,
      latitude: median(kept.map((r) => r.latitude)),
      longitude: median(kept.map((r) => r.longitude)),
      outliers,
    });
  }
  return clusters.sort((a, b) => a.markaz.localeCompare(b.markaz));
}

/**
 * Choose the city for a row: its own markaz when the coordinates agree with the
 * label, another markaz only when the place genuinely sits inside that cluster,
 * and nothing at all when it is isolated — a Rural Place stays discoverable by
 * its coordinates.
 */
export function resolveCity(row: MarkazRow, clusters: MarkazCluster[]): { cluster: MarkazCluster | null; contradictsLabel: boolean } {
  const own = clusters.find((c) => c.markaz === row.markaz) ?? null;
  if (own && !own.outliers.has(row)) return { cluster: own, contradictsLabel: false };

  // Being split off from its own markaz means every same-markaz place is already
  // further than LINK_KM, so only another markaz with real neighbours counts.
  const votes = clusters
    .filter((c) => c !== own)
    .map((cluster) => {
      const distances = cluster.rows
        .map((r) => distanceKm(row.latitude, row.longitude, r.latitude, r.longitude))
        .sort((a, b) => a - b);
      return { cluster, near: distances.filter((km) => km <= LINK_KM).length, nearest: distances[0] ?? Infinity };
    })
    .filter((vote) => vote.near >= MIN_EVIDENCE_ROWS)
    .sort((a, b) => b.near - a.near || a.nearest - b.nearest);

  return { cluster: votes[0]?.cluster ?? null, contradictsLabel: Boolean(own) };
}

/**
 * Same-brand test for attaching a place to an existing restaurant. Deliberately
 * stricter than `namesMatch`: containment is only trusted for long names, so a
 * generic word like `مطعم` cannot absorb every other restaurant behind it.
 */
export function sameBrand(a: string, b: string): boolean {
  const ka = normalizeNameKey(a);
  const kb = normalizeNameKey(b);
  if (!ka || !kb) return false;
  if (ka === kb) return true;
  if (levenshteinRatio(ka, kb) >= 0.85) return true;
  return ka.length >= 6 && kb.length >= 6 && (ka.includes(kb) || kb.includes(ka));
}
