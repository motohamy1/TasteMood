import { describe, expect, it, vi } from "vitest";

vi.mock("expo-secure-store", () => ({
  getItemAsync: vi.fn(async () => null),
  setItemAsync: vi.fn(async () => {}),
}));

import {
  buildTraitBars,
  resolveTraitVector,
  TRAIT_MEASURED_THRESHOLD,
  type TraitBarData,
  type TraitId,
} from "@/lib/personality-traits";
import { emptyTasteVector, type TasteVector } from "@/lib/personality-session";

function byId(bars: TraitBarData[], id: TraitId): TraitBarData {
  const found = bars.find((bar) => bar.id === id);
  if (!found) throw new Error(`missing trait ${id}`);
  return found;
}

describe("trait confidence threshold", () => {
  it(`marks bars measured at >= ${TRAIT_MEASURED_THRESHOLD} net signals`, () => {
    const vector: TasteVector = {
      ...emptyTasteVector(),
      cuisine: { Egyptian: 3, Italian: 2 },
      tasteAttribute: { SPICY: 5, SAVORY: 2, SWEET: 1 },
      mealCharacteristic: { LUNCH: 4, DINNER: 1 },
    };
    const bars = buildTraitBars({ vector, spicePreference: 4 });
    expect(byId(bars, "heat").confidence).toBe("measured");
    expect(byId(bars, "adventure").confidence).toBe("measured");
    expect(byId(bars, "breadth").confidence).toBe("measured");
    expect(byId(bars, "mealPattern").confidence).toBe("measured");
  });

  it("marks bars low-signal below the threshold and falls back to setup", () => {
    const vector: TasteVector = {
      ...emptyTasteVector(),
      cuisine: { Egyptian: 1 },
      tasteAttribute: { SPICY: 1 },
      mealCharacteristic: {},
    };
    const bars = buildTraitBars({
      vector,
      spicePreference: 4,
      preferredCuisines: ["Egyptian", "Italian"],
      discoveryPreference: "FAMILIAR",
    });
    // spice 4/5 -> 80; cuisines 2*25 -> 50
    expect(byId(bars, "heat")).toMatchObject({ confidence: "low-signal", pct: 80 });
    expect(byId(bars, "breadth")).toMatchObject({ confidence: "low-signal", pct: 50 });
    expect(byId(bars, "mealPattern")).toMatchObject({ confidence: "low-signal", pct: 0 });
  });
});

describe("pct mapping", () => {
  it("heat rises with spicy net signals once measured", () => {
    const mild = byId(
      buildTraitBars({
        vector: { ...emptyTasteVector(), tasteAttribute: { SPICY: -5 } },
        spicePreference: 0,
      }),
      "heat"
    );
    const hot = byId(
      buildTraitBars({
        vector: { ...emptyTasteVector(), tasteAttribute: { SPICY: 5 } },
        spicePreference: 0,
      }),
      "heat"
    );
    expect(mild.confidence).toBe("measured");
    expect(hot.confidence).toBe("measured");
    expect(hot.pct).toBeGreaterThan(mild.pct);
    expect(hot.pct).toBeGreaterThanOrEqual(70);
    expect(mild.pct).toBeLessThanOrEqual(30);
  });

  it("clamps every pct to 0-100", () => {
    const bars = buildTraitBars({
      vector: {
        ...emptyTasteVector(),
        cuisine: Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`C${i}`, 3])),
        tasteAttribute: { SPICY: 99 },
        mealCharacteristic: { LUNCH: 40 },
      },
      spicePreference: 5,
      preferredCuisines: Array.from({ length: 9 }, (_, i) => `C${i}`),
      preferredMealTypes: ["LUNCH", "DINNER", "BREAKFAST", "SNACK", "DESSERT"],
      discoveryPreference: "CURIOUS",
    });
    for (const bar of bars) {
      expect(bar.pct).toBeGreaterThanOrEqual(0);
      expect(bar.pct).toBeLessThanOrEqual(100);
    }
  });
});

describe("provenance contents", () => {
  it("lists signal counts plus the setup value", () => {
    const bars = buildTraitBars({
      vector: {
        ...emptyTasteVector(),
        cuisine: { Egyptian: 3, Italian: -1 },
        tasteAttribute: { SPICY: 5, SAVORY: 2 },
        mealCharacteristic: {},
      },
      spicePreference: 4,
      preferredCuisines: ["Egyptian"],
      discoveryPreference: "CURIOUS",
    });
    const heat = byId(bars, "heat");
    expect(heat.sources).toContainEqual({
      kind: "signal",
      dimension: "tasteAttribute",
      name: "SPICY",
      net: 5,
    });
    expect(heat.sources).toContainEqual({
      kind: "setup",
      dimension: "setup",
      name: "spicePreference",
      value: "4",
    });
    const breadth = byId(bars, "breadth");
    expect(breadth.sources.some((s) => s.kind === "signal" && s.name === "Egyptian")).toBe(true);
  });
});

describe("guest vs server vector paths", () => {
  it("guests resolve from the session vector", () => {
    const vector = resolveTraitVector(
      false,
      { cuisine: { Egyptian: 2 }, tasteAttribute: {}, mealCharacteristic: {} },
      { cuisine: { Italian: 9 }, tasteAttribute: {}, mealCharacteristic: {} }
    );
    expect(vector.cuisine).toEqual({ Egyptian: 2 });
  });

  it("signed-in users resolve from the server inferred vector", () => {
    const vector = resolveTraitVector(
      true,
      { cuisine: { Egyptian: 2 }, tasteAttribute: {}, mealCharacteristic: {} },
      { cuisine: { Italian: 9 }, tasteAttribute: { SPICY: 6 }, mealCharacteristic: {} }
    );
    expect(vector.cuisine).toEqual({ Italian: 9 });
    expect(vector.tasteAttribute).toEqual({ SPICY: 6 });
    const bars = buildTraitBars({ vector, spicePreference: 2 });
    expect(byId(bars, "heat").confidence).toBe("measured");
  });

  it("normalizes unknown shapes to an empty vector", () => {
    expect(resolveTraitVector(false, null, null)).toEqual(emptyTasteVector());
    expect(resolveTraitVector(true, { cuisine: { X: 5 } }, undefined)).toEqual(emptyTasteVector());
  });
});
