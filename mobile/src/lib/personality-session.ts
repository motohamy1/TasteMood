import * as SecureStore from "expo-secure-store";

import type { RecommendationItem } from "@/types/recommendation";
import type { PersonalityMealSlot, WeatherCondition } from "@/lib/personality";

/**
 * Shared learned-taste vocabulary (mirrors backend interactions/taste-vector.ts):
 * integer net counters (LIKE/SAVED +1, DISLIKE -1), no decay.
 */
export interface TasteVector {
  cuisine: Record<string, number>;
  tasteAttribute: Record<string, number>;
  mealCharacteristic: Record<string, number>;
}

function storageKey(scope?: string): string {
  return `tastemood.personality.live-context.${scope ?? "guest"}`;
}

export interface PersonalitySession {
  dateKey: string;
  mood: string | null;
  weatherOverride: WeatherCondition | null;
  weatherEnabled: boolean;
  mealSlotOverride: PersonalityMealSlot | null;
  timeEnabled: boolean;
  tasteVector: TasteVector;
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

export function emptyPersonalitySession(): PersonalitySession {
  return {
    dateKey: todayKey(),
    mood: null,
    weatherOverride: null,
    weatherEnabled: true,
    mealSlotOverride: null,
    timeEnabled: true,
    tasteVector: emptyTasteVector(),
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

function normalizeTasteVector(value: unknown): TasteVector {
  const vector = emptyTasteVector();
  if (typeof value !== "object" || value === null) return vector;
  const source = value as Partial<TasteVector>;
  const dimensions = [
    "cuisine",
    "tasteAttribute",
    "mealCharacteristic",
  ] as const;
  for (const dimension of dimensions) {
    const entries = source[dimension];
    if (typeof entries !== "object" || entries === null) continue;
    for (const [name, net] of Object.entries(entries)) {
      if (typeof net !== "number" || !Number.isFinite(net)) continue;
      vector[dimension][name] = Math.trunc(net);
    }
  }
  return vector;
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
    if (parsed.dateKey !== fallback.dateKey) {
      return { ...fallback, tasteVector };
    }
    return {
      ...fallback,
      ...parsed,
      weatherEnabled: parsed.weatherEnabled !== false,
      timeEnabled: parsed.timeEnabled !== false,
      tasteVector,
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
