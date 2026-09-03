/**
 * Interaction types mirror backend/src/modules/interactions/schema.ts.
 * Kept as a string literal union so they can be serialized over the wire.
 */
export type InteractionType =
  | "VIEW_RESTAURANT"
  | "VIEW_DISH"
  | "CLICK_RECOMMENDATION"
  | "LIKE"
  | "DISLIKE"
  | "NOT_INTERESTED"
  | "TOO_EXPENSIVE"
  | "TOO_FAR"
  | "WRONG_TASTE"
  | "SAVED"
  | "SHARED";

export interface CreateInteractionInput {
  dishId?: string;
  restaurantId?: string;
  branchId?: string;
  interactionType: InteractionType;
  metadata?: Record<string, unknown>;
}
