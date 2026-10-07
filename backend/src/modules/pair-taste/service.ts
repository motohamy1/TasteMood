import { z } from 'zod';
import { Prisma, MealCharacteristic } from '@prisma/client';
import { dishRepository } from '../dishes/repository.js';
import { dishRankingInclude } from '../dishes/includes.js';
import { presentDish } from '../dishes/presenter.js';
import { evaluateBranch } from '../branches/availability.js';
import { preferencesRepository } from '../preferences/repository.js';
import { AppError } from '../../common/errors/app-error.js';
import { PairTasteRequestInput, PairTasteResponse, PairTasteResponseSchema } from './schema.js';

/** One ranking-pool dish row with the shared dish-ranking relation graph. */
export type PairTasteDish = Prisma.DishGetPayload<{ include: typeof dishRankingInclude }>;
type PairTasteMenu = NonNullable<PairTasteDish['menu']>;
export type PairTasteRestaurant = NonNullable<PairTasteMenu['restaurant']>;
export type PairTasteBranch = PairTasteRestaurant['branches'][number];

export interface PairCandidate {
  dish: PairTasteDish;
  restaurant: PairTasteRestaurant;
  branch: PairTasteBranch;
}

export type TasteVector = {
  cuisine: Record<string, number>;
  tasteAttribute: Record<string, number>;
  mealCharacteristic: Record<string, number>;
};

export type ProbeFacet = 'tasteAttribute' | 'mealCharacteristic';

/** Probe dimension, e.g. `{ facet: 'tasteAttribute', value: 'SPICY' }`. */
export interface ProbeDimension {
  facet: ProbeFacet;
  value: string;
}

export interface PairTasteOptions {
  random?: () => number;
  now?: Date;
}

/** Meal-slot → the catalogue meal characteristic every pair item must carry. */
const SLOT_MEALS: Record<string, MealCharacteristic> = {
  breakfast: 'BREAKFAST',
  lunch: 'LUNCH',
  dinner: 'DINNER',
  'late-night': 'SNACK',
};

const TASTE_COUNTERS_SCHEMA = z.record(z.number());
const TASTE_VECTOR_SCHEMA = z
  .object({
    cuisine: z.unknown().optional(),
    tasteAttribute: z.unknown().optional(),
    mealCharacteristic: z.unknown().optional(),
  })
  .passthrough();
const INFERRED_TASTE_SCHEMA = z
  .object({ tasteVector: z.unknown().optional() })
  .passthrough();

const PROBE_FACETS: ProbeFacet[] = ['tasteAttribute', 'mealCharacteristic'];

/** Lenient read of the global taste vector; old profiles without one yield an empty (all low-confidence) vector. */
export function readPairTasteVector(value: unknown): TasteVector {
  const parsed = TASTE_VECTOR_SCHEMA.safeParse(value);
  const counters = (dimension: unknown): Record<string, number> => {
    const countersParsed = TASTE_COUNTERS_SCHEMA.safeParse(dimension);
    return countersParsed.success ? countersParsed.data : {};
  };
  if (!parsed.success) return { cuisine: {}, tasteAttribute: {}, mealCharacteristic: {} };
  return {
    cuisine: counters(parsed.data.cuisine),
    tasteAttribute: counters(parsed.data.tasteAttribute),
    mealCharacteristic: counters(parsed.data.mealCharacteristic),
  };
}

/** Confidence signal for one value: |net|; measured at >= 5, below is low-confidence. */
export function confidenceFor(vector: TasteVector, facet: ProbeFacet, value: string): number {
  return Math.abs(vector[facet][value] ?? 0);
}

function dishValues(dish: PairTasteDish, facet: ProbeFacet): string[] {
  if (facet === 'tasteAttribute') return [...(dish.attributes?.tasteAttributes ?? [])];
  return [...(dish.attributes?.mealCharacteristics ?? [])];
}

/**
 * Lowest-confidence taste value that actually splits the pool (at least one
 * dish carrying it and one lacking it). Taste attributes are preferred over
 * meal characteristics; ties break randomly. Returns null when no value
 * splits the pool.
 */
export function pickProbeDimension(
  dishes: PairTasteDish[],
  vector: TasteVector,
  random: () => number = Math.random
): ProbeDimension | null {
  for (const facet of PROBE_FACETS) {
    const seen: Record<string, true> = {};
    for (const dish of dishes) {
      for (const value of dishValues(dish, facet)) seen[value] = true;
    }
    let best: ProbeDimension[] = [];
    let bestConfidence = Number.POSITIVE_INFINITY;
    for (const value of Object.keys(seen)) {
      const withValue = dishes.some((dish) => dishValues(dish, facet).includes(value));
      const withoutValue = dishes.some((dish) => !dishValues(dish, facet).includes(value));
      if (!withValue || !withoutValue) continue;
      const confidence = confidenceFor(vector, facet, value);
      if (confidence < bestConfidence) {
        bestConfidence = confidence;
        best = [{ facet, value }];
      } else if (confidence === bestConfidence) {
        best.push({ facet, value });
      }
    }
    if (best.length > 0) return best[Math.floor(random() * best.length)];
  }
  return null;
}

export class PairTasteService {
  async getPairTaste(input: PairTasteRequestInput, userId?: string, options: PairTasteOptions = {}): Promise<PairTasteResponse> {
    const random = options.random ?? Math.random;
    const now = options.now ?? new Date();

    const profile = userId ? await preferencesRepository.findByUserId(userId) : null;
    // Signed-in restrictions come from the server profile; a guest's live only
    // on-device, so the client forwards them on the request. Merge both so the
    // hard dietary constraint holds for guests too.
    const dietaryRestrictions = [
      ...new Set([
        ...(profile?.dietaryRestrictions ?? []),
        ...(input.dietaryRestrictions ?? []),
      ]),
    ].filter(Boolean);
    const inferred = INFERRED_TASTE_SCHEMA.safeParse(profile?.inferredPreferences);
    // Guests and old profiles without a vector read as empty: every dimension
    // is low-confidence, so the pair is generic rather than an error.
    const vector = inferred.success ? readPairTasteVector(inferred.data.tasteVector) : { cuisine: {}, tasteAttribute: {}, mealCharacteristic: {} };

    const slot = input.mealSlot ?? input.personalityContext?.mealSlot;
    const slotMeal = slot ? SLOT_MEALS[slot] : undefined;

    const attributesFilter: Prisma.DishAttributeWhereInput = {};
    if (dietaryRestrictions.length > 0) attributesFilter.dietaryProperties = { hasEvery: [...dietaryRestrictions] };
    if (slotMeal) attributesFilter.mealCharacteristics = { has: slotMeal };

    const dishes = await dishRepository.findRankingPool({
      status: 'ACTIVE',
      verificationStatus: 'VERIFIED',
      ...(Object.keys(attributesFilter).length > 0 ? { attributes: attributesFilter } : {}),
    });

    // In-memory guards mirror the hard constraints (diet, slot, verified dish
    // at an active restaurant) and fan out per active branch — the same
    // candidate-pool seam as recommendation.service. Availability (open-now)
    // is evaluated per branch at presentation via evaluateBranch; closed
    // branches are annotated, not excluded, exactly like recommendations.
    const candidates: PairCandidate[] = [];
    for (const dish of dishes) {
      if (dish.status !== 'ACTIVE' || dish.verificationStatus !== 'VERIFIED') continue;
      const restaurant = dish.menu?.restaurant;
      if (!restaurant || restaurant.status !== 'ACTIVE') continue;
      const dietary = dish.attributes?.dietaryProperties ?? [];
      if (!dietaryRestrictions.every((restriction) => dietary.includes(restriction))) continue;
      if (slotMeal && !(dish.attributes?.mealCharacteristics ?? []).includes(slotMeal)) continue;
      for (const branch of restaurant.branches) {
        candidates.push({ dish, restaurant, branch });
      }
    }

    if (new Set(candidates.map((candidate) => candidate.dish.id)).size < 2) {
      throw AppError.notFound('No dishes available for a taste test right now');
    }

    const distinctDishes = [...new Map(candidates.map((candidate) => [candidate.dish.id, candidate.dish])).values()];
    const dimension = pickProbeDimension(distinctDishes, vector, random);

    let first: PairCandidate;
    let second: PairCandidate;
    const withValue = dimension
      ? candidates.filter((candidate) => dishValues(candidate.dish, dimension.facet).includes(dimension.value))
      : [];
    const withoutValue = dimension
      ? candidates.filter((candidate) => !dishValues(candidate.dish, dimension.facet).includes(dimension.value))
      : [];
    if (dimension && withValue.length > 0 && withoutValue.length > 0) {
      // Distinct dishes on each side: the same dish must not appear twice.
      const firstPick = withValue[Math.floor(random() * withValue.length)];
      const secondPool = withoutValue.filter((candidate) => candidate.dish.id !== firstPick.dish.id);
      const pool = secondPool.length > 0 ? secondPool : withoutValue.filter((candidate) => candidate.dish.id !== firstPick.dish.id);
      first = firstPick;
      second =
        pool.length > 0
          ? pool[Math.floor(random() * pool.length)]
          : candidates.filter((candidate) => candidate.dish.id !== firstPick.dish.id)[0];
    } else {
      const firstPick = candidates[Math.floor(random() * candidates.length)];
      first = firstPick;
      const rest = candidates.filter((candidate) => candidate.dish.id !== firstPick.dish.id);
      second = rest[Math.floor(random() * rest.length)];
    }

    const dimensionLabel = dimension?.value ?? 'taste';
    const reason = `Taste match · ${dimensionLabel} — one has it, one doesn't.`;

    const response = {
      pair: [this.formatItem(first, reason, now), this.formatItem(second, reason, now)],
      dimension: dimensionLabel,
    };
    return PairTasteResponseSchema.parse(response);
  }

  private formatItem(candidate: PairCandidate, reason: string, now: Date): Record<string, unknown> {
    return {
      dish: presentDish(candidate.dish),
      restaurant: {
        id: candidate.restaurant.id ?? '',
        name: candidate.restaurant.name,
        priceRange: candidate.restaurant.priceRange ?? null,
        logoUrl: candidate.restaurant.logoUrl ?? null,
        cuisines: (candidate.restaurant.cuisines ?? []).map((entry) => entry.cuisine.name),
      },
      branch: {
        id: candidate.branch.id ?? '',
        name: candidate.branch.name ?? '',
        address: candidate.branch.address ?? null,
        latitude: candidate.branch.latitude ?? 0,
        longitude: candidate.branch.longitude ?? 0,
        isOpen: evaluateBranch(candidate.branch, null, now).isOpen,
      },
      distanceMeters: null,
      score: 0,
      scoreBreakdown: {
        preferenceMatch: 0,
        learnedAffinity: 0,
        priceMatch: 0,
        distanceScore: 0,
        tasteMatch: 0,
        popularity: 0,
        freshness: 0,
      },
      reason,
    };
  }
}

export const pairTasteService = new PairTasteService();
