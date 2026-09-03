/**
 * Types aligned with the TasteMood backend (see backend/src/modules/dishes/schema.ts).
 * Kept hand-rolled (no zod) to keep the mobile bundle lean.
 */

export type DishStatus = "ACTIVE" | "INACTIVE" | "DRAFT";
export type VerificationStatus = "UNVERIFIED" | "VERIFIED" | "NEEDS_REVIEW";

export type TasteAttribute =
  | "SPICY"
  | "SWEET"
  | "SAVORY"
  | "SOUR"
  | "BITTER"
  | "CREAMY"
  | "RICH"
  | "REFRESHING";

export type MealCharacteristic =
  | "LIGHT"
  | "HEAVY"
  | "FILLING"
  | "SNACK"
  | "BREAKFAST"
  | "LUNCH"
  | "DINNER"
  | "DESSERT"
  | "BEVERAGE";

export type DietaryProperty =
  | "VEGETARIAN"
  | "VEGAN"
  | "HALAL"
  | "GLUTEN_FREE"
  | "DAIRY_FREE"
  | "NUT_FREE"
  | "LOW_CARB";

/** Lightweight dish card shape used in lists. The /dishes list endpoint returns this. */
export interface DishSummary {
  id: string;
  name: string;
  slug: string;
  description?: string;
  price: number;
  currency: string;
  imageUrl?: string;
  status: DishStatus;
  verificationStatus?: VerificationStatus;
  /** Ratings are not modeled in the backend yet — only render when present. */
  rating?: number;
  reviewCount?: number;
  calories?: number;
  prepTimeMinutes?: number;
  restaurantName: string;
  branchName?: string;
  category: string;
  cuisine: string;
  tasteAttributes: TasteAttribute[];
  mealCharacteristics: MealCharacteristic[];
  dietaryProperties: DietaryProperty[];
  tags: string[];
}

/** Detailed dish shape returned by GET /dishes/:id. */
export interface Dish extends DishSummary {
  restaurantId: string;
  branchId?: string;
  menuId: string;
  ingredients: string[];
  aiScore?: number;
  aiExplanation?: string;
  scoreBreakdown?: {
    preferenceScore: number;
    priceScore: number;
    distanceScore: number;
    tasteScore: number;
    popularityScore: number;
    freshnessScore: number;
  };
}

/** Paginated response envelope used by /dishes. */
export interface Paginated<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Re-export so consumers can `import { UserProfile } from "@/types/dish"`
// alongside Dish types without a second import.
export type { UserProfile } from "./user";
