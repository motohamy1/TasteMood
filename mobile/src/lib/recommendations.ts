import type { TranslationKey } from "@/i18n/dictionaries";
import type { RecommendationRequest } from "@/types/recommendation";

/**
 * Recommendation request-authoring domain (card 07): the AI screen's payload
 * building — mood/price/query merging and the maxPrice NaN guard from WR-04 —
 * is a pure module instead of screen-local state + constants. Backend
 * vocabulary stays out of the screen; this file owns it.
 *
 * Presets are two independent single-select sections: mood (taste direction)
 * and price (max budget). Selections stage locally; the screen submits them
 * only on explicit confirm.
 */

export const MOODS: Array<{
  emoji: string;
  labelKey: TranslationKey;
  query: string;
}> = [
  { emoji: "🔥", labelKey: "ai.moodSpicy", query: "something spicy with bold flavors" },
  { emoji: "🥗", labelKey: "ai.moodLight", query: "something light and healthy" },
  { emoji: "🍔", labelKey: "ai.moodComfort", query: "comfort food, rich and filling" },
  { emoji: "🍰", labelKey: "ai.moodSweet", query: "a sweet dessert" },
  { emoji: "🌱", labelKey: "ai.moodVegan", query: "vegan dish" },
  { emoji: "🌙", labelKey: "ai.moodLateNight", query: "quick late night snack" },
];

/**
 * Price presets (EGP). `maxPrice: null` means "Any price" (no cap).
 * Labels render via `ai.priceAny` / `ai.priceUnder` with `{price}`.
 */
export const PRICE_PRESETS: Array<{ maxPrice: number | null }> = [
  { maxPrice: null },
  { maxPrice: 150 },
  { maxPrice: 250 },
  { maxPrice: 400 },
];

export interface RecommendationSelections {
  query: string;
  activeMood: number | null;
  /** Raw TextInput string — parsed defensively so NaN never reaches the wire. */
  maxPriceInput: string;
}

/** Merge the current selections into a submitted request, or null if empty. */
export function buildRecommendationRequest(
  selections: RecommendationSelections
): RecommendationRequest | null {
  const { query, activeMood, maxPriceInput } = selections;
  const trimmedQuery = query.trim();
  const parsedPrice = maxPriceInput.trim() ? Number(maxPriceInput) : NaN;
  const maxPrice =
    Number.isFinite(parsedPrice) && parsedPrice > 0 ? parsedPrice : undefined;
  if (!trimmedQuery && activeMood === null && maxPrice === undefined)
    return null;

  return {
    query: trimmedQuery || (activeMood !== null ? MOODS[activeMood].query : undefined),
    maxPrice,
    limit: 6,
  };
}
