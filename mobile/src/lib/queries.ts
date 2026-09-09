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
  getRecommendations,
  updateMyPreferences,
  type CuisineOption,
} from "./api";
import type { DishSummary } from "@/types/dish";
import type { RecommendationRequest } from "@/types/recommendation";
import type { UserPreferences } from "@/types/user";
import { useAuthStore, selectIsSignedIn } from "@/lib/auth-store";

export const queryKeys = {
  dishes: (params: Parameters<typeof getDishes>[0] = {}) =>
    ["dishes", params] as const,
  dish: (id: string) => ["dish", id] as const,
  cuisines: ["cuisines"] as const,
  recommendations: (req: RecommendationRequest) =>
    ["recommendations", req] as const,
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
