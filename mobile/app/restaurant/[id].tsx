import { Stack, useLocalSearchParams, router } from "expo-router";
import { Image } from "expo-image";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AmbientGlow } from "@/components/ambient-glow";
import { DishCard } from "@/components/dish-card";
import { useRestaurant } from "@/lib/queries";
import { displayName, pickLabel, useLang, useT } from "@/i18n";
import { cn } from "@/lib/cn";
import { formatDistance } from "@/lib/format";
import { COLORS } from "@/lib/theme";
import type { TranslationKey } from "@/i18n/dictionaries";

const PRICE_KEYS: Record<string, TranslationKey> = {
  BUDGET: "price.budget",
  MODERATE: "price.moderate",
  EXPENSIVE: "price.expensive",
  LUXURY: "price.luxury",
};

/**
 * Place detail: what the directory knows about a restaurant — its branches,
 * contact/atmosphere facts and the dishes published for it. Everything shown
 * comes from source data; a place without a published menu shows that instead
 * of an invented one.
 */
export default function RestaurantDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const t = useT();
  const lang = useLang();
  const { data: place, isLoading, isError, error, refetch } = useRestaurant(id);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-ink-950">
        <Stack.Screen options={{ title: t("restaurant.loading") }} />
        <ActivityIndicator size="large" color={COLORS.amber} />
      </View>
    );
  }

  if (isError || !place) {
    return (
      <View className="flex-1 items-center justify-center bg-ink-950 px-6">
        <Stack.Screen options={{ title: t("restaurant.notFound") }} />
        <Text className="text-5xl mb-2">🍽</Text>
        <Text className="text-lg font-semibold text-cream text-center">
          {t("restaurant.notFoundTitle")}
        </Text>
        <Text className="text-sm text-cream-mute text-center mt-1">
          {(error as Error)?.message ?? t("restaurant.notFoundDesc")}
        </Text>
        <Pressable
          onPress={() => refetch()}
          className="mt-4 px-4 py-2 rounded-full bg-brand-cta active:opacity-80"
        >
          <Text className="text-night text-sm font-bold">{t("common.retry")}</Text>
        </Pressable>
      </View>
    );
  }

  const name = displayName(lang, place);
  const areaLabel = place.area
    ? pickLabel(lang, place.area.nameEn, place.area.nameAr)
    : null;

  return (
    <View className="flex-1 bg-ink-950 overflow-hidden">
      <AmbientGlow top={80} />
      <Stack.Screen options={{ title: name }} />
      <ScrollView
        className="flex-1 bg-transparent"
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
        showsVerticalScrollIndicator={false}
      >
        <View
          className="flex-row items-center gap-2 px-4"
          style={{ paddingTop: insets.top + 8 }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("common.back")}
            onPress={() => router.back()}
            className="w-9 h-9 rounded-full bg-ink-900 border border-ink-700 items-center justify-center active:opacity-75"
          >
            <Text className="text-[14px] text-cream">←</Text>
          </Pressable>
          <Text
            numberOfLines={1}
            className="flex-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-cream-mute"
          >
            {t("restaurant.place")}
            {areaLabel ? ` • ${areaLabel}` : ""}
          </Text>
        </View>

        <View className="px-4 mt-3">
          <View className="rounded-2xl overflow-hidden bg-wine-deep border border-ink-700">
            {place.coverImageUrl ? (
              <Image
                source={{ uri: place.coverImageUrl }}
                className="w-full h-48"
                contentFit="cover"
                transition={200}
              />
            ) : (
              <View className="w-full h-48 items-center justify-center">
                <Text className="text-6xl">🍽</Text>
              </View>
            )}
          </View>
        </View>

        <View className="px-4 pt-4 gap-4">
          <View className="gap-1.5">
            <Text className="text-[22px] font-bold text-brand-50 leading-[26px]">
              {name}
            </Text>
            <View className="flex-row flex-wrap items-center gap-1.5">
              {place.cuisines.map((cuisine) => (
                <View key={cuisine.slug} className="bg-wine px-2.5 py-1 rounded-full">
                  <Text className="text-[11px] font-semibold text-cream">
                    {pickLabel(lang, cuisine.name, cuisine.nameAr ?? undefined)}
                  </Text>
                </View>
              ))}
              <View className="bg-neutral-chip px-2.5 py-1 rounded-full">
                <Text className="text-[11px] font-semibold text-cream">
                  {t(PRICE_KEYS[place.priceRange] ?? "price.moderate")}
                </Text>
              </View>
              <Text className="text-[11px] text-cream-mute">
                {t("browse.branchCount", { count: place.branchesCount })}
              </Text>
            </View>
          </View>

          {place.description ? (
            <Text className="text-[13px] text-cream-dim leading-5">
              {place.description}
            </Text>
          ) : null}

          <View className="gap-2">
            <Text className="text-[18px] leading-6 font-bold text-brand-50">
              {t("restaurant.branches")}
            </Text>
            {place.branches.map((branch) => {
              const branchArea = branch.area
                ? pickLabel(lang, branch.area.nameEn, branch.area.nameAr)
                : null;
              const distance = formatDistance(
                branch.id === place.branch?.id ? place.distanceMeters : null
              );
              const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                `${name}, ${branch.address}`
              )}`;

              return (
                <View
                  key={branch.id}
                  className="bg-ink-900 border border-ink-700 rounded-2xl p-3 gap-1.5"
                  style={{ borderCurve: "continuous" }}
                >
                  <View className="flex-row items-center justify-between gap-2">
                    <Text numberOfLines={1} className="flex-1 text-[13px] font-bold text-cream">
                      {branch.name || name}
                      {branchArea ? ` · ${branchArea}` : ""}
                    </Text>
                    <Text
                      className={cn(
                        "text-[10px] font-bold",
                        branch.isOpen === true
                          ? "text-success-ink"
                          : branch.isOpen === false
                            ? "text-danger"
                            : "text-cream-mute"
                      )}
                    >
                      {t(
                        branch.isOpen === true
                          ? "card.openNow"
                          : branch.isOpen === false
                            ? "card.closedNow"
                            : "card.hoursUnknown"
                      )}
                    </Text>
                  </View>

                  <Text className="text-[11px] leading-4 text-cream-mute">
                    {branch.address}
                    {distance ? ` · ${distance}` : ""}
                  </Text>

                  {branch.atmospheres.length > 0 ? (
                    <View className="flex-row flex-wrap gap-1">
                      {branch.atmospheres.map((atmosphere) => (
                        <View
                          key={atmosphere}
                          className="bg-neutral-chip px-2 py-0.5 rounded-full"
                        >
                          <Text className="text-[10px] text-cream">{atmosphere}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}

                  <View className="flex-row items-center gap-2 pt-0.5">
                    <Pressable
                      onPress={() => void Linking.openURL(mapUrl)}
                      accessibilityRole="button"
                      className="rounded-xl border border-ink-700 px-2.5 py-1.5 active:opacity-75"
                    >
                      <Text className="text-[10px] font-semibold text-accent">
                        ⌖ {t("card.viewOnMap")}
                      </Text>
                    </Pressable>
                    {branch.phone && /[0-9]{6,}/.test(branch.phone) ? (
                      <Pressable
                        onPress={() => void Linking.openURL(`tel:${branch.phone}`)}
                        accessibilityRole="button"
                        className="rounded-xl border border-ink-700 px-2.5 py-1.5 active:opacity-75"
                      >
                        <Text className="text-[10px] font-semibold text-cream">
                          {branch.phone}
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>

          <View className="gap-2">
            <Text className="text-[18px] leading-6 font-bold text-brand-50">
              {t("restaurant.dishesHere")}
            </Text>
            {place.dishes.length === 0 ? (
              <View className="bg-ink-900 border border-ink-700 rounded-2xl p-4 gap-1">
                <Text className="text-[13px] font-semibold text-cream">
                  {t("restaurant.noDishes")}
                </Text>
                <Text className="text-[12px] leading-4 text-cream-mute">
                  {t("restaurant.noDishesDesc")}
                </Text>
              </View>
            ) : (
              <View className="flex-row flex-wrap gap-2.5">
                {place.dishes.map((dish) => (
                  <View key={dish.id} className="basis-[48%] flex-1">
                    <DishCard dish={dish} />
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
