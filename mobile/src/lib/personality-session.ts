import * as SecureStore from "expo-secure-store";

import type { PersonalityMealSlot, WeatherCondition } from "@/lib/personality";

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
}

export function todayKey(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function emptyPersonalitySession(): PersonalitySession {
  return {
    dateKey: todayKey(),
    mood: null,
    weatherOverride: null,
    weatherEnabled: true,
    mealSlotOverride: null,
    timeEnabled: true,
  };
}

export async function readPersonalitySession(scope?: string): Promise<PersonalitySession> {
  const fallback = emptyPersonalitySession();
  try {
    const stored = await SecureStore.getItemAsync(storageKey(scope));
    if (!stored) return fallback;
    const parsed = JSON.parse(stored) as Partial<PersonalitySession>;
    if (parsed.dateKey !== fallback.dateKey) return fallback;
    return {
      ...fallback,
      ...parsed,
      weatherEnabled: parsed.weatherEnabled !== false,
      timeEnabled: parsed.timeEnabled !== false,
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
