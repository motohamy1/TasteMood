import { DEFAULT_RANKING_WEIGHTS, RankingWeights, SURPRISE_MODE_WEIGHTS } from '../../config/ranking.config.js';
import { UserPreferenceProfile } from '@prisma/client';
import { StructuredIntent } from '../../ai/intent/intent.schema.js';

/**
 * Structural minimum of a dish/restaurant/branch the scorer reads. Full Prisma
 * rows satisfy these shapes, and so do hand-built test fixtures — the scorer no
 * longer depends on a specific repository include shape.
 */
export interface RankableDish {
  id: string;
  name: string;
  price: number;
  currency?: string | null;
  verificationStatus?: string | null;
  attributes?: {
    tasteAttributes?: string[];
    mealCharacteristics?: string[];
  } | null;
  tags?: Array<{ tag: { name: string } }> | null;
}

export interface RankableRestaurant {
  id?: string;
  name: string;
  nameEn?: string | null;
  priceRange?: string | null;
  logoUrl?: string | null;
  verificationStatus?: string | null;
  cuisines?: Array<{ cuisine: { name: string } }> | null;
}

export interface RankableBranch {
  id?: string;
  name?: string;
  address?: string | null;
  latitude?: number;
  longitude?: number;
  operatingHours?: Array<{
    dayOfWeek: number;
    openTime: string;
    closeTime: string;
    isClosed: boolean;
  }> | null;
}

export interface CandidateInput<DishT extends RankableDish = RankableDish> {
  dish: DishT;
  restaurant: RankableRestaurant;
  branch: RankableBranch;
  distanceKm?: number;
  interactionsCount?: number;
}

export interface ScoredCandidate<DishT extends RankableDish = RankableDish>
  extends CandidateInput<DishT> {
  score: number;
  scoreBreakdown: {
    preferenceMatch: number;
    priceMatch: number;
    distanceScore: number;
    tasteMatch: number;
    popularity: number;
    freshness: number;
  };
}

export class RankingService {
  /**
   * Scores a candidate based on configurable weights and deterministic scoring rules.
   */
  scoreCandidate<DishT extends RankableDish>(
    candidate: CandidateInput<DishT>,
    intent: StructuredIntent,
    userProfile?: UserPreferenceProfile | null,
    weights: RankingWeights = intent.surpriseMe ? SURPRISE_MODE_WEIGHTS : DEFAULT_RANKING_WEIGHTS
  ): ScoredCandidate<DishT> {
    const { dish, restaurant, branch, distanceKm, interactionsCount = 0 } = candidate;

    // 1. Preference Match (0 to 1)
    let preferenceMatch = 0.5; // Neutral default
    if (userProfile) {
      const restaurantCuisines = restaurant.cuisines?.map((c) => c.cuisine.name.toLowerCase()) || [];
      const hasPreferredCuisine = userProfile.preferredCuisines.some((pc) =>
        restaurantCuisines.includes(pc.toLowerCase())
      );
      const hasDislikedCuisine = userProfile.dislikedCuisines.some((dc) =>
        restaurantCuisines.includes(dc.toLowerCase())
      );

      if (hasDislikedCuisine) {
        preferenceMatch = 0.0;
      } else if (hasPreferredCuisine) {
        preferenceMatch = 1.0;
      }

      // Spice preference alignment (0 to 5)
      const dishIsSpicy = dish.attributes?.tasteAttributes?.includes('SPICY');
      if (dishIsSpicy && userProfile.spicePreference >= 3) {
        preferenceMatch = Math.min(1.0, preferenceMatch + 0.2);
      } else if (dishIsSpicy && userProfile.spicePreference === 0) {
        preferenceMatch = Math.max(0.0, preferenceMatch - 0.4);
      }
    }

    // 2. Price Match (0 to 1)
    let priceMatch = 0.7;
    if (intent.maxPrice && intent.maxPrice > 0) {
      if (dish.price <= intent.maxPrice) {
        // Higher score if it comfortably fits budget (not exceeding)
        priceMatch = Math.min(1.0, 0.6 + (1 - dish.price / intent.maxPrice) * 0.4);
      } else {
        priceMatch = 0.0;
      }
    }

    // 3. Distance Score (0 to 1 with decay)
    let distanceScore = 0.5;
    if (distanceKm !== undefined) {
      // Distance decay formula: closer is significantly higher
      distanceScore = 1 / (1 + distanceKm * 0.2);
    }

    // 4. Taste & Characteristic Match (0 to 1)
    let tasteMatch = 0.5;
    const requestedTastes = intent.tasteAttributes || [];
    const requestedMeals = intent.mealTypes || [];
    const dishTastes = dish.attributes?.tasteAttributes || [];
    const dishMeals = dish.attributes?.mealCharacteristics || [];

    let totalMatches = 0;
    let totalRequested = requestedTastes.length + requestedMeals.length;

    if (totalRequested > 0) {
      for (const t of requestedTastes) {
        if (dishTastes.includes(t)) totalMatches++;
      }
      for (const m of requestedMeals) {
        if (dishMeals.includes(m)) totalMatches++;
      }
      tasteMatch = totalMatches / totalRequested;
    } else {
      tasteMatch = 0.7;
    }

    // 5. Popularity (0 to 1)
    const popularity = Math.min(1.0, interactionsCount / 20);

    // 6. Freshness & Verification Status (0 to 1)
    let freshness = 0.5;
    if (dish.verificationStatus === 'VERIFIED') freshness += 0.3;
    if (restaurant.verificationStatus === 'VERIFIED') freshness += 0.2;

    // Final Weighted Score
    const finalScore =
      preferenceMatch * weights.preferenceMatch +
      priceMatch * weights.priceMatch +
      distanceScore * weights.distanceScore +
      tasteMatch * weights.tasteMatch +
      popularity * weights.popularity +
      freshness * weights.freshness;

    return {
      dish,
      restaurant,
      branch,
      distanceKm,
      score: Number(finalScore.toFixed(3)),
      scoreBreakdown: {
        preferenceMatch: Number(preferenceMatch.toFixed(2)),
        priceMatch: Number(priceMatch.toFixed(2)),
        distanceScore: Number(distanceScore.toFixed(2)),
        tasteMatch: Number(tasteMatch.toFixed(2)),
        popularity: Number(popularity.toFixed(2)),
        freshness: Number(freshness.toFixed(2)),
      },
    };
  }
}

export const rankingService = new RankingService();
