import type { InteractionType } from "@/types/interaction";
import type { DietaryProperty } from "@/types/dish";
import type {
  PairTasteRequest,
  PairTasteResponse,
  RecommendationItem,
  RecommendationRequest,
} from "@/types/recommendation";

/**
 * Ticket 08 — pair-taste ("Which of these two sounds more you tonight?").
 *
 * Pure helpers only: the mesh of API call, query hook and card lives in
 * queries.ts / the personality screen. Everything here is deterministic and
 * holds no React or network state so the pairing/dismissal rules are testable.
 */

/** The pair answer travels the ordinary interaction path as a pick (LIKE). */
export const PAIR_ANSWER_INTERACTION: Extract<InteractionType, "LIKE"> = "LIKE";

export interface PairAnswerInput {
  dishId: string;
  restaurantId: string;
  branchId: string;
  interactionType: Extract<InteractionType, "LIKE">;
}

/**
 * The interaction the chosen pair item should record — the same payload the
 * standard feedback path posts, so no special casing exists server-side.
 * Returns null for a malformed item (missing ids) rather than posting garbage.
 */
export function pairAnswerInput(
  item: Pick<RecommendationItem, "dish" | "restaurant" | "branch">
): PairAnswerInput | null {
  const dishId = item?.dish?.id;
  const restaurantId = item?.restaurant?.id;
  const branchId = item?.branch?.id;
  if (!dishId || !restaurantId || !branchId) return null;
  return {
    dishId,
    restaurantId,
    branchId,
    interactionType: PAIR_ANSWER_INTERACTION,
  };
}

/**
 * A pair is only showable when it holds exactly two distinct, well-formed
 * items — never the same dish twice, never a card missing ids it needs to
 * record an answer with. Guards the UI against a partial backend response.
 */
export function isShowablePair(
  pair: PairTasteResponse["pair"] | null | undefined
): pair is PairTasteResponse["pair"] {
  if (!pair || pair.length !== 2) return false;
  const [left, right] = pair;
  if (!pairAnswerInput(left) || !pairAnswerInput(right)) return false;
  return left.dish.id !== right.dish.id;
}

/**
 * Whether the pair surface should be offered at all: the core quiz must be
 * done, the user must not have dismissed the pair for this session, and the
 * backend must have returned two well-formed, distinct cards.
 */
export function shouldOfferPair(input: {
  pair: PairTasteResponse["pair"] | null | undefined;
  dismissed: boolean;
  showCoreQuiz: boolean;
}): boolean {
  if (input.showCoreQuiz || input.dismissed) return false;
  return isShowablePair(input.pair);
}

/**
 * Derives the pair-taste request from the recommendation request the screen
 * already built. Carries the session's meal slot (so both candidates share it)
 * and the live context, so a signed-in pair is informed by the requester's
 * vector. `dietaryRestrictions` is forwarded explicitly because a guest's
 * restrictions live only on-device — signed-in callers can omit it and the
 * service reads them from the server profile. Returns null while the base
 * request is absent (core quiz pending), which is what keeps the pair request
 * disabled.
 */
export function pairTasteRequest(
  request: RecommendationRequest | null | undefined,
  dietaryRestrictions?: readonly DietaryProperty[]
): PairTasteRequest | null {
  if (!request) return null;
  const context = request.personalityContext;
  const slot = context?.mealSlot;
  return {
    ...(slot ? { mealSlot: slot } : {}),
    ...(context ? { personalityContext: context } : {}),
    ...(dietaryRestrictions?.length
      ? { dietaryRestrictions: [...dietaryRestrictions] }
      : {}),
  };
}
