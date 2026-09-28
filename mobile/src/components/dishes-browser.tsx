import { useMemo, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DishCard } from "@/components/dish-card";
import { RecommendationCard } from "@/components/recommendation-card";
import { RestaurantCard } from "@/components/restaurant-card";
import { marketIcon } from "@/components/market-icons";
import {
  useDishes,
  useMyPreferences,
  useRecommendations,
  useRestaurantAreas,
  useRestaurants,
} from "@/lib/queries";
import { useClock, useLiveContext } from "@/lib/live-context";
import {
  PERSONALITY_MOODS,
  SLOT_LABELS,
  WEATHER_OPTIONS,
  buildPersonalityRequest,
  type PersonalityMealSlot,
  type WeatherCondition,
} from "@/lib/personality";
import {
  cardFromRestaurant,
  cardsFromRecommendations,
  dedupeRecommendations,
  nearestArea,
} from "@/lib/browse-groups";
import type {
  RecommendationItem,
  RecommendationRequest,
} from "@/types/recommendation";
import type { RestaurantCardItem } from "@/types/restaurant";
import type { TranslationKey } from "@/i18n/dictionaries";
import { displayName, useLang, useT } from "@/i18n";
import { cn } from "@/lib/cn";
import { COLORS } from "@/lib/theme";

const SLOT_KEYS: Record<PersonalityMealSlot, TranslationKey> = {
  breakfast: "personality.slotBreakfast",
  lunch: "personality.slotLunch",
  dinner: "personality.slotDinner",
  "late-night": "personality.slotLateNight",
};

const WEATHER_KEYS: Record<WeatherCondition, TranslationKey> = {
  hot: "personality.weatherHot",
  dry: "personality.weatherDry",
  cold: "personality.weatherCold",
  rainy: "personality.weatherRainy",
  mild: "personality.weatherMild",
};

const MOOD_KEYS: Record<string, TranslationKey> = {
  cozy: "personality.moodCozy",
  light: "personality.moodLight",
  energized: "personality.moodEnergized",
  indulgent: "personality.moodIndulgent",
  adventurous: "personality.moodAdventurous",
  refreshing: "personality.moodRefreshing",
};

interface Props {
  headerLeft?: "menu" | "back";
}

/**
 * Dishes page: three category criteria — mood, weather and area — each showing
 * its categories and, for the selected one, the matching dishes and places.
 *
 * Mood and weather are taste/intent dimensions, so they ride the recommendation
 * engine (meal + taste intent, no distance cut: a mood is not a place). Area is
 * a catalogue dimension: places come from the restaurant catalogue by markaz
 * (or by distance for "near me") and its dishes are the ones published for the
 * places of that markaz.
 */
