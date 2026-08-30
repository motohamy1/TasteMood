import { z } from 'zod';
import { DietaryPropertyEnum, MealCharacteristicEnum, TasteAttributeEnum } from '../dishes/schema.js';

export const RecommendationRequestSchema = z.object({
  query: z.string().optional(), // Natural language request: e.g. "I want something spicy under 250 EGP near me"
  maxPrice: z.number().positive().optional(),
  minPrice: z.number().positive().optional(),
  cuisines: z.array(z.string()).optional(),
  tasteAttributes: z.array(TasteAttributeEnum).optional(),
  mealTypes: z.array(MealCharacteristicEnum).optional(),
  dietaryRestrictions: z.array(DietaryPropertyEnum).optional(),
  atmosphere: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  radiusKm: z.number().positive().default(10),
  surpriseMe: z.boolean().default(false),
  limit: z.number().min(1).max(20).default(5),
});

export type RecommendationRequestInput = z.infer<typeof RecommendationRequestSchema>;
