import type { PlaceKind } from './taxonomy.js';

export type ImportSource = 'OSM' | 'OVERTURE' | 'FOURSQUARE';

export interface OpeningHour {
  dayOfWeek: number; // 0 = Sunday … 6 = Saturday (matches BranchOperatingHour)
  openTime: string; // "HH:mm"
  closeTime: string; // "HH:mm" (closeTime <= openTime means overnight shift)
  isClosed: boolean;
  isSplitShift: boolean;
}

/** A place normalized from any source, before dedup/upsert. */
export interface NormalizedPlace {
  externalId: string; // e.g. "osm/node/123", "fsq/abc", "ov/uuid"
  source: ImportSource;
  name: string | null; // primary name, often Arabic in Egypt
  nameEn: string | null;
  latitude: number;
  longitude: number;
  phone: string | null;
  website: string | null;
  address: string | null;
  street: string | null;
  cuisineSlugs: string[];
  placeKind: PlaceKind;
  priceTier: number | null; // 1-4 (Foursquare), null when unknown
  openingHours: OpeningHour[] | null;
  photoUrl: string | null;
  photoAttribution: string | null;
}

/** Places clustered into a brand (Restaurant) with one or more branches. */
export interface PlaceGroup {
  key: string; // normalized brand key
  places: NormalizedPlace[];
}
