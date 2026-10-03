import * as SecureStore from "expo-secure-store";

import { getPersonalityMetadata } from "@/lib/personality";
import {
  emptyContextTasteVector,
  emptyTasteVector,
  normalizeContextTasteVector,
  normalizeTasteVector,
  type PersonalityContextTasteVector,
  type PersonalitySession,
  type TasteVector,
} from "@/lib/personality-session";
import { isRecord } from "@/lib/type-guards";
import type {
  PersonalityMealSlot,
  PersonalityMood,
  PersonalityWeather,
} from "@/types/recommendation";
import type { DietaryProperty, MealCharacteristic } from "@/types/dish";
import type { UserPreferences } from "@/types/user";

export type CoreQuestionId = "dietary" | "cuisine" | "mealType" | "spice" | "discovery";

export interface CoreAnswerPatch {
  patch: Partial<UserPreferences>;
  meta: Record<string, unknown>;
}

/**
 * Maps a Taste-Discovery Scenario answer to a stable-preference patch and the
 * profile confirmation it implies. "NONE"/"depends" records an explicit
 * no-preference answer rather than leaving the facet open.
 */
export function coreAnswerPatch(question: CoreQuestionId, value: string): CoreAnswerPatch {
  if (question === "dietary") {
    return {
      patch: {
        dietaryRestrictions:
          value === "NONE" ? [] : (value.split(",") as DietaryProperty[]),
      },
      meta: { dietaryConfirmed: true },
    };
  }
  if (question === "cuisine") {
    return {
      patch: { preferredCuisines: value === "NONE" ? [] : [value] },
      meta: { cuisineConfirmed: true },
    };
  }
  if (question === "mealType") {
    return {
      patch: {
        preferredMealTypes: value === "NONE" ? [] : [value as MealCharacteristic],
      },
      meta: { mealTypesConfirmed: true },
    };
  }
  if (question === "spice") {
    return { patch: { spicePreference: Number(value) }, meta: { spiceConfirmed: true } };
  }
  return { patch: {}, meta: { discoveryPreference: value } };
}

export interface GuestPersonalityProfile {
  preferences: Partial<UserPreferences>;
  coreAnswers: Partial<Record<CoreQuestionId, string>>;
  coreCompleted: boolean;
  followUpShownDate: string | null;
  mergeId: string;
}

const GUEST_PROFILE_STORAGE_KEY = "tastemood.personality.profile.guest";
export const CORE_QUESTION_IDS: CoreQuestionId[] = ["dietary", "cuisine", "mealType", "spice", "discovery"];

export function nextCoreQuestionId(
  answers: Partial<Record<CoreQuestionId, string>>
): CoreQuestionId | null {
  return CORE_QUESTION_IDS.find((id) => typeof answers[id] !== "string") ?? null;
}

function createMergeId(): string {
  return `guest-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function emptyGuestPersonalityProfile(mergeId = createMergeId()): GuestPersonalityProfile {
  return {
    preferences: {},
    coreAnswers: {},
    coreCompleted: false,
    followUpShownDate: null,
    mergeId,
  };
}

export async function readGuestPersonalityProfile(): Promise<GuestPersonalityProfile> {
  try {
    const stored = await SecureStore.getItemAsync(GUEST_PROFILE_STORAGE_KEY);
    if (!stored) return emptyGuestPersonalityProfile();
    const parsed: unknown = JSON.parse(stored);
    if (!isRecord(parsed)) return emptyGuestPersonalityProfile();

    const rawPreferences = parsed.preferences;
    const preferences = isRecord(rawPreferences)
      ? (rawPreferences as Partial<UserPreferences>)
      : {};
    const rawAnswers = parsed.coreAnswers;
    const coreAnswers: Partial<Record<CoreQuestionId, string>> = {};
    if (isRecord(rawAnswers)) {
      for (const id of CORE_QUESTION_IDS) {
        if (typeof rawAnswers[id] === "string") coreAnswers[id] = rawAnswers[id];
      }
    }
    return {
      preferences,
      coreAnswers,
      coreCompleted: parsed.coreCompleted === true,
      followUpShownDate:
        typeof parsed.followUpShownDate === "string" ? parsed.followUpShownDate : null,
      mergeId: typeof parsed.mergeId === "string" ? parsed.mergeId : createMergeId(),
    };
  } catch {
    return emptyGuestPersonalityProfile();
  }
}

export async function writeGuestPersonalityProfile(
  profile: GuestPersonalityProfile
): Promise<void> {
  try {
    await SecureStore.setItemAsync(GUEST_PROFILE_STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // Recommendations remain usable if protected local storage is unavailable.
  }
}

function hasAnyStableAnswer(prefs?: Partial<UserPreferences> | null): boolean {
  if (!prefs) return false;
  const metadata = getPersonalityMetadata(prefs);
  return Boolean(
    (prefs.preferredCuisines?.length ?? 0) > 0 ||
      (prefs.dietaryRestrictions?.length ?? 0) > 0 ||
      (prefs.preferredMealTypes?.length ?? 0) > 0 ||
      (prefs.atmospherePreferences?.length ?? 0) > 0 ||
      prefs.preferredPriceRange != null ||
      (typeof prefs.spicePreference === "number" && prefs.spicePreference !== 2) ||
      metadata.coreCompleted === true ||
      Object.keys(metadata.coreAnswers ?? {}).length > 0 ||
      metadata.dietaryConfirmed === true ||
      metadata.cuisineConfirmed === true ||
      metadata.mealTypesConfirmed === true ||
      metadata.spiceConfirmed === true ||
      metadata.discoveryPreference !== undefined
  );
}

export function shouldGateCoreQuiz(
  accountPreferences?: Partial<UserPreferences> | null,
  guestProfile?: GuestPersonalityProfile | null
): boolean {
  return !hasAnyStableAnswer(accountPreferences) &&
    !hasAnyStableAnswer(guestProfile?.preferences) &&
    Object.keys(guestProfile?.coreAnswers ?? {}).length === 0;
}

/** Completes a partial preference set with neutral, non-constraining defaults. */
export function completeUserPreferences(
  prefs?: Partial<UserPreferences> | null
): UserPreferences {
  return {
    preferredCuisines: prefs?.preferredCuisines ?? [],
    dislikedCuisines: prefs?.dislikedCuisines ?? [],
    preferredPriceRange: prefs?.preferredPriceRange ?? null,
    dietaryRestrictions: prefs?.dietaryRestrictions ?? [],
    spicePreference: prefs?.spicePreference ?? 2,
    preferredMealTypes: prefs?.preferredMealTypes ?? [],
    atmospherePreferences: prefs?.atmospherePreferences ?? [],
    inferredPreferences: prefs?.inferredPreferences ?? null,
  };
}

/** Stable taste-profile facets that still have no answered evidence. */
export function missingCoreFacets(prefs?: Partial<UserPreferences> | null): CoreQuestionId[] {
  if (!prefs) return [...CORE_QUESTION_IDS];
  const metadata = getPersonalityMetadata(prefs);
  const missing: CoreQuestionId[] = [];
  if (prefs.dietaryRestrictions?.length === 0 && metadata.dietaryConfirmed !== true) {
    missing.push("dietary");
  }
  if (prefs.preferredCuisines?.length === 0 && metadata.cuisineConfirmed !== true) {
    missing.push("cuisine");
  }
  if (prefs.preferredMealTypes?.length === 0 && metadata.mealTypesConfirmed !== true) {
    missing.push("mealType");
  }
  if ((prefs.spicePreference ?? 2) === 2 && metadata.spiceConfirmed !== true) {
    missing.push("spice");
  }
  if (metadata.discoveryPreference === undefined) {
    missing.push("discovery");
  }
  return missing;
}

function addTasteVectors(left: TasteVector, right: TasteVector): TasteVector {
  const result = emptyTasteVector();
  for (const dimension of ["cuisine", "tasteAttribute", "mealCharacteristic"] as const) {
    for (const [name, net] of Object.entries(left[dimension])) result[dimension][name] = net;
    for (const [name, net] of Object.entries(right[dimension])) {
      result[dimension][name] = (result[dimension][name] ?? 0) + net;
    }
  }
  return result;
}

function addContextVectors(
  account: PersonalityContextTasteVector,
  guest: PersonalityContextTasteVector
): PersonalityContextTasteVector {
  const result = emptyContextTasteVector();
  const weatherValues: PersonalityWeather[] = ["hot", "dry", "cold", "rainy", "mild"];
  const mealSlotValues: PersonalityMealSlot[] = ["breakfast", "lunch", "dinner", "late-night"];
  const moodValues: PersonalityMood[] = ["cozy", "light", "energized", "indulgent", "adventurous", "refreshing"];

  for (const key of weatherValues) {
    const accountVector = account.weather[key];
    const guestVector = guest.weather[key];
    if (accountVector || guestVector) {
      result.weather[key] = addTasteVectors(
        accountVector ?? emptyTasteVector(),
        guestVector ?? emptyTasteVector()
      );
    }
  }
  for (const key of mealSlotValues) {
    const accountVector = account.mealSlot[key];
    const guestVector = guest.mealSlot[key];
    if (accountVector || guestVector) {
      result.mealSlot[key] = addTasteVectors(
        accountVector ?? emptyTasteVector(),
        guestVector ?? emptyTasteVector()
      );
    }
  }
  for (const key of moodValues) {
    const accountVector = account.mood[key];
    const guestVector = guest.mood[key];
    if (accountVector || guestVector) {
      result.mood[key] = addTasteVectors(
        accountVector ?? emptyTasteVector(),
        guestVector ?? emptyTasteVector()
      );
    }
  }
  return result;
}

export interface GuestProfileMerge {
  preferences: UserPreferences;
  update: Partial<UserPreferences>;
  alreadyMerged: boolean;
}

export function mergeGuestPersonalityProfile(
  account: UserPreferences,
  guest: GuestPersonalityProfile,
  session: PersonalitySession
): GuestProfileMerge {
  const inferred = isRecord(account.inferredPreferences) ? account.inferredPreferences : {};
  const accountPersonality = isRecord(inferred.personality) ? inferred.personality : {};
  const mergedIds = Array.isArray(accountPersonality.guestMergeIds)
    ? accountPersonality.guestMergeIds.filter((id): id is string => typeof id === "string")
    : [];
  if (mergedIds.includes(guest.mergeId)) {
    return { preferences: account, update: {}, alreadyMerged: true };
  }

  const guestPrefs = guest.preferences;
  const next: Partial<UserPreferences> = {};
  const personality = { ...accountPersonality };
  const guestInferred = isRecord(guestPrefs.inferredPreferences)
    ? guestPrefs.inferredPreferences
    : {};
  const guestPersonality = isRecord(guestInferred.personality)
    ? guestInferred.personality
    : {};

  if (account.preferredCuisines.length === 0 && guestPrefs.preferredCuisines?.length) {
    next.preferredCuisines = guestPrefs.preferredCuisines;
  }
  if (
    account.dietaryRestrictions.length === 0 &&
    accountPersonality.dietaryConfirmed !== true &&
    guestPrefs.dietaryRestrictions?.length
  ) {
    next.dietaryRestrictions = guestPrefs.dietaryRestrictions;
  }
  if (
    account.spicePreference === 2 &&
    accountPersonality.spiceConfirmed !== true &&
    typeof guestPrefs.spicePreference === "number"
  ) {
    next.spicePreference = guestPrefs.spicePreference;
  }
  if (
    account.preferredMealTypes.length === 0 &&
    accountPersonality.mealTypesConfirmed !== true &&
    guestPrefs.preferredMealTypes?.length
  ) {
    next.preferredMealTypes = guestPrefs.preferredMealTypes;
  }
  if (account.atmospherePreferences.length === 0 && guestPrefs.atmospherePreferences?.length) {
    next.atmospherePreferences = guestPrefs.atmospherePreferences;
  }
  if (account.preferredPriceRange == null && guestPrefs.preferredPriceRange != null) {
    next.preferredPriceRange = guestPrefs.preferredPriceRange;
  }

  for (const key of [
    "discoveryPreference",
    "dietaryConfirmed",
    "cuisineConfirmed",
    "mealTypesConfirmed",
    "spiceConfirmed",
    "followUpShownDate",
  ] as const) {
    if (accountPersonality[key] === undefined && guestPersonality[key] !== undefined) {
      personality[key] = guestPersonality[key];
    }
  }
  if (accountPersonality.coreAnswers === undefined && Object.keys(guest.coreAnswers).length > 0) {
    personality.coreAnswers = guest.coreAnswers;
  }
  if (accountPersonality.coreCompleted === undefined && guest.coreCompleted) {
    personality.coreCompleted = true;
  }
  personality.guestMergeIds = [...mergedIds, guest.mergeId];

  const update: Partial<UserPreferences> = {
    ...next,
    inferredPreferences: {
      ...inferred,
      personality,
      tasteVector: addTasteVectors(
        normalizeTasteVector(inferred.tasteVector),
        session.tasteVector
      ),
      contextTasteVector: addContextVectors(
        normalizeContextTasteVector(inferred.contextTasteVector),
        session.contextTasteVector
      ),
    },
  };
  return { preferences: { ...account, ...update }, update, alreadyMerged: false };
}
