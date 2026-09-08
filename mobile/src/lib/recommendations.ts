import type { RecommendationRequest } from "@/types/recommendation";

/**
 * Recommendation request-authoring domain (card 07): the AI screen's payload
 * building — mood/prompt/query merging and the maxPrice NaN guard from WR-04 —
 * is a pure module instead of screen-local state + constants. Backend
 * vocabulary stays out of the screen; this file owns it.
 */

export const QUICK_PROMPTS: Array<{
  label: string;
  payload: Partial<RecommendationRequest>;
}> = [
  { label: "🌶 Spicy & under 200 EGP", payload: { maxPrice: 200, tasteAttributes: ["SPICY"] } },
  { label: "🥗 Healthy & light", payload: { mealTypes: ["LIGHT"] } },
  { label: "🍰 Sweet treat", payload: { tasteAttributes: ["SWEET"], mealTypes: ["DESSERT"] } },
  { label: "🌱 Vegan", payload: { dietaryRestrictions: ["VEGAN"] } },
  { label: "🎲 Surprise me", payload: { surpriseMe: true } },
];

export const MOODS: Array<{ emoji: string; label: string; query: string }> = [
  { emoji: "🔥", label: "Spicy", query: "something spicy with bold flavors" },
  { emoji: "🥗", label: "Light", query: "something light and healthy" },
  { emoji: "🍔", label: "Comfort", query: "comfort food, rich and filling" },
  { emoji: "🍰", label: "Sweet", query: "a sweet dessert" },
  { emoji: "🌱", label: "Vegan", query: "vegan dish" },
  { emoji: "🌙", label: "Late night", query: "quick late night snack" },
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
