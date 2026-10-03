import { describe, expect, it } from 'vitest';
import { CreateInteractionSchema } from '../../src/modules/interactions/schema.js';
import {
  RecommendationItemSchema,
  RecommendationRequestSchema,
} from '../../src/modules/recommendations/schema.js';

const validContext = { weather: 'hot', mealSlot: 'dinner', mood: 'cozy' };

describe('PersonalityContext request validation', () => {
  it('accepts the shared categorical context on recommendation and interaction requests', () => {
    expect(RecommendationRequestSchema.safeParse({ personalityContext: validContext }).success).toBe(true);
    expect(CreateInteractionSchema.safeParse({ interactionType: 'LIKE', personalityContext: validContext }).success).toBe(true);
  });

  it.each([
    { weather: 'humid' },
    { mealSlot: 'brunch' },
    { mood: 'sad' },
  ])('rejects invalid context values on both request schemas: %o', (personalityContext) => {
    expect(RecommendationRequestSchema.safeParse({ personalityContext }).success).toBe(false);
    expect(CreateInteractionSchema.safeParse({ interactionType: 'LIKE', personalityContext }).success).toBe(false);
  });

  it('requires learnedAffinity in the recommendation score breakdown', () => {
    const item = {
      dish: {
        id: 'dish-1',
        name: 'Spicy Koshary',
        description: null,
        price: 100,
        currency: 'EGP',
        imageUrl: null,
        tasteAttributes: ['SPICY'],
        mealCharacteristics: ['LUNCH'],
        dietaryProperties: [],
        tags: [],
      },
      restaurant: { id: 'restaurant-1', name: 'Egyptian Eatery', priceRange: null, logoUrl: null, cuisines: ['Egyptian'] },
      branch: { id: 'branch-1', name: 'Downtown', address: null, latitude: 30, longitude: 31, isOpen: true },
      distanceMeters: 800,
      score: 0.8,
      scoreBreakdown: {
        preferenceMatch: 0.8,
        learnedAffinity: 0.3,
        priceMatch: 0.7,
        distanceScore: 0.8,
        tasteMatch: 1,
        popularity: 0.5,
        freshness: 1,
      },
      reason: 'A strong match',
    };

    expect(RecommendationItemSchema.safeParse(item).success).toBe(true);
    const { learnedAffinity: _learnedAffinity, ...withoutLearnedAffinity } = item.scoreBreakdown;
    expect(RecommendationItemSchema.safeParse({
      ...item,
      scoreBreakdown: withoutLearnedAffinity,
    }).success).toBe(false);
  });
});
