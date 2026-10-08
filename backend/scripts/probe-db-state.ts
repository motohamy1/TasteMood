import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
async function main() {
  const all = await db.branch.count();
  const sourceCounts = await db.branch.groupBy({ by: ['source'], _count: true });
  const activeCount = await db.branch.count({ where: { status: 'ACTIVE' } });
  const draftCount = await db.branch.count({ where: { status: 'DRAFT' } });
  const gmaps = await db.branch.findMany({
    where: { source: 'GMAPS_PLAYWRIGHT' },
    select: { externalId: true, name: true, status: true, address: true, placeKind: true, cityId: true, governorateId: true },
    take: 5,
  });
  const haveAddress = await db.branch.count({ where: { address: { not: '' } } });
  const havePhone = await db.branch.count({ where: { phone: { not: null } } });
  const haveHours = await db.branchOperatingHour.count();
  const havePhotos = await db.placePhoto.count();
  const haveCuisines = await db.restaurantCuisine.count();
  const haveMenus = await db.menu.count();
  const haveDishes = await db.dish.count();
  console.log('All branches:', all, '| ACTIVE:', activeCount, '| DRAFT:', draftCount);
  console.log('By source:', sourceCounts);
  console.log('Address not null:', haveAddress, '| Phone not null:', havePhone);
  console.log('Operating hours rows:', haveHours, '| Photos:', havePhotos);
  console.log('Cuisines:', haveCuisines, '| Menus:', haveMenus, '| Dishes:', haveDishes);
  console.log('Sample GMAPS rows:');
  for (const b of gmaps) {
    console.log('  ', b.status, (b.externalId || '').slice(0, 40), '|', b.name, '| addr:', b.address, '| kind:', b.placeKind, '| cityId:', !!b.cityId, '| govId:', !!b.governorateId);
  }
}
main().finally(() => db.$disconnect());
