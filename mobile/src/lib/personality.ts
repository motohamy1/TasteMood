import type {
  PersonalityContext,
  PersonalityMealSlot as RequestMealSlot,
  PersonalityMood,
  PersonalityWeather,
  RecommendationRequest,
} from "@/types/recommendation";
import type { DietaryProperty, MealCharacteristic, TasteAttribute } from "@/types/dish";
import type { UserPreferences } from "@/types/user";
import { isRecord } from "@/lib/type-guards";

export type WeatherCondition = PersonalityWeather;
export type DiscoveryPreference = "FAMILIAR" | "CURIOUS";
export type ProfileCompleteness = "NOT_STARTED" | "IN_PROGRESS" | "READY";
export type PersonalityMealSlot = RequestMealSlot;

export interface MoodOption {
  id: PersonalityMood;
  emoji: string;
  label: string;
  labelAr: string;
  prompt: string;
}

export const PERSONALITY_MOODS: MoodOption[] = [
  { id: "cozy", emoji: "🫶", label: "Cozy", labelAr: "دافئ", prompt: "something cozy and comforting" },
  { id: "light", emoji: "🥗", label: "Light", labelAr: "خفيف", prompt: "something light and fresh" },
  { id: "energized", emoji: "⚡", label: "Energized", labelAr: "نشيط", prompt: "something vibrant and energizing" },
  { id: "indulgent", emoji: "🍰", label: "Indulgent", labelAr: "دسم", prompt: "something indulgent and satisfying" },
  { id: "adventurous", emoji: "🎲", label: "Adventurous", labelAr: "مغامر", prompt: "something exciting and new" },
  { id: "refreshing", emoji: "🍋", label: "Refreshing", labelAr: "منعش", prompt: "something refreshing" },
];

export const WEATHER_OPTIONS: Array<{
  value: WeatherCondition;
  emoji: string;
  label: string;
  labelAr: string;
}> = [
  { value: "hot", emoji: "☀️", label: "Hot", labelAr: "حار" },
  { value: "dry", emoji: "🏜️", label: "Dry", labelAr: "جاف" },
  { value: "cold", emoji: "🧣", label: "Cold", labelAr: "بارد" },
  { value: "rainy", emoji: "🌧️", label: "Rainy", labelAr: "ممطر" },
  { value: "mild", emoji: "🌤️", label: "Mild", labelAr: "معتدل" },
];

export const CUISINE_OPTIONS = [
  "Egyptian",
  "Italian",
  "Japanese",
  "Indian",
  "Mediterranean",
  "Mexican",
] as const;

export const DISCOVERY_OPTIONS: Array<{
  value: DiscoveryPreference;
  label: string;
  labelAr: string;
  description: string;
  descriptionAr: string;
}> = [
  {
    value: "FAMILIAR",
    label: "Keep it familiar",
    labelAr: "المألوف أولًا",
    description: "Reliable favorites first",
    descriptionAr: "المفضلات الموثوقة أولًا",
  },
  {
    value: "CURIOUS",
    label: "Surprise me",
    labelAr: "فاجئني",
    description: "Leave room for discovery",
    descriptionAr: "اترك مساحة للاستكشاف",
  },
];

export const SLOT_LABELS = {
  breakfast: { word: "breakfast", labelAr: "الفطار", emoji: "🌅" },
  lunch: { word: "lunch", labelAr: "الغداء", emoji: "🕛" },
  dinner: { word: "dinner", labelAr: "العشاء", emoji: "🌆" },
  "late-night": { word: "late-night", labelAr: "سهر", emoji: "🌙" },
} as const;

export const SLOT_MEALS: Record<PersonalityMealSlot, MealCharacteristic> = {
  breakfast: "BREAKFAST",
  lunch: "LUNCH",
  dinner: "DINNER",
  "late-night": "SNACK",
};

const MOOD_INTENT: Record<
  string,
  { meals?: MealCharacteristic[]; tastes?: TasteAttribute[] }
