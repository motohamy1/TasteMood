import type { MealCharacteristic, TasteAttribute } from "@/types/dish";
import type { RecommendationRequest } from "@/types/recommendation";
import type { UserPreferences } from "@/types/user";

export type WeatherCondition = "hot" | "dry" | "cold" | "rainy" | "mild";
export type DiscoveryPreference = "FAMILIAR" | "CURIOUS";
export type ProfileCompleteness = "NOT_STARTED" | "IN_PROGRESS" | "READY";
export type PersonalityMealSlot = "breakfast" | "lunch" | "dinner" | "late-night";

export interface MoodOption {
  id: string;
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
  mood?: string | null;
  weather?: WeatherCondition | null;
  mealSlot?: PersonalityMealSlot | null;
  freeText?: string;
  discoveryPreference?: DiscoveryPreference;
  latitude?: number | null;
  longitude?: number | null;
  radiusKm?: number;
}

interface PersonalityMetadata {
  discoveryPreference?: DiscoveryPreference;
  dietaryConfirmed?: boolean;
  spiceConfirmed?: boolean;
}

export function getPersonalityMetadata(
  prefs?: UserPreferences | null
): PersonalityMetadata {
  const raw = prefs?.inferredPreferences;
  if (!raw || typeof raw !== "object") return {};
  const personality = (raw as Record<string, unknown>).personality;
  if (!personality || typeof personality !== "object") return {};
  return personality as PersonalityMetadata;
}

export function getProfileCompleteness(
  prefs?: UserPreferences | null
): ProfileCompleteness {
  if (!prefs) return "NOT_STARTED";

  const metadata = getPersonalityMetadata(prefs);
  const spiceAnswered = metadata.spiceConfirmed === true || prefs.spicePreference !== 2;
  const answered = [
    prefs.preferredCuisines.length > 0,
    metadata.dietaryConfirmed === true || prefs.dietaryRestrictions.length > 0,
    spiceAnswered,
    metadata.discoveryPreference !== undefined,
  ].filter(Boolean).length;

  if (answered === 0) return "NOT_STARTED";
  return answered === 4 ? "READY" : "IN_PROGRESS";
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
    ...(latitude != null && longitude != null
      ? { lat: latitude, lng: longitude, radiusKm }
      : {}),
    surpriseMe: discoveryPreference === "CURIOUS" || mood === "adventurous",
    limit: 8,
  };
}
