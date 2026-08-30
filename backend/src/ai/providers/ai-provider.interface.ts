import { StructuredIntent } from '../intent/intent.schema.js';

export interface UserContext {
  userId?: string;
  preferredCuisines?: string[];
  dislikedCuisines?: string[];
  dietaryRestrictions?: string[];
  spicePreference?: number;
  latitude?: number;
  longitude?: number;
}

export interface RecommendationFact {
  dishId: string;
  dishName: string;
  restaurantName: string;
  branchName: string;
  price: number;
  currency: string;
  distanceKm?: number;
  tasteAttributes: string[];
  mealCharacteristics: string[];
  dietaryProperties: string[];
  tags: string[];
  score: number;
}

export interface AIProvider {
  readonly name: string;
  extractIntent(rawQuery: string, userContext?: UserContext): Promise<StructuredIntent>;
  generateExplanation(query: string, facts: RecommendationFact[]): Promise<string[]>;
}
