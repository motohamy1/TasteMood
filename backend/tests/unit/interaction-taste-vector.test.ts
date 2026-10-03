import { describe, it, expect, vi, beforeEach } from 'vitest';

const dishFindById = vi.fn();
const profileFindByUserId = vi.fn();
const profileUpsert = vi.fn();
const interactionFindSaved = vi.fn();
const interactionCreate = vi.fn();

vi.doMock('../../src/modules/dishes/repository.js', () => ({
  dishRepository: { findById: (id: string) => dishFindById(id) },
}));
vi.doMock('../../src/modules/preferences/repository.js', () => ({
  preferencesRepository: {
    findByUserId: (id: string) => profileFindByUserId(id),
    upsert: (id: string, data: unknown) => profileUpsert(id, data),
  },
}));
vi.doMock('../../src/modules/interactions/repository.js', () => ({
  interactionRepository: {
    create: (userId: string, input: unknown) => interactionCreate(userId, input),
    findSaved: (userId: string, dishId: string) => interactionFindSaved(userId, dishId),
  },
}));

const { interactionService } = await import('../../src/modules/interactions/service.js');

const DISH_ID = '11111111-1111-4111-8111-111111111111';
const RESTAURANT_ID = '22222222-2222-4222-8222-222222222222';
const USER_ID = '33333333-3333-4333-8333-333333333333';

function makeDish() {
  return {
    id: DISH_ID,
    attributes: { tasteAttributes: ['SPICY', 'SWEET'], mealCharacteristics: ['SNACK'] },
    menu: {
      restaurant: { cuisines: [{ cuisine: { name: 'Egyptian' } }] },
    },
  };
}

function inferredOf(upsertCallIndex = 0) {
  const call = profileUpsert.mock.calls[upsertCallIndex];
  return (call[1] as { inferredPreferences: Record<string, unknown> }).inferredPreferences;
}

