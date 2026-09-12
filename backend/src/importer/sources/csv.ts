import { readFile } from 'node:fs/promises';
import { makePlace, mapOsmCuisines } from '../normalize.js';
import type { NormalizedPlace } from '../types.js';

export interface CsvMenuRow {
  restaurantName: string;
  city: string | null;
  district: string | null;
  placeType: string | null;
  cuisines: string[];
  itemName: string;
  price: number;
  priceText: string;
  description: string | null;
  phone: string | null;
}

/** Parse one CSV record, including quoted commas and escaped quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const next = text[index + 1];
    if (character === '"') {
      if (quoted && next === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === ',' && !quoted) {
      row.push(field.trim());
      field = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && next === '\n') index += 1;
      row.push(field.trim());
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      field = '';
    } else {
      field += character;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field.trim());
    rows.push(row);
  }
  return rows;
}

function asRecords(text: string): Array<Record<string, string>> {
  const rows = parseCsv(text);
  const headers = rows.shift()?.map((header) => header.trim()) ?? [];
  return rows.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])));
}

function nullable(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed ? trimmed : null;
}

function parsePrice(value: string): { amount: number; text: string } | null {
  const numbers = value.match(/\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  if (numbers.length === 0) return null;
  const amount = numbers.length > 1 ? (numbers[0] + numbers[1]) / 2 : numbers[0];
  return { amount, text: value.trim() };
}

export async function readPlaceCsv(filePath: string): Promise<NormalizedPlace[]> {
  const records = asRecords(await readFile(filePath, 'utf8'));
  return records.flatMap((record) => {
    const latitude = Number(record.Latitude);
    const longitude = Number(record.Longitude);
    if (!record.ID || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return [];

    const name = nullable(record['Name (AR)']) ?? nullable(record['Name (EN)']);
    const nameEn = nullable(record['Name (EN)']);
    const amenity = nullable(record.Amenity);
    const cuisine = nullable(record.Cuisine);
    return [makePlace({
      externalId: `csv/places/${record.ID}`,
      source: 'CSV_PLACES',
      name,
      nameEn: nameEn && nameEn !== name ? nameEn : null,
      latitude,
      longitude,
      phone: nullable(record.Phone),
      website: null,
      address: [nullable(record.Street), nullable(record['City/Town'])].filter(Boolean).join('، ') || null,
      street: nullable(record.Street),
      cuisineSlugs: mapOsmCuisines(cuisine, amenity, null),
      placeKind: amenity === 'cafe' ? 'cafe' : amenity === 'restaurant' ? 'restaurant' : 'other',
      openingHours: null,
    })];
  });
}

export async function readMenuCsv(filePath: string): Promise<CsvMenuRow[]> {
  const records = asRecords(await readFile(filePath, 'utf8'));
  return records.flatMap((record) => {
    const parsedPrice = parsePrice(record.Price ?? '');
    const restaurantName = nullable(record['Restaurant Name']);
    const itemName = nullable(record['Menu Item']);
    if (!restaurantName || !itemName || !parsedPrice) return [];
    return [{
      restaurantName,
      city: nullable(record['City/Town']),
      district: nullable(record['District/Area']),
      placeType: nullable(record.Type),
      cuisines: (record['Cuisines/Categories'] ?? '').split(',').map((value) => value.trim()).filter(Boolean),
      itemName,
      price: parsedPrice.amount,
      priceText: parsedPrice.text,
      description: nullable(record.Description),
      phone: nullable(record['Contact/Phone']),
    }];
  });
}