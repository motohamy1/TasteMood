import { z } from 'zod';

export const InteractionTypeEnum = z.enum([
  'VIEW_RESTAURANT',
  'VIEW_DISH',
  'CLICK_RECOMMENDATION',
  'LIKE',
  'DISLIKE',
  'NOT_INTERESTED',
  'TOO_EXPENSIVE',
  'TOO_FAR',
  'WRONG_TASTE',
  'SAVED',
  'SHARED',
]);

export const CreateInteractionSchema = z.object({
  restaurantId: z.string().uuid().optional(),
  branchId: z.string().uuid().optional(),
  dishId: z.string().uuid().optional(),
  interactionType: InteractionTypeEnum,
  metadata: z.record(z.unknown()).optional(),
});

export const QueryInteractionsSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  interactionType: InteractionTypeEnum.optional(),
});

export const DishIdParamSchema = z.object({
  dishId: z.string().uuid(),
});

export type CreateInteractionInput = z.infer<typeof CreateInteractionSchema>;
export type QueryInteractionsInput = z.infer<typeof QueryInteractionsSchema>;
export type DishIdParamInput = z.infer<typeof DishIdParamSchema>;
