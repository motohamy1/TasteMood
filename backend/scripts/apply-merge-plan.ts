/**
 * Batched, retry-aware publisher. Reads merge-plan.json and applies
 * it in small transactions, with retry on transient pooler drops.
 *
 * Usage:
 *   npx tsx scripts/apply-merge-plan.ts                    # default batch 50
 *   npx tsx scripts/apply-merge-plan.ts --batch=25
 *   npx tsx scripts/apply-merge-plan.ts --plan=enrichments/merge-plan.json
 */

import { readFile } from 'node:fs/promises';
import { PrismaClient } from '@prisma/client';
import type { Prisma } from '@prisma/client';

interface Args { batch: number; plan: string }
function parseArgs(argv: string[]): Args {
  const out: Args = { batch: 50, plan: 'enrichments/merge-plan.json' };
  for (const a of argv) {
    if (a.startsWith('--batch=')) out.batch = Number(a.split('=')[1]);
    if (a.startsWith('--plan=')) out.plan = a.split('=')[1];
  }
  return out;
}

interface BranchPlan {
  branchId: string;
  externalId: string;
  before: { cuisineCount: number; hoursCount: number; placeKind: string | null; phone: string | null };
  plan: {
    address: string | null;
    phone: string | null;
    placeKind: string | null;
    cuisineSlugs: string[];
    hours: Array<{ dayOfWeek: number; openTime: string; closeTime: string; isClosed: boolean; isSplitShift: boolean }> | null;
  };
  applied: boolean;
  reason: string;
}

async function withRetry<T>(label: string, attempts: number, fn: () => Promise<T>): Promise<T> {
  for (let a = 1; a <= attempts; a += 1) {
    try { return await fn(); }
    catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const transient = /P1001|P1008|P2024|Transaction not found|terminating connection|Connection|ECONNRESET|ETIMEDOUT|closed transaction/i.test(msg);
      if (!transient || a === attempts) throw e;
      console.log(`  [${label}] transient failure, retry ${a}/${attempts}: ${msg.slice(0, 80)}`);
      await new Promise((r) => setTimeout(r, 2000 * a));
    }
  }
  throw new Error(`${label}: exhausted`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const db = new PrismaClient();
  const plans: BranchPlan[] = JSON.parse(await readFile(args.plan, 'utf8'));
  const todo = plans.filter((p) => p.reason !== 'no-change' && !p.applied);
  console.log(`[apply] ${todo.length} plans to apply, batch=${args.batch}`);

  // Pre-fetch cuisine slug → id so the batch doesn't repeat
  const wantedCuisines = [...new Set(todo.flatMap((p) => p.plan.cuisineSlugs))];
  const cuisineRows = wantedCuisines.length > 0
    ? await db.cuisine.findMany({ where: { slug: { in: wantedCuisines } }, select: { id: true, slug: true } })
    : [];
  const cuisineIdBySlug = new Map(cuisineRows.map((c) => [c.slug, c.id]));

  let applied = 0;
  for (let i = 0; i < todo.length; i += args.batch) {
    const batch = todo.slice(i, i + args.batch);
    const batchLabel = `batch ${Math.floor(i / args.batch) + 1}/${Math.ceil(todo.length / args.batch)}`;
    process.stdout.write(`  ${batchLabel} (${batch.length}) ... `);

    await withRetry(batchLabel, 4, () =>
      db.$transaction(
        async (tx) => {
          for (const p of batch) {
            const data: Prisma.BranchUpdateInput = {};
            if (p.plan.address) data.address = p.plan.address;
            if (p.plan.phone) data.phone = p.plan.phone;
            if (p.plan.placeKind) data.placeKind = p.plan.placeKind;
            if (Object.keys(data).length > 0) {
              await tx.branch.update({ where: { id: p.branchId }, data });
            }
            if (p.plan.cuisineSlugs.length > 0) {
              const branch = await tx.branch.findUnique({
                where: { id: p.branchId },
                select: { restaurantId: true },
              });
              if (branch) {
                await tx.restaurantCuisine.createMany({
                  data: p.plan.cuisineSlugs
                    .map((slug) => {
                      const cuisineId = cuisineIdBySlug.get(slug);
                      return cuisineId ? { restaurantId: branch.restaurantId, cuisineId } : null;
                    })
                    .filter((x): x is { restaurantId: string; cuisineId: string } => x !== null),
                  skipDuplicates: true,
                });
              }
            }
            if (p.plan.hours && p.plan.hours.length > 0) {
              await tx.branchOperatingHour.deleteMany({ where: { branchId: p.branchId } });
              await tx.branchOperatingHour.createMany({
                data: p.plan.hours.map((h) => ({ ...h, branchId: p.branchId })),
              });
            }
            p.applied = true;
          }
        },
        { maxWait: 15000, timeout: 90000 },
      ),
    );

    applied += batch.length;
    console.log(`OK (${applied}/${todo.length})`);
  }

  console.log(`\n[apply] complete — ${applied} branches updated`);
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