> = {
  cozy: { meals: ["FILLING"], tastes: ["RICH"] },
  light: { meals: ["LIGHT"], tastes: ["REFRESHING"] },
  energized: { meals: ["LIGHT"], tastes: ["SAVORY"] },
  indulgent: { meals: ["DESSERT"], tastes: ["SWEET", "RICH"] },
  adventurous: { tastes: ["SOUR", "SPICY"] },
  refreshing: { meals: ["LIGHT"], tastes: ["REFRESHING"] },
};

const WEATHER_INTENT: Record<
  WeatherCondition,
  { meals?: MealCharacteristic[]; tastes?: TasteAttribute[] }
> = {
  hot: { meals: ["LIGHT"], tastes: ["REFRESHING"] },
  dry: { meals: ["LIGHT"], tastes: ["REFRESHING"] },
  cold: { meals: ["FILLING"], tastes: ["RICH"] },
  rainy: { meals: ["FILLING"], tastes: ["RICH"] },
  mild: {},
};

interface PersonalityRequestInput {
  prefs?: UserPreferences | null;
  mood?: PersonalityMood | null;
  weather?: WeatherCondition | null;
  mealSlot?: PersonalityMealSlot | null;
  freeText?: string;
  discoveryPreference?: DiscoveryPreference;
  latitude?: number | null;
  longitude?: number | null;
  radiusKm?: number;
}

export interface PersonalityMetadata {
  discoveryPreference?: DiscoveryPreference;
  dietaryConfirmed?: boolean;
  cuisineConfirmed?: boolean;
  mealTypesConfirmed?: boolean;
  spiceConfirmed?: boolean;
  coreAnswers?: Partial<Record<"dietary" | "cuisine" | "mealType" | "spice" | "discovery", string>>;
  coreCompleted?: boolean;
  followUpShownDate?: string;
  /** Day the "Know you better" probe was dismissed; honored for that day. */
  probeDismissedDate?: string;
  guestMergeIds?: string[];
}

export function getPersonalityMetadata(
  prefs?: Partial<UserPreferences> | null
): PersonalityMetadata {
  const inferred = prefs?.inferredPreferences;
  if (!isRecord(inferred) || !isRecord(inferred.personality)) return {};
  const source = inferred.personality;
  const metadata: PersonalityMetadata = {};
  if (source.discoveryPreference === "FAMILIAR" || source.discoveryPreference === "CURIOUS") {
    metadata.discoveryPreference = source.discoveryPreference;
  }
  for (const key of ["dietaryConfirmed", "cuisineConfirmed", "mealTypesConfirmed", "spiceConfirmed", "coreCompleted"] as const) {
    if (typeof source[key] === "boolean") metadata[key] = source[key];
  }
  if (typeof source.followUpShownDate === "string") metadata.followUpShownDate = source.followUpShownDate;
  if (typeof source.probeDismissedDate === "string") metadata.probeDismissedDate = source.probeDismissedDate;
  if (Array.isArray(source.guestMergeIds)) {
    metadata.guestMergeIds = source.guestMergeIds.filter((id): id is string => typeof id === "string");
  }
  if (isRecord(source.coreAnswers)) {
    const answers: NonNullable<PersonalityMetadata["coreAnswers"]> = {};
    for (const id of ["dietary", "cuisine", "mealType", "spice", "discovery"] as const) {
      if (typeof source.coreAnswers[id] === "string") answers[id] = source.coreAnswers[id];
    }
    metadata.coreAnswers = answers;
  }
  return metadata;
}

