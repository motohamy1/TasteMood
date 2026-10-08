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

export const RestaurantSortSchema = z.enum(['newest', 'distance', 'name']);

export const QueryRestaurantSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  cuisine: z.string().optional(),
  priceRange: z.enum(['BUDGET', 'MODERATE', 'EXPENSIVE', 'LUXURY']).optional(),
  search: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'DRAFT']).optional(),
  verificationStatus: z.enum(['UNVERIFIED', 'VERIFIED', 'NEEDS_REVIEW']).optional(),
  /** Match restaurants that have an ACTIVE branch in this governorate (Governorate.slug). */
  governorate: z.string().optional(),
  /** Match restaurants that have an ACTIVE branch in this city (City.slug). */
  city: z.string().optional(),
  /**
   * Match restaurants that have an ACTIVE branch of this kind (Branch.placeKind).
   * 'coffee' is the friendly alias the app sends for coffee shops.
   */
  placeKind: z
    .enum(['restaurant', 'cafe', 'coffee', 'fast_food', 'bakery', 'ice_cream', 'bar', 'food_court'])
    .optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  /** Geo radius in kilometres; only applied when latitude+longitude are given. */
  radiusKm: z.coerce.number().positive().default(10),
  sort: RestaurantSortSchema.default('newest'),
});

/** GET /restaurants/cities — optional governorate scope. */
export const QueryRestaurantCitySchema = z.object({
  governorate: z.string().optional(),
});

export type CreateRestaurantInput = z.infer<typeof CreateRestaurantSchema>;
export type UpdateRestaurantInput = z.infer<typeof UpdateRestaurantSchema>;
export type QueryRestaurantInput = z.infer<typeof QueryRestaurantSchema>;
export type QueryRestaurantCityInput = z.infer<typeof QueryRestaurantCitySchema>;
export type RestaurantSort = z.infer<typeof RestaurantSortSchema>;
