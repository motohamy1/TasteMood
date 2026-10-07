import { describe, expect, it } from "vitest";
import { whyLine } from "@/lib/personality-why";
import type {
  PersonalityContext,
  RecommendationItem,
  RecommendationScoreBreakdown,
} from "@/types/recommendation";

function breakdown(over: Partial<RecommendationScoreBreakdown> = {}): RecommendationScoreBreakdown {
  return {
    preferenceMatch: 0.5,
    learnedAffinity: 0,
    priceMatch: 0.7,
    distanceScore: 0.5,
    tasteMatch: 0.5,
    popularity: 0.5,
    freshness: 0.5,
    ...over,
  };
}

function item(over: Partial<RecommendationItem> = {}): RecommendationItem {
  return {
    dish: {
      id: "d1",
      name: "كشري",
      nameEn: "Koshary",
      description: null,
      price: 60,
      currency: "EGP",
      imageUrl: null,
      tasteAttributes: ["SPICY"],
      mealCharacteristics: ["LUNCH"],
      dietaryProperties: [],
      tags: [],
    },
    restaurant: {
      id: "r1",
      name: "مطعم",
      nameEn: "Place",
      priceRange: "$$",
      logoUrl: null,
      cuisines: ["Egyptian"],
    },
    branch: {
      id: "b1",
      name: "Downtown",
      address: null,
      latitude: 0,
      longitude: 0,
      isOpen: true,
    },
    distanceMeters: 1200,
    score: 0.9,
    scoreBreakdown: breakdown(),
    reason: "",
    ...over,
  };
}

const FULL_CONTEXT: PersonalityContext = {
  mood: "cozy",
  weather: "cold",
  mealSlot: "dinner",
};

describe("whyLine", () => {
  it("is deterministic: same input => same string", () => {
    const b = breakdown({ preferenceMatch: 1, learnedAffinity: 0.1, priceMatch: 0.9 });
    const pick = item();
    const first = whyLine(b, pick, FULL_CONTEXT, "en");
    for (let i = 0; i < 5; i += 1) {
      expect(whyLine(b, pick, FULL_CONTEXT, "en")).toBe(first);
    }
    expect(whyLine(b, pick, FULL_CONTEXT, "ar")).toBe(
      whyLine(b, pick, FULL_CONTEXT, "ar")
    );
  });

  it("omits missing signals and never says unknown", () => {
    const line = whyLine(
      breakdown(),
      item({ distanceMeters: null, restaurant: { ...item().restaurant, cuisines: [] } }),
      {},
      "en"
    );
    expect(line.toLowerCase()).not.toContain("unknown");
    // Only neutral defaults + no context => the generic fallback.
    expect(line).toBe("top pick for this session");
  });

  it("composes declared match + learned + mood/weather + distance + price", () => {
    const line = whyLine(
      breakdown({ preferenceMatch: 1, tasteMatch: 1, learnedAffinity: 0.2, priceMatch: 0.95 }),
      item(),
      FULL_CONTEXT,
      "en"
    );
    expect(line).toContain("Egyptian");
    expect(line).toContain("spicy");
    expect(line).toContain("learned-taste pick");
    expect(line).toContain("Cozy");
    expect(line).toContain("Cold");
    expect(line).toContain("1.2 km");
    expect(line).toContain("fits your budget");
  });

  it("renders the same signals in Arabic", () => {
    const line = whyLine(
      breakdown({ preferenceMatch: 1, learnedAffinity: 0.2, priceMatch: 0.95 }),
      item(),
      { mood: "cozy" },
      "ar"
    );
    expect(line).toContain("Egyptian");
    expect(line).toContain("اختيار ذوقك المتعلَّم");
    expect(line).toContain("دافئ");
    expect(line).toContain("1.2 km");
    expect(line).toContain("يناسب ميزانيتك");
  });

  it("omits the learned segment below the ±0.05 threshold, words negative affinity", () => {
    const quiet = whyLine(breakdown({ learnedAffinity: 0.049 }), item({ distanceMeters: null }), {}, "en");
    expect(quiet).not.toContain("learned-taste");
    const quietNeg = whyLine(breakdown({ learnedAffinity: -0.049 }), item({ distanceMeters: null }), {}, "en");
    expect(quietNeg).not.toContain("usual taste");
    const neg = whyLine(breakdown({ learnedAffinity: -0.2 }), item({ distanceMeters: null }), {}, "en");
    expect(neg).toContain("outside your usual taste");
  });

  it("does not report a cuisine when only learned affinity pushed preferenceMatch up", () => {
    // A learned bump (e.g. +0.25) can lift blended preferenceMatch past the
    // threshold while the declared match stayed neutral — the line must not
    // claim a declared cuisine the user never stated.
    const line = whyLine(
      breakdown({ preferenceMatch: 0.75, learnedAffinity: 0.25 }),
      item({ distanceMeters: null }),
      {},
      "en"
    );
    expect(line).not.toContain("Egyptian");
    expect(line).toContain("learned-taste pick");
  });

  it("works for guest ordering: learnedAffinity 0 still yields a truthful line", () => {
    const line = whyLine(
      breakdown({ preferenceMatch: 1, learnedAffinity: 0 }),
      item(),
      { mood: "light" },
      "en"
    );
    expect(line).toContain("Egyptian");
    expect(line).not.toContain("learned-taste");
    expect(line.toLowerCase()).not.toContain("unknown");
  });
});
