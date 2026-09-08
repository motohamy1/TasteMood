import { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { Link } from "expo-router";

import { useAuthStore, selectIsSignedIn } from "@/lib/auth-store";
import { getDish } from "@/lib/api";
import {
  useMyInteractions,
  useUnsaveDish,
} from "@/lib/queries";
import { DishCard } from "@/components/dish-card";
import { ProfileButton } from "@/components/profile-button";
import { DishSkeletonGrid } from "@/components/dish-skeleton";
import { EmptyState } from "@/components/empty-state";
import { AmbientGlow } from "@/components/ambient-glow";
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

export default function FavouritesScreen() {
  const insets = useSafeAreaInsets();
  const isSignedIn = useAuthStore(selectIsSignedIn);

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
  const unsaveDishMutation = useUnsaveDish();

  // Local optimistic list of removed ids so the UI updates instantly.
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  useEffect(() => setRemovedIds([]), [interactions?.length]);

  function unsave(dishId: string) {
    setRemovedIds((prev) => [...prev, dishId]);
    unsaveDishMutation.mutate(dishId);
  }

  const visibleDishes = (dishes ?? []).filter((d) => !removedIds.includes(d.id));

  return (
    <View className="flex-1 bg-ink-950 overflow-hidden">
      <AmbientGlow top={80} />
      <ScrollView
        className="flex-1 bg-transparent"
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 110 }}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
      >
        {/* gap on an inner View — ScrollView contentContainer ignores gap on Android */}
        <View className="px-4 gap-3">
        <View className="flex-row items-start gap-3">
          <View className="flex-1 gap-1">
            <Text className="text-[10px] font-semibold uppercase tracking-[0.12em] text-brand-500">
              Saved • GET /favourites
            </Text>
            <Text className="text-2xl font-bold text-brand-50">
              Favourites
            </Text>
            <Text className="text-[13px] text-cream-mute">
              Heart it once — reorder in a tap.
            </Text>
          </View>
          <ProfileButton />
        </View>

        {!isSignedIn ? (
          <View className="bg-ink-900 border border-wine rounded-2xl p-4 gap-2">
            <Text className="text-sm font-semibold text-cream">
              Sign in to save dishes
            </Text>
            <Text className="text-xs text-cream-mute">
              Your saved list is tied to your TasteMood account.
            </Text>
            <Link href="/auth" asChild>
              <Pressable className="bg-brand-500 rounded-full px-4 py-2 self-start mt-1 active:opacity-85">
                <Text className="text-night text-sm font-bold">Sign in</Text>
              </Pressable>
            </Link>
          </View>
        ) : loadingInteractions || loadingDishes ? (
          <View className="flex-row flex-wrap gap-2.5 mt-2">
            <DishSkeletonGrid count={4} />
          </View>
        ) : visibleDishes.length === 0 ? (
          <EmptyState
            icon="♥"
            title="Nothing saved yet"
            description="Tap the heart on any dish to save it for later."
          />
        ) : (
          <View className="flex-row flex-wrap gap-2.5 mt-2">
            {visibleDishes.map((dish) => (
              <View key={dish.id} className="basis-[48%] flex-1 gap-1.5">
                <DishCard dish={dish as DishSummary} />
                <Pressable
                  onPress={() => unsave(dish.id)}
                  className="border border-ink-700 rounded-full py-1 items-center active:opacity-70"
                >
                  <Text className="text-[11px] text-cream-mute">Remove</Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}
        </View>
      </ScrollView>
    </View>
  );
}
