import type {
  DietaryProperty,
  MealCharacteristic,
  TasteAttribute,
} from "./dish";

/** Mirrors backend/src/modules/recommendations/schema.ts. */
export interface RecommendationRequest {
  query?: string;
  maxPrice?: number;
  minPrice?: number;
  cuisines?: string[];
  tasteAttributes?: TasteAttribute[];
  mealTypes?: MealCharacteristic[];
  dietaryRestrictions?: DietaryProperty[];
  atmosphere?: string[];
  tags?: string[];
  lat?: number;
  lng?: number;
  radiusKm?: number;
  surpriseMe?: boolean;
  limit?: number;
}

import type { Dish } from "./dish";

export interface RecommendationResponse {
  recommendations: Dish[];
  explanation?: string;
}
