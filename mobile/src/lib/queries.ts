/**
 * React Query hooks for the TasteMood backend.
 *
 * Saved-state hooks live in ./saved-dishes.ts; this file owns the dish
 * catalog, recommendations, and preference queries.
 */

import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query";

import {
  getCuisines,
  getDish,
  getDishes,
  getMyPreferences,
  getPairTaste,
  getRecommendations,
  getRestaurant,
  getRestaurantAreas,
  getRestaurants,
  updateMyPreferences,
  type CuisineOption,
} from "./api";
import { pairTasteRequest } from "@/lib/personality-pair";
import type { DishSummary, DietaryProperty } from "@/types/dish";
import type {
  PairTasteRequest,
  PairTasteResponse,
  RecommendationRequest,
} from "@/types/recommendation";
import type {
  RestaurantArea,
  RestaurantDetail,
  RestaurantQuery,
  RestaurantSummary,
} from "@/types/restaurant";
import type { UserPreferences } from "@/types/user";
import { useAuthStore, selectIsSignedIn } from "@/lib/auth-store";

export const queryKeys = {
  dishes: (params: Parameters<typeof getDishes>[0] = {}) =>
    ["dishes", params] as const,
  dish: (id: string) => ["dish", id] as const,
  cuisines: ["cuisines"] as const,
  recommendations: (req: RecommendationRequest) =>
    ["recommendations", req] as const,
  pairTaste: (req: PairTasteRequest | null) =>
    ["pair-taste", req] as const,
  restaurants: (params: RestaurantQuery = {}) =>
    ["restaurants", params] as const,
  restaurantAreas: ["restaurants", "areas"] as const,
  restaurant: (id: string) => ["restaurant", id] as const,
  preferences: ["preferences", "me"] as const,
};

interface DishListParams {
  page?: number;
  limit?: number;
  search?: string;
  cuisine?: string;
  categoryId?: string;
  minPrice?: number;
  maxPrice?: number;
  city?: string;
  governorate?: string;
}

export function useDishes(
  params: DishListParams = {},
  options?: Omit<UseQueryOptions<DishSummary[], Error>, "queryKey" | "queryFn">
) {
  return useQuery({
    queryKey: queryKeys.dishes(params),
    queryFn: () => getDishes(params),
    staleTime: 60_000,
    ...options,
  });
}

export function useDish(id: string | undefined) {
  return useQuery({
    queryKey: id ? queryKeys.dish(id) : ["dish", "unknown"],
    queryFn: () => getDish(id as string),
    enabled: !!id,
    staleTime: 60_000,
  });
}

export function useCuisines(
  options?: Omit<UseQueryOptions<CuisineOption[], Error>, "queryKey" | "queryFn">
) {
  return useQuery({
    queryKey: queryKeys.cuisines,
    queryFn: getCuisines,
    staleTime: 5 * 60_000,
    ...options,
  });
}

export function useRecommendations(payload: RecommendationRequest | null) {
  return useQuery({
    queryKey: payload
      ? queryKeys.recommendations(payload)
      : (["recommendations"] as const),
    queryFn: () => getRecommendations(payload as RecommendationRequest),
    enabled: payload != null,
    staleTime: 5 * 60_000,
  });
}

/**
 * Pair-taste card data. Fetched lazily: `enabled` stays false until the screen
 * decides the pair surface should be offered, so the extra request never runs
 * during the core quiz or after the pair is dismissed. A failed pair request
 * leaves the rest of the page usable (the caller ignores the error state).
 *
 * `dietaryRestrictions` is the guest path for the hard dietary constraint;
 * signed-in callers pass the profile's value or omit it.
 */
export function usePairTaste(
  payload: RecommendationRequest | null,
  dietaryRestrictions?: readonly DietaryProperty[],
  options?: Omit<UseQueryOptions<PairTasteResponse, Error>, "queryKey" | "queryFn">
) {
  const request = pairTasteRequest(payload, dietaryRestrictions);
  return useQuery({
    queryKey: queryKeys.pairTaste(request ?? null),
    queryFn: () => getPairTaste(request ?? {}),
    enabled: request != null,
    staleTime: 5 * 60_000,
    retry: false,
    ...options,
  });
}

// ----- Places (restaurant catalogue) --------------------------------------

export function useRestaurants(
  params: RestaurantQuery = {},
  options?: Omit<
    UseQueryOptions<RestaurantSummary[], Error>,
    "queryKey" | "queryFn"
  >
) {
  return useQuery({
    queryKey: queryKeys.restaurants(params),
    queryFn: () => getRestaurants(params),
    staleTime: 5 * 60_000,
    ...options,
  });
}

/** Markaz/area options for the Location category rail (with counts). */
export function useRestaurantAreas() {
  return useQuery({
    queryKey: queryKeys.restaurantAreas,
    queryFn: () => getRestaurantAreas(),
    staleTime: 30 * 60_000,
  });
}

export function useRestaurant(id: string | undefined) {
  return useQuery({
    queryKey: id ? queryKeys.restaurant(id) : (["restaurant", "unknown"] as const),
    queryFn: () => getRestaurant(id as string),
    enabled: !!id,
    staleTime: 60_000,
  });
}

// ----- Authenticated endpoints -------------------------------------------

export function useMyPreferences() {
  const isSignedIn = useAuthStore(selectIsSignedIn);
  return useQuery({
    queryKey: queryKeys.preferences,
    queryFn: () => getMyPreferences(),
    enabled: isSignedIn,
  });
}

export function useUpdateMyPreferences() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<UserPreferences>) => updateMyPreferences(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.preferences });
    },
  });
}
