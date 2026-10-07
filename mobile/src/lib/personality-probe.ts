import { isRecord } from "@/lib/type-guards";
import { TRAIT_MEASURED_THRESHOLD } from "@/lib/personality-traits";
import type { TasteVector } from "@/lib/personality-session";
import type { UserPreferences } from "@/types/user";

/**
 * Ticket 06 — low-confidence taste probes ("Know you better" card).
 *
 * Pure pending-probe selection: at most one probe is ever pending, the first
 * probe is always the budget ceiling (preferredPriceRange == null — highest
 * leverage, unblocks price-aware ranking), and later topics are keyed off
 * low-confidence learned-taste dimensions.
 *
 * A dimension is measured when the sum of |net| across its entries is >= the
 * threshold owned by personality-traits.ts — the same computation the measured
 * trait bars use, imported rather than duplicated so the two cannot drift.
 */

export const PROBE_MEASURED_THRESHOLD = TRAIT_MEASURED_THRESHOLD;

export type ProbeDimension = "cuisine" | "tasteAttribute" | "mealCharacteristic";

export type ProbeTopic = "budget" | ProbeDimension;

export interface PendingProbe {
  topic: ProbeTopic;
}

function dimensionSignalTotal(
  dimension: Record<string, number> | null | undefined
): number {
  if (!dimension) return 0;
  let total = 0;
  for (const net of Object.values(dimension)) {
    if (typeof net !== "number" || !Number.isFinite(net)) continue;
    total += Math.abs(Math.trunc(net));
  }
  return total;
}

export function isDimensionMeasured(
  dimension: Record<string, number> | null | undefined,
  threshold: number = PROBE_MEASURED_THRESHOLD
): boolean {
  return dimensionSignalTotal(dimension) >= threshold;
}

/** Dimensions still below the measured threshold, in stable priority order. */
export function lowConfidenceDimensions(
  vector: TasteVector | null | undefined
): ProbeDimension[] {
  const dimensions: ProbeDimension[] = ["cuisine", "tasteAttribute", "mealCharacteristic"];
  return dimensions.filter((dimension) => !isDimensionMeasured(vector?.[dimension]));
}

/**
 * Returns the single pending probe, or null when nothing needs asking:
 * budget is unknown (or prefs unavailable), or every learned dimension is
 * still low-confidence. Returns null once the budget is known AND all
 * dimensions are measured.
 */
export function pendingProbe(
  prefs: UserPreferences | null,
  vector: TasteVector | null | undefined
): PendingProbe | null {
  // Budget first: highest leverage, unblocks price-aware ranking.
  if (!prefs || prefs.preferredPriceRange == null) {
    return { topic: "budget" };
  }
  const [next] = lowConfidenceDimensions(vector);
  return next ? { topic: next } : null;
}

/**
 * Reads the probe dismissal date from stored personality metadata, mirroring
 * the followUpShownDate pattern: dismissed today stays retired, any other
 * day the probe may show again. Never throws on malformed metadata.
 */
export function probeDismissedDate(
  prefs?: Partial<UserPreferences> | null,
): string | null {
  const personality = prefs?.inferredPreferences;
  if (!isRecord(personality)) return null;
  const inner = personality.personality;
  if (!isRecord(inner)) return null;
  return typeof inner.probeDismissedDate === "string" ? inner.probeDismissedDate : null;
}

export function isProbeDismissedForToday(
  dismissedDate: string | null | undefined,
  today: string
): boolean {
  return dismissedDate === today;
}
