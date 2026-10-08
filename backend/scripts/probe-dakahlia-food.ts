import dotenv from 'dotenv';
dotenv.config();

import { readFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

interface RawRow {
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

async function main() {
  const rows = JSON.parse(
    readFileSync('../dakahlia_food/dakahlia_food.json', 'utf8'),
  ) as RawRow[];

  console.log('rows:', rows.length);

  const chijOf = (r: RawRow) => (r.google_maps_url ?? '').match(/19s([A-Za-z0-9_-]+)/)?.[1] ?? '';
  const hexOf = (r: RawRow) => r.place_id;

  const withChij = rows.filter((r) => chijOf(r));
  const chijSet = new Set(withChij.map(chijOf));
  console.log('rows with ChIJ:', withChij.length, '| unique ChIJ:', chijSet.size);

  // existing branches in DB
  const existing = await db.branch.findMany({
    select: { externalId: true, name: true, source: true, latitude: true, longitude: true },
  });
  console.log('existing branches:', existing.length);

  const existingIds = new Set(existing.map((b) => b.externalId));

  // How many new rows collide with an existing ChIJ-shaped externalId?
  let collideChij = 0;
  const collideSamples: string[] = [];
  for (const r of withChij) {
    const id = `gmaps/place/${chijOf(r)}`;
    if (existingIds.has(id)) {
      collideChij += 1;
      if (collideSamples.length < 8) collideSamples.push(`${r.name} <-> ${id}`);
    }
  }
  console.log('collisions with existing gmaps/place/<ChIJ>:', collideChij);
  console.log(collideSamples.join('\n'));

  // Do any existing hex-form ids exist?
  const hexExisting = existing.filter((b) => /^gmaps\/hex\//.test(b.externalId));
  console.log('existing gmaps/hex/ ids:', hexExisting.length);

  // name overlap (lowercased) to gauge duplicate places across sources
  const normName = (s: string) =>
    s
      .toLowerCase()
      .replace(/[\u064B-\u0652]/g, '')
      .replace(/[أإآ]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/ى/g, 'ي')
      .replace(/\s+/g, ' ')
      .trim();
  const existingNames = new Set(existing.map((b) => normName(b.name)));
  const existingRestaurantNames = new Set(
    (await db.restaurant.findMany({ select: { name: true } })).map((r) => normName(r.name)),
  );

  let nameHitBranch = 0;
  let nameHitRestaurant = 0;
  const nameSamples: string[] = [];
  for (const r of rows) {
    const n = normName(r.name);
    if (existingNames.has(n)) {
      nameHitBranch += 1;
      if (nameSamples.length < 12) nameSamples.push(`branch-name hit: ${r.name}`);
    } else if (existingRestaurantNames.has(n)) {
      nameHitRestaurant += 1;
      if (nameSamples.length < 12) nameSamples.push(`restaurant-name hit: ${r.name}`);
    }
  }
  console.log('\nname hits -> branch:', nameHitBranch, '| restaurant:', nameHitRestaurant);
  console.log(nameSamples.join('\n'));

  // rating parse check
  const parseRating = (s: string) => {
    if (!s) return null;
    const n = Number(s.replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  };
  const bad = rows.filter((r) => r.rating && parseRating(r.rating) === null);
  console.log('\nunparseable ratings:', bad.length);
  const rv = rows
    .filter((r) => r.rating)
    .map((r) => parseRating(r.rating) as number)
    .filter((n) => n >= 0 && n <= 5);
  console.log('ratings in [0,5]:', rv.length, 'of', rows.filter((r) => r.rating).length);

  const badReviews = rows.filter((r) => {
    if (!r.reviews) return false;
    const n = Number(String(r.reviews).replace(/[^\d]/g, ''));
    return !Number.isFinite(n);
  });
  console.log('unparseable reviews:', badReviews.length);

  // bbox sanity for Dakahlia
  const lats = rows.map((r) => Number(r.lat));
  const lngs = rows.map((r) => Number(r.lng));
  console.log(
    '\nlat range',
    Math.min(...lats).toFixed(4),
    Math.max(...lats).toFixed(4),
    '| lng range',
    Math.min(...lngs).toFixed(4),
    Math.max(...lngs).toFixed(4),
  );

  // cross-check: coordinates whose own city_source disagrees badly
  const cityCenter: Record<string, [number, number]> = {
    Mansoura: [31.0409, 31.3785],
    Talkha: [31.0545, 31.3855],
    'Mit Ghamr': [30.718, 31.2625],
    Dekernes: [30.9542, 31.5575],
    Belqas: [31.139, 31.37],
    Sherbin: [31.1928, 31.5219],
    Sinbillawein: [30.8777, 31.4522],
    Matareya: [31.1783, 31.5047],
    Manzala: [31.15, 31.9333],
    Gamasa: [31.4356, 31.6761],
    Gamasa_suburb_south: [31.37, 31.67],
    Rasheed: [31.4103, 31.7528],
    Faraskur: [31.3256, 31.7181],
    'Bani Ubaid': [30.9728, 31.4408],
    'Mahalla Damana': [31.0897, 31.5506],
    'Mit Salsil': [30.8464, 31.5169],
    Bagour: [30.9667, 31.2333],
  };
  const distKm = (la1: number, lo1: number, la2: number, lo2: number) => {
    const R = 6371;
    const dLa = ((la2 - la1) * Math.PI) / 180;
    const dLo = ((lo2 - lo1) * Math.PI) / 180;
    const a =
      Math.sin(dLa / 2) ** 2 +
      Math.cos((la1 * Math.PI) / 180) * Math.cos((la2 * Math.PI) / 180) * Math.sin(dLo / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  };
  let far = 0;
  const farSamples: string[] = [];
  for (const r of rows) {
    const c = cityCenter[r.city_source];
    if (!c) continue;
    const d = distKm(Number(r.lat), Number(r.lng), c[0], c[1]);
    if (d > 25) {
      far += 1;
      if (farSamples.length < 15)
        farSamples.push(`${r.city_source} <- ${r.name} @ ${d.toFixed(1)}km`);
    }
  }
  console.log('rows >25km from their city_source centre:', far);
  console.log(farSamples.join('\n'));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());