import { describe, expect, it, vi, beforeEach } from 'vitest';

const dishFindRankingPool = vi.fn();
const profileFindByUserId = vi.fn();

// vi.doMock (not hoisted, unlike vi.mock) so the mock factories can close
// over the fn handles above — same seam pattern as interaction-taste-vector.test.ts.
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
vi.doMock('../../src/modules/dishes/repository.js', () => ({
  dishRepository: { findRankingPool: (...args: unknown[]) => dishFindRankingPool(...args) },
}));
vi.doMock('../../src/modules/preferences/repository.js', () => ({
  preferencesRepository: { findByUserId: (userId: string) => profileFindByUserId(userId) },
}));

// Dynamic imports must resolve after the doMock registrations above, so
// static imports cannot work here (same reason as the sibling test file).
const { PairTasteService, pickProbeDimension, confidenceFor } = await import(
  '../../src/modules/pair-taste/service.js'
);
const { PairTasteRequestSchema, PairTasteResponseSchema } = await import(
  '../../src/modules/pair-taste/schema.js'
);
import type { PairTasteDish } from '../../src/modules/pair-taste/service.js';

const MONDAY_NOON = new Date(2026, 8, 28, 12, 0);
const DAY = MONDAY_NOON.getDay();

function branch(id: string) {
  return {
    id,
    name: `Branch ${id}`,
    address: 'Cairo',
    latitude: 30.0,
    longitude: 31.2,
    operatingHours: [{ dayOfWeek: DAY, openTime: '08:00', closeTime: '23:00', isClosed: false }],
  };
}

function restaurant(id: string, branchIds: string[]) {
  return {
    id,
    name: `Restaurant ${id}`,
    status: 'ACTIVE',
    priceRange: 'MODERATE',
    logoUrl: null,
    cuisines: [{ cuisine: { name: 'Egyptian' } }],
    branches: branchIds.map(branch),
  };
}

function dish(
  id: string,
  tasteAttributes: string[],
  mealCharacteristics: string[],
  dietaryProperties: string[],
  branchIds: string[] = ['b1']
) {
  return {
    id,
    name: `Dish ${id}`,
    slug: `dish-${id}`,
    description: 'Tasty',
    price: 120,
    currency: 'EGP',
    imageUrl: null,
    status: 'ACTIVE',
    verificationStatus: 'VERIFIED',
    menuId: 'menu-1',
    attributes: { tasteAttributes, mealCharacteristics, dietaryProperties },
    categories: [],
    tags: [],
    ingredients: [],
    menu: { restaurantId: 'r1', restaurant: restaurant('r1', branchIds) },
  };
}

function verifiedPool() {
  return [
    dish('d-spicy', ['SPICY'], ['DINNER'], ['HALAL', 'VEGETARIAN']),
    dish('d-sweet', ['SWEET'], ['DINNER'], ['HALAL', 'VEGETARIAN']),
  ];
}

describe('pair-taste', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dishFindRankingPool.mockResolvedValue(verifiedPool());
    profileFindByUserId.mockResolvedValue(null);
  });

  it('guest with no profile gets a generic pair differing on one dimension', async () => {
    const service = new PairTasteService();
    const result = await service.getPairTaste({}, undefined, {
      now: MONDAY_NOON,
      random: () => 0.1,
    });

    expect(PairTasteResponseSchema.safeParse(result).success).toBe(true);
    expect(result.pair).toHaveLength(2);
    expect(result.pair[0].dish.id).not.toBe(result.pair[1].dish.id);
    const [a, b] = result.pair;
    const inA = a.dish.tasteAttributes.includes(result.dimension);
    const inB = b.dish.tasteAttributes.includes(result.dimension);
    expect(inA).not.toBe(inB);
    // Pair items carry the ids POST /interactions needs for the pick-as-LIKE path.
    expect(a.dish.id).toBeTruthy();
    expect(a.branch.id).toBeTruthy();
  });

  it('dietary restrictions reach the repository as hard constraints', async () => {
    dishFindRankingPool.mockResolvedValue([
      dish('d-halal', ['SPICY'], ['DINNER'], ['HALAL']),
      dish('d-veg', ['SWEET'], ['DINNER'], ['HALAL', 'VEGETARIAN']),
    ]);
    profileFindByUserId.mockResolvedValue({
      dietaryRestrictions: ['VEGETARIAN'],
      inferredPreferences: {},
    });

    const service = new PairTasteService();
    await expect(
      service.getPairTaste({}, 'user-1', { now: MONDAY_NOON, random: () => 0.1 })
    ).rejects.toThrow();
    // Only one dietary-compatible dish exists: no pair can be formed.
    const where = dishFindRankingPool.mock.calls[0][0];
    expect(where.attributes.dietaryProperties).toEqual({ hasEvery: ['VEGETARIAN'] });
  });

  it('applies guest-supplied dietary restrictions without a server profile', async () => {
    dishFindRankingPool.mockResolvedValue([
      dish('d-meat', ['SPICY'], ['DINNER'], ['HALAL']),
      dish('d-veg-a', ['SPICY'], ['DINNER'], ['HALAL', 'VEGETARIAN']),
      dish('d-veg-b', ['SWEET'], ['DINNER'], ['HALAL', 'VEGETARIAN']),
    ]);
    profileFindByUserId.mockResolvedValue(null); // guest: no server profile

    const service = new PairTasteService();
    const result = await service.getPairTaste(
      { dietaryRestrictions: ['VEGETARIAN'] },
      undefined,
      { now: MONDAY_NOON, random: () => 0.1 }
    );

    // The guest's on-device restriction must reach the hard constraint...
    const where = dishFindRankingPool.mock.calls[0][0];
    expect(where.attributes.dietaryProperties).toEqual({ hasEvery: ['VEGETARIAN'] });
    // ...and every returned item must be vegetarian (never the meat dish).
    for (const item of result.pair) {
      expect(item.dish.dietaryProperties).toContain('VEGETARIAN');
    }
  });

  it('accepts dietaryRestrictions in the request schema', () => {
    expect(
      PairTasteRequestSchema.safeParse({ dietaryRestrictions: ['VEGETARIAN', 'HALAL'] }).success
    ).toBe(true);
    expect(
      PairTasteRequestSchema.safeParse({ dietaryRestrictions: ['NOT_A_DIET'] }).success
    ).toBe(false);
  });

  it('matches the requested meal slot on both items', async () => {
    dishFindRankingPool.mockResolvedValue([
      dish('d-lunch-a', ['SPICY'], ['LUNCH'], ['HALAL']),
      dish('d-lunch-b', ['SWEET'], ['LUNCH'], ['HALAL']),
      dish('d-dinner', ['SPICY'], ['DINNER'], ['HALAL']),
    ]);
    const service = new PairTasteService();
    const result = await service.getPairTaste({ mealSlot: 'lunch' }, undefined, {
      now: MONDAY_NOON,
      random: () => 0.1,
    });
    for (const item of result.pair) {
      expect(item.dish.mealCharacteristics).toContain('LUNCH');
    }
    const where = dishFindRankingPool.mock.calls[0][0];
    expect(where.attributes.mealCharacteristics).toEqual({ has: 'LUNCH' });
  });

  it('differs on the lowest-confidence dimension', async () => {
    profileFindByUserId.mockResolvedValue({
      dietaryRestrictions: [],
      inferredPreferences: {
        tasteVector: {
          cuisine: {},
          tasteAttribute: { SPICY: 5 },
          mealCharacteristic: {},
        },
      },
    });
    dishFindRankingPool.mockResolvedValue([
      dish('d-spicy-a', ['SPICY'], ['DINNER'], ['HALAL']),
      dish('d-spicy-b', ['SPICY'], ['DINNER'], ['HALAL']),
      dish('d-sweet', ['SWEET'], ['DINNER'], ['HALAL']),
    ]);
    const service = new PairTasteService();
    const result = await service.getPairTaste({}, 'user-1', {
      now: MONDAY_NOON,
      random: () => 0.9,
    });
    // SPICY is measured (5 nets); SWEET is low-confidence (0 nets).
    expect(result.dimension).toBe('SWEET');
    const sides = result.pair.map((item) => item.dish.tasteAttributes.includes('SWEET'));
    expect(sides).toContain(true);
    expect(sides).toContain(false);
  });

  it('old profile without a vector takes the neutral path instead of erroring', async () => {
    profileFindByUserId.mockResolvedValue({
      dietaryRestrictions: [],
      inferredPreferences: { personality: { discoveryPreference: 'CURIOUS' } },
    });
    const service = new PairTasteService();
    const result = await service.getPairTaste({}, 'user-old', {
      now: MONDAY_NOON,
      random: () => 0.3,
    });
    expect(result.pair).toHaveLength(2);
    expect(typeof result.dimension).toBe('string');
  });

  it('accepts mealSlot via personalityContext', () => {
    expect(
      PairTasteRequestSchema.safeParse({ personalityContext: { mealSlot: 'dinner' } }).success
    ).toBe(true);
  });

  it('confidence counts |net| with measured at >= 5', () => {
    const vector = { cuisine: {}, tasteAttribute: { SPICY: 5, SWEET: 4 }, mealCharacteristic: {} };
    expect(confidenceFor(vector, 'tasteAttribute', 'SPICY')).toBe(5);
    expect(confidenceFor(vector, 'tasteAttribute', 'SWEET')).toBe(4);
    expect(
      pickProbeDimension(verifiedPool() as unknown as PairTasteDish[], vector, () => 0.1)?.value
    ).toBe('SWEET');
  });
});
