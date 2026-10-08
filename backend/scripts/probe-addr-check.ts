import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
async function m() {
  const r = await db.branch.findMany({
    where: { source: 'GMAPS_PLAYWRIGHT' },
    select: { externalId: true, name: true, address: true },
    take: 12,
    orderBy: { externalId: 'asc' },
  });
  for (const b of r) {
    console.log(((b.externalId || '').slice(0, 30)).padEnd(30), '|', ((b.name || '').slice(0, 32)).padEnd(32), '|', b.address);
  }
}
m().finally(() => db.$disconnect());
