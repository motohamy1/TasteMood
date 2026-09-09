import type { TranslationKey } from "@/i18n/dictionaries";
import type { RecommendationRequest } from "@/types/recommendation";

/**
 * Recommendation request-authoring domain (card 07): the AI screen's payload
 * building — mood/prompt/query merging and the maxPrice NaN guard from WR-04 —
 * is a pure module instead of screen-local state + constants. Backend
 * vocabulary stays out of the screen; this file owns it.
 */

export const QUICK_PROMPTS: Array<{
  labelKey: TranslationKey;
  payload: Partial<RecommendationRequest>;
}> = [
  { labelKey: "ai.promptSpicy", payload: { maxPrice: 200, tasteAttributes: ["SPICY"] } },
  { labelKey: "ai.promptHealthy", payload: { mealTypes: ["LIGHT"] } },
  { labelKey: "ai.promptSweet", payload: { tasteAttributes: ["SWEET"], mealTypes: ["DESSERT"] } },
  { labelKey: "ai.promptVegan", payload: { dietaryRestrictions: ["VEGAN"] } },
  { labelKey: "ai.promptSurprise", payload: { surpriseMe: true } },
];

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

export interface RecommendationSelections {
  query: string;
  activePrompt: number | null;
  activeMood: number | null;
  /** Raw TextInput string — parsed defensively so NaN never reaches the wire. */
  maxPriceInput: string;
}

/** Merge the current selections into a submitted request, or null if empty. */
export function buildRecommendationRequest(
  selections: RecommendationSelections
): RecommendationRequest | null {
  const { query, activePrompt, activeMood, maxPriceInput } = selections;
  const trimmedQuery = query.trim();
  if (!trimmedQuery && activePrompt === null && activeMood === null) return null;

  const parsedPrice = maxPriceInput.trim() ? Number(maxPriceInput) : NaN;
  const base: RecommendationRequest = {
    query: trimmedQuery || (activeMood !== null ? MOODS[activeMood].query : undefined),
    maxPrice:
      Number.isFinite(parsedPrice) && parsedPrice > 0 ? parsedPrice : undefined,
    limit: 6,
  };

  return activePrompt !== null
    ? { ...base, ...QUICK_PROMPTS[activePrompt].payload }
    : base;
}
