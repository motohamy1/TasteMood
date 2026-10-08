/**
 * Restaurant shapes mirroring backend/src/modules/restaurants/presenter.ts.
 * Hand-rolled (no zod) to keep the mobile bundle lean.
 */

import type { DishSummary } from "./dish";

/** A markaz/area with a restaurant count — drives the Location category rail. */
export interface RestaurantArea {
  slug: string;
  nameEn: string;
  nameAr: string;
  latitude: number | null;
  longitude: number | null;
  restaurantCount: number;
}

export interface RestaurantCuisine {
  slug: string;
  name: string;
  nameAr: string | null;
}

export interface RestaurantAreaRef {
  slug: string;
  nameEn: string;
  nameAr: string;
}

/**
 * What kind of place this is. `cafe` is a coffee shop; `restaurant`,
 * `fast_food`, `bakery`, `ice_cream`, `bar`, `food_court` are the rest.
 * Null when the source did not classify it, which is common for older imports.
 */
export type PlaceKind =
  | "restaurant"
  | "cafe"
  | "fast_food"
  | "bakery"
  | "ice_cream"
  | "bar"
  | "food_court";

export interface RestaurantBranch {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  phone: string | null;
  /** null when the branch has no published opening hours. */
  isOpen: boolean | null;
  area: RestaurantAreaRef | null;
  atmospheres: string[];
  placeKind: PlaceKind | null;
  /**
   * Source-reported rating, when there is one. Optional provenance, never a
   * requirement: most of the catalogue has no rating and every place must show
   * and browse identically without it.
   */
  rating: number | null;
  reviewsCount: number | null;
  /** Link out to the source listing. */
  mapsUrl: string | null;
}

export interface RestaurantSummary {
  id: string;
  name: string;
  nameEn: string | null;
  slug: string;
  description: string | null;
  priceRange: string;
  logoUrl: string | null;
  coverImageUrl: string | null;
  cuisines: RestaurantCuisine[];
  /** Nearest (or first) branch's area. */
  area: RestaurantAreaRef | null;
  /** Nearest (or first) active branch. */
  branch: RestaurantBranch | null;
  branchesCount: number;
  distanceMeters: number | null;
  /** The shown branch's kind, hoisted so cards need not reach into `branch`. */
  placeKind: PlaceKind | null;
}

export interface RestaurantDetail extends RestaurantSummary {
  branches: RestaurantBranch[];
  /** Flattened by the backend with the shared dish presenter (DishDTO). */
  dishes: DishSummary[];
}

/**
 * What a place card actually renders. Both the restaurant catalogue
 * (`RestaurantSummary`) and places derived from a recommendation response
 * (which only carries the nested restaurant/branch fields) map onto this, so
 * the card has one input shape.
 */
export interface RestaurantCardItem {
  id: string;
  name: string;
  nameEn: string | null;
  photoUrl: string | null;
  cuisines: Array<{ name: string; nameAr: string | null }>;
  area: { name: string; nameAr: string } | null;
  address: string | null;
  isOpen: boolean | null;
  distanceMeters: number | null;
  branchesCount: number | null;
  placeKind: PlaceKind | null;
  /**
   * Optional. Rendered only when present; its absence must never change the
   * card's layout or hide the place.
   */
  rating: number | null;
  reviewsCount: number | null;
}

/** A place kind the catalogue actually holds — drives the browse filter. */
export interface PlaceKindCount {
  kind: string;
  count: number;
  nameEn: string | null;
  nameAr: string | null;
}

/** Query accepted by GET /restaurants. */
export type RestaurantQuery = {
  page?: number;
  limit?: number;
  search?: string;
  cuisine?: string;
  priceRange?: "BUDGET" | "MODERATE" | "EXPENSIVE" | "LUXURY";
  governorate?: string;
  city?: string;
  /** `coffee` is an alias the API maps to `cafe`. */
  placeKind?: PlaceKind | "coffee";
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
  sort?: "newest" | "distance" | "name";
};