export function DishesBrowser({ headerLeft = "back" }: Props) {
  const insets = useSafeAreaInsets();
  const t = useT();
  const lang = useLang();
  const clock = useClock();
  const live = useLiveContext();
  const preferences = useMyPreferences();
  const areas = useRestaurantAreas();

  const [mood, setMood] = useState<string | null>(null);
  const [weatherOverride, setWeatherOverride] = useState<WeatherCondition | null>(null);
  /** null = "near me"; an area slug pins the section to that markaz. */
  const [areaSlug, setAreaSlug] = useState<string | null>(null);

  const liveWeather = weatherOverride ?? live.weatherCategory;
  const ready = !live.loading && !preferences.isLoading;

  const areaList = areas.data ?? [];
  const nearMeAvailable = live.latitude !== null && live.longitude !== null;
  const nearMeArea = useMemo(
    () => nearestArea(areaList, live.latitude, live.longitude),
    [areaList, live.latitude, live.longitude]
  );
  // Without a device position "near me" cannot resolve, so the rail starts on
  // the biggest area instead of showing an empty section.
  const defaultAreaSlug = nearMeAvailable ? null : (areaList[0]?.slug ?? null);
  const activeAreaSlug = areaSlug ?? defaultAreaSlug;
  const activeArea =
    (activeAreaSlug
      ? areaList.find((area) => area.slug === activeAreaSlug)
      : nearMeArea) ?? null;

  const requests = useMemo<{
    mood: RecommendationRequest;
    weather: RecommendationRequest;
  }>(() => {
    const base = { prefs: preferences.data, mealSlot: clock.slot };
    return {
      mood: buildPersonalityRequest({ ...base, mood, weather: null }),
      weather: buildPersonalityRequest({ ...base, mood: null, weather: liveWeather }),
    };
  }, [clock.slot, liveWeather, mood, preferences.data]);

  const moodPicks = useRecommendations(ready ? requests.mood : null);
  const weatherPicks = useRecommendations(ready ? requests.weather : null);
  const areaDishes = useDishes(
    { city: activeArea?.slug, limit: 12 },
    { enabled: ready && activeArea !== null }
  );
  const areaPlaces = useRestaurants(
    activeAreaSlug
      ? { city: activeAreaSlug, limit: 12 }
      : {
          latitude: live.latitude ?? undefined,
          longitude: live.longitude ?? undefined,
          radiusKm: 10,
          sort: "distance" as const,
          limit: 12,
        },
    { enabled: ready && (activeAreaSlug !== null || nearMeAvailable) }
  );

  const moodDishes = useMemo(
    () => dedupeRecommendations(moodPicks.data?.recommendations),
    [moodPicks.data]
  );
  const weatherDishes = useMemo(
    () => dedupeRecommendations(weatherPicks.data?.recommendations),
    [weatherPicks.data]
  );
  const moodPlaces = useMemo(() => cardsFromRecommendations(moodDishes), [moodDishes]);
  const weatherPlaces = useMemo(
    () => cardsFromRecommendations(weatherDishes),
    [weatherDishes]
  );
  const areaPlaceCards = useMemo(
    () => (areaPlaces.data ?? []).map(cardFromRestaurant),
    [areaPlaces.data]
  );
  const areaDishCards = areaDishes.data ?? [];

  const refreshing =
    moodPicks.isRefetching ||
    weatherPicks.isRefetching ||
    areaDishes.isRefetching ||
    areaPlaces.isRefetching;

  const activeWeatherOption = WEATHER_OPTIONS.find(
    (option) => option.value === liveWeather
  );

  return (
    <View className="flex-1 bg-ink-950">
      <StatusBar barStyle="light-content" backgroundColor={COLORS.ink950} />
      <ScrollView
        className="flex-1"
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{
          paddingTop: insets.top + 8,
          paddingBottom: insets.bottom + 116,
          gap: 26,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              void moodPicks.refetch();
              void weatherPicks.refetch();
              void areaDishes.refetch();
              void areaPlaces.refetch();
              void areas.refetch();
            }}
            tintColor={COLORS.amber}
            colors={[COLORS.amber]}
          />
        }
      >
        <View className="flex-row items-center gap-3 px-5">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t(headerLeft === "back" ? "common.back" : "profile.title")}
            onPress={() =>
              headerLeft === "back" ? router.back() : router.push("/profile")
            }
            className="h-11 w-11 items-center justify-center rounded-2xl bg-ink-900 active:opacity-75"
            style={{ borderCurve: "continuous" }}
          >
            <Image
              source={marketIcon(headerLeft === "back" ? "back" : "menu", COLORS.cream, 20)}
              style={{ width: 20, height: 20 }}
            />
          </Pressable>
          <View className="flex-1">
            <Text className="text-[11px] font-semibold uppercase tracking-[0.12em] text-accent">
              {t("home.discover")}
            </Text>
            <Text className="text-[25px] leading-[30px] font-bold text-brand-50">
              {t("browse.title")}
            </Text>
          </View>
          <Text className="text-xs font-semibold tabular-nums text-cream-mute">
            {clock.clock}
          </Text>
        </View>

        <View className="px-5 gap-2">
          <Text className="text-[13px] leading-5 text-cream-dim">
            {t("browse.subtitle")}
          </Text>
          <View className="flex-row flex-wrap gap-2">
            <View className="flex-row items-center gap-1.5 rounded-full bg-ink-900 px-3 py-1.5">
              <Text className="text-sm">{SLOT_LABELS[clock.slot].emoji}</Text>
              <Text className="text-[11px] font-semibold text-cream">
                {t("dishes.timeContext", { slot: t(SLOT_KEYS[clock.slot]) })}
              </Text>
            </View>
            <View className="flex-row items-center gap-1.5 rounded-full bg-ink-900 px-3 py-1.5">
              <Text className="text-sm">
                {activeWeatherOption?.emoji ?? (live.loading ? "🌦️" : "📍")}
              </Text>
              <Text className="text-[11px] font-semibold text-cream">
                {liveWeather
                  ? t(WEATHER_KEYS[liveWeather])
                  : t("dishes.weatherUnavailable")}
                {live.tempC !== null && weatherOverride === null
                  ? ` · ${live.tempC}°C`
                  : ""}
              </Text>
            </View>
            {live.city ? (
              <View className="flex-row items-center gap-1.5 rounded-full bg-ink-900 px-3 py-1.5">
                <Text className="text-sm">⌖</Text>
                <Text
                  numberOfLines={1}
                  className="max-w-[180px] text-[11px] font-medium text-cream-dim"
                >
                  {live.city}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        <BrowseSection
          title={t("browse.moodTitle")}
          subtitle={t("browse.moodSubtitle")}
          tiles={
            <>
              <CategoryTile
                label={t("dishes.anyMood")}
                emoji="✨"
                selected={mood === null}
                onPress={() => setMood(null)}
              />
              {PERSONALITY_MOODS.map((option) => (
                <CategoryTile
                  key={option.id}
                  label={t(MOOD_KEYS[option.id])}
                  emoji={option.emoji}
                  selected={mood === option.id}
                  onPress={() => setMood(option.id)}
                />
              ))}
            </>
          }
        >
          <DishRecommendationRail
            loading={moodPicks.isLoading}
            error={moodPicks.isError}
            items={moodDishes}
            onRetry={() => void moodPicks.refetch()}
          />
          <PlaceRail
            loading={moodPicks.isLoading}
            error={moodPicks.isError}
            items={moodPlaces}
            onRetry={() => void moodPicks.refetch()}
          />
        </BrowseSection>

        <BrowseSection
          title={t("browse.weatherTitle")}
          subtitle={
            live.weatherCategory === null && weatherOverride === null
              ? t("dishes.weatherFallback")
              : t("browse.weatherSubtitle")
          }
          tiles={
            <>
              <CategoryTile
                label={t("dishes.weatherAuto")}
                emoji="📍"
                selected={weatherOverride === null}
                onPress={() => setWeatherOverride(null)}
              />
              {WEATHER_OPTIONS.map((option) => (
                <CategoryTile
                  key={option.value}
                  label={t(WEATHER_KEYS[option.value])}
                  emoji={option.emoji}
                  selected={weatherOverride === option.value}
                  onPress={() => setWeatherOverride(option.value)}
                />
              ))}
            </>
          }
        >
          <DishRecommendationRail
            loading={weatherPicks.isLoading}
            error={weatherPicks.isError}
            items={weatherDishes}
            onRetry={() => void weatherPicks.refetch()}
          />
          <PlaceRail
            loading={weatherPicks.isLoading}
            error={weatherPicks.isError}
            items={weatherPlaces}
            onRetry={() => void weatherPicks.refetch()}
          />
        </BrowseSection>

        <BrowseSection
          title={t("browse.locationTitle")}
          subtitle={t("browse.locationSubtitle")}
          tiles={
            <>
              <CategoryTile
                label={t("browse.nearMe")}
                emoji="📍"
                selected={activeAreaSlug === null}
                disabled={!nearMeAvailable}
                onPress={() => setAreaSlug(null)}
              />
              {areaList.map((area) => (
                <CategoryTile
                  key={area.slug}
                  label={displayName(lang, { name: area.nameAr, nameEn: area.nameEn })}
                  emoji="⌖"
                  badge={String(area.restaurantCount)}
                  selected={activeAreaSlug === area.slug}
                  onPress={() => setAreaSlug(area.slug)}
                />
              ))}
            </>
          }
        >
          <Rail
            label={t("browse.dishes")}
            count={areaDishCards.length}
            loading={areaDishes.isLoading}
            error={areaDishes.isError}
            empty={t("browse.noDishes")}
            onRetry={() => void areaDishes.refetch()}
          >
            {areaDishCards.map((dish) => (
              <DishCard key={dish.id} dish={dish} className="w-[196px]" />
            ))}
          </Rail>
          <PlaceRail
            loading={areaPlaces.isLoading || areas.isLoading}
            error={areaPlaces.isError}
            items={areaPlaceCards}
            onRetry={() => {
              void areaPlaces.refetch();
              void areas.refetch();
            }}
          />
        </BrowseSection>
      </ScrollView>
    </View>
  );
}

