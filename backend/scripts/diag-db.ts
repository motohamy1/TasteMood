import { PrismaClient } from '@prisma/client';

async function tryUrl(label: string, url: string) {
  const p = new PrismaClient({
    datasources: { db: { url } },
    log: ['error'],
  });
  const start = Date.now();
  try {
    await p.$connect();
    const r = await p.$queryRaw`SELECT 1 as ok, current_database() as db, version() as v`;
    console.log(`[${label}] OK in ${Date.now() - start}ms`);
    console.log(JSON.stringify(r, null, 2));
  } catch (e: any) {
    console.log(`[${label}] FAIL in ${Date.now() - start}ms`);
    console.log('  message:', e?.message);
    console.log('  code   :', e?.code);
    console.log('  meta   :', JSON.stringify(e?.meta ?? null));
    console.log('  cause  :', e?.cause?.message ?? e?.cause);
  } finally {
    await p.$disconnect().catch(() => {});
  }
}

async function main() {
  const pooler = process.env.DATABASE_URL!;
  const direct = process.env.DIRECT_URL!;
  console.log('--- pooler (6543) ---');
  await tryUrl('pooler', pooler);
  console.log('--- direct (5432) ---');
  await tryUrl('direct', direct);
}

main();
