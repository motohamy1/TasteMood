import { OVERTURE_CATEGORY_MAP } from '../taxonomy.js';
import { makePlace } from '../normalize.js';
import type { NormalizedPlace } from '../types.js';

/**
 * Overture Maps places fetcher (optional secondary source).
 *
 * Requires the native `duckdb` package (`npm i duckdb`) and reads the public
 * Overture S3 bucket with an anonymous httpfs connection. This fetcher is
 * best-effort: when the dependency or network is unavailable the importer
 * continues with OSM + Foursquare.
 */

const DEFAULT_RELEASE = '2025-02-19.0';
const BUCKET = 'overturemaps-us-west-2';

interface OvertureRow {
  id: string;
  latitude: number;
  longitude: number;
  primary: string | null;
  category: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  brand: string | null;
}

interface DuckDbConnection {
  all(query: string, cb: (err: Error | null, rows: OvertureRow[]) => void): void;
  close(): void;
}

interface DuckDbInstance {
  connect(): DuckDbConnection;
  close(): void;
}

interface DuckDbModule {
  Database: new (path: string) => DuckDbInstance;
}

export async function fetchOverturePlaces(
  bbox: { south: number; west: number; north: number; east: number },
  release = process.env.OVERTURE_RELEASE || DEFAULT_RELEASE
): Promise<NormalizedPlace[]> {
  const specifier = 'duckdb'; // non-literal so a missing optional dependency is a runtime, not compile, error
  const duckdbModule = (await import(specifier)) as unknown as DuckDbModule | null;
  if (!duckdbModule) {
    throw new Error('Overture source requires the duckdb package: npm i duckdb');
  }

  const db = new duckdbModule.Database(':memory:');
  const connection = db.connect();
  const query = `
    SET s3_region='us-west-2';
    SELECT
      id,
      latitude,
      longitude,
      names.primary AS primary,
      categories.primary AS category,
      phone,
      website,
      addresses[1].formatted_address AS address,
      brand.names.primary AS brand
    FROM read_parquet('s3://${BUCKET}/release/${release}/theme=places/type=place/*.zstd.parquet')
    WHERE latitude BETWEEN ${bbox.south} AND ${bbox.north}
      AND longitude BETWEEN ${bbox.west} AND ${bbox.east}`;

  const rows = await new Promise<OvertureRow[]>((resolve, reject) => {
    connection.all(query, (err: Error | null, result: OvertureRow[]) => {
      if (err) reject(err);
      else resolve(result ?? []);
    });
  });
  connection.close();
  db.close();

  return rows
    .filter((row) => typeof row.latitude === 'number' && typeof row.longitude === 'number')
    .map((row) => {
      const category = (row.category ?? '').toLowerCase();
      let cuisineSlug = 'other';
      for (const [pattern, slug] of OVERTURE_CATEGORY_MAP) {
        if (pattern.test(category)) {
          cuisineSlug = slug;
          break;
        }
      }
      const displayName = row.brand ?? row.primary;
      return makePlace({
        externalId: `ov/${row.id}`,
        source: 'OVERTURE',
        name: displayName ?? null,
        nameEn: displayName ?? null,
        latitude: row.latitude,
        longitude: row.longitude,
        phone: row.phone ?? null,
        website: row.website ?? null,
        address: row.address ?? null,
        cuisineSlugs: [cuisineSlug],
        placeKind: /coffee/.test(category) ? 'cafe' : 'restaurant',
      });
    });
}
