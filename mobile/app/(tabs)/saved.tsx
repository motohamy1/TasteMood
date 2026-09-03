import { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "expo-router";

import { useAuthStore, selectIsSignedIn } from "@/lib/auth-store";
import { getDish } from "@/lib/api";
import { useMyInteractions, useRecordInteraction } from "@/lib/queries";
import { DishCard } from "@/components/dish-card";
import { DishSkeletonGrid } from "@/components/dish-skeleton";
import { EmptyState } from "@/components/empty-state";
import type { DishSummary } from "@/types/dish";

/** Fetch a batch of dishes by id (skips missing). */
function useSavedDishes(dishIds: string[]) {
  return useQuery({
    queryKey: ["saved-dishes", dishIds.slice().sort().join("|")],
    enabled: dishIds.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const results = await Promise.allSettled(dishIds.map((id) => getDish(id)));
      return results
        .filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof getDish>>> => r.status === "fulfilled")
        .map((r) => r.value);
    },
  });
}

export default function SavedScreen() {
  const insets = useSafeAreaInsets();
  const isSignedIn = useAuthStore(selectIsSignedIn);
  const qc = useQueryClient();

  const { data: interactions, isLoading: loadingInteractions } =
    useMyInteractions({ interactionType: "SAVED", limit: 50 });

  const dishIds = useMemo(
    () =>
      (interactions ?? [])
        .map((i) => i.dishId)
        .filter((id): id is string => !!id),
    [interactions]
  );

  const { data: dishes, isLoading: loadingDishes } = useSavedDishes(dishIds);
  const recordInteraction = useRecordInteraction();

  // Local optimistic list of removed ids so the UI updates instantly.
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  useEffect(() => setRemovedIds([]), [interactions?.data?.length]);

  function unsave(dishId: string) {
    setRemovedIds((prev) => [...prev, dishId]);
    recordInteraction.mutate(
      { dishId, interactionType: "SAVED" },
      {
        onSettled: () => {
          qc.invalidateQueries({ queryKey: ["interactions", "me"] });
        },
      }
    );
  }

  const visibleDishes = (dishes ?? []).filter((d) => !removedIds.includes(d.id));

  return (
    <ScrollView
      className="flex-1 bg-brand-50"
      contentContainerClassName="px-4 gap-3"
      contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 32 }}
      contentInsetAdjustmentBehavior="automatic"
    >
      <Text className="text-2xl font-bold text-neutral-900">Saved</Text>
      <Text className="text-sm text-neutral-600">
        Dishes you&apos;ve bookmarked for later.
      </Text>

      {!isSignedIn ? (
        <View className="bg-white rounded-2xl border border-neutral-200 p-4 mt-2 gap-2">
          <Text className="text-sm font-semibold text-neutral-900">
            Sign in to save dishes
          </Text>
          <Text className="text-xs text-neutral-500">
            Your saved list is tied to your TasteMood account.
          </Text>
          <Link href="/auth" asChild>
            <Pressable className="bg-brand-500 rounded-full px-4 py-2 self-start mt-1">
              <Text className="text-white text-sm font-semibold">Sign in</Text>
            </Pressable>
          </Link>
        </View>
      ) : loadingInteractions || loadingDishes ? (
        <View className="flex-row flex-wrap gap-3 mt-2">
          <DishSkeletonGrid count={4} />
        </View>
      ) : visibleDishes.length === 0 ? (
        <EmptyState
          icon="♥"
          title="Nothing saved yet"
          description="Tap the heart on any dish to save it for later."
        />
      ) : (
        <View className="flex-row flex-wrap gap-3 mt-2">
          {visibleDishes.map((dish) => (
            <View key={dish.id} className="basis-[48%] flex-1 gap-1">
              <DishCard dish={dish as DishSummary} />
              <Pressable
                onPress={() => unsave(dish.id)}
                className="bg-white border border-neutral-200 rounded-full py-1 items-center"
              >
                <Text className="text-xs text-neutral-600">Remove</Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}
