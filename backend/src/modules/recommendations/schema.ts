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

/**
 * Output contract for POST /recommendations. The response is parsed through
 * this schema before it leaves the pipeline, so shape drift between the
 * pipeline and the client (the CR-03 bug class) becomes a test failure at the
 * seam instead of a silent client crash.
 */
export const RecommendationItemSchema = z.object({
  dish: z
    .object({
      id: z.string(),
      name: z.string(),
      description: z.string().nullable(),
      price: z.number(),
      currency: z.string(),
      imageUrl: z.string().nullable(),
      tasteAttributes: z.array(z.string()),
      mealCharacteristics: z.array(z.string()),
      dietaryProperties: z.array(z.string()),
      tags: z.array(z.string()),
    })
    .passthrough(),
  restaurant: z.object({
    id: z.string(),
    name: z.string(),
    priceRange: z.string().nullable(),
    logoUrl: z.string().nullable(),
    cuisines: z.array(z.string()),
  }),
  branch: z.object({
    id: z.string(),
    name: z.string(),
    address: z.string().nullable(),
    latitude: z.number(),
    longitude: z.number(),
    isOpen: z.boolean(),
  }),
  distanceMeters: z.number().nullable(),
  score: z.number(),
  scoreBreakdown: z.object({
    preferenceMatch: z.number(),
    priceMatch: z.number(),
    distanceScore: z.number(),
    tasteMatch: z.number(),
    popularity: z.number(),
    freshness: z.number(),
  }),
  reason: z.string(),
});

export const RecommendationResponseSchema = z.object({
  request: z.object({
    originalQuery: z.string().nullable(),
    surpriseMe: z.boolean(),
  }),
  interpretation: z.object({
    maxPrice: z.number().nullable(),
    minPrice: z.number().nullable(),
    mealTypes: z.array(z.string()),
    tasteAttributes: z.array(z.string()),
    preferredCuisines: z.array(z.string()),
    dietaryRestrictions: z.array(z.string()),
    atmosphere: z.array(z.string()),
  }),
  recommendations: z.array(RecommendationItemSchema),
});

export type RecommendationResponse = z.infer<typeof RecommendationResponseSchema>;
