/**
 * Saved-dishes module (card 06): the single client-side owner of "is this
 * dish saved / what is saved". Screens previously computed savedness three
 * incompatible ways (scan of a ≤100-item list, a local removedIds copy that
 * resurrected on refetch, an N+1 fan-out in the saved screen). All of it
 * lives here now: ids query, saved-list query, optimistic save/unsave.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  getDish,
  getMyInteractionsPage,
  recordInteraction,
  unsaveDish,
} from "./api";
import { useAuthStore, selectIsSignedIn } from "./auth-store";
import type { Dish, DishSummary } from "@/types/dish";

export const savedQueryKeys = {
  ids: ["saved", "ids"] as const,
  list: ["saved", "list"] as const,
};

/** Fetch every SAVED interaction across pages — correctness no longer depends on "<100 saves". */
export async function fetchAllSavedIds(): Promise<string[]> {
  const pageOne = await getMyInteractionsPage({
    interactionType: "SAVED",
    page: 1,
    limit: 100,
  });
  const totalPages = Math.max(1, pageOne.totalPages);

  const rest =
    totalPages > 1
      ? await Promise.all(
          Array.from({ length: totalPages - 1 }, (_, i) =>
            getMyInteractionsPage({ interactionType: "SAVED", page: i + 2, limit: 100 })
          )
        )
      : [];

  const ids = [pageOne, ...rest]
    .flatMap((page) => page.items)
    .map((item) => item.dishId)
    .filter((id): id is string => !!id);

  return Array.from(new Set(ids)).sort();
}

export function useSavedDishIds() {
  const isSignedIn = useAuthStore(selectIsSignedIn);
  return useQuery({
    queryKey: savedQueryKeys.ids,
    queryFn: fetchAllSavedIds,
    enabled: isSignedIn,
    staleTime: 30_000,
  });
}

export function isDishSaved(savedIds: string[] | undefined, dishId: string | undefined) {
  return !!dishId && (savedIds ?? []).includes(dishId);
}

export function useSavedDishes() {
  const isSignedIn = useAuthStore(selectIsSignedIn);
  const idsQuery = useSavedDishIds();
  const ids = idsQuery.data ?? [];

  return useQuery({
    queryKey: [...savedQueryKeys.list, ids.join("|")],
    enabled: isSignedIn && idsQuery.isSuccess && ids.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const results = await Promise.allSettled(ids.map((id) => getDish(id)));
      return results
        .filter(
          (r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof getDish>>> =>
            r.status === "fulfilled"
        )
        .map((r) => r.value as DishSummary);
    },
  });
}

function invalidateSavedState(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: savedQueryKeys.ids });
  qc.invalidateQueries({ queryKey: savedQueryKeys.list });
}

export function useSaveDish() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dishId: string) =>
      recordInteraction({ dishId, interactionType: "SAVED" }),
    onMutate: async (dishId) => {
      await qc.cancelQueries({ queryKey: savedQueryKeys.ids });
      const previous = qc.getQueryData<string[]>(savedQueryKeys.ids);
      if (previous && !previous.includes(dishId)) {
        qc.setQueryData(savedQueryKeys.ids, [...previous, dishId].sort());
      }
      return { previous };
    },
    onError: (_err, _dishId, ctx) => {
      if (ctx?.previous) qc.setQueryData(savedQueryKeys.ids, ctx.previous);
    },
    onSettled: () => invalidateSavedState(qc),
  });
}

export function useUnsaveDish() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dishId: string) => unsaveDish(dishId),
    onMutate: async (dishId) => {
      await qc.cancelQueries({ queryKey: savedQueryKeys.ids });
      const previousIds = qc.getQueryData<string[]>(savedQueryKeys.ids);
      if (previousIds) {
        qc.setQueryData(
          savedQueryKeys.ids,
          previousIds.filter((id) => id !== dishId)
        );
      }
      // Optimistically drop the dish from any loaded saved list.
      qc.setQueriesData<DishSummary[]>(
        { queryKey: savedQueryKeys.list },
        (old) => old?.filter((dish) => dish.id !== dishId)
      );
      return { previous: previousIds };
    },
    onError: (_err, _dishId, ctx) => {
      if (ctx?.previous) qc.setQueryData(savedQueryKeys.ids, ctx.previous);
    },
    onSettled: () => invalidateSavedState(qc),
  });
}

/** VIEW_DISH analytics — intentionally separate from save/unsave mutations. */
export function useRecordViewDish() {
  return useMutation({
    mutationFn: (dishId: string) =>
      recordInteraction({ dishId, interactionType: "VIEW_DISH" }),
  });
}
