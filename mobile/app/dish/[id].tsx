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
import { COLORS } from "@/lib/theme";
import { AmbientGlow } from "@/components/ambient-glow";
import { displayDescription, displayName, useLang, useT } from "@/i18n";
import { formatPrice } from "@/lib/format";

const SPICE_LEVELS = [
  { value: "Mild", labelKey: "dish.mild", emoji: "🌱" },
  { value: "Medium", labelKey: "dish.medium", emoji: "🌶" },
  { value: "Hot", labelKey: "dish.hot", emoji: "🔥" },
] as const;

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
  const t = useT();
  const lang = useLang();
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
  const [spice, setSpice] = useState<(typeof SPICE_LEVELS)[number]["value"]>("Medium");
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
    if (!isSignedIn) return; // save button hidden in this case
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
      <View className="flex-1 items-center justify-center bg-ink-950">
        <Stack.Screen options={{ title: t("dish.loading") }} />
        <ActivityIndicator size="large" color={COLORS.amber} />
      </View>
    );
  }

  if (isError || !dish) {
    return (
      <View className="flex-1 items-center justify-center bg-ink-950 px-6">
        <Stack.Screen options={{ title: t("dish.notFound") }} />
        <Text className="text-5xl mb-2">⚠️</Text>
        <Text className="text-lg font-semibold text-cream text-center">
          {t("dish.notFoundTitle")}
        </Text>
        <Text className="text-sm text-cream-mute text-center mt-1">
          {(error as Error)?.message ?? t("dish.notFoundDesc")}
        </Text>
        <Pressable
          onPress={() => refetch()}
          className="mt-4 px-4 py-2 rounded-full bg-brand-cta"
        >
          <Text className="text-night text-sm font-bold">{t("common.retry")}</Text>
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
        <Stack.Screen options={{ title: t("dish.detail") }} />

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
            {t("dish.dish")} • {dish.cuisine}
          </Text>
          {isSignedIn ? (
            <Pressable
              onPress={toggleSave}
              hitSlop={8}
              className="w-8 h-8 rounded-full bg-brand-cta items-center justify-center"
            >
              <Text className="text-[14px] text-night">
                {isSaved ? "♥" : "♡"}
              </Text>
            </Pressable>
          ) : (
            <Link href="/auth" asChild>
              <Pressable hitSlop={8} className="px-2 py-1">
                <Text className="text-[11px] text-accent font-bold">
                  {t("common.signIn")}
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
              {displayName(lang, dish)}
            </Text>
            <Text className="text-xs text-cream-mute">
              {displayName(lang, { name: dish.restaurantName, nameEn: dish.restaurantNameEn })}
              {dish.branchName ? ` · ${dish.branchName}` : ""}
              {dish.cuisine ? ` · ${dish.cuisine}` : ""}
            </Text>
            <View className="flex-row items-center gap-2 mt-1">
              <Text className="text-xl font-extrabold text-accent">
                {formatPrice(dish.price, dish.currency)}
              </Text>
              {dish.verificationStatus === "UNVERIFIED" ? (
                <View className="px-1.5 py-px rounded-full border border-ink-700">
                  <Text className="text-[8px] font-semibold text-cream-mute">
                    {t("dish.estimated")}
                  </Text>
                </View>
              ) : null}
              {typeof dish.rating === "number" ? (
                <Text className="text-xs text-brand-50">
                  ★ {dish.rating.toFixed(1)}
                  {dish.reviewCount && dish.reviewCount > 0
                    ? ` · ${dish.reviewCount} ${t("dish.reviews")}`
                    : ""}
                </Text>
              ) : null}
            </View>
          </View>

          <View className="gap-2">
            {displayDescription(lang, dish) ? (
              <Text className="text-[13px] text-cream-dim leading-5">
                {displayDescription(lang, dish)}
              </Text>
            ) : null}

            {dish.tasteAttributes.length > 0 && (
              <View className="flex-row items-center flex-wrap gap-1.5">
                <MetaLabel>{t("dish.taste")}</MetaLabel>
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
                <MetaLabel>{t("dish.dietary")}</MetaLabel>
                {dish.dietaryProperties.map((tag) => (
                  <View
                    key={tag}
                    className="bg-success-bg px-2.5 py-1 rounded-full"
                  >
                    <Text className="text-[11px] font-semibold text-cream uppercase">
                      {tag.toLowerCase().replace(/_/g, " ")}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {dish.ingredients.length > 0 && (
              <View className="flex-row items-center flex-wrap gap-1.5">
                <MetaLabel>{t("dish.ingredients")}</MetaLabel>
                {dish.ingredients.map((ing) => (
                  <View
                    key={ing}
                    className="bg-neutral-chip px-2.5 py-1 rounded-full"
                  >
                    <Text className="text-[11px] text-cream">{ing}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          {dish.aiExplanation ? (
            <View className="bg-brand-50 border border-brand-100 rounded-[14px] p-2.5 gap-0.5">
              <Text className="text-[10px] font-bold uppercase tracking-[0.08em] text-oncard-price">
                {t("dish.whyThisDish")}
              </Text>
              <Text className="text-xs text-oncard leading-4">
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
                  isSaved ? "bg-ink-700" : "bg-brand-cta"
                )}
              >
                <Text
                  className={cn(
                    "text-xs font-extrabold",
                    isSaved ? "text-cream" : "text-night"
                  )}
                >
                  {isSaved ? t("common.saved") : t("common.save")}
                </Text>
              </Pressable>
            ) : null}
          </View>

          {/* Customize panel */}
          <View className="gap-2.5">
            <Text className="text-xs font-semibold uppercase tracking-[0.12em] text-accent">
              {t("dish.customize")}
            </Text>

            <View className="flex-row items-center justify-between bg-ink-900 border border-ink-700 rounded-xl px-3.5 py-2.5">
              <Text className="text-[13px] font-semibold text-cream">
                {t("dish.portion")}
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
                  className="w-7 h-7 rounded-full bg-brand-cta items-center justify-center active:opacity-85"
                >
                  <Text className="text-sm text-night font-bold">+</Text>
                </Pressable>
              </View>
            </View>

            <View className="bg-ink-900 border border-ink-700 rounded-xl px-3.5 py-2.5 gap-2">
              <Text className="text-[13px] font-semibold text-cream">
                {t("dish.spiceLevel")}
              </Text>
              <View className="flex-row gap-1.5">
                {SPICE_LEVELS.map((level) => {
                  const active = spice === level.value;
                  return (
                    <Pressable
                      key={level.value}
                      onPress={() => setSpice(level.value)}
                      className={cn(
                        "flex-1 py-1.5 rounded-full items-center border",
                        active
                          ? "bg-brand-cta border-brand-cta"
                          : "border-ink-700"
                      )}
                    >
                      <Text
                        className={cn(
                          "text-[11px]",
                          active ? "font-semibold text-night" : "text-cream-mute"
                        )}
                      >
                        {level.emoji} {t(level.labelKey)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {dish.ingredients.length > 0 ? (
              <View className="gap-1.5">
                <Text className="text-[13px] font-semibold text-cream">
                  {t("dish.toppings")}
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
                  {t("dish.sideOptions")}
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
