import type {
  DietaryProperty,
  MealCharacteristic,
} from "./dish";

/** Mirrors backend prisma `model User`. */
export interface UserProfile {
  id: string;
  authUserId: string;
  email?: string | null;
  displayName: string;
  role: "USER" | "ADMIN" | "RESTAURANT_OWNER";
  avatarUrl?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export type PriceRange = "BUDGET" | "MID_RANGE" | "PREMIUM" | "LUXURY";

/** Mirrors backend prisma `model UserPreferenceProfile`. */
export interface UserPreferences {
  id?: string;
  userId?: string;
  preferredCuisines: string[];
  dislikedCuisines: string[];
  preferredPriceRange?: PriceRange | null;
  dietaryRestrictions: DietaryProperty[];
  spicePreference: number; // 0..5
  preferredMealTypes: MealCharacteristic[];
  atmospherePreferences: string[];
  inferredPreferences?: Record<string, unknown> | null;
}

export type { UserProfile as User };