function BrowseSection({
  title,
  subtitle,
  tiles,
  children,
}: {
  title: string;
  subtitle: string;
  tiles: ReactNode;
  children: ReactNode;
}) {
  return (
    <View className="gap-3">
      <View className="px-5 gap-0.5">
        <Text className="text-[18px] leading-6 font-bold text-brand-50">{title}</Text>
        <Text className="text-xs text-cream-mute">{subtitle}</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}
      >
        {tiles}
      </ScrollView>

      {children}
    </View>
  );
}

/** One labelled horizontal rail with its loading/empty/error states. */
function Rail({
  label,
  count,
  loading,
  error,
  empty,
  onRetry,
  children,
}: {
  label: string;
  count: number;
  loading: boolean;
  error: boolean;
  empty: string;
  onRetry: () => void;
  children: ReactNode;
}) {
  const t = useT();

  return (
    <View className="gap-2">
      <View className="flex-row items-center justify-between px-5">
        <Text className="text-[11px] font-semibold uppercase tracking-[0.12em] text-accent">
          {label}
        </Text>
        {count > 0 ? (
          <Text className="text-[11px] font-semibold tabular-nums text-cream-mute">
            {count}
          </Text>
        ) : null}
      </View>

      {loading ? (
        <View className="flex-row items-center gap-2 px-5 py-3">
          <ActivityIndicator color={COLORS.amber} />
          <Text className="text-xs text-cream-mute">{t("browse.loading")}</Text>
        </View>
      ) : error ? (
        <View className="mx-4 flex-row items-center justify-between gap-3 rounded-2xl border border-danger-line bg-danger-bg px-4 py-3">
          <Text className="flex-1 text-xs leading-4 text-danger">
            {t("personality.unavailable")}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={onRetry}
            className="rounded-xl border border-danger-line px-3 py-1.5 active:opacity-75"
          >
            <Text className="text-[11px] font-semibold text-danger">
              {t("common.retry")}
            </Text>
          </Pressable>
        </View>
      ) : count === 0 ? (
        <View className="mx-4 rounded-2xl border border-ink-700 bg-ink-900 px-4 py-3">
          <Text className="text-xs text-cream-mute">{empty}</Text>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 12, alignItems: "stretch" }}
        >
          {children}
        </ScrollView>
      )}
    </View>
  );
}

