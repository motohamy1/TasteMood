import {
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Link } from "expo-router";

import { useAuthStore, selectIsSignedIn } from "@/lib/auth-store";
import {
  useSavedDishes,
  useUnsaveDish,
} from "@/lib/saved-dishes";
import { DishCard } from "@/components/dish-card";
import { DishSkeletonGrid } from "@/components/dish-skeleton";
import { EmptyState } from "@/components/empty-state";

export default function SavedScreen() {
  const insets = useSafeAreaInsets();
  const isSignedIn = useAuthStore(selectIsSignedIn);

  // Single saved-dishes module owns ids + list + optimistic removal — the
  // screen no longer keeps a removedIds copy that resurrects items on refetch.
  const { data: dishes, isLoading: loadingDishes } = useSavedDishes();
  const unsaveDishMutation = useUnsaveDish();

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
      ) : loadingDishes ? (
        <View className="flex-row flex-wrap gap-3 mt-2">
          <DishSkeletonGrid count={4} />
        </View>
      ) : (dishes ?? []).length === 0 ? (
        <EmptyState
          icon="♥"
          title="Nothing saved yet"
          description="Tap the heart on any dish to save it for later."
        />
      ) : (
        <View className="flex-row flex-wrap gap-3 mt-2">
          {(dishes ?? []).map((dish) => (
            <View key={dish.id} className="basis-[48%] flex-1 gap-1">
              <DishCard dish={dish} />
              <Pressable
                onPress={() => unsaveDishMutation.mutate(dish.id)}
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
