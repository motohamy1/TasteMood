import { prisma } from '../../database/prisma.client.js';
import { RecommendationRequestInput } from './schema.js';
import { intentService } from '../../ai/intent/intent.service.js';
import { explanationService } from '../../ai/explanation/explanation.service.js';
import { rankingService, ScoredCandidate } from './ranking.service.js';
import { calculateHaversineDistanceKm } from '../../common/utils/geo.utils.js';
import { branchService } from '../branches/service.js';
import { preferencesRepository } from '../preferences/repository.js';
import { RecommendationFact, UserContext } from '../../ai/providers/ai-provider.interface.js';
import { StructuredIntent } from '../../ai/intent/intent.schema.js';

export class RecommendationService {
  async getRecommendations(input: RecommendationRequestInput, userId?: string) {
    // 1. Fetch User Profile Context if authenticated
    let userProfile = null;
    if (userId) {
      userProfile = await preferencesRepository.findByUserId(userId);
    }

    const userContext: UserContext = {
      userId,
      preferredCuisines: userProfile?.preferredCuisines,
      dislikedCuisines: userProfile?.dislikedCuisines,
      dietaryRestrictions: userProfile?.dietaryRestrictions,
      spicePreference: userProfile?.spicePreference,
      latitude: input.lat,
      longitude: input.lng,
    };

    // 2. Extract or Synthesize Structured Intent
    let intent: StructuredIntent;
    if (input.query && input.query.trim().length > 0) {
      intent = await intentService.extractIntent(input.query, userContext);
    } else {
      intent = {
        rawQuery: 'Structured Recommendation Request',
        mealTypes: input.mealTypes || [],
        preferredCuisines: input.cuisines || [],
        dislikedCuisines: userProfile?.dislikedCuisines || [],
        preferredTags: input.tags || [],
        tasteAttributes: input.tasteAttributes || [],
        dietaryRestrictions: input.dietaryRestrictions || (userProfile?.dietaryRestrictions as any) || [],
        atmosphere: input.atmosphere || [],
        maxPrice: input.maxPrice,
        minPrice: input.minPrice,
        location:
          input.lat !== undefined && input.lng !== undefined
            ? { latitude: input.lat, longitude: input.lng, radiusKm: input.radiusKm }
            : null,
        surpriseMe: input.surpriseMe,
        excludedIngredients: [],
      };
    }

    // Override extracted intent with explicitly passed parameters
    if (input.maxPrice) intent.maxPrice = input.maxPrice;
    if (input.lat !== undefined && input.lng !== undefined) {
      intent.location = {
        latitude: input.lat,
        longitude: input.lng,
        radiusKm: input.radiusKm,
      };
    }
    if (input.surpriseMe) intent.surpriseMe = true;

    // 3. Database Candidate Retrieval (Deterministic Hard Constraints)
    const dishes = await prisma.dish.findMany({
      where: {
        status: 'ACTIVE',
        ...(intent.maxPrice ? { price: { lte: intent.maxPrice } } : {}),
        ...(intent.minPrice ? { price: { gte: intent.minPrice } } : {}),
        // Hard dietary restriction enforcement
        ...(intent.dietaryRestrictions.length > 0
          ? {
              attributes: {
                dietaryProperties: {
                  hasEvery: intent.dietaryRestrictions as any,
                },
              },
            }
          : {}),
      },
      include: {
        attributes: true,
        categories: { include: { category: true } },
        tags: { include: { tag: true } },
        ingredients: { include: { ingredient: true } },
        _count: {
          select: { interactions: true },
        },
        menu: {
          include: {
            restaurant: {
              include: {
                cuisines: { include: { cuisine: true } },
                branches: {
                  where: { status: 'ACTIVE' },
                  include: {
                    operatingHours: true,
                    atmospheres: { include: { atmosphereTag: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    const now = new Date();
    const candidatePool: Array<{
      dish: any;
      restaurant: any;
      branch: any;
      distanceKm?: number;
      interactionsCount: number;
    }> = [];

    for (const dish of dishes) {
      const restaurant = dish.menu.restaurant;
      if (restaurant.status !== 'ACTIVE') continue;

      // Filter excluded ingredients
      if (intent.excludedIngredients.length > 0) {
        const dishIngredients = dish.ingredients.map((i) => i.ingredient.name.toLowerCase());
        const hasExcluded = intent.excludedIngredients.some((ex) =>
          dishIngredients.some((di) => di.includes(ex.toLowerCase()))
        );
        if (hasExcluded) continue;
      }

      // Check branches and geographic constraints
      for (const branch of restaurant.branches) {
        let distanceKm: number | undefined;

        if (intent.location) {
          distanceKm = calculateHaversineDistanceKm(
            intent.location.latitude,
            intent.location.longitude,
            branch.latitude,
            branch.longitude
          );

          if (distanceKm > intent.location.radiusKm) {
            continue; // Outside radius
          }
        }

        candidatePool.push({
          dish,
          restaurant,
          branch,
          distanceKm,
          interactionsCount: dish._count.interactions,
        });
      }
    }

    // 4. Score and Rank Candidates
    const scoredCandidates: ScoredCandidate[] = candidatePool.map((candidate) =>
      rankingService.scoreCandidate(candidate, intent, userProfile)
    );

    // Sort descending by score
    scoredCandidates.sort((a, b) => b.score - a.score);

    // Limit to requested top K
    const topCandidates = scoredCandidates.slice(0, input.limit);

    // 5. Generate Factual Explanations via AI / Rule Provider
    const facts: RecommendationFact[] = topCandidates.map((c) => ({
      dishId: c.dish.id,
      dishName: c.dish.name,
      restaurantName: c.restaurant.name,
      branchName: c.branch.name,
      price: c.dish.price,
      currency: c.dish.currency,
      distanceKm: c.distanceKm ? Number(c.distanceKm.toFixed(2)) : undefined,
      tasteAttributes: c.dish.attributes?.tasteAttributes || [],
      mealCharacteristics: c.dish.attributes?.mealCharacteristics || [],
      dietaryProperties: c.dish.attributes?.dietaryProperties || [],
      tags: c.dish.tags.map((t: any) => t.tag.name),
      score: c.score,
    }));

    const explanations = await explanationService.generateExplanations(
      input.query || 'Recommended for you',
      facts
    );

    // 6. Format Response
    const formattedRecommendations = topCandidates.map((candidate, index) => ({
      dish: {
        id: candidate.dish.id,
        name: candidate.dish.name,
        description: candidate.dish.description,
        price: candidate.dish.price,
        currency: candidate.dish.currency,
        imageUrl: candidate.dish.imageUrl,
        tasteAttributes: candidate.dish.attributes?.tasteAttributes || [],
        mealCharacteristics: candidate.dish.attributes?.mealCharacteristics || [],
        dietaryProperties: candidate.dish.attributes?.dietaryProperties || [],
        tags: candidate.dish.tags.map((t: any) => t.tag.name),
      },
      restaurant: {
        id: candidate.restaurant.id,
        name: candidate.restaurant.name,
        priceRange: candidate.restaurant.priceRange,
        logoUrl: candidate.restaurant.logoUrl,
        cuisines: candidate.restaurant.cuisines.map((c: any) => c.cuisine.name),
      },
      branch: {
        id: candidate.branch.id,
        name: candidate.branch.name,
        address: candidate.branch.address,
        latitude: candidate.branch.latitude,
        longitude: candidate.branch.longitude,
        isOpen: branchService.isBranchOpen(candidate.branch.operatingHours, now),
      },
      distanceMeters: candidate.distanceKm !== undefined ? Math.round(candidate.distanceKm * 1000) : null,
      score: candidate.score,
      scoreBreakdown: candidate.scoreBreakdown,
      reason: explanations[index] || `Top match with score ${(candidate.score * 100).toFixed(0)}%`,
    }));

    return {
      request: {
        originalQuery: input.query || null,
        surpriseMe: intent.surpriseMe,
      },
      interpretation: {
        maxPrice: intent.maxPrice || null,
        mealTypes: intent.mealTypes,
        tasteAttributes: intent.tasteAttributes,
        preferredCuisines: intent.preferredCuisines,
        dietaryRestrictions: intent.dietaryRestrictions,
        atmosphere: intent.atmosphere,
      },
      recommendations: formattedRecommendations,
    };
  }
}

export const recommendationService = new RecommendationService();
