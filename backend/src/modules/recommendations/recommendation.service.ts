import { RecommendationRequestInput, RecommendationResponseSchema } from './schema.js';
import { intentService } from '../../ai/intent/intent.service.js';
import { explanationService } from '../../ai/explanation/explanation.service.js';
import { CandidateInput, rankingService, ScoredCandidate } from './ranking.service.js';
import { dishRepository } from '../dishes/repository.js';
import { presentDish } from '../dishes/presenter.js';
import { evaluateBranch } from '../branches/availability.js';
import { preferencesRepository } from '../preferences/repository.js';
import { RecommendationFact, UserContext } from '../../ai/providers/ai-provider.interface.js';
import { StructuredIntent } from '../../ai/intent/intent.schema.js';
import { Prisma } from '@prisma/client';

type DishRow = Awaited<ReturnType<typeof dishRepository.findRankingPool>>[number];
type RestaurantRow = NonNullable<DishRow['menu']>['restaurant'];
type BranchRow = RestaurantRow['branches'][number];
type RankedDishRow = ScoredCandidate<DishRow>;

export class RecommendationService {
  /**
   * The recommendation pipeline. One interface — (request, caller) in,
   * schema-validated result out — with the profile lookup, intent extraction,
   * candidate fetch, geo fan-out, ranking, explanation and response assembly
   * kept as internal steps rather than six public modules.
   */
  async getRecommendations(input: RecommendationRequestInput, userId?: string) {
    // 1. Fetch caller's taste profile if authenticated
    const userProfile = userId
      ? await preferencesRepository.findByUserId(userId)
      : null;

    const userContext: UserContext = {
      userId,
      preferredCuisines: userProfile?.preferredCuisines,
      dislikedCuisines: userProfile?.dislikedCuisines,
      dietaryRestrictions: userProfile?.dietaryRestrictions,
      spicePreference: userProfile?.spicePreference,
      latitude: input.lat,
      longitude: input.lng,
    };

    // 2. Extract (or synthesize) the structured intent
    const intent = await this.#extractIntent(input, userContext, userProfile);
    this.#applyExplicitOverrides(input, intent);

    // 3. Fetch candidate pool against deterministic hard constraints
    const dishes = await dishRepository.findRankingPool(this.#buildHardConstraints(intent));
    const now = new Date();

    // 4. Fan out to branches, applying geo + exclusion filters in memory
    const candidates = this.#buildCandidatePool(dishes, intent, now);

    // 5. Score, rank, and keep the top K
    const topCandidates = candidates
      .map((candidate) => rankingService.scoreCandidate(candidate, intent, userProfile))
      .sort((a, b) => b.score - a.score)
      .slice(0, input.limit);

    // 6. Explain the winners (single degrade policy lives at the AI seam)
    const facts = this.#buildFacts(topCandidates);
    const explanations = await explanationService.generateExplanations(
      input.query || 'Recommended for you',
      facts
    );

    // 7. Assemble + validate the response contract
    const response = {
      request: {
        originalQuery: input.query || null,
        surpriseMe: intent.surpriseMe,
      },
      interpretation: {
        maxPrice: intent.maxPrice ?? null,
        minPrice: intent.minPrice ?? null,
        mealTypes: intent.mealTypes,
        tasteAttributes: intent.tasteAttributes,
        preferredCuisines: intent.preferredCuisines,
        dietaryRestrictions: intent.dietaryRestrictions,
        atmosphere: intent.atmosphere,
      },
      recommendations: this.#formatRecommendations(topCandidates, explanations, now),
    };

    return RecommendationResponseSchema.parse(response);
  }

  async #extractIntent(
    input: RecommendationRequestInput,
    userContext: UserContext,
    userProfile: Awaited<ReturnType<typeof preferencesRepository.findByUserId>>
  ): Promise<StructuredIntent> {
    if (input.query && input.query.trim().length > 0) {
      return intentService.extractIntent(input.query, userContext);
    }

    return {
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

  /**
   * Explicitly passed structured parameters always win over what the AI intent
   * extractor guessed. Previously only maxPrice/location/surpriseMe were
   * re-applied, so e.g. `query` + `minPrice` silently dropped the price floor.
   */
  #applyExplicitOverrides(input: RecommendationRequestInput, intent: StructuredIntent): void {
    if (input.maxPrice !== undefined) intent.maxPrice = input.maxPrice;
    if (input.minPrice !== undefined) intent.minPrice = input.minPrice;
    if (input.cuisines !== undefined) intent.preferredCuisines = input.cuisines;
    if (input.mealTypes !== undefined) intent.mealTypes = input.mealTypes;
    if (input.tasteAttributes !== undefined) intent.tasteAttributes = input.tasteAttributes;
    if (input.dietaryRestrictions !== undefined) intent.dietaryRestrictions = input.dietaryRestrictions;
    if (input.atmosphere !== undefined) intent.atmosphere = input.atmosphere;
    if (input.tags !== undefined) intent.preferredTags = input.tags;
    if (input.lat !== undefined && input.lng !== undefined) {
      intent.location = {
        latitude: input.lat,
        longitude: input.lng,
        radiusKm: input.radiusKm,
      };
    }
    if (input.surpriseMe) intent.surpriseMe = true;
  }

  #buildHardConstraints(intent: StructuredIntent): Prisma.DishWhereInput {
    const priceFilter: Prisma.FloatFilter = {};
    if (intent.maxPrice !== undefined && intent.maxPrice !== null && intent.maxPrice > 0) {
      priceFilter.lte = intent.maxPrice;
    }
    if (intent.minPrice !== undefined && intent.minPrice !== null && intent.minPrice > 0) {
      priceFilter.gte = intent.minPrice;
    }

    return {
      status: 'ACTIVE',
      ...(Object.keys(priceFilter).length > 0 ? { price: priceFilter } : {}),
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
    };
  }

