import type {
  DietaryProperty,
  MealCharacteristic,
  TasteAttribute,
} from "./dish";

/**
 * Response shapes mirror backend/src/modules/recommendations/recommendation.service.ts
 * (see formattedRecommendations / return value of getRecommendations).
 */
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

export interface RecommendationDish {
  id: string;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  imageUrl: string | null;
  tasteAttributes: TasteAttribute[];
  mealCharacteristics: MealCharacteristic[];
  dietaryProperties: DietaryProperty[];
  tags: string[];
}

export interface RecommendationRestaurant {
  id: string;
  name: string;
  priceRange: string;
  logoUrl: string | null;
  cuisines: string[];
}

export interface RecommendationBranch {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  isOpen: boolean;
}

export interface RecommendationScoreBreakdown {
  preferenceMatch: number;
  priceMatch: number;
  distanceScore: number;
  tasteMatch: number;
  popularity: number;
  freshness: number;
}

export interface RecommendationItem {
  dish: RecommendationDish;
  restaurant: RecommendationRestaurant;
  branch: RecommendationBranch;
  distanceMeters: number | null;
  score: number;
  scoreBreakdown: RecommendationScoreBreakdown;
  reason: string;
}

export interface RecommendationInterpretation {
  maxPrice: number | null;
  mealTypes: string[];
  tasteAttributes: string[];
  preferredCuisines: string[];
  dietaryRestrictions: string[];
  atmosphere: string[];
}

export interface RecommendationResponse {
  request: {
    originalQuery: string | null;
    surpriseMe: boolean;
  };
  interpretation: RecommendationInterpretation;
  recommendations: RecommendationItem[];
}
