import { beforeEach, describe, expect, it, vi } from "vitest";

const secureStore = vi.hoisted(() => ({ values: new Map<string, string>() }));
vi.mock("expo-secure-store", () => ({
  getItemAsync: vi.fn(async (key: string) => secureStore.values.get(key) ?? null),
  setItemAsync: vi.fn(async (key: string, value: string) => {
    secureStore.values.set(key, value);
  }),
}));

import {
  completeUserPreferences,
  coreAnswerPatch,
  emptyGuestPersonalityProfile,
  mergeGuestPersonalityProfile,
  missingCoreFacets,
  nextCoreQuestionId,
  readGuestPersonalityProfile,
  shouldGateCoreQuiz,
  writeGuestPersonalityProfile,
} from "@/lib/personality-profile";
import { buildPersonalityRequest } from "@/lib/personality";
import { emptyPersonalitySession } from "@/lib/personality-session";
import type { UserPreferences } from "@/types/user";

function blankPreferences(): UserPreferences {
  return {
    preferredCuisines: [],
    dislikedCuisines: [],
    dietaryRestrictions: [],
    spicePreference: 2,
    preferredMealTypes: [],
    atmospherePreferences: [],
    inferredPreferences: {},
  };
}

it("completes sparse guest preferences with neutral defaults", () => {
  expect(completeUserPreferences({ dietaryRestrictions: ["HALAL"] })).toEqual({
    preferredCuisines: [],
    dislikedCuisines: [],
    preferredPriceRange: null,
    dietaryRestrictions: ["HALAL"],
    spicePreference: 2,
    preferredMealTypes: [],
    atmospherePreferences: [],
    inferredPreferences: null,
  });
});

describe("guest personality profile persistence and merge", () => {
  beforeEach(() => secureStore.values.clear());

  it("persists stable guest answers and core quiz progress on-device", async () => {
    const profile = emptyGuestPersonalityProfile("guest-test-id");
    profile.preferences = {
      dietaryRestrictions: ["VEGAN"],
      preferredCuisines: ["Japanese"],
    };
    profile.coreAnswers = { dietary: "VEGAN", cuisine: "Japanese" };

    await writeGuestPersonalityProfile(profile);

    expect(await readGuestPersonalityProfile()).toEqual(profile);
  });

  it("gates only a genuinely new profile, not saved or in-progress preferences", () => {
    expect(shouldGateCoreQuiz(blankPreferences(), null)).toBe(true);

    const existing = blankPreferences();
    existing.preferredCuisines = ["Egyptian"];
    expect(shouldGateCoreQuiz(existing, null)).toBe(false);

    const inProgress = emptyGuestPersonalityProfile("guest-progress");
    inProgress.coreAnswers = { dietary: "depends" };
    expect(shouldGateCoreQuiz(blankPreferences(), inProgress)).toBe(false);
  });

  it("advances through each core facet once and ends after discovery", () => {
    const answers = {
      dietary: "NONE",
      cuisine: "Egyptian",
      mealType: "DINNER",
      spice: "4",
    };

    expect(nextCoreQuestionId(answers)).toBe("discovery");
    expect(nextCoreQuestionId({ ...answers, discovery: "CURIOUS" })).toBeNull();
  });

  it("merges only absent stable fields and adds learned vectors exactly once", () => {
    const account = blankPreferences();
    account.preferredCuisines = ["Mexican"];
    account.spicePreference = 3;
    const guest = emptyGuestPersonalityProfile("guest-merge-id");
    guest.preferences = {
      preferredCuisines: ["Japanese"],
      dietaryRestrictions: ["VEGAN"],
      spicePreference: 5,
      preferredMealTypes: ["DINNER"],
      inferredPreferences: {
        personality: { discoveryPreference: "CURIOUS", dietaryConfirmed: true },
      },
    };
    const session = emptyPersonalitySession();
    session.tasteVector.cuisine.Egyptian = 2;
    session.contextTasteVector.weather = {
      hot: { ...session.tasteVector, cuisine: { Egyptian: 1 } },
    };

    const once = mergeGuestPersonalityProfile(account, guest, session);
    expect(once.preferences.preferredCuisines).toEqual(["Mexican"]);
    expect(once.preferences.spicePreference).toBe(3);
    expect(once.preferences.dietaryRestrictions).toEqual(["VEGAN"]);
    expect(once.preferences.preferredMealTypes).toEqual(["DINNER"]);
    expect(
      (once.preferences.inferredPreferences?.tasteVector as { cuisine: Record<string, number> }).cuisine
    ).toEqual({ Egyptian: 2 });

    const twice = mergeGuestPersonalityProfile(once.preferences, guest, session);
    expect(twice.alreadyMerged).toBe(true);
    expect(twice.preferences.inferredPreferences).toEqual(once.preferences.inferredPreferences);
  });
});

describe("core answer mapping and remaining facets", () => {
  it("records explicit no-preference answers instead of leaving the facet open", () => {
    expect(coreAnswerPatch("dietary", "NONE")).toEqual({
      patch: { dietaryRestrictions: [] },
      meta: { dietaryConfirmed: true },
    });
    expect(coreAnswerPatch("dietary", "VEGAN,HALAL").patch.dietaryRestrictions).toEqual([
      "VEGAN",
      "HALAL",
    ]);
    expect(coreAnswerPatch("cuisine", "NONE").patch.preferredCuisines).toEqual([]);
    expect(coreAnswerPatch("mealType", "NONE").patch.preferredMealTypes).toEqual([]);
  });

  it("maps a scenario answer onto the stable preference it reveals", () => {
    expect(coreAnswerPatch("cuisine", "Japanese").patch.preferredCuisines).toEqual(["Japanese"]);
    expect(coreAnswerPatch("mealType", "DINNER").patch.preferredMealTypes).toEqual(["DINNER"]);
    expect(coreAnswerPatch("spice", "4").patch.spicePreference).toBe(4);
    expect(coreAnswerPatch("discovery", "CURIOUS").meta).toEqual({
      discoveryPreference: "CURIOUS",
    });
  });

  it("reports every unanswered facet, then none once the profile is answered", () => {
    expect(missingCoreFacets(blankPreferences())).toEqual([
      "dietary",
      "cuisine",
      "mealType",
      "spice",
      "discovery",
    ]);

    const answered = blankPreferences();
    answered.dietaryRestrictions = ["HALAL"];
    answered.preferredCuisines = ["Japanese"];
    answered.preferredMealTypes = ["DINNER"];
    answered.spicePreference = 4;
    answered.inferredPreferences = { personality: { discoveryPreference: "CURIOUS" } };
    expect(missingCoreFacets(answered)).toEqual([]);
  });
});

describe("personality core request construction", () => {
  it("keeps stable restrictions and sends only the selected live context", () => {
    const request = buildPersonalityRequest({
      prefs: {
        ...blankPreferences(),
        preferredCuisines: ["Japanese"],
        dietaryRestrictions: ["HALAL"],
      },
      mood: "cozy",
      weather: "cold",
      mealSlot: "dinner",
    });

    expect(request.dietaryRestrictions).toEqual(["HALAL"]);
    expect(request.cuisines).toEqual(["Japanese"]);
    expect(request.personalityContext).toEqual({
      weather: "cold",
      mealSlot: "dinner",
      mood: "cozy",
    });
  });
});
