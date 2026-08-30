import { z } from 'zod';
import { DietaryPropertyEnum, MealCharacteristicEnum } from '../dishes/schema.js';

export const UpdatePreferencesSchema = z.object({
  preferredCuisines: z.array(z.string()).optional(),
  dislikedCuisines: z.array(z.string()).optional(),
  preferredPriceRange: z.enum(['BUDGET', 'MODERATE', 'EXPENSIVE', 'LUXURY']).nullable().optional(),
  dietaryRestrictions: z.array(DietaryPropertyEnum).optional(),
  spicePreference: z.number().int().min(0).max(5).optional(),
  preferredMealTypes: z.array(MealCharacteristicEnum).optional(),
  atmospherePreferences: z.array(z.string()).optional(),
  inferredPreferences: z.record(z.unknown()).optional(),
});

export type UpdatePreferencesInput = z.infer<typeof UpdatePreferencesSchema>;
