/**
 * Deterministic why-lines for recommendation cards.
 *
 * Pure client-side rendering of data already returned with each pick
 * (score breakdown + item + request context). No backend or AI calls, so
 * the line is always truthful: every segment is either a fact about the
 * item (cuisine, distance) or a claim gated on the breakdown that produced
 * the ranking. Missing signals are omitted — never shown as "unknown".
 *
 * Same (breakdown, item, context, lang) => same string, always.
 */
import { dictionaries, type Lang, type TranslationKey } from "@/i18n/dictionaries";
import { formatDistance } from "@/lib/format";
import type {
  PersonalityContext,
  PersonalityMealSlot,
  PersonalityMood,
  PersonalityWeather,
  RecommendationItem,
  RecommendationScoreBreakdown,
} from "@/types/recommendation";

/** Declared-preference / taste signals below this are neutral defaults, not reasons. */
export const WHY_DECLARED_THRESHOLD = 0.75;
/** Learned-affinity magnitude below this is noise — omit the learned segment. */
export const WHY_LEARNED_THRESHOLD = 0.05;
/** Backend default priceMatch is 0.7 (no budget set); only comfortably-inside counts. */
export const WHY_PRICE_THRESHOLD = 0.75;

const MOOD_LABEL_KEYS: Record<PersonalityMood, TranslationKey> = {
  cozy: "personality.moodCozy",
  light: "personality.moodLight",
  energized: "personality.moodEnergized",
  indulgent: "personality.moodIndulgent",
  adventurous: "personality.moodAdventurous",
  refreshing: "personality.moodRefreshing",
};

const WEATHER_LABEL_KEYS: Record<PersonalityWeather, TranslationKey> = {
  hot: "personality.weatherHot",
  dry: "personality.weatherDry",
  cold: "personality.weatherCold",
  rainy: "personality.weatherRainy",
  mild: "personality.weatherMild",
};

const SLOT_LABEL_KEYS: Record<PersonalityMealSlot, TranslationKey> = {
  breakfast: "personality.slotBreakfast",
  lunch: "personality.slotLunch",
  dinner: "personality.slotDinner",
  "late-night": "personality.slotLateNight",
};

function fill(template: string, vars: Record<string, string>): string {
  let out = template;
  for (const [name, value] of Object.entries(vars)) {
    out = out.replaceAll(`{${name}}`, value);
  }
  return out;
}

export function whyLine(
  breakdown: RecommendationScoreBreakdown,
  item: RecommendationItem,
  context: PersonalityContext,
  lang: Lang
): string {
  const dict = dictionaries[lang] ?? dictionaries.en;
  const parts: string[] = [];

  // The declared-preference component, recovered exactly: the backend defines
  // learnedAffinity as (blended preferenceMatch − declaredPreferenceMatch), so
  // subtracting it back out gives the declared score alone. Gating on this
  // keeps a learned-affinity bump from being reported as a declared cuisine.
  const declaredMatch = (breakdown?.preferenceMatch ?? 0) - (breakdown?.learnedAffinity ?? 0);

  // Top declared-match signal: the cuisine that matched stated preferences.
  const cuisine =
    item?.restaurant?.cuisines?.[0] ?? item?.dish?.cuisine ?? null;
  if (declaredMatch >= WHY_DECLARED_THRESHOLD && cuisine) {
    parts.push(cuisine);
  }

  // Declared taste match: the dish's own attribute, same wording as the card badge.
  const taste = item?.dish?.tasteAttributes?.[0];
  if ((breakdown?.tasteMatch ?? 0) >= WHY_DECLARED_THRESHOLD && taste) {
    parts.push(taste.toLowerCase().replace(/_/g, " "));
  }

  // Learned-taste contribution (server delta or guest local blend).
  const learned = breakdown?.learnedAffinity ?? 0;
  if (learned >= WHY_LEARNED_THRESHOLD) {
    parts.push(dict["personality.whyLearned"]);
  } else if (learned <= -WHY_LEARNED_THRESHOLD) {
    parts.push(dict["personality.whyLearnedLess"]);
  }

  // Live request factors: only the ones actually present in the request.
  if (context?.mood && MOOD_LABEL_KEYS[context.mood]) {
    parts.push(
      fill(dict["personality.whyMood"], { mood: dict[MOOD_LABEL_KEYS[context.mood]] })
    );
  }
  if (context?.weather && WEATHER_LABEL_KEYS[context.weather]) {
    parts.push(
      fill(dict["personality.whyWeather"], {
        weather: dict[WEATHER_LABEL_KEYS[context.weather]],
      })
    );
  }
  if (context?.mealSlot && SLOT_LABEL_KEYS[context.mealSlot]) {
    parts.push(
      fill(dict["dishes.timeContext"], { slot: dict[SLOT_LABEL_KEYS[context.mealSlot]] })
    );
  }

  // Distance is a fact about the pick, shown whenever the server measured it.
  const distance = formatDistance(item?.distanceMeters);
  if (distance) parts.push(distance);

  // Price fit: only when the breakdown says the dish comfortably fits a budget.
  if ((breakdown?.priceMatch ?? 0) >= WHY_PRICE_THRESHOLD) {
    parts.push(dict["personality.whyPriceFit"]);
  }

  if (parts.length === 0) return dict["personality.whyGeneral"];
  return parts.join(" · ");
}
