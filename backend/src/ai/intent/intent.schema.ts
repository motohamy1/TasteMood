import { z } from 'zod';

export const StructuredIntentSchema = z.object({
  rawQuery: z.string(),
  mealTypes: z.array(
    z.enum([
      'LIGHT',
      'HEAVY',
      'FILLING',
      'SNACK',
      'BREAKFAST',
      'LUNCH',
      'DINNER',
      'DESSERT',
      'BEVERAGE',
    ])
  ).default([]),
  preferredCuisines: z.array(z.string()).default([]),
  dislikedCuisines: z.array(z.string()).default([]),
  preferredTags: z.array(z.string()).default([]),
  tasteAttributes: z.array(
    z.enum([
      'SPICY',
      'SWEET',
      'SAVORY',
      'SOUR',
      'BITTER',
      'CREAMY',
      'RICH',
      'REFRESHING',
    ])
  ).default([]),
  dietaryRestrictions: z.array(
    z.enum([
      'VEGETARIAN',
      'VEGAN',
      'HALAL',
      'GLUTEN_FREE',
      'DAIRY_FREE',
      'NUT_FREE',
      'LOW_CARB',
    ])
  ).default([]),
  atmosphere: z.array(z.string()).default([]),
  maxPrice: z.number().nullable().optional(),
  minPrice: z.number().nullable().optional(),
  location: z
    .object({
      latitude: z.number(),
      longitude: z.number(),
      radiusKm: z.number().default(10),
    })
    .nullable()
    .optional(),
  surpriseMe: z.boolean().default(false),
  specificDishOrIngredient: z.string().nullable().optional(),
  excludedIngredients: z.array(z.string()).default([]),
});

export type StructuredIntent = z.infer<typeof StructuredIntentSchema>;
