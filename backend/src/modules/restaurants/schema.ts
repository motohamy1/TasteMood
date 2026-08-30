import { z } from 'zod';

export const CreateRestaurantSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().optional(),
  priceRange: z.enum(['BUDGET', 'MODERATE', 'EXPENSIVE', 'LUXURY']).default('MODERATE'),
  cuisineIds: z.array(z.string()).default([]),
  logoUrl: z.string().url().optional(),
  coverImageUrl: z.string().url().optional(),
  source: z.string().default('MANUAL'),
});

export const UpdateRestaurantSchema = CreateRestaurantSchema.partial().extend({
  status: z.enum(['ACTIVE', 'INACTIVE', 'DRAFT']).optional(),
  verificationStatus: z.enum(['UNVERIFIED', 'VERIFIED', 'NEEDS_REVIEW']).optional(),
});

export const QueryRestaurantSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  cuisine: z.string().optional(),
  priceRange: z.enum(['BUDGET', 'MODERATE', 'EXPENSIVE', 'LUXURY']).optional(),
  search: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'DRAFT']).optional(),
  verificationStatus: z.enum(['UNVERIFIED', 'VERIFIED', 'NEEDS_REVIEW']).optional(),
});

export type CreateRestaurantInput = z.infer<typeof CreateRestaurantSchema>;
export type UpdateRestaurantInput = z.infer<typeof UpdateRestaurantSchema>;
export type QueryRestaurantInput = z.infer<typeof QueryRestaurantSchema>;
