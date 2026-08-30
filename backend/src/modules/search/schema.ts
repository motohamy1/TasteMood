import { z } from 'zod';
import { DietaryPropertyEnum, MealCharacteristicEnum, TasteAttributeEnum } from '../dishes/schema.js';

export const SearchRestaurantsSchema = z.object({
  q: z.string().optional(),
  cuisine: z.string().optional(),
  priceRange: z.enum(['BUDGET', 'MODERATE', 'EXPENSIVE', 'LUXURY']).optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  radiusKm: z.coerce.number().default(10),
  atmosphere: z.string().optional(),
  openNow: z.coerce.boolean().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export const SearchDishesSchema = z.object({
  q: z.string().optional(),
  cuisine: z.string().optional(),
  minPrice: z.coerce.number().optional(),
  maxPrice: z.coerce.number().optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  radiusKm: z.coerce.number().default(10),
  taste: TasteAttributeEnum.optional(),
  mealType: MealCharacteristicEnum.optional(),
  dietary: DietaryPropertyEnum.optional(),
  tag: z.string().optional(),
  openNow: z.coerce.boolean().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export type SearchRestaurantsInput = z.infer<typeof SearchRestaurantsSchema>;
export type SearchDishesInput = z.infer<typeof SearchDishesSchema>;
