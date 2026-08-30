import { z } from 'zod';

export const CreateMenuSchema = z.object({
  restaurantId: z.string().uuid(),
  branchId: z.string().uuid().optional(),
  name: z.string().min(2).max(100),
  description: z.string().optional(),
  source: z.string().default('MANUAL'),
  effectiveFrom: z.coerce.date().optional(),
  effectiveTo: z.coerce.date().optional(),
});

export const UpdateMenuSchema = CreateMenuSchema.partial().extend({
  status: z.enum(['ACTIVE', 'INACTIVE', 'DRAFT']).optional(),
});

export type CreateMenuInput = z.infer<typeof CreateMenuSchema>;
export type UpdateMenuInput = z.infer<typeof UpdateMenuSchema>;
