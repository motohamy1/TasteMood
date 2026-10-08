/**
 * Promote the Dakahlia Google Maps scrape from DRAFT to ACTIVE.
 *
 * Every branch the importer wrote carries source = GMAPS_PLAYWRIGHT, so this
 * is scoped to that source and cannot touch the demo seed or other imports.
 * Promotes the branch's Restaurant too, since a place the user can browse is
 * useless if its brand row stays hidden.
 *
 *   npx tsx scripts/publish-gmaps-import.ts --dry-run
 *   npx tsx scripts/publish-gmaps-import.ts
 */
import dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';

const SOURCE = 'GMAPS_PLAYWRIGHT';

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const db = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } });

  const branches = await db.branch.findMany({
    where: { source: SOURCE, status: { not: 'ACTIVE' } },
    select: { id: true, restaurantId: true },
  });
  const restaurantIds = [...new Set(branches.map((b) => b.restaurantId))];

  console.log(`branches to promote: ${branches.length}`);
  console.log(`restaurants to promote: ${restaurantIds.length}`);

  if (dryRun) {
    console.log('\n[dry-run] nothing written.');
    await db.$disconnect();
    return;
  }

  if (branches.length > 0) {
    await db.branch.updateMany({
      where: { id: { in: branches.map((b) => b.id) } },
      data: { status: 'ACTIVE' },
    });
    await db.restaurant.updateMany({
      where: { id: { in: restaurantIds } },
      data: { status: 'ACTIVE' },
    });
  }

  const activeBranches = await db.branch.count({ where: { source: SOURCE, status: 'ACTIVE' } });
  console.log(`\nactive scrape branches now: ${activeBranches}`);
  await db.$disconnect();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => process.exit(0));