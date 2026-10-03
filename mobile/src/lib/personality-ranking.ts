import type { RecommendationItem, PersonalityContext } from "@/types/recommendation";
import type {
  PersonalityContextTasteVector,
  TasteVector,
} from "@/lib/personality-session";

const AFFINITY_SCALE = 5;
const LEARNED_INFLUENCE_CAP = 0.3;

export interface LearnedTasteProfile {
  tasteVector: TasteVector;
  contextTasteVector?: PersonalityContextTasteVector;
}

export function dimensionAffinity(net: number): number {
  return Math.max(-1, Math.min(1, net / AFFINITY_SCALE));
}

/**
 * Per dimension: mean of clamped per-value affinities over the candidate's
 * values for that dimension. Empty dimension is neutral (0).
 */
export function pickAffinity(
  vector: TasteVector,
  item: Pick<RecommendationItem, "dish" | "restaurant">
): number {
  const dimensions: Array<[Record<string, number>, readonly string[]]> = [
    [vector.cuisine, item.restaurant?.cuisines ?? []],
    [vector.tasteAttribute, item.dish?.tasteAttributes ?? []],
    [vector.mealCharacteristic, item.dish?.mealCharacteristics ?? []],
  ];
  let sum = 0;
  let count = 0;
  for (const [nets, values] of dimensions) {
    for (const name of values) {
      sum += dimensionAffinity(nets[name] ?? 0);
      count += 1;
    }
  }
  return count === 0 ? 0 : sum / count;
}

function contextualVectors(
  vectors: PersonalityContextTasteVector | undefined,
  context: PersonalityContext | undefined
): TasteVector[] {
  if (!vectors || !context) return [];
  const matching: TasteVector[] = [];
  if (context.weather) {
    const vector = vectors.weather[context.weather];
    if (vector) matching.push(vector);
  }
  if (context.mealSlot) {
    const vector = vectors.mealSlot[context.mealSlot];
    if (vector) matching.push(vector);
  }
  if (context.mood) {
    const vector = vectors.mood[context.mood];
    if (vector) matching.push(vector);
  }
  return matching;
}

export function learnedPickAffinity(
  item: Pick<RecommendationItem, "dish" | "restaurant">,
  learned: LearnedTasteProfile,
  context?: PersonalityContext
): number {
  const affinities = [pickAffinity(learned.tasteVector, item)];
  for (const vector of contextualVectors(learned.contextTasteVector, context)) {
    affinities.push(pickAffinity(vector, item));
  }
  return affinities.reduce((sum, affinity) => sum + affinity, 0) / affinities.length;
}

/**
 * Stable guest-side ranking blend. Learned affinity contributes at most ±0.3
 * to the existing score; the server's order remains the deterministic tiebreak.
 */
export function orderByLearnedAffinity<T extends RecommendationItem>(
  items: readonly T[],
  learned: TasteVector | LearnedTasteProfile,
  context?: PersonalityContext
): T[] {
  const profile: LearnedTasteProfile = "tasteVector" in learned
    ? learned
    : { tasteVector: learned };
  return items
    .map((item, index) => ({
      item,
      index,
      score: (item.score ?? 0) + learnedPickAffinity(item, profile, context) * LEARNED_INFLUENCE_CAP,
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.item);
}
