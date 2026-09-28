import type { RecommendationItem } from "@/types/recommendation";
import type { TasteVector } from "@/lib/personality-session";

/**
 * Guest-side ranking fold (mirrors ADR-001 §2 in spirit): per-dimension
 * affinity is net/5 clamped to [-1, +1]; each candidate's combined affinity is
 * the average of its dimensions' affinities. Deterministic, same input =
 * same order; ties keep the server order.
 */
const AFFINITY_SCALE = 5;

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

/**
 * Stable sort of candidates by learned affinity, descending. Server order is
 * the tiebreak: equal affinities never swap, so the baseline ranking still
 * shows through for untouched candidates.
 */
export function orderByLearnedAffinity<T extends RecommendationItem>(
  items: readonly T[],
  vector: TasteVector
): T[] {
  return items
    .map((item, index) => ({ item, index, affinity: pickAffinity(vector, item) }))
    .sort((a, b) => b.affinity - a.affinity || a.index - b.index)
    .map((entry) => entry.item);
}
