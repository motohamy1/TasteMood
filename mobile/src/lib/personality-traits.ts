import { normalizeTasteVector, type TasteVector } from "@/lib/personality-session";
import type { DiscoveryPreference } from "@/lib/personality";
import type { MealCharacteristic } from "@/types/dish";

/**
 * Measured trait bars for the personality screen.
 *
 * Each bar blends the learned taste vector (LIKE/SAVED +1, DISLIKE -1 net
 * counters, no decay) with the stable setup value. A bar is "measured" once
 * its signal subset reaches TRAIT_MEASURED_THRESHOLD net signals
 * (sum of |net|); below that it renders the setup value and invites input.
 */

export const TRAIT_MEASURED_THRESHOLD = 5;

export type TraitId = "heat" | "adventure" | "breadth" | "mealPattern";

export type TraitConfidence = "measured" | "low-signal";

/**
 * Language-agnostic provenance entry. Rendered through i18n template keys
 * (personality.traitSourceSignal / traitSourceSetup) so the data stays out of
 * the dictionaries. A pair pick is an ordinary LIKE signal, so it shows up as
 * a signal entry — there is no separate pair kind to render.
 */
export interface ProvenanceSource {
  kind: "signal" | "setup";
  dimension: "cuisine" | "tasteAttribute" | "mealCharacteristic" | "setup";
  /** Signal value name (e.g. "SPICY", "Egyptian") or setup field name. */
  name: string;
  /** Net counter for signal sources. */
  net?: number;
  /** Stable value for setup sources (e.g. "4", "CURIOUS"). */
  value?: string;
}

export interface TraitBarData {
  id: TraitId;
  pct: number;
  confidence: TraitConfidence;
  signalCount: number;
  sources: ProvenanceSource[];
}

export interface TraitInputs {
  vector: TasteVector;
  spicePreference?: number;
  preferredCuisines?: string[];
  preferredMealTypes?: MealCharacteristic[];
  discoveryPreference?: DiscoveryPreference;
}

function absSum(record: Record<string, number>): number {
  return Object.values(record).reduce((sum, net) => sum + Math.abs(net), 0);
}

function distinctCount(record: Record<string, number>): number {
  return Object.values(record).filter((net) => net !== 0).length;
}

/** Measured blend: learned dominates; low-signal: setup value as-is. */
function blend(learnedPct: number, setupPct: number, measured: boolean): number {
  const raw = measured ? learnedPct * 0.7 + setupPct * 0.3 : setupPct;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

function topSignals(
  record: Record<string, number>,
  dimension: ProvenanceSource["dimension"],
  limit = 5
): ProvenanceSource[] {
  return Object.entries(record)
    .filter(([, net]) => net !== 0)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .slice(0, limit)
    .map(([name, net]) => ({ kind: "signal" as const, dimension, name, net }));
}

function heatTrait(input: TraitInputs): TraitBarData {
  const spicyNet = input.vector.tasteAttribute.SPICY ?? 0;
  const signalCount = Math.abs(spicyNet);
  const measured = signalCount >= TRAIT_MEASURED_THRESHOLD;
  const learnedPct = 50 + 10 * Math.max(-5, Math.min(5, spicyNet));
  const setupPct = ((input.spicePreference ?? 0) / 5) * 100;
  const sources: ProvenanceSource[] = [];
  if (spicyNet !== 0) {
    sources.push({ kind: "signal", dimension: "tasteAttribute", name: "SPICY", net: spicyNet });
  }
  sources.push({
    kind: "setup",
    dimension: "setup",
    name: "spicePreference",
    value: String(input.spicePreference ?? 0),
  });
  return { id: "heat", pct: blend(learnedPct, setupPct, measured), confidence: measured ? "measured" : "low-signal", signalCount, sources };
}

function adventureTrait(input: TraitInputs): TraitBarData {
  const signalCount = absSum(input.vector.tasteAttribute);
  const measured = signalCount >= TRAIT_MEASURED_THRESHOLD;
  const learnedPct = Math.min(100, distinctCount(input.vector.tasteAttribute) * 20);
  const setupPct = input.discoveryPreference === "CURIOUS" ? 75 : 25;
  const sources: ProvenanceSource[] = [
    ...topSignals(input.vector.tasteAttribute, "tasteAttribute"),
    {
      kind: "setup",
      dimension: "setup",
      name: "discoveryPreference",
      value: input.discoveryPreference ?? "FAMILIAR",
    },
  ];
  return { id: "adventure", pct: blend(learnedPct, setupPct, measured), confidence: measured ? "measured" : "low-signal", signalCount, sources };
}

function breadthTrait(input: TraitInputs): TraitBarData {
  const signalCount = absSum(input.vector.cuisine);
  const measured = signalCount >= TRAIT_MEASURED_THRESHOLD;
  const learnedPct = Math.min(100, distinctCount(input.vector.cuisine) * 25);
  const setupPct = Math.min(100, (input.preferredCuisines?.length ?? 0) * 25);
  const sources: ProvenanceSource[] = [
    ...topSignals(input.vector.cuisine, "cuisine"),
    {
      kind: "setup",
      dimension: "setup",
      name: "preferredCuisines",
      value: (input.preferredCuisines ?? []).join(", "),
    },
  ];
  return { id: "breadth", pct: blend(learnedPct, setupPct, measured), confidence: measured ? "measured" : "low-signal", signalCount, sources };
}

function mealPatternTrait(input: TraitInputs): TraitBarData {
  const signalCount = absSum(input.vector.mealCharacteristic);
  const measured = signalCount >= TRAIT_MEASURED_THRESHOLD;
  const learnedPct = Math.min(100, distinctCount(input.vector.mealCharacteristic) * 20);
  const setupPct = Math.min(100, (input.preferredMealTypes?.length ?? 0) * 34);
  const sources: ProvenanceSource[] = [
    ...topSignals(input.vector.mealCharacteristic, "mealCharacteristic"),
    {
      kind: "setup",
      dimension: "setup",
      name: "preferredMealTypes",
      value: (input.preferredMealTypes ?? []).join(", "),
    },
  ];
  return { id: "mealPattern", pct: blend(learnedPct, setupPct, measured), confidence: measured ? "measured" : "low-signal", signalCount, sources };
}

export function buildTraitBars(input: TraitInputs): TraitBarData[] {
  return [heatTrait(input), adventureTrait(input), breadthTrait(input), mealPatternTrait(input)];
}

/**
 * Vector path per auth state: guests read the local session vector,
 * signed-in users read the server profile's inferred vector. Both pass
 * through normalizeTasteVector — no duplicated normalization.
 */
export function resolveTraitVector(
  isSignedIn: boolean,
  sessionVector: unknown,
  serverVector: unknown
): TasteVector {
  return normalizeTasteVector(isSignedIn ? serverVector : sessionVector);
}
