import { describe, expect, it, vi } from "vitest";

const secureStore = vi.hoisted(() => ({ values: new Map<string, string>() }));
vi.mock("expo-secure-store", () => ({
  getItemAsync: vi.fn(async (key: string) => secureStore.values.get(key) ?? null),
  setItemAsync: vi.fn(async (key: string, value: string) => {
    secureStore.values.set(key, value);
  }),
}));

import {
  isDimensionMeasured,
  isProbeDismissedForToday,
  lowConfidenceDimensions,
  pendingProbe,
  PROBE_MEASURED_THRESHOLD,
  probeDismissedDate,
} from "@/lib/personality-probe";
import { emptyTasteVector, type TasteVector } from "@/lib/personality-session";
import type { UserPreferences } from "@/types/user";

function makePrefs(overrides: Partial<UserPreferences> = {}): UserPreferences {
  return {
    preferredCuisines: [],
    dislikedCuisines: [],
    preferredPriceRange: null,
    dietaryRestrictions: [],
    spicePreference: 2,
    preferredMealTypes: [],
    atmospherePreferences: [],
    inferredPreferences: null,
    ...overrides,
  };
}

function measuredVector(): TasteVector {
  return {
    cuisine: { Egyptian: 3, Italian: 2 },
    tasteAttribute: { SPICY: 4, RICH: -1 },
    mealCharacteristic: { DINNER: 5 },
  };
}

describe("pendingProbe budget-first ordering", () => {
  it("returns budget when the price range is unknown", () => {
    expect(pendingProbe(makePrefs(), emptyTasteVector())).toEqual({ topic: "budget" });
  });

  it("returns budget first even when every dimension is measured", () => {
    expect(pendingProbe(makePrefs(), measuredVector())).toEqual({ topic: "budget" });
  });

  it("returns budget when prefs are unavailable", () => {
    expect(pendingProbe(null, measuredVector())).toEqual({ topic: "budget" });
  });
});

describe("pendingProbe dimension topics", () => {
  it("returns a single pending topic keyed off the first low-confidence dimension", () => {
    const probe = pendingProbe(makePrefs({ preferredPriceRange: "MODERATE" }), emptyTasteVector());
    expect(probe).toEqual({ topic: "cuisine" });
  });

  it("skips measured dimensions in stable order", () => {
    const vector: TasteVector = {
      ...emptyTasteVector(),
      cuisine: { Egyptian: 5 },
    };
    const probe = pendingProbe(makePrefs({ preferredPriceRange: "BUDGET" }), vector);
    expect(probe).toEqual({ topic: "tasteAttribute" });
  });

  it("returns null when the budget is known and all dimensions are measured", () => {
    const probe = pendingProbe(makePrefs({ preferredPriceRange: "LUXURY" }), measuredVector());
    expect(probe).toBeNull();
  });
});

describe("measured threshold", () => {
  it("treats a dimension as measured at >= 5 net signals", () => {
    expect(PROBE_MEASURED_THRESHOLD).toBe(5);
    expect(isDimensionMeasured({ a: 5 })).toBe(true);
    expect(isDimensionMeasured({ a: 3, b: 1 })).toBe(false);
  });

  it("sums absolute nets, so opposing signals still count as evidence", () => {
    expect(isDimensionMeasured({ a: 3, b: -2 })).toBe(true);
    expect(isDimensionMeasured({ a: -4 })).toBe(false);
  });

  it("treats missing dimensions as low-confidence", () => {
    expect(isDimensionMeasured(null)).toBe(false);
    expect(isDimensionMeasured(undefined)).toBe(false);
    expect(lowConfidenceDimensions(null)).toEqual(["cuisine", "tasteAttribute", "mealCharacteristic"]);
  });
});

describe("probe dismissal / session honor (pure part)", () => {
  const today = "2026-10-08";

  it("shows when never dismissed", () => {
    expect(isProbeDismissedForToday(null, today)).toBe(false);
    expect(isProbeDismissedForToday(undefined, today)).toBe(false);
  });

  it("stays retired once dismissed today", () => {
    expect(isProbeDismissedForToday(today, today)).toBe(true);
  });

  it("may show again on a later day", () => {
    expect(isProbeDismissedForToday("2026-10-07", today)).toBe(false);
  });
});

describe("probeDismissedDate", () => {
  it("reads the dismissal date from personality metadata", () => {
    const prefs = makePrefs({
      inferredPreferences: { personality: { probeDismissedDate: "2026-10-08" } },
    });
    expect(probeDismissedDate(prefs)).toBe("2026-10-08");
  });

  it("returns null when absent or malformed", () => {
    expect(probeDismissedDate(makePrefs())).toBeNull();
    expect(probeDismissedDate(null)).toBeNull();
    expect(
      probeDismissedDate(makePrefs({ inferredPreferences: { personality: 42 } as never })),
    ).toBeNull();
  });
});
