import { z } from 'zod';
import { DietaryPropertyEnum } from '../dishes/schema.js';
import { RecommendationItemSchema } from '../recommendations/schema.js';
import { PersonalityContextSchema } from '../personality/personality-context.js';

/**
 * POST /api/v1/pair-taste request. Guests may post an empty object and still
 * receive a generic pair — authentication is optional and never a 401 here.
 *
 * `dietaryRestrictions` is the guest path for the hard dietary constraint:
 * signed-in users' restrictions come from their server profile, but a guest's
 * live only on-device, so the client forwards them here. The service merges
 * both sources, so pair candidates are always dietary-compatible.
 *
 * Answer path (no special casing): the client posts the user's pick as an
 * ordinary interaction via POST /api/v1/interactions with
 * `{ dishId, restaurantId, branchId, interactionType: 'LIKE', personalityContext? }`.
 * The standard interaction write-back path then folds the pick into the
 * requester's taste vector. Every pair item therefore carries the
 * dish/restaurant/branch ids that POST /interactions needs.
 */
export const PairTasteRequestSchema = z.object({
  mealSlot: z.enum(['breakfast', 'lunch', 'dinner', 'late-night']).optional(),
  personalityContext: PersonalityContextSchema.optional(),
  dietaryRestrictions: z.array(DietaryPropertyEnum).optional(),
});

export type PairTasteRequestInput = z.infer<typeof PairTasteRequestSchema>;

/**
 * Exactly two verified-available dishes that share the requested meal slot
 * but differ on `dimension` — the taste-vector dimension where the requester
 * has the lowest confidence. Reuses RecommendationItemSchema (imported, not
 * duplicated) so the pair cards render with the existing recommendation UI.
 */
export const PairTasteResponseSchema = z.object({
  pair: z.tuple([RecommendationItemSchema, RecommendationItemSchema]),
  dimension: z.string(),
});

export type PairTasteResponse = z.infer<typeof PairTasteResponseSchema>;
