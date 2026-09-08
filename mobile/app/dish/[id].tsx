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

import {
  useDish,
  useMyInteractions,
  useRecordInteraction,
  useUnsaveDish,
} from "@/lib/queries";
import { useAuthStore, selectIsSignedIn } from "@/lib/auth-store";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { COLORS } from "@/lib/theme";
import { AmbientGlow } from "@/components/ambient-glow";

function formatPrice(value: number, currency: string) {
  return `${value.toFixed(0)} ${currency}`;
}

const SPICE_LEVELS = ["Mild", "Medium", "Hot"] as const;

function MetaLabel({ children }: { children: string }) {
  return (
    <Text className="w-[74px] text-[10px] font-semibold uppercase tracking-[0.08em] text-cream-mute leading-3">
      {children}
    </Text>
  );
}

/**
 * Dish Detail: hero card, price/rating row, taste/dietary/ingredient
 * chips, customize panel (portion stepper, spice level, toppings, side
 * options), AI explanation. Customization is client-side only: it
 * expresses the diner's preference, nothing is sent to the backend.
 */
export default function DishDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { data: dish, isLoading, isError, error, refetch } = useDish(id);
  const recordInteraction = useRecordInteraction();
  const unsaveDish = useUnsaveDish();
  const isSignedIn = useAuthStore(selectIsSignedIn);

  const [portion, setPortion] = useState(1);
  const [spice, setSpice] = useState<(typeof SPICE_LEVELS)[number]>("Medium");
  const [toppings, setToppings] = useState<string[]>([]);

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

  // Fire a VIEW_DISH interaction once the dish loads (signed-in users only —
  // the endpoint requires auth and a 401 here is pure noise for guests).
  useEffect(() => {
    if (dish?.id && isSignedIn) {
      recordInteraction.mutate({
        dishId: dish.id,
        interactionType: "VIEW_DISH",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dish?.id, isSignedIn]);

  function toggleSave() {
    if (!dish) return;
    if (!isSignedIn) return; // save button hidden in this case
    if (isSaved) {
      unsaveDish.mutate(dish.id);
    } else {
      recordInteraction.mutate({
        dishId: dish.id,
        interactionType: "SAVED",
      });
    }
  }

  function toggleTopping(ing: string) {
    setToppings((prev) =>
      prev.includes(ing) ? prev.filter((t) => t !== ing) : [...prev, ing]
    );
  }

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-ink-950">
        <Stack.Screen options={{ title: "Loading…" }} />
        <ActivityIndicator size="large" color={COLORS.amber} />
      </View>
    );
  }

  if (isError || !dish) {
    return (
      <View className="flex-1 items-center justify-center bg-ink-950 px-6">
        <Stack.Screen options={{ title: "Not found" }} />
        <Text className="text-5xl mb-2">⚠️</Text>
        <Text className="text-lg font-semibold text-cream text-center">
          We couldn&apos;t load this dish
        </Text>
        <Text className="text-sm text-cream-mute text-center mt-1">
          {(error as Error)?.message ?? "Please try again later."}
        </Text>
        <Pressable
          onPress={() => refetch()}
          className="mt-4 px-4 py-2 rounded-full bg-brand-500"
        >
          <Text className="text-night text-sm font-bold">Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-ink-950 overflow-hidden">
      <AmbientGlow top={80} />
      <ScrollView
        className="flex-1 bg-transparent"
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
        showsVerticalScrollIndicator={false}
      >
        <Stack.Screen options={{ title: "Dish Detail" }} />

        {/* Top row */}
        <View
          className="flex-row items-center gap-2 px-4"
          style={{ paddingTop: insets.top + 8 }}
        >
          <Link href="/(tabs)" asChild>
            <Pressable className="w-9 h-9 rounded-full bg-ink-900 border border-ink-700 items-center justify-center">
              <Text className="text-[14px] text-cream">←</Text>
            </Pressable>
          </Link>
          <Text className="flex-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-cream-mute">
            Dish • {dish.cuisine}
          </Text>
          {isSignedIn ? (
            <Pressable
              onPress={toggleSave}
              hitSlop={8}
              className="w-8 h-8 rounded-full bg-brand-500 items-center justify-center"
            >
              <Text className="text-[14px] text-night">
                {isSaved ? "♥" : "♡"}
              </Text>
            </Pressable>
          ) : (
            <Link href="/auth" asChild>
              <Pressable hitSlop={8} className="px-2 py-1">
                <Text className="text-[11px] text-brand-500 font-bold">
                  Sign in
                </Text>
              </Pressable>
            </Link>
          )}
        </View>

        {/* Hero */}
        <View className="px-4 mt-3">
          <View className="rounded-2xl overflow-hidden bg-wine-deep border border-ink-700">
            {dish.imageUrl ? (
              <Image
                source={{ uri: dish.imageUrl }}
                className="w-full h-56"
                contentFit="cover"
                transition={200}
              />
            ) : (
              <View className="w-full h-56 items-center justify-center">
                <Text className="text-6xl">🍽</Text>
              </View>
            )}
          </View>
        </View>

        <View className="px-4 pt-4 gap-4">
          <View className="gap-1">
            <Text className="text-[22px] font-bold text-brand-50 leading-[26px]">
              {dish.name}
            </Text>
            <Text className="text-xs text-cream-mute">
              {dish.restaurantName}
              {dish.branchName ? ` · ${dish.branchName}` : ""}
              {dish.cuisine ? ` · ${dish.cuisine}` : ""}
            </Text>
            <View className="flex-row items-center gap-2 mt-1">
              <Text className="text-xl font-extrabold text-brand-500">
                {formatPrice(dish.price, dish.currency)}
              </Text>
              {typeof dish.rating === "number" ? (
                <Text className="text-xs text-brand-50">
                  ★ {dish.rating.toFixed(1)}
                  {dish.reviewCount && dish.reviewCount > 0
                    ? ` · ${dish.reviewCount} reviews`
                    : ""}
                </Text>
              ) : null}
            </View>
          </View>

          <View className="gap-2">
            {dish.description ? (
              <Text className="text-[13px] text-cream-dim leading-5">
                {dish.description}
              </Text>
            ) : null}

            {dish.tasteAttributes.length > 0 && (
              <View className="flex-row items-center flex-wrap gap-1.5">
                <MetaLabel>Taste</MetaLabel>
                {dish.tasteAttributes.map((tag) => (
                  <View key={tag} className="bg-wine px-2.5 py-1 rounded-full">
                    <Text className="text-[11px] font-semibold text-cream uppercase">
                      {tag.toLowerCase().replace(/_/g, " ")}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {dish.dietaryProperties.length > 0 && (
              <View className="flex-row items-center flex-wrap gap-1.5">
                <MetaLabel>Dietary</MetaLabel>
                {dish.dietaryProperties.map((tag) => (
                  <View
                    key={tag}
                    className="bg-emerald-900 px-2.5 py-1 rounded-full"
                  >
                    <Text className="text-[11px] font-semibold text-emerald-50 uppercase">
                      {tag.toLowerCase().replace(/_/g, " ")}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {dish.ingredients.length > 0 && (
              <View className="flex-row items-center flex-wrap gap-1.5">
                <MetaLabel>Ingredients</MetaLabel>
                {dish.ingredients.map((ing) => (
                  <View
                    key={ing}
                    className="bg-stone-800 px-2.5 py-1 rounded-full"
                  >
                    <Text className="text-[11px] text-cream">{ing}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          {dish.aiExplanation ? (
            <View className="bg-brand-50 border border-brand-100 rounded-[14px] p-2.5 gap-0.5">
              <Text className="text-[10px] font-bold uppercase tracking-[0.08em] text-brand-600">
                Why this dish?
              </Text>
              <Text className="text-xs text-brand-900 leading-4">
                {dish.aiExplanation}
              </Text>
            </View>
          ) : null}

          <View className="flex-row gap-2">
            {typeof dish.calories === "number" ? (
              <View className="flex-1 bg-ink-900 border border-ink-700 p-2 rounded-xl">
                <Text className="text-[9px] uppercase text-cream-mute leading-3">
                  Calories
                </Text>
                <Text className="text-[13px] font-bold text-cream mt-0.5">
                  {dish.calories} kcal
                </Text>
              </View>
            ) : null}
            {typeof dish.prepTimeMinutes === "number" ? (
              <View className="flex-1 bg-ink-900 border border-ink-700 p-2 rounded-xl">
                <Text className="text-[9px] uppercase text-cream-mute leading-3">
                  Prep time
                </Text>
                <Text className="text-[13px] font-bold text-cream mt-0.5">
                  {dish.prepTimeMinutes} min
                </Text>
              </View>
            ) : null}
            {isSignedIn ? (
              <Pressable
                onPress={toggleSave}
                className={cn(
                  "flex-1 rounded-xl items-center justify-center p-2",
                  isSaved ? "bg-ink-700" : "bg-brand-500"
                )}
              >
                <Text
                  className={cn(
                    "text-xs font-extrabold",
                    isSaved ? "text-cream" : "text-night"
                  )}
                >
                  {isSaved ? "Saved ♥" : "Save ♥"}
                </Text>
              </Pressable>
            ) : null}
          </View>

          {/* Customize panel */}
          <View className="gap-2.5">
            <Text className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-500">
              Customize to your taste
            </Text>

            <View className="flex-row items-center justify-between bg-ink-900 border border-ink-700 rounded-xl px-3.5 py-2.5">
              <Text className="text-[13px] font-semibold text-cream">
                Portion
              </Text>
              <View className="flex-row items-center gap-3">
                <Pressable
                  onPress={() => setPortion((p) => Math.max(1, p - 1))}
                  className="w-7 h-7 rounded-full bg-ink-700 items-center justify-center active:opacity-70"
                >
                  <Text className="text-sm text-cream">−</Text>
                </Pressable>
                <Text className="text-sm font-bold text-cream min-w-[20px] text-center">
                  {portion}
                </Text>
                <Pressable
                  onPress={() => setPortion((p) => Math.min(9, p + 1))}
                  className="w-7 h-7 rounded-full bg-brand-500 items-center justify-center active:opacity-85"
                >
                  <Text className="text-sm text-night font-bold">+</Text>
                </Pressable>
              </View>
            </View>

            <View className="bg-ink-900 border border-ink-700 rounded-xl px-3.5 py-2.5 gap-2">
              <Text className="text-[13px] font-semibold text-cream">
                Spice level
              </Text>
              <View className="flex-row gap-1.5">
                {SPICE_LEVELS.map((level) => {
                  const active = spice === level;
                  return (
                    <Pressable
                      key={level}
                      onPress={() => setSpice(level)}
                      className={cn(
                        "flex-1 py-1.5 rounded-full items-center border",
                        active
                          ? "bg-brand-500 border-brand-500"
                          : "border-ink-700"
                      )}
                    >
                      <Text
                        className={cn(
                          "text-[11px]",
                          active ? "font-semibold text-night" : "text-cream-mute"
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

            {dish.ingredients.length > 0 ? (
              <View className="gap-1.5">
                <Text className="text-[13px] font-semibold text-cream">
                  Toppings
                </Text>
                <View className="flex-row flex-wrap gap-1.5">
                  {dish.ingredients.map((ing) => {
                    const selected = toppings.includes(ing);
                    return (
                      <Pressable
                        key={ing}
                        onPress={() => toggleTopping(ing)}
                        className={cn(
                          "px-2.5 py-1 rounded-full border",
                          selected
                            ? "bg-wine border-wine"
                            : "border-ink-700"
                        )}
                      >
                        <Text
                          className={cn(
                            "text-[11px]",
                            selected ? "font-semibold text-cream" : "text-cream-mute"
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

            {dish.tags.length > 0 ? (
              <View className="gap-1.5">
                <Text className="text-[13px] font-semibold text-cream">
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
                      className="bg-ink-900 border border-ink-700 px-3 py-1.5 rounded-xl"
                    >
                      <Text className="text-[11px] text-cream font-medium">
                        {tag}
                      </Text>
                    </View>
                  ))}
                </ScrollView>
              </View>
            ) : null}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
