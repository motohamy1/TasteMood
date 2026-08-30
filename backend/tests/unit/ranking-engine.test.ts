import { describe, it, expect } from 'vitest';
import { rankingService } from '../../src/modules/recommendations/ranking.service.js';
import { StructuredIntent } from '../../src/ai/intent/intent.schema.js';

describe('Recommendation Ranking Engine', () => {
  const dummyCandidate = {
    dish: {
      id: 'dish-1',
      name: 'Spicy Koshary',
      price: 130,
      currency: 'EGP',
      verificationStatus: 'VERIFIED',
      attributes: {
        tasteAttributes: ['SPICY', 'SAVORY'],
        mealCharacteristics: ['FILLING', 'LUNCH'],
        dietaryProperties: ['VEGETARIAN'],
      },
      tags: [{ tag: { name: 'comfort-food' } }],
    },
    restaurant: {
      id: 'rest-1',
      name: 'Egyptian Eatery',
      priceRange: 'BUDGET',
      verificationStatus: 'VERIFIED',
      cuisines: [{ cuisine: { name: 'Egyptian' } }],
    },
    branch: {
      id: 'branch-1',
      name: 'Zamalek',
      latitude: 30.06,
      longitude: 31.22,
    },
    distanceKm: 1.2,
    interactionsCount: 15,
  };

  it('calculates higher score for matching spicy taste and budget', () => {
    const intent: StructuredIntent = {
      rawQuery: 'spicy under 200',
      mealTypes: ['FILLING'],
      preferredCuisines: ['Egyptian'],
      dislikedCuisines: [],
      preferredTags: [],
      tasteAttributes: ['SPICY'],
      dietaryRestrictions: ['VEGETARIAN'],
      atmosphere: [],
      maxPrice: 200,
      surpriseMe: false,
      excludedIngredients: [],
    };

    const userProfile = {
      id: 'p-1',
      userId: 'u-1',
      preferredCuisines: ['Egyptian'],
      dislikedCuisines: [],
      preferredPriceRange: 'BUDGET' as any,
      dietaryRestrictions: ['VEGETARIAN'] as any,
      spicePreference: 4,
      preferredMealTypes: [],
      atmospherePreferences: [],
      inferredPreferences: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const scored = rankingService.scoreCandidate(dummyCandidate, intent, userProfile);

    expect(scored.score).toBeGreaterThan(0.7);
    expect(scored.scoreBreakdown.preferenceMatch).toBe(1.0);
    expect(scored.scoreBreakdown.priceMatch).toBeGreaterThan(0.7);
  });

  it('penalizes candidates from user disliked cuisines', () => {
    const intent: StructuredIntent = {
      rawQuery: 'test',
      mealTypes: [],
      preferredCuisines: [],
      dislikedCuisines: [],
      preferredTags: [],
      tasteAttributes: [],
      dietaryRestrictions: [],
      atmosphere: [],
      surpriseMe: false,
      excludedIngredients: [],
    };

    const userProfile = {
      id: 'p-1',
      userId: 'u-1',
      preferredCuisines: [],
      dislikedCuisines: ['Egyptian'], // User dislikes Egyptian
      preferredPriceRange: null,
      dietaryRestrictions: [] as any,
      spicePreference: 2,
      preferredMealTypes: [],
      atmospherePreferences: [],
      inferredPreferences: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const scored = rankingService.scoreCandidate(dummyCandidate, intent, userProfile);
    expect(scored.scoreBreakdown.preferenceMatch).toBe(0.0);
  });
});
