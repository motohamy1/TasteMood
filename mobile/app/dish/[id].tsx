import { Stack, useLocalSearchParams, Link } from "expo-router";
import { Image } from "expo-image";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useDish } from "@/lib/queries";
import { useAuthStore, selectIsSignedIn } from "@/lib/auth-store";
import {
  isDishSaved,
  useRecordViewDish,
  useSaveDish,
  useSavedDishIds,
  useUnsaveDish,
} from "@/lib/saved-dishes";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { formatPrice } from "@/lib/format";

const SPICE_LEVELS = ["Mild", "Medium", "Hot"] as const;

/**
 * Dish Detail: hero with overlay actions, info, taste/dietary/ingredient
 * chips, AI explanation — plus a "Customize" panel (portion stepper,
 * spice level, toppings, side options) modeled on the Figma product-5
 * screen. Customization is client-side only: it expresses the diner's
 * preference, nothing is sent to the backend.
 */
export default function DishDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { data: dish, isLoading, isError, error, refetch } = useDish(id);
  const isSignedIn = useAuthStore(selectIsSignedIn);

  // Savedness comes from the single saved-dishes module — no more scanning a
  // ≤100-item interaction list or keeping a second optimistic copy here.
  const { data: savedIds } = useSavedDishIds();
  const isSaved = isDishSaved(savedIds, dish?.id);
  const saveDish = useSaveDish();
  const unsaveDish = useUnsaveDish();
  const recordViewDish = useRecordViewDish();

  const [portion, setPortion] = useState(1);
  const [spice, setSpice] = useState<(typeof SPICE_LEVELS)[number]>("Medium");
  const [toppings, setToppings] = useState<string[]>([]);

  // Fire a VIEW_DISH interaction once the dish loads (signed-in users only —
  // the endpoint requires auth and a 401 here is pure noise for guests).
  useEffect(() => {
    if (dish?.id && isSignedIn) {
      recordViewDish.mutate(dish.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dish?.id, isSignedIn]);

  function toggleSave() {
    if (!dish) return;
    if (!isSignedIn) return; // heart button hidden in this case
    if (isSaved) {
      unsaveDish.mutate(dish.id);
    } else {
      saveDish.mutate(dish.id);
    }
  }

  function toggleTopping(ing: string) {
    setToppings((prev) =>
      prev.includes(ing) ? prev.filter((t) => t !== ing) : [...prev, ing]
    );
  }

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-[#FFF8F1]">
        <Stack.Screen options={{ title: "Loading…" }} />
        <ActivityIndicator size="large" color="#f97316" />
      </View>
    );
  }

  if (isError || !dish) {
    return (
      <View className="flex-1 items-center justify-center bg-[#FFF8F1] px-6">
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
      className="flex-1 bg-[#FFF8F1]"
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      showsVerticalScrollIndicator={false}
    >
      <Stack.Screen options={{ title: dish.name }} />

      {/* Hero with overlay actions */}
      <View>
        <Image
          source={{ uri: dish.imageUrl }}
          className="w-full h-80 bg-brand-100"
          contentFit="cover"
          transition={200}
        />
        <View
          className="absolute flex-row justify-between w-full px-5"
          style={{ top: insets.top + 8 }}
        >
          <Link href="/(tabs)" asChild>
            <Pressable className="w-10 h-10 rounded-full bg-white/95 items-center justify-center">
              <Text className="text-lg text-neutral-900">←</Text>
            </Pressable>
          </Link>
          {isSignedIn ? (
            <Pressable
              onPress={toggleSave}
              hitSlop={8}
              className="w-10 h-10 rounded-full bg-white/95 items-center justify-center"
            >
              <Text
                className={cn(
                  "text-xl",
                  isSaved ? "text-red-500" : "text-neutral-400"
                )}
              >
                {isSaved ? "♥" : "♡"}
              </Text>
            </Pressable>
          ) : (
            <Link href="/auth" asChild>
              <Pressable className="h-10 rounded-full bg-white/95 items-center justify-center px-4">
                <Text className="text-xs text-brand-600 font-semibold">
                  Sign in
                </Text>
              </Pressable>
            </Link>
          )}
        </View>
      </View>

      {/* Info card overlapping the hero */}
      <View className="px-5 -mt-6">
        <View
          className="bg-white rounded-3xl border border-neutral-200 p-4 gap-2"
          style={{ boxShadow: "0 4px 12px rgba(0, 0, 0, 0.06)" }}
        >
          <View className="flex-row items-start justify-between gap-2">
            <View className="flex-1">
              <Text className="text-xl font-bold text-neutral-900">
                {dish.name}
              </Text>
              <Text className="text-xs text-neutral-500 mt-0.5">
                {dish.restaurantName}
                {dish.branchName ? ` · ${dish.branchName}` : ""}
              </Text>
            </View>
            <Text className="text-xl font-bold text-brand-600">
              {formatPrice(dish.price, dish.currency)}
            </Text>
          </View>

          <View className="flex-row items-center gap-3">
            {typeof dish.rating === "number" ? (
              <View className="flex-row items-center gap-1">
                <Text className="text-sm text-amber-500">★</Text>
                <Text className="text-xs font-semibold text-neutral-700">
                  {dish.rating.toFixed(1)}
                  {dish.reviewCount && dish.reviewCount > 0
                    ? ` · ${dish.reviewCount} reviews`
                    : ""}
                </Text>
              </View>
            ) : null}
            <View className="bg-brand-50 px-2.5 py-1 rounded-full border border-brand-100">
              <Text className="text-[11px] text-brand-700 font-medium">
                {dish.cuisine}
              </Text>
            </View>
            {typeof dish.calories === "number" ? (
              <Text className="text-[11px] text-neutral-500">
                {dish.calories} kcal
              </Text>
            ) : null}
            {typeof dish.prepTimeMinutes === "number" ? (
              <Text className="text-[11px] text-neutral-500">
                · {dish.prepTimeMinutes} min
              </Text>
            ) : null}
          </View>

          {dish.description ? (
            <Text className="text-sm text-neutral-700 leading-5">
              {dish.description}
            </Text>
          ) : null}
        </View>
      </View>

      <View className="px-5 pt-4 gap-4">
        {/* Customize panel (from Figma product-5 screen) */}
        <View className="gap-3">
          <Text className="text-lg font-bold text-neutral-900">
            Customize to your taste
          </Text>

          {/* Portion stepper */}
          <View className="flex-row items-center justify-between bg-white rounded-2xl border border-neutral-200 px-4 py-3">
            <Text className="text-sm font-semibold text-neutral-800">
              Portion
            </Text>
            <View className="flex-row items-center gap-3">
              <Pressable
                onPress={() => setPortion((p) => Math.max(1, p - 1))}
                className="w-8 h-8 rounded-full bg-neutral-100 items-center justify-center active:opacity-70"
              >
                <Text className="text-base text-neutral-700">−</Text>
              </Pressable>
              <Text className="text-base font-bold text-neutral-900 min-w-[20px] text-center">
                {portion}
              </Text>
              <Pressable
                onPress={() => setPortion((p) => Math.min(9, p + 1))}
                className="w-8 h-8 rounded-full bg-brand-500 items-center justify-center active:opacity-85"
              >
                <Text className="text-base text-white">+</Text>
              </Pressable>
            </View>
          </View>

          {/* Spice level */}
          <View className="bg-white rounded-2xl border border-neutral-200 px-4 py-3 gap-2">
            <Text className="text-sm font-semibold text-neutral-800">
              Spice level
            </Text>
            <View className="flex-row gap-2">
              {SPICE_LEVELS.map((level) => {
                const active = spice === level;
                return (
                  <Pressable
                    key={level}
                    onPress={() => setSpice(level)}
                    className={cn(
                      "flex-1 py-2 rounded-full border items-center",
                      active
                        ? "bg-brand-500 border-brand-500"
                        : "bg-white border-neutral-200"
                    )}
                  >
                    <Text
                      className={cn(
                        "text-xs font-semibold",
                        active ? "text-white" : "text-neutral-600"
                      )}
                    >
                      {level === "Mild" ? "🌱 " : level === "Medium" ? "🌶 " : "🔥 "}
                      {level}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Toppings from ingredients */}
          {dish.ingredients.length > 0 ? (
            <View className="gap-2">
              <Text className="text-sm font-semibold text-neutral-800">
                Toppings
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {dish.ingredients.map((ing) => {
                  const selected = toppings.includes(ing);
                  return (
                    <Pressable
                      key={ing}
                      onPress={() => toggleTopping(ing)}
                      className={cn(
                        "px-3 py-1.5 rounded-full border",
                        selected
                          ? "bg-brand-500 border-brand-500"
                          : "bg-white border-neutral-200"
                      )}
                    >
                      <Text
                        className={cn(
                          "text-xs font-medium",
                          selected ? "text-white" : "text-neutral-700"
                        )}
                      >
                        {selected ? "✓ " : ""}
                        {ing}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

          {/* Side options from tags */}
          {dish.tags.length > 0 ? (
            <View className="gap-2">
              <Text className="text-sm font-semibold text-neutral-800">
                Side options
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8 }}
              >
                {dish.tags.map((tag) => (
                  <View
                    key={tag}
                    className="bg-white px-3.5 py-2 rounded-2xl border border-neutral-200"
                  >
                    <Text className="text-xs text-neutral-700 font-medium">
                      {tag}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            </View>
          ) : null}
        </View>

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

        {dish.aiExplanation ? (
          <View className="p-4 rounded-3xl bg-neutral-900">
            <Text className="text-xs font-semibold text-amber-400 uppercase mb-1">
              ✨ Why this dish?
            </Text>
            <Text className="text-sm text-neutral-100 leading-5">
              {dish.aiExplanation}
            </Text>
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}
