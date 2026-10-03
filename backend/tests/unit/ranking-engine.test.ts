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

  it('uses only matching contextual vectors and caps their ranking influence', () => {
    const zeroVector = {
      cuisine: { Egyptian: 0 },
      tasteAttribute: { SPICY: 0, SAVORY: 0 },
      mealCharacteristic: { FILLING: 0, LUNCH: 0 },
    };
    const contextualVector = (net: number) => ({
      cuisine: { Egyptian: net },
      tasteAttribute: { SPICY: net, SAVORY: net },
      mealCharacteristic: { FILLING: net, LUNCH: net },
    });
    const profile = {
      id: 'p-context',
      userId: 'u-1',
      preferredCuisines: [],
      dislikedCuisines: [],
      preferredPriceRange: null,
      dietaryRestrictions: [],
      spicePreference: 2,
      preferredMealTypes: [],
      atmospherePreferences: [],
      inferredPreferences: {
        tasteVector: zeroVector,
        contextTasteVector: {
          weather: { hot: contextualVector(5), cold: contextualVector(-5) },
        },
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
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

    const hot = rankingService.scoreCandidate(dummyCandidate, intent, profile, undefined, { weather: 'hot' });
    const cold = rankingService.scoreCandidate(dummyCandidate, intent, profile, undefined, { weather: 'cold' });
    const unrelated = rankingService.scoreCandidate(dummyCandidate, intent, profile, undefined, { weather: 'mild' });

    expect(hot.scoreBreakdown.learnedAffinity).toBe(0.25);
    expect(cold.scoreBreakdown.learnedAffinity).toBe(-0.25);
    expect(unrelated.scoreBreakdown.learnedAffinity).toBe(0);
    expect(hot.scoreBreakdown.preferenceMatch).toBe(0.75);
    expect(cold.scoreBreakdown.preferenceMatch).toBe(0.25);
  });

  it('retains global learning without context and preserves declared preference baseline', () => {
    const globalVector = {
      cuisine: { Egyptian: 5 },
      tasteAttribute: { SPICY: 5, SAVORY: 5 },
      mealCharacteristic: { FILLING: 5, LUNCH: 5 },
    };
    const profile = {
      id: 'p-global',
      userId: 'u-1',
      preferredCuisines: ['Egyptian'],
      dislikedCuisines: [],
      preferredPriceRange: null,
      dietaryRestrictions: [],
      spicePreference: 2,
      preferredMealTypes: [],
      atmospherePreferences: [],
      inferredPreferences: {
        tasteVector: {
          cuisine: { Egyptian: -5 },
          tasteAttribute: { SPICY: -5, SAVORY: -5 },
          mealCharacteristic: { FILLING: -5, LUNCH: -5 },
        },
        contextTasteVector: { weather: { hot: globalVector } },
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
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

    const outsideContext = rankingService.scoreCandidate(dummyCandidate, intent, profile);
    const unrelatedContext = rankingService.scoreCandidate(dummyCandidate, intent, profile, undefined, { weather: 'cold' });
    const matchingContext = rankingService.scoreCandidate(dummyCandidate, intent, profile, undefined, { weather: 'hot' });

    expect(outsideContext.scoreBreakdown.learnedAffinity).toBe(-0.3);
    expect(unrelatedContext.scoreBreakdown.learnedAffinity).toBe(-0.3);
    expect(matchingContext.scoreBreakdown.learnedAffinity).toBe(0);
    expect(outsideContext.scoreBreakdown.preferenceMatch).toBe(0.7);
  });
});
