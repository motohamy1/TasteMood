import { Stack, useLocalSearchParams, Link } from "expo-router";
import { Image } from "expo-image";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  useDish,
  useMyInteractions,
  useRecordInteraction,
  useUnsaveDish,
} from "@/lib/queries";
import { useAuthStore, selectIsSignedIn } from "@/lib/auth-store";
import { useEffect, useMemo } from "react";

function formatPrice(value: number, currency: string) {
  return `${value.toFixed(0)} ${currency}`;
}

export default function DishDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { data: dish, isLoading, isError, error, refetch } = useDish(id);
  const recordInteraction = useRecordInteraction();
  const unsaveDish = useUnsaveDish();
  const isSignedIn = useAuthStore(selectIsSignedIn);

  // Fetch the user's saved interactions to know if THIS dish is saved.
  const { data: savedInteractions } = useMyInteractions({
    interactionType: "SAVED",
    limit: 100,
  });
  const isSaved = useMemo(
    () =>
      !!dish?.id &&
      (savedInteractions ?? []).some((i) => i.dishId === dish.id),
    [savedInteractions, dish?.id]
  );

  // Fire a VIEW_DISH interaction once the dish loads.
  useEffect(() => {
    if (dish?.id) {
      recordInteraction.mutate({
        dishId: dish.id,
        interactionType: "VIEW_DISH",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dish?.id]);

  function toggleSave() {
    if (!dish) return;
    if (!isSignedIn) return; // heart button hidden in this case
    if (isSaved) {
      unsaveDish.mutate(dish.id);
    } else {
      recordInteraction.mutate({
        dishId: dish.id,
        interactionType: "SAVED",
      });
    }
  }

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <Stack.Screen options={{ title: "Loading…" }} />
        <ActivityIndicator size="large" color="#f97316" />
      </View>
    );
  }

  if (isError || !dish) {
    return (
      <View className="flex-1 items-center justify-center bg-white px-6">
        <Stack.Screen options={{ title: "Not found" }} />
        <Text className="text-5xl mb-2">⚠️</Text>
        <Text className="text-lg font-semibold text-neutral-900 text-center">
          We couldn&apos;t load this dish
        </Text>
        <Text className="text-sm text-neutral-500 text-center mt-1">
          {(error as Error)?.message ?? "Please try again later."}
        </Text>
        <Pressable
          onPress={() => refetch()}
          className="mt-4 px-4 py-2 rounded-full bg-brand-500"
        >
          <Text className="text-white text-sm font-semibold">Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-white"
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
    >
      <Stack.Screen
        options={{
          title: dish.name,
          headerRight: () =>
            isSignedIn ? (
              <Pressable
                onPress={toggleSave}
                hitSlop={8}
                className="px-2 py-1"
              >
                <Text
                  className={isSaved ? "text-red-500 text-xl" : "text-neutral-400 text-xl"}
                >
                  {isSaved ? "♥" : "♡"}
                </Text>
              </Pressable>
            ) : (
              <Link href="/auth" asChild>
                <Pressable hitSlop={8} className="px-2 py-1">
                  <Text className="text-sm text-brand-600 font-semibold">
                    Sign in
                  </Text>
                </Pressable>
              </Link>
            ),
        }}
      />

      <Image
        source={{ uri: dish.imageUrl }}
        className="w-full h-72 bg-neutral-100"
        contentFit="cover"
        transition={200}
      />

      <View className="px-5 pt-4 gap-3">
        <View>
          <Text className="text-2xl font-bold text-neutral-900">
            {dish.name}
          </Text>
          <Text className="text-sm text-neutral-500 mt-1">
            {dish.restaurantName}
            {dish.branchName ? ` · ${dish.branchName}` : ""}
          </Text>
        </View>

        <View className="flex-row items-center justify-between">
          <Text className="text-2xl font-bold text-brand-600">
            {formatPrice(dish.price, dish.currency)}
          </Text>
          {typeof dish.rating === "number" ? (
            <View className="flex-row items-center gap-1">
              <Text>★</Text>
              <Text className="text-sm text-neutral-700">
                {dish.rating.toFixed(1)}
                {dish.reviewCount && dish.reviewCount > 0 ? ` · ${dish.reviewCount} reviews` : ""}
              </Text>
            </View>
          ) : null}
        </View>

        {dish.description ? (
          <Text className="text-sm text-neutral-700 leading-5">
            {dish.description}
          </Text>
        ) : null}

        {dish.tasteAttributes.length > 0 && (
          <View>
            <Text className="text-xs font-semibold text-neutral-500 uppercase mb-2">
              Taste
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {dish.tasteAttributes.map((tag) => (
                <View
                  key={tag}
                  className="bg-brand-50 px-3 py-1 rounded-full border border-brand-100"
                >
                  <Text className="text-xs text-brand-700 font-medium">
                    {tag.toLowerCase().replace(/_/g, " ")}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {dish.dietaryProperties.length > 0 && (
          <View>
            <Text className="text-xs font-semibold text-neutral-500 uppercase mb-2">
              Dietary
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {dish.dietaryProperties.map((tag) => (
                <View
                  key={tag}
                  className="bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100"
                >
                  <Text className="text-xs text-emerald-700 font-medium">
                    {tag.toLowerCase().replace(/_/g, " ")}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {dish.ingredients.length > 0 && (
          <View>
            <Text className="text-xs font-semibold text-neutral-500 uppercase mb-2">
              Ingredients
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {dish.ingredients.map((ing) => (
                <View
                  key={ing}
                  className="bg-neutral-100 px-3 py-1 rounded-full"
                >
                  <Text className="text-xs text-neutral-700">{ing}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {dish.aiExplanation ? (
          <View className="mt-2 p-3 rounded-2xl bg-brand-50 border border-brand-100">
            <Text className="text-xs font-semibold text-brand-700 uppercase mb-1">
              Why this dish?
            </Text>
            <Text className="text-sm text-neutral-800 leading-5">
              {dish.aiExplanation}
            </Text>
          </View>
        ) : null}

        {typeof dish.calories === "number" ||
        typeof dish.prepTimeMinutes === "number" ? (
          <View className="flex-row gap-4 mt-2">
            {typeof dish.calories === "number" ? (
              <View className="flex-1 bg-neutral-50 p-3 rounded-xl border border-neutral-100">
                <Text className="text-[10px] text-neutral-500 uppercase">
                  Calories
                </Text>
                <Text className="text-base font-semibold text-neutral-900">
                  {dish.calories} kcal
                </Text>
              </View>
            ) : null}
            {typeof dish.prepTimeMinutes === "number" ? (
              <View className="flex-1 bg-neutral-50 p-3 rounded-xl border border-neutral-100">
                <Text className="text-[10px] text-neutral-500 uppercase">
                  Prep time
                </Text>
                <Text className="text-base font-semibold text-neutral-900">
                  {dish.prepTimeMinutes} min
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}
