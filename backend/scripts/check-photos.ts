import dotenv from 'dotenv';
dotenv.config();
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient({ datasourceUrl: process.env.DIRECT_URL });

(async () => {
  try {
    const c = await p.placePhoto.count();
    console.log('Photos in DB:', c);
    const byType = await p.placePhoto.groupBy({
      by: ['photoType'],
      _count: true,
      orderBy: { _count: { photoType: 'desc' } },
      take: 15,
    });
    console.log('By type:', JSON.stringify(byType, null, 2));
    const byBranch = await p.placePhoto.groupBy({
      by: ['branchId'],
      _count: true,
    });
    console.log('Branches with photos:', byBranch.length);
    const totalBranches = await p.branch.count();
    console.log('Total branches:', totalBranches);
    console.log('Coverage:', `${byBranch.length}/${totalBranches}`);
  } finally {
    await p.$disconnect();
  }
})();