export function getProfileCompleteness(
  prefs?: UserPreferences | null
): ProfileCompleteness {
  if (!prefs) return "NOT_STARTED";
  const metadata = getPersonalityMetadata(prefs);
  if (metadata.coreCompleted) return "READY";
  const answered = [
    metadata.cuisineConfirmed === true || prefs.preferredCuisines.length > 0,
    metadata.dietaryConfirmed === true || prefs.dietaryRestrictions.length > 0,
    metadata.mealTypesConfirmed === true || prefs.preferredMealTypes.length > 0,
    metadata.spiceConfirmed === true || prefs.spicePreference !== 2,
    metadata.discoveryPreference !== undefined,
  ].filter(Boolean).length;
  if (answered === 0 && Object.keys(metadata.coreAnswers ?? {}).length === 0) return "NOT_STARTED";
  return answered === 5 ? "READY" : "IN_PROGRESS";
}

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

export function profileSignature(prefs?: UserPreferences | null): string {
  if (!prefs) return "none";
  return JSON.stringify({
    cuisines: prefs.preferredCuisines,
    dislikedCuisines: prefs.dislikedCuisines,
    price: prefs.preferredPriceRange,
    diet: prefs.dietaryRestrictions,
    spice: prefs.spicePreference,
    meals: prefs.preferredMealTypes,
    atmosphere: prefs.atmospherePreferences,
    inferred: prefs.inferredPreferences,
  });
}

export function buildPersonalityRequest({
  prefs,
  mood,
  weather,
  mealSlot,
  freeText = "",
  discoveryPreference,
  latitude,
  longitude,
  radiusKm = 10,
}: PersonalityRequestInput): RecommendationRequest {
  const moodOption = PERSONALITY_MOODS.find((option) => option.id === mood);
  const moodIntent = mood ? MOOD_INTENT[mood] : undefined;
  const weatherIntent = weather ? WEATHER_INTENT[weather] : undefined;
  const mealTypes = unique<MealCharacteristic>([
    ...(prefs?.preferredMealTypes ?? []),
    ...(mealSlot ? [SLOT_MEALS[mealSlot]] : []),
    ...(moodIntent?.meals ?? []),
    ...(weatherIntent?.meals ?? []),
    "BEVERAGE",
  ]);
  const tasteAttributes = unique<TasteAttribute>([
    ...(moodIntent?.tastes ?? []),
    ...(weatherIntent?.tastes ?? []),
    ...(prefs?.spicePreference ?? 0) >= 3 ? (["SPICY"] as TasteAttribute[]) : [],
  ]);

  const context = [
    moodOption?.prompt,
    weather ? `${weather} weather` : null,
    mealSlot ? `${SLOT_LABELS[mealSlot].word} time` : null,
    discoveryPreference === "CURIOUS" ? "include something I may not have tried" : null,
  ].filter(Boolean);
  const trimmedFreeText = freeText.trim();
  const query = [trimmedFreeText, context.length ? `Context: ${context.join(", ")}.` : null]
    .filter(Boolean)
    .join(" ");

  return {
    ...(query ? { query } : {}),
    mealTypes: mealTypes.length ? mealTypes : undefined,
    cuisines: prefs?.preferredCuisines.length ? prefs.preferredCuisines : undefined,
    tasteAttributes: tasteAttributes.length ? tasteAttributes : undefined,
    dietaryRestrictions: prefs?.dietaryRestrictions.length
      ? prefs.dietaryRestrictions
      : undefined,
    atmosphere: prefs?.atmospherePreferences.length
      ? prefs.atmospherePreferences
      : undefined,
    maxPrice:
      prefs?.preferredPriceRange === "BUDGET"
        ? 150
        : prefs?.preferredPriceRange === "MODERATE"
          ? 350
          : prefs?.preferredPriceRange === "EXPENSIVE"
            ? 800
            : undefined,
    ...((mood || weather || mealSlot)
      ? {
          personalityContext: {
            ...(weather ? { weather } : {}),
            ...(mealSlot ? { mealSlot } : {}),
            ...(mood ? { mood } : {}),
          } satisfies PersonalityContext,
        }
      : {}),
    ...(latitude != null && longitude != null
      ? { lat: latitude, lng: longitude, radiusKm, nearestFirst: true }
      : {}),
    surpriseMe: discoveryPreference === "CURIOUS" || mood === "adventurous",
    limit: 12,
  };
}
