import { describe, expect, it } from "vitest";

import {
  PAIR_ANSWER_INTERACTION,
  isShowablePair,
  pairAnswerInput,
  pairTasteRequest,
  shouldOfferPair,
} from "@/lib/personality-pair";
import type { RecommendationItem } from "@/types/recommendation";

function item(dishId: string, overrides: Partial<RecommendationItem> = {}): RecommendationItem {
  return {
    dish: { id: dishId, name: dishId } as RecommendationItem["dish"],
    restaurant: { id: "r1", name: "R" } as RecommendationItem["restaurant"],
    branch: { id: "b1", name: "B" } as RecommendationItem["branch"],
    distanceMeters: 1200,
    score: 0.8,
    scoreBreakdown: {
      preferenceMatch: 0.7,
      learnedAffinity: 0,
      priceMatch: 0.7,
      distanceScore: 0.5,
      tasteMatch: 0.7,
      popularity: 0.5,
      freshness: 0.5,
    },
    reason: "",
    ...overrides,
  };
}

describe("pairAnswerInput", () => {
  it("maps a pair item to the ordinary LIKE interaction payload", () => {
    expect(pairAnswerInput(item("d1"))).toEqual({
      dishId: "d1",
      restaurantId: "r1",
      branchId: "b1",
      interactionType: "LIKE",
    });
    expect(PAIR_ANSWER_INTERACTION).toBe("LIKE");
  });

  it("returns null when ids are missing rather than posting garbage", () => {
    const noDish = item("d1", { dish: { id: "" } as RecommendationItem["dish"] });
    expect(pairAnswerInput(noDish)).toBeNull();
    const noBranch = item("d1", { branch: { id: "" } as RecommendationItem["branch"] });
    expect(pairAnswerInput(noBranch)).toBeNull();
  });
});

describe("isShowablePair", () => {
  it("accepts two distinct well-formed items", () => {
    expect(isShowablePair([item("d1"), item("d2")])).toBe(true);
  });

  it("rejects same-dish, malformed, or wrong-length pairs", () => {
    expect(isShowablePair([item("d1"), item("d1")])).toBe(false);
    expect(isShowablePair([item("d1")])).toBe(false);
    expect(isShowablePair(null)).toBe(false);
    expect(
      isShowablePair([item("d1"), item("d2", { branch: { id: "" } as RecommendationItem["branch"] })])
    ).toBe(false);
  });
});

describe("shouldOfferPair", () => {
  const pair: [RecommendationItem, RecommendationItem] = [item("d1"), item("d2")];

  it("offers the pair when available, undismissed, and past the core quiz", () => {
    expect(shouldOfferPair({ pair, dismissed: false, showCoreQuiz: false })).toBe(true);
  });

  it("hides the pair during the core quiz or after dismissal", () => {
    expect(shouldOfferPair({ pair, dismissed: false, showCoreQuiz: true })).toBe(false);
    expect(shouldOfferPair({ pair, dismissed: true, showCoreQuiz: false })).toBe(false);
  });

  it("hides the pair when the backend returned nothing usable", () => {
    expect(shouldOfferPair({ pair: null, dismissed: false, showCoreQuiz: false })).toBe(false);
  });
});

describe("pairTasteRequest", () => {
  it("carries the session meal slot and live context", () => {
    expect(
      pairTasteRequest({
        personalityContext: { mealSlot: "dinner", mood: "cozy", weather: "cold" },
      })
    ).toEqual({
      mealSlot: "dinner",
      personalityContext: { mealSlot: "dinner", mood: "cozy", weather: "cold" },
    });
  });

  it("omits the slot when the session has no meal slot", () => {
    expect(pairTasteRequest({ personalityContext: { mood: "light" } })).toEqual({
      personalityContext: { mood: "light" },
    });
  });

  it("returns null while no base request exists (core quiz pending)", () => {
    expect(pairTasteRequest(null)).toBeNull();
    expect(pairTasteRequest(undefined)).toBeNull();
  });
});
