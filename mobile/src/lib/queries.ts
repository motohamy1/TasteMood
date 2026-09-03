/**
 * React Query hooks for the TasteMood backend.
 */

import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query";

import {
  getDish,
  getDishes,
  getMyInteractions,
  getMyPreferences,
  getRecommendations,
  recordInteraction,
  searchDishes,
  unsaveDish,
  updateMyPreferences,
} from "./api";
import type { Dish, DishSummary } from "@/types/dish";
import type { RecommendationRequest } from "@/types/recommendation";
import type { InteractionType } from "@/types/interaction";
import type { UserPreferences } from "@/types/user";

export const queryKeys = {
  dishes: (params: Parameters<typeof getDishes>[0] = {}) =>
    ["dishes", params] as const,
  dish: (id: string) => ["dish", id] as const,
  search: (q: string) => ["search", "dishes", q] as const,
  recommendations: (req: RecommendationRequest) =>
    ["recommendations", req] as const,
  interactions: (params?: { interactionType?: InteractionType }) =>
    ["interactions", "me", params ?? {}] as const,
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
    queryFn: async () => {
      const res = await getDishes(params);
      return res;
    },
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

export function useDishSearch(query: string) {
  return useQuery({
    queryKey: queryKeys.search(query),
    queryFn: async () => {
      if (!query.trim()) return [];
      const res = await searchDishes(query);
      return res;
    },
    enabled: query.trim().length > 0,
    staleTime: 30_000,
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

export function useRecordInteraction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: recordInteraction,
    onSuccess: (_data, vars) => {
      if (vars.dishId) {
        qc.invalidateQueries({ queryKey: queryKeys.dish(vars.dishId) });
      }
      qc.invalidateQueries({ queryKey: ["interactions", "me"] });
    },
  });
}

export function useUnsaveDish() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dishId: string) => unsaveDish(dishId),
    onSuccess: (_data, dishId) => {
      qc.invalidateQueries({ queryKey: queryKeys.dish(dishId) });
      qc.invalidateQueries({ queryKey: ["interactions", "me"] });
      qc.invalidateQueries({ queryKey: ["saved-dishes"] });
    },
  });
}

// ----- Authenticated endpoints -------------------------------------------

export function useMyInteractions(params: {
  interactionType?: InteractionType;
  page?: number;
  limit?: number;
} = {}) {
  return useQuery({
    queryKey: queryKeys.interactions(params),
    queryFn: () => getMyInteractions(params),
    staleTime: 30_000,
  });
}

export function useMyPreferences() {
  return useQuery({
    queryKey: queryKeys.preferences,
    queryFn: () => getMyPreferences(),
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
