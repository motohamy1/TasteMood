import * as SecureStore from "expo-secure-store";

import type {
  PersonalityContext,
  PersonalityMealSlot,
  PersonalityMood,
  PersonalityWeather,
  RecommendationItem,
} from "@/types/recommendation";

import { isRecord } from "@/lib/type-guards";

/**
 * Shared learned-taste vocabulary (mirrors backend interactions/taste-vector.ts):
 * integer net counters (LIKE/SAVED +1, DISLIKE -1), no decay.
 */
export interface TasteVector {
  cuisine: Record<string, number>;
  tasteAttribute: Record<string, number>;
  mealCharacteristic: Record<string, number>;
}

export interface PersonalityContextTasteVector {
  weather: Partial<Record<PersonalityWeather, TasteVector>>;
  mealSlot: Partial<Record<PersonalityMealSlot, TasteVector>>;
  mood: Partial<Record<PersonalityMood, TasteVector>>;
}

function storageKey(scope?: string): string {
  return `tastemood.personality.live-context.${scope ?? "guest"}`;
}

export interface PersonalitySession {
  dateKey: string;
  mood: PersonalityMood | null;
  weatherOverride: PersonalityWeather | null;
  weatherEnabled: boolean;
  mealSlotOverride: PersonalityMealSlot | null;
  timeEnabled: boolean;
  tasteVector: TasteVector;
  contextTasteVector: PersonalityContextTasteVector;
  followUpShownDate: string | null;
  lastContext: PersonalityContext | null;
}

function normalizeContext(value: unknown): PersonalityContext | null {
  if (!isRecord(value)) return null;
  const weatherValues: PersonalityWeather[] = ["hot", "dry", "cold", "rainy", "mild"];
  const mealSlotValues: PersonalityMealSlot[] = ["breakfast", "lunch", "dinner", "late-night"];
  const moodValues: PersonalityMood[] = ["cozy", "light", "energized", "indulgent", "adventurous", "refreshing"];
  const context: PersonalityContext = {};
  if (weatherValues.includes(value.weather as PersonalityWeather)) {
    context.weather = value.weather as PersonalityWeather;
  }
  if (mealSlotValues.includes(value.mealSlot as PersonalityMealSlot)) {
    context.mealSlot = value.mealSlot as PersonalityMealSlot;
  }
  if (moodValues.includes(value.mood as PersonalityMood)) {
    context.mood = value.mood as PersonalityMood;
  }
  return Object.keys(context).length > 0 ? context : null;
}

export function todayKey(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function emptyTasteVector(): TasteVector {
  return { cuisine: {}, tasteAttribute: {}, mealCharacteristic: {} };
}

export function emptyContextTasteVector(): PersonalityContextTasteVector {
  return { weather: {}, mealSlot: {}, mood: {} };
}

export function emptyPersonalitySession(): PersonalitySession {
  return {
    dateKey: todayKey(),
    mood: null,
    weatherOverride: null,
    weatherEnabled: true,
    mealSlotOverride: null,
    timeEnabled: true,
    tasteVector: emptyTasteVector(),
    contextTasteVector: emptyContextTasteVector(),
    followUpShownDate: null,
    lastContext: null,
  };
}

/**
 * Applies the interaction's net delta (+1 LIKE/SAVED, -1 DISLIKE) to every
 * dimension the dish carries: venue cuisines, taste attributes, meal
 * characteristics. Pure — returns a new vector, nothing is filtered.
 */
export function applyTasteVectorDelta(
  vector: TasteVector | null | undefined,
  item: Pick<RecommendationItem, "dish" | "restaurant">,
  delta: number
): TasteVector {
  const next: TasteVector = {
    cuisine: { ...(vector?.cuisine ?? {}) },
    tasteAttribute: { ...(vector?.tasteAttribute ?? {}) },
    mealCharacteristic: { ...(vector?.mealCharacteristic ?? {}) },
  };
  for (const cuisine of item.restaurant?.cuisines ?? []) {
    next.cuisine[cuisine] = (next.cuisine[cuisine] ?? 0) + delta;
  }
  for (const taste of item.dish?.tasteAttributes ?? []) {
    next.tasteAttribute[taste] = (next.tasteAttribute[taste] ?? 0) + delta;
  }
  for (const meal of item.dish?.mealCharacteristics ?? []) {
    next.mealCharacteristic[meal] = (next.mealCharacteristic[meal] ?? 0) + delta;
  }
  return next;
}

export function applyPersonalitySignal(
  session: PersonalitySession,
  item: Pick<RecommendationItem, "dish" | "restaurant">,
  delta: number,
  context: PersonalityContext
): PersonalitySession {
  if (delta === 0) return session;
  const contextTasteVector: PersonalityContextTasteVector = {
    weather: { ...session.contextTasteVector.weather },
    mealSlot: { ...session.contextTasteVector.mealSlot },
    mood: { ...session.contextTasteVector.mood },
  };
  if (context.weather) {
    contextTasteVector.weather[context.weather] = applyTasteVectorDelta(
      contextTasteVector.weather[context.weather],
      item,
      delta
    );
  }
  if (context.mealSlot) {
    contextTasteVector.mealSlot[context.mealSlot] = applyTasteVectorDelta(
      contextTasteVector.mealSlot[context.mealSlot],
      item,
      delta
    );
  }
  if (context.mood) {
    contextTasteVector.mood[context.mood] = applyTasteVectorDelta(
      contextTasteVector.mood[context.mood],
      item,
      delta
    );
  }
  return {
    ...session,
    tasteVector: applyTasteVectorDelta(session.tasteVector, item, delta),
    contextTasteVector,
  };
}

export function normalizeTasteVector(value: unknown): TasteVector {
  const vector = emptyTasteVector();
  if (!isRecord(value)) return vector;
  const dimensions = ["cuisine", "tasteAttribute", "mealCharacteristic"] as const;
  for (const dimension of dimensions) {
    const entries = value[dimension];
    if (!isRecord(entries)) continue;
    for (const [name, net] of Object.entries(entries)) {
      if (typeof net !== "number" || !Number.isFinite(net)) continue;
      vector[dimension][name] = Math.trunc(net);
    }
  }
  return vector;
}


export function normalizeContextTasteVector(value: unknown): PersonalityContextTasteVector {
  const contextVector = emptyContextTasteVector();
  if (!isRecord(value)) return contextVector;
  const weatherValues: PersonalityWeather[] = ["hot", "dry", "cold", "rainy", "mild"];
  const mealSlotValues: PersonalityMealSlot[] = ["breakfast", "lunch", "dinner", "late-night"];
  const moodValues: PersonalityMood[] = ["cozy", "light", "energized", "indulgent", "adventurous", "refreshing"];
  for (const factor of ["weather", "mealSlot", "mood"] as const) {
    const values = value[factor];
    if (!isRecord(values)) continue;
    for (const [key, rawVector] of Object.entries(values)) {
      const vector = normalizeTasteVector(rawVector);
      if (factor === "weather") {
        const weather = weatherValues.find((candidate) => candidate === key);
        if (weather) contextVector.weather[weather] = vector;
      } else if (factor === "mealSlot") {
        const mealSlot = mealSlotValues.find((candidate) => candidate === key);
        if (mealSlot) contextVector.mealSlot[mealSlot] = vector;
      } else {
        const mood = moodValues.find((candidate) => candidate === key);
        if (mood) contextVector.mood[mood] = vector;
      }
    }
  }
  return contextVector;
}


/**
 * Reads the stored session. Mood/weather/meal-slot/time are daily context and
 * reset on a stale dateKey; the taste vector is lifted before that fallback
 * and reattached after, so learned signals survive both an app restart and
 * the daily reset.
 */
export async function readPersonalitySession(scope?: string): Promise<PersonalitySession> {
  const fallback = emptyPersonalitySession();
  try {
    const stored = await SecureStore.getItemAsync(storageKey(scope));
    if (!stored) return fallback;
    const parsed = JSON.parse(stored) as Partial<PersonalitySession>;
    const tasteVector = normalizeTasteVector(parsed.tasteVector);
    const contextTasteVector = normalizeContextTasteVector(parsed.contextTasteVector);
    if (parsed.dateKey !== fallback.dateKey) {
      return { ...fallback, tasteVector, contextTasteVector };
    }
    return {
      ...fallback,
      ...parsed,
      weatherEnabled: parsed.weatherEnabled !== false,
      timeEnabled: parsed.timeEnabled !== false,
      followUpShownDate:
        typeof parsed.followUpShownDate === "string" ? parsed.followUpShownDate : null,
      lastContext: normalizeContext(parsed.lastContext),
      tasteVector,
      contextTasteVector,
    };
  } catch {
    return fallback;
  }
}

export async function writePersonalitySession(
  session: Omit<PersonalitySession, "dateKey"> | PersonalitySession,
  scope?: string
): Promise<void> {
  try {
    await SecureStore.setItemAsync(
      storageKey(scope),
      JSON.stringify({ ...session, dateKey: todayKey() })
    );
  } catch {
    // Temporary context is best effort; recommendations still work in memory.
  }
}
