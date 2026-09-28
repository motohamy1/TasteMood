import dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';

const dbUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
const p = new PrismaClient({ datasourceUrl: dbUrl });

(async () => {
  const total = await p.dish.count();
  const csv = await p.dish.count({ where: { source: 'CSV' } });
  const active = await p.dish.count({ where: { status: 'ACTIVE' } });
  const recent = await p.dish.findMany({
    where: { source: 'CSV' },
    include: { menu: { include: { restaurant: true } } },
    orderBy: { createdAt: 'desc' },
    take: 30
  });
  console.log('Total dishes:', total);
  console.log('CSV source dishes:', csv);
  console.log('Active dishes:', active);
  console.log('\nRecent CSV dishes:');
  for (const d of recent) {
    console.log(`  - ${d.name} (${d.price} EGP) → ${d.menu.restaurant.name} [${d.status}]`);
  }

  // Branch breakdown
  const branchesBySource = await p.branch.groupBy({ by: ['source'], _count: true });
  console.log('\nBranches by source:', JSON.stringify(branchesBySource, null, 2));

  await p.$disconnect();
})().catch(e => { console.error(e.message); process.exit(1); });
