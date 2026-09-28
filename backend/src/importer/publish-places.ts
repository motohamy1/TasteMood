import dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';

/**
 * Promotes reviewed import output to ACTIVE. Listings are only served when the
 * restaurant *and* the branch are ACTIVE, so both have to move together.
 * `verificationStatus` is deliberately untouched — it stays the honesty signal
 * for what a human or an authorised source has actually confirmed.
 * INACTIVE branches are never resurrected; only DRAFT rows are promoted.
 */
const DEFAULT_SOURCES = ['GMAPS_MARKAZ', 'CSV_PLACES', 'OSM'];

const db = new PrismaClient(process.env.DIRECT_URL ? { datasourceUrl: process.env.DIRECT_URL } : undefined);

function parseArgs(argv: string[]): { sources: string[]; dryRun: boolean; governorate: string | null } {
  const sources = argv.find((a) => a.startsWith('--sources='))?.split('=')[1]?.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
  const governorate = argv.find((a) => a.startsWith('--governorate='))?.split('=')[1] ?? null;
  return { sources: sources && sources.length > 0 ? sources : DEFAULT_SOURCES, dryRun: argv.includes('--dry-run'), governorate };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const branchWhere = {
    status: 'DRAFT' as const,
    source: { in: args.sources },
    ...(args.governorate ? { governorate: { slug: args.governorate } } : {}),
  };

  const draftBranches = await db.branch.findMany({
    where: branchWhere,
    select: { id: true, restaurantId: true, source: true },
  });

  if (draftBranches.length === 0) {
    console.log(`Nothing to publish: no DRAFT branches for ${args.sources.join(', ')}.`);
    return;
  }

  const restaurantIds = [...new Set(draftBranches.map((b) => b.restaurantId))];
  const draftRestaurants = await db.restaurant.findMany({
    where: { id: { in: restaurantIds }, status: 'DRAFT' },
    select: { id: true },
  });

  const orphans = await db.restaurant.count({ where: { status: 'DRAFT', branches: { none: {} } } });

  console.log(
    `Sources ${args.sources.join(', ')}${args.governorate ? ` in ${args.governorate}` : ''}: ` +
      `publishing ${draftBranches.length} branch(es) across ${restaurantIds.length} restaurant(s), of which ${draftRestaurants.length} are still DRAFT.`
  );
  const bySource = draftBranches.reduce<Record<string, number>>((acc, b) => ({ ...acc, [b.source]: (acc[b.source] ?? 0) + 1 }), {});
  console.log('  branches:', Object.entries(bySource).map(([k, v]) => `${k}=${v}`).join(' '));
  if (orphans > 0) console.log(`  left alone: ${orphans} DRAFT restaurant(s) with no branches at all.`);

  if (args.dryRun) {
    console.log('DRY RUN — nothing written.');
    return;
  }

  const branches = await db.branch.updateMany({ where: { id: { in: draftBranches.map((b) => b.id) } }, data: { status: 'ACTIVE' } });
  const restaurants = await db.restaurant.updateMany({ where: { id: { in: draftRestaurants.map((r) => r.id) } }, data: { status: 'ACTIVE' } });
  console.log(`Published ${branches.count} branch(es) and ${restaurants.count} restaurant(s). Verification statuses unchanged.`);
}

main()
  .catch((error) => {
    console.error('Publish failed:', error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