  #buildCandidatePool(
    dishes: Awaited<ReturnType<typeof dishRepository.findRankingPool>>,
    intent: StructuredIntent,
    now: Date
  ): CandidateInput<DishRow>[] {
    const candidatePool: CandidateInput<DishRow>[] = [];

    for (const dish of dishes) {
      const restaurant = dish.menu?.restaurant;
      if (!restaurant || restaurant.status !== 'ACTIVE') continue;

      // Filter excluded ingredients
      if (intent.excludedIngredients.length > 0) {
        const dishIngredients = (dish.ingredients ?? []).map((i) => i.ingredient.name.toLowerCase());
        const hasExcluded = intent.excludedIngredients.some((ex) =>
          dishIngredients.some((di) => di.includes(ex.toLowerCase()))
        );
        if (hasExcluded) continue;
      }

      // Check branches and geographic constraints
      for (const branch of restaurant.branches) {
        const { distanceKm } = evaluateBranch(branch, intent.location, now);

        if (intent.location && (distanceKm === undefined || distanceKm > intent.location.radiusKm)) {
          continue; // Outside radius (or too far to measure)
        }

        candidatePool.push({
          dish,
          restaurant,
          branch,
          distanceKm,
          interactionsCount: dish._count?.interactions ?? 0,
        });
      }
    }

    return candidatePool;
  }

  #buildFacts(candidates: RankedDishRow[]): RecommendationFact[] {
    return candidates.map((c) => ({
      dishId: c.dish.id,
      dishName: c.dish.name,
      restaurantName: c.restaurant.name,
      branchName: c.branch.name ?? '',
      price: c.dish.price,
      currency: c.dish.currency || 'EGP',
      distanceKm: c.distanceKm,
      tasteAttributes: c.dish.attributes?.tasteAttributes || [],
      mealCharacteristics: c.dish.attributes?.mealCharacteristics || [],
      dietaryProperties: (c.dish.attributes as any)?.dietaryProperties || [],
      tags: (c.dish.tags ?? []).map((t) => t.tag.name),
      score: c.score,
    }));
  }

  #formatRecommendations(
    candidates: RankedDishRow[],
    explanations: string[],
    now: Date
  ): Array<Record<string, unknown>> {
    return candidates.map((candidate, index) => ({
      // Every dish leaf is produced by the shared dish presenter — the same
      // flat shape GET /dishes and /search/dishes return (card: one wire shape).
      dish: presentDish(candidate.dish),
      restaurant: {
        id: candidate.restaurant.id ?? '',
        name: candidate.restaurant.name,
        nameEn: candidate.restaurant.nameEn ?? null,
        priceRange: candidate.restaurant.priceRange ?? null,
        logoUrl: candidate.restaurant.logoUrl ?? null,
        cuisines: (candidate.restaurant.cuisines ?? []).map((c) => c.cuisine.name),
      },
      branch: {
        id: candidate.branch.id ?? '',
        name: candidate.branch.name ?? '',
        address: candidate.branch.address ?? null,
        latitude: candidate.branch.latitude ?? 0,
        longitude: candidate.branch.longitude ?? 0,
        isOpen: evaluateBranch(candidate.branch, null, now).isOpen,
      },
      distanceMeters: candidate.distanceKm !== undefined ? Math.round(candidate.distanceKm * 1000) : null,
      score: candidate.score,
      scoreBreakdown: candidate.scoreBreakdown,
      reason:
        explanations[index] ||
        `Top match with score ${(candidate.score * 100).toFixed(0)}%`,
    }));
  }
}

export const recommendationService = new RecommendationService();
