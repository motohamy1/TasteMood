import { z } from 'zod';

export const PersonalityContextSchema = z
  .object({
    weather: z.enum(['hot', 'dry', 'cold', 'rainy', 'mild']).optional(),
    mealSlot: z.enum(['breakfast', 'lunch', 'dinner', 'late-night']).optional(),
    mood: z.enum(['cozy', 'light', 'energized', 'indulgent', 'adventurous', 'refreshing']).optional(),
  })
  .strict();

export type PersonalityContext = z.infer<typeof PersonalityContextSchema>;
