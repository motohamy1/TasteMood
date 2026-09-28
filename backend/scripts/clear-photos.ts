import dotenv from 'dotenv';
dotenv.config();
import { PrismaClient } from '@prisma/client';
const dbUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
let p = new PrismaClient({ datasourceUrl: dbUrl });
async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  for (let attempt = 1; attempt <= 5; attempt++) {
    try { return await fn(); }
    catch (e: any) {
      const msg = String(e.message || '').split('\n')[0];
      if (attempt === 5 || !/Can't reach|ECONNRESET/i.test(msg)) throw e;
      console.log(`[${attempt}] ${label} retry: ${msg}`);
      try { await p.$disconnect(); } catch {}
      p = new PrismaClient({ datasourceUrl: dbUrl });
      await new Promise(r => setTimeout(r, 2000 * attempt));
    }
  }
  throw new Error('unreachable');
}
(async () => {
  const c = await withRetry(() => p.placePhoto.count(), 'count');
  console.log('Before:', c);
  if (c > 0) {
    await withRetry(() => p.placePhoto.deleteMany({}), 'delete');
    const c2 = await withRetry(() => p.placePhoto.count(), 'count2');
    console.log('After:', c2);
  }
  await p.$disconnect();
})();