function DishRecommendationRail({
  items,
  loading,
  error,
  onRetry,
}: {
  items: RecommendationItem[];
  loading: boolean;
  error: boolean;
  onRetry: () => void;
}) {
  const t = useT();
  return (
    <Rail
      label={t("browse.dishes")}
      count={items.length}
      loading={loading}
      error={error}
      empty={t("browse.noDishes")}
      onRetry={onRetry}
    >
      {items.map((item) => (
        <RecommendationCard key={item.dish.id} item={item} className="w-[286px]" />
      ))}
    </Rail>
  );
}

function PlaceRail({
  items,
  loading,
  error,
  onRetry,
}: {
  items: RestaurantCardItem[];
  loading: boolean;
  error: boolean;
  onRetry: () => void;
}) {
  const t = useT();
  return (
    <Rail
      label={t("browse.places")}
      count={items.length}
      loading={loading}
      error={error}
      empty={t("browse.noPlaces")}
      onRetry={onRetry}
    >
      {items.map((item) => (
        <RestaurantCard key={item.id} item={item} className="w-[286px]" />
      ))}
    </Rail>
  );
}

function CategoryTile({
  label,
  emoji,
  badge,
  selected,
  disabled,
  onPress,
}: {
  label: string;
  emoji: string;
  badge?: string;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      className={cn(
        "flex-row items-center gap-1.5 rounded-full border px-3 py-2.5 active:opacity-80",
        selected ? "border-brand-cta bg-brand-cta" : "border-ink-700 bg-ink-900",
        disabled ? "opacity-40" : ""
      )}
      style={{ borderCurve: "continuous" }}
    >
      <Text className="text-sm">{emoji}</Text>
      <Text
        className={cn(
          "text-xs",
          selected ? "font-bold text-night" : "font-medium text-cream"
        )}
      >
        {label}
      </Text>
      {badge ? (
        <View
          className={cn(
            "rounded-full px-1.5",
            selected ? "bg-night/10" : "bg-ink-950"
          )}
        >
          <Text
            className={cn(
              "text-[10px] font-semibold tabular-nums",
              selected ? "text-night" : "text-cream-mute"
            )}
          >
            {badge}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}
