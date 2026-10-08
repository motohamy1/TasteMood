import dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

async function main() {
  const gov = await db.governorate.findUnique({
    where: { slug: 'dakahlia' },
    include: { cities: true },
  });
  if (!gov) throw new Error('no dakahlia governorate');

  const withCoords = gov.cities.filter((c) => c.latitude != null && c.longitude != null);
  console.log('cities:', gov.cities.length, '| with coordinates:', withCoords.length);

  // Which pairs of Dakahlia cities are implausibly far apart?
  const rows: string[] = [];
  for (let i = 0; i < withCoords.length; i += 1) {
    for (let j = i + 1; j < withCoords.length; j += 1) {
      const a = withCoords[i];
      const b = withCoords[j];
      const d = haversineKm(a.latitude!, a.longitude!, b.latitude!, b.longitude!);
      if (d > 45) {
        rows.push(
          `${d.toFixed(1)}km  ${a.nameEn}(${a.latitude},${a.longitude})  <->  ${b.nameEn}(${b.latitude},${b.longitude})`,
        );
      }
    }
  }
  console.log('\ncity pairs >45km apart (Dakahlia is ~60km across):');
  console.log(rows.join('\n'));

  console.log('\nall Dakahlia city coordinates:');
  for (const c of withCoords.sort((a, b) => a.nameEn.localeCompare(b.nameEn))) {
    console.log(`  ${c.slug.padEnd(28)} ${c.nameEn.padEnd(28)} ${c.latitude}, ${c.longitude}`);
  }

  const missing = gov.cities.filter((c) => c.latitude == null || c.longitude == null);
  console.log(`\ncities missing coordinates (${missing.length}):`);
  console.log(missing.map((c) => `  ${c.slug} | ${c.nameEn}`).join('\n'));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());