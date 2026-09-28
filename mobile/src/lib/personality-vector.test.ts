import { describe, expect, it } from "vitest";

import {
  applyTasteVectorDelta,
  emptyPersonalitySession,
  emptyTasteVector,
  readPersonalitySession,
  todayKey,
  writePersonalitySession,
  type TasteVector,
} from "@/lib/personality-session";
import {
  dimensionAffinity,
  orderByLearnedAffinity,
  pickAffinity,
} from "@/lib/personality-ranking";
import type {
  RecommendationItem,
  RecommendationDish,
  RecommendationRestaurant,
} from "@/types/recommendation";

function makeItem(
  id: string,
  dimensions: {
    cuisines?: string[];
    tasteAttributes?: RecommendationDish["tasteAttributes"];
    mealCharacteristics?: RecommendationDish["mealCharacteristics"];
  }
): RecommendationItem {
  const dish: RecommendationDish = {
    id,
    name: `Dish ${id}`,
    description: null,
    currency: "EGP",
    imageUrl: null,
    tasteAttributes: dimensions.tasteAttributes ?? [],
    mealCharacteristics: dimensions.mealCharacteristics ?? [],
    dietaryProperties: [],
    tags: [],
  };
  const restaurant: RecommendationRestaurant = {
    id: `rest-${id}`,
    name: `Restaurant ${id}`,
    priceRange: "BUDGET",
    logoUrl: null,
    cuisines: dimensions.cuisines ?? [],
  };
  return {
    dish,
    restaurant,
    branch: {
      id: `branch-${id}`,
      name: `Branch ${id}`,
      address: null,
      latitude: 30,
      longitude: 31,
      isOpen: true,
    },
    distanceMeters: null,
    score: 0.8,
    scoreBreakdown: {
      preferenceMatch: 1,
      priceMatch: 0.7,
      distanceScore: 0.5,
      tasteMatch: 0.5,
      popularity: 0.5,
      freshness: 0.8,
    },
    reason: "fits",
  };
}

const SPICY_KOSHARY = makeItem("koshary", {
  cuisines: ["Egyptian"],
  tasteAttributes: ["SPICY", "SAVORY"],
  mealCharacteristics: ["FILLING", "LUNCH"],
});

describe("guest taste vector deltas", () => {
  it("LIKE increments every dimension the dish carries by 1", () => {
    const vector = applyTasteVectorDelta(
      emptyTasteVector(),
      SPICY_KOSHARY,
      1
    );
    expect(vector.cuisine).toEqual({ Egyptian: 1 });
    expect(vector.tasteAttribute).toEqual({ SPICY: 1, SAVORY: 1 });
    expect(vector.mealCharacteristic).toEqual({ FILLING: 1, LUNCH: 1 });
  });

  it("DISLIKE decrements every dimension and never removes counters", () => {
    const liked = applyTasteVectorDelta(emptyTasteVector(), SPICY_KOSHARY, 1);
    const disliked = applyTasteVectorDelta(liked, SPICY_KOSHARY, -1);
    expect(disliked.cuisine).toEqual({ Egyptian: 0 });
    expect(disliked.tasteAttribute).toEqual({ SPICY: 0, SAVORY: 0 });
    expect(disliked.mealCharacteristic).toEqual({ FILLING: 0, LUNCH: 0 });
  });
});

describe("personality-session taste-vector persistence", () => {
  it("round-trips the vector through storage within the same day", async () => {
    const base = emptyPersonalitySession();
    await writePersonalitySession(base);
    const read = await readPersonalitySession();
    expect(read.tasteVector).toEqual(base.tasteVector);
    expect(read.mood).toBeNull();
  });

  it("carries the vector across the daily dateKey reset", async () => {
    const learned: TasteVector = {
      cuisine: { Egyptian: 3 },
      tasteAttribute: { SPICY: 5 },
      mealCharacteristic: { LUNCH: 1 },
    };
    await writePersonalitySession({
      dateKey: "1999-12-31",
      mood: "cozy",
      weatherOverride: "cold",
      weatherEnabled: false,
      mealSlotOverride: "late-night",
      timeEnabled: true,
      tasteVector: learned,
    });
    const read = await readPersonalitySession();
    expect(read.dateKey).toBe(todayKey());
    expect(read.tasteVector).toEqual(learned);
    expect(read.mood).toBeNull();
    expect(read.weatherOverride).toBeNull();
    expect(read.mealSlotOverride).toBeNull();
  });
});

describe("learned affinity", () => {
  it("clamps per-dimension net to [-1, +1] at net/5", () => {
    expect(dimensionAffinity(2.5)).toBe(0.5);
    expect(dimensionAffinity(7)).toBe(1);
    expect(dimensionAffinity(-9)).toBe(-1);
    expect(dimensionAffinity(0)).toBe(0);
  });

  it("averages the candidate's dimensions; unmeasured names count as 0", () => {
    const vector: TasteVector = {
      cuisine: { Egyptian: 4 },
      tasteAttribute: { SPICY: 5 },
      mealCharacteristic: {},
    };
    expect(pickAffinity(vector, SPICY_KOSHARY)).toBe(0.75);
  });

  it("reorders picks by affinity with server order as tiebreak", () => {
    const italian = makeItem("italian", { cuisines: ["Italian"] });
    const japanese = makeItem("japanese", { cuisines: ["Japanese"] });
    const egyptian = makeItem("egyptian", { cuisines: ["Egyptian"] });
    const base = [italian, japanese, egyptian];
    const sorted = orderByLearnedAffinity(base, {
      cuisine: { Egyptian: 5, Italian: -2 },
      tasteAttribute: {},
      mealCharacteristic: {},
    });
    expect(sorted).toEqual([egyptian, japanese, italian]);
  });
});