describe('InteractionService taste-vector write-back', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    profileFindByUserId.mockResolvedValue({ inferredPreferences: {} });
    profileUpsert.mockResolvedValue({});
    interactionCreate.mockImplementation((_userId: string, input: unknown) => Promise.resolve({ id: 'i-1', ...input }));
  });

  it('LIKE increments cuisine, tasteAttribute and mealCharacteristic by 1', async () => {
    dishFindById.mockResolvedValue(makeDish());

    await interactionService.recordInteraction(USER_ID, {
      dishId: DISH_ID,
      restaurantId: RESTAURANT_ID,
      interactionType: 'LIKE',
    });

    const inferred = inferredOf();
    const vector = inferred.tasteVector as Record<string, Record<string, number>>;
    expect(vector.cuisine.Egyptian).toBe(1);
    expect(vector.tasteAttribute.SPICY).toBe(1);
    expect(vector.tasteAttribute.SWEET).toBe(1);
    expect(vector.mealCharacteristic.SNACK).toBe(1);
  });

  it('DISLIKE decrements instead of deleting', async () => {
    dishFindById.mockResolvedValue(makeDish());
    profileFindByUserId.mockResolvedValue({
      inferredPreferences: {
        tasteVector: { cuisine: { Egyptian: 2 }, tasteAttribute: { SPICY: 3 }, mealCharacteristic: { SNACK: 1 } },
      },
    });

    await interactionService.recordInteraction(USER_ID, {
      dishId: DISH_ID,
      restaurantId: RESTAURANT_ID,
      interactionType: 'DISLIKE',
    });

    const vector = inferredOf().tasteVector as Record<string, Record<string, number>>;
    expect(vector.cuisine.Egyptian).toBe(1);
    expect(vector.tasteAttribute.SPICY).toBe(2);
    expect(vector.tasteAttribute.SWEET).toBe(-1);
    expect(vector.mealCharacteristic.SNACK).toBe(0);
    // Nothing was removed — every dimension still present
    expect(Object.keys(vector.cuisine)).toContain('Egyptian');
    expect(Object.keys(vector.tasteAttribute)).toEqual(['SPICY', 'SWEET']);
  });

  it('keeps existing flat dish:<id> counters intact', async () => {
    dishFindById.mockResolvedValue(makeDish());
    profileFindByUserId.mockResolvedValue({
      inferredPreferences: { [`dish:${DISH_ID}`]: 7, 'dish:legacy': 3 },
    });

    await interactionService.recordInteraction(USER_ID, {
      dishId: DISH_ID,
      interactionType: 'LIKE',
    });

    const inferred = inferredOf();
    // flat counter kept additively (+1 from this LIKE)
    expect(inferred[`dish:${DISH_ID}`]).toBe(8);
    expect(inferred['dish:legacy']).toBe(3);
  });

  it('dish fetch failure still creates the interaction and does not throw', async () => {
    dishFindById.mockRejectedValue(new Error('db down'));

    const interaction = await interactionService.recordInteraction(USER_ID, {
      dishId: DISH_ID,
      interactionType: 'LIKE',
    });

    expect(interactionCreate).toHaveBeenCalledTimes(1);
    expect(interaction.interactionType).toBe('LIKE');
    // profile upsert never completed — either skipped entirely or persisted without a vector
    const persisted = profileUpsert.mock.calls.map((c) => c[1] as { inferredPreferences: Record<string, unknown> });
    for (const p of persisted) expect(p.inferredPreferences.tasteVector).toBeUndefined();
  });

  it('no dishId and no restaurantId leaves the taste vector untouched', async () => {
    dishFindById.mockClear();

    await interactionService.recordInteraction(USER_ID, { interactionType: 'LIKE' });

    expect(dishFindById).not.toHaveBeenCalled();
    const vector = inferredOf().tasteVector as Record<string, Record<string, number>> | undefined;
    expect(vector?.cuisine ?? {}).toEqual({});
    expect(vector?.tasteAttribute ?? {}).toEqual({});
    expect(vector?.mealCharacteristic ?? {}).toEqual({});
  });
  it('SAVED updates global and matching context vectors and stores context provenance', async () => {
    dishFindById.mockResolvedValue(makeDish());
    const personalityContext = { weather: 'hot', mealSlot: 'dinner', mood: 'cozy' };

    await interactionService.recordInteraction(USER_ID, {
      dishId: DISH_ID,
      interactionType: 'SAVED',
      metadata: { source: 'personality' },
      personalityContext,
    });

    expect(interactionCreate).toHaveBeenCalledWith(USER_ID, {
      dishId: DISH_ID,
      interactionType: 'SAVED',
      metadata: { source: 'personality', personalityContext },
    });
    const inferred = inferredOf();
    const global = inferred.tasteVector as Record<string, Record<string, number>>;
    expect(global.cuisine.Egyptian).toBe(1);
    expect(global.tasteAttribute.SPICY).toBe(1);
    expect(global.mealCharacteristic.SNACK).toBe(1);

    const contextual = inferred.contextTasteVector as Record<string, Record<string, Record<string, Record<string, number>>>>;
    for (const factor of ['weather', 'mealSlot', 'mood']) {
      const value = personalityContext[factor as keyof typeof personalityContext];
      const vector = contextual[factor][value];
      expect(vector.cuisine.Egyptian).toBe(1);
      expect(vector.tasteAttribute.SPICY).toBe(1);
      expect(vector.mealCharacteristic.SNACK).toBe(1);
    }
  });

  it('does not enrich taste vectors for views or clicks', async () => {
    for (const interactionType of ['VIEW_DISH', 'CLICK_RECOMMENDATION'] as const) {
      await interactionService.recordInteraction(USER_ID, {
        dishId: DISH_ID,
        interactionType,
        personalityContext: { weather: 'hot' },
      });
    }

    expect(profileFindByUserId).not.toHaveBeenCalled();
    expect(profileUpsert).not.toHaveBeenCalled();
    expect(dishFindById).not.toHaveBeenCalled();
    expect(interactionCreate).toHaveBeenCalledTimes(2);
  });
});
