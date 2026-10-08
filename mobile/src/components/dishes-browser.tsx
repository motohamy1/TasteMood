import { useMemo, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DishCard } from "@/components/dish-card";
import { RestaurantCard } from "@/components/restaurant-card";
import { tabIcon } from "@/components/tab-icons";
import { AmbientGlow } from "@/components/ambient-glow";
import {
  useDishes,
  useMyPreferences,
  usePlaceKinds,
  usePlacesNear,
  useRecommendations,
  useRestaurantAreas,
} from "@/lib/queries";
import { useClock, useLiveContext } from "@/lib/live-context";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import {
  SLOT_LABELS,
  WEATHER_OPTIONS,
  buildPersonalityRequest,
  type PersonalityMealSlot,
  type WeatherCondition,
} from "@/lib/personality";
import {
  cardFromRestaurant,
  dedupeRecommendations,
  nearestArea,
} from "@/lib/browse-groups";
import { isPlaceKind, placeKindGlyph, placeKindLabel } from "@/lib/place-card";
import type {
  RecommendationItem,
  RecommendationRequest,
} from "@/types/recommendation";
import type { PlaceKind } from "@/types/restaurant";
import type { TranslationKey } from "@/i18n/dictionaries";
import { displayName, useLang, useT } from "@/i18n";
import { cn } from "@/lib/cn";
import { CARD_SHADOW, COLORS } from "@/lib/theme";

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

interface Props {
  headerLeft?: "menu" | "back";
}

/**
 * Home screen: greeting header, search bar, weather recommendations,
 * and location-based dish rails.
 */
export function DishesBrowser({ headerLeft = "back" }: Props) {
  const insets = useSafeAreaInsets();
  const t = useT();
  const lang = useLang();
  const clock = useClock();
  const live = useLiveContext();
  const preferences = useMyPreferences();
  const areas = useRestaurantAreas();

  const [weatherOverride, setWeatherOverride] = useState<WeatherCondition | null>(null);
  const [areaSlug, setAreaSlug] = useState<string | null>(null);
  const [searchText, setSearchText] = useState("");
  const [kindSlug, setKindSlug] = useState<PlaceKind | null>(null);

  const liveWeather = weatherOverride ?? live.weatherCategory;
  const ready = !live.loading && !preferences.isLoading;

  const areaList = areas.data ?? [];
  const nearMeAvailable = live.latitude !== null && live.longitude !== null;
  const nearMeArea = useMemo(
    () => nearestArea(areaList, live.latitude, live.longitude),
    [areaList, live.latitude, live.longitude]
  );
  const defaultAreaSlug = nearMeAvailable ? null : (areaList[0]?.slug ?? null);
  const activeAreaSlug = areaSlug ?? defaultAreaSlug;
  const activeArea =
    (activeAreaSlug
      ? areaList.find((area) => area.slug === activeAreaSlug)
      : (nearMeArea ?? areaList[0])) ?? null;

  const weatherRequest = useMemo<RecommendationRequest>(() => {
    return buildPersonalityRequest({
      prefs: preferences.data,
      mealSlot: clock.slot,
      mood: null,
      weather: liveWeather,
    });
  }, [clock.slot, liveWeather, preferences.data]);

  const weatherPicks = useRecommendations(ready ? weatherRequest : null);
  // Debounced so typing filters the rails without a request per keystroke.
  const search = useDebouncedValue(searchText.trim(), 300);
  const areaDishes = useDishes(
    { city: activeArea?.slug, limit: 12, ...(search ? { search } : {}) },
    { enabled: ready && activeArea !== null }
  );

  const weatherDishes = useMemo(
    () => dedupeRecommendations(weatherPicks.data?.recommendations),
    [weatherPicks.data]
  );
  const areaDishCards = areaDishes.data ?? [];

  // ── Places rail ──
  // Coordinates win when the user has not pinned a specific area; picking an
  // area chip switches the rail to that markaz, so the two controls never fight.
  const kindList = usePlaceKinds().data ?? [];
  const areaChosen = activeAreaSlug !== null;
  const placesByCoords = !areaChosen && nearMeAvailable;
  const nearbyPlaces = usePlacesNear({
    latitude: live.latitude,
    longitude: live.longitude,
    radiusKm: 15,
    city: placesByCoords ? undefined : (activeArea?.slug ?? undefined),
    placeKind: kindSlug ?? undefined,
    search: search || undefined,
    limit: 10,
  });
  const placeCards = useMemo(
    () => (nearbyPlaces.data ?? []).map(cardFromRestaurant),
    [nearbyPlaces.data]
  );

  const refreshing =
    weatherPicks.isRefetching ||
    areaDishes.isRefetching ||
    nearbyPlaces.isRefetching;

  // Greeting based on time slot
  const greetingLine = (() => {
    const slot = clock.slot;
    if (slot === "breakfast") return "Good Morning";
    if (slot === "lunch") return "Good Afternoon";
    if (slot === "dinner") return "Good Evening";
    return "Good Night";
  })();

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.ink950 }}>
      <AmbientGlow top={0} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: insets.top + 8,
          paddingBottom: insets.bottom + 80,
          gap: 0,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              void weatherPicks.refetch();
              void areaDishes.refetch();
              void nearbyPlaces.refetch();
              void areas.refetch();
            }}
            tintColor={COLORS.amber}
            colors={[COLORS.amber]}
          />
        }
      >
        {/* ── Header Row ── */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 20,
            paddingBottom: 16,
          }}
        >
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              headerLeft === "back" ? router.back() : router.push("/profile")
            }
            style={{
              width: 42,
              height: 42,
              borderRadius: 14,
              backgroundColor: COLORS.panel,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 1,
              borderColor: COLORS.line,
            }}
          >
            <Image
              source={tabIcon(
                headerLeft === "back" ? "back" : "menu",
                COLORS.cream,
                20
              )}
              style={{ width: 20, height: 20 }}
            />
          </Pressable>

          <Pressable
            onPress={() => router.push("/profile")}
            style={{
              width: 42,
              height: 42,
              borderRadius: 21,
              backgroundColor: COLORS.panel,
              borderWidth: 1,
              borderColor: COLORS.line,
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 2px 10px rgba(126,16,57,0.10)",
            }}
          >
            <Image
              source={tabIcon("profile", COLORS.amberCta, 22)}
              style={{ width: 22, height: 22 }}
            />
          </Pressable>
        </View>

        {/* ── Greeting ── */}
        <View style={{ paddingHorizontal: 20, paddingBottom: 20, gap: 2 }}>
          <Text
            style={{
              fontSize: 14,
              color: COLORS.dim,
              fontWeight: "500",
            }}
          >
            {live.city ? `📍 ${live.city}  ` : ""}
            {clock.clock}  👋
          </Text>
          <Text
            style={{
              fontSize: 30,
              fontWeight: "800",
              color: COLORS.cream,
              lineHeight: 36,
            }}
          >
            {greetingLine}{"\n"}
            <Text style={{ color: COLORS.amber }}>
              {t("browse.title")}
            </Text>
            !
          </Text>
        </View>

        {/* ── Search Bar — deep wine pill from the reference ── */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginHorizontal: 20,
            marginBottom: 22,
            height: 48,
            borderRadius: 24,
            backgroundColor: COLORS.amberCta,
            paddingHorizontal: 16,
            gap: 10,
            boxShadow: "0 4px 14px rgba(126,16,57,0.28)",
          }}
        >
          <Image
            source={tabIcon("search", COLORS.night, 18)}
            style={{ width: 18, height: 18 }}
          />
          <TextInput
            value={searchText}
            onChangeText={setSearchText}
            placeholder={t("dishes.searchPlaceholder")}
            placeholderTextColor={COLORS.searchPlaceholder}
            style={{
              flex: 1,
              fontSize: 14,
              color: COLORS.night,
            }}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
          />
          {searchText.length > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("search.clear")}
              onPress={() => setSearchText("")}
              hitSlop={8}
              style={{
                width: 34,
                height: 34,
                borderRadius: 17,
                backgroundColor: "rgba(255,255,255,0.16)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ fontSize: 15, color: COLORS.night, fontWeight: "700" }}>
                ✕
              </Text>
            </Pressable>
          ) : null}
        </View>

        {/* ── Weather / Recommendations Section ── */}
        <HomeSectionHeader
          title={t("browse.weatherTitle")}
          subtitle={live.tempC !== null ? `${live.tempC}°C` : undefined}
        />
        <View style={{ height: 14 }} />

        {/* Weather chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, gap: 8, paddingBottom: 14 }}
        >
          <WeatherChip
            label={t("dishes.weatherAuto")}
            emoji="📍"
            selected={weatherOverride === null}
            onPress={() => setWeatherOverride(null)}
          />
          {WEATHER_OPTIONS.map((option) => (
            <WeatherChip
              key={option.value}
              label={t(WEATHER_KEYS[option.value])}
              emoji={option.emoji}
              selected={weatherOverride === option.value}
              onPress={() => setWeatherOverride(option.value)}
            />
          ))}
        </ScrollView>

        {weatherPicks.isLoading ? (
          <LoadingRow />
        ) : weatherPicks.isError ? (
          <ErrorRow onRetry={() => void weatherPicks.refetch()} />
        ) : weatherDishes.length === 0 ? (
          <EmptyRow message={t("browse.noDishes")} />
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 20, gap: 14 }}
          >
            {weatherDishes.slice(0, 8).map((item) => (
              <PopularDishCard key={item.dish.id} item={item} />
            ))}
          </ScrollView>
        )}

        <View style={{ height: 30 }} />

        {/* ── Near Me / Area Section ── */}
        <HomeSectionHeader
          title={t("browse.locationTitle")}
          subtitle={activeArea ? displayName(lang, { name: activeArea.nameAr, nameEn: activeArea.nameEn }) : undefined}
        />
        <View style={{ height: 14 }} />

        {/* Area chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, gap: 8, paddingBottom: 14 }}
        >
          <WeatherChip
            label={t("browse.nearMe")}
            emoji="📍"
            selected={activeAreaSlug === null}
            disabled={!nearMeAvailable}
            onPress={() => setAreaSlug(null)}
          />
          {areaList.map((area) => (
            <WeatherChip
              key={area.slug}
              label={displayName(lang, { name: area.nameAr, nameEn: area.nameEn })}
              emoji="⌖"
              selected={activeAreaSlug === area.slug}
              onPress={() => setAreaSlug(area.slug)}
            />
          ))}
        </ScrollView>

        {/* Dishes in area */}
        {areaDishes.isLoading ? (
          <LoadingRow />
        ) : areaDishes.isError ? (
          <ErrorRow onRetry={() => void areaDishes.refetch()} />
        ) : areaDishCards.length === 0 ? (
          <EmptyRow message={t("browse.noDishes")} />
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 20, gap: 14 }}
          >
            {areaDishCards.map((dish) => (
              <DishCard key={dish.id} dish={dish} className="w-[160px]" />
            ))}
          </ScrollView>
        )}

        <View style={{ height: 30 }} />

        {/* ── Places: kind-first, anchored to wherever the user actually is ── */}
        <HomeSectionHeader
          title={
            !placesByCoords && activeArea
              ? t("browse.placesByArea", {
                  area: displayName(lang, {
                    name: activeArea.nameAr,
                    nameEn: activeArea.nameEn,
                  }),
                })
              : t("browse.placesNearby")
          }
        />
        <View style={{ height: 14 }} />

        {/* Kind chips: only kinds the catalogue actually holds, with counts */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, gap: 8, paddingBottom: 14 }}
        >
          <WeatherChip
            label={t("browse.allKinds")}
            emoji="✦"
            selected={kindSlug === null}
            onPress={() => setKindSlug(null)}
          />
          {kindList
            .filter((kind) => isPlaceKind(kind.kind))
            .map((kind) => {
              // Narrowed by the isPlaceKind filter above.
              const slug = kind.kind as PlaceKind;
              return (
                <WeatherChip
                  key={slug}
                  label={`${placeKindLabel(slug, lang) ?? slug} (${kind.count})`}
                  emoji={placeKindGlyph(slug)}
                  selected={kindSlug === slug}
                  onPress={() => setKindSlug(kindSlug === slug ? null : slug)}
                />
              );
            })}
        </ScrollView>

        {nearbyPlaces.isLoading ? (
          <LoadingRow />
        ) : nearbyPlaces.isError ? (
          <ErrorRow onRetry={() => void nearbyPlaces.refetch()} />
        ) : placeCards.length === 0 ? (
          <EmptyRow message={t("browse.noPlaces")} />
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 20, gap: 14 }}
          >
            {placeCards.map((card) => (
              <RestaurantCard key={card.id} item={card} className="w-[170px]" />
            ))}
          </ScrollView>
        )}
      </ScrollView>
    </View>
  );
}

// ──────────────────────────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────────────────────────

function HomeSectionHeader({
  title,
  subtitle,
  onViewAll,
}: {
  title: string;
  subtitle?: string;
  /** Rendered only when there is a real destination — a dead link is worse than none. */
  onViewAll?: () => void;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 20,
      }}
    >
      <View style={{ gap: 1 }}>
        <Text style={{ fontSize: 18, fontWeight: "800", color: COLORS.cream }}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={{ fontSize: 11, color: COLORS.mute }}>{subtitle}</Text>
        ) : null}
      </View>
      {onViewAll ? (
        <Pressable onPress={onViewAll} hitSlop={8}>
          <Text style={{ fontSize: 12, fontWeight: "700", color: COLORS.amber }}>
            View All
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * Popular dish card — white card with food photo on top, name, price, and
 * crimson + button. Matches the "Popular Now" cards in the reference.
 */
function PopularDishCard({ item }: { item: RecommendationItem }) {
  const lang = useLang();
  const { dish } = item;
  const name = displayName(lang, dish);

  return (
    <Pressable
      onPress={() => router.push({ pathname: "/dish/[id]", params: { id: dish.id } })}
      style={{
        width: 160,
        borderRadius: 18,
        backgroundColor: COLORS.panel,
        overflow: "hidden",
        boxShadow: CARD_SHADOW,
      }}
    >
      {/* Photo */}
      <View style={{ width: "100%", height: 120, backgroundColor: COLORS.raised }}>
        {dish.imageUrl ? (
          <Image
            source={{ uri: dish.imageUrl }}
            style={{ width: "100%", height: 120 }}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <View
            style={{
              width: "100%",
              height: 120,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ fontSize: 44 }}>🍽</Text>
          </View>
        )}
        {/* Heart icon overlay */}
        <View
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            width: 28,
            height: 28,
            borderRadius: 14,
            backgroundColor: COLORS.pillOnPhoto,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Image
            source={tabIcon("favourites", COLORS.amber, 14)}
            style={{ width: 14, height: 14 }}
          />
        </View>
        {/* Taste badge */}
        {dish.tasteAttributes.length > 0 ? (
          <View
            style={{
              position: "absolute",
              top: 8,
              left: 8,
              backgroundColor: COLORS.wine,
              borderRadius: 8,
              paddingHorizontal: 7,
              paddingVertical: 3,
            }}
          >
            <Text style={{ fontSize: 9, fontWeight: "700", color: COLORS.onCardTag }}>
              {dish.tasteAttributes[0].toLowerCase().replace(/_/g, " ")}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Info row */}
      <View style={{ padding: 10, gap: 3 }}>
        <Text
          numberOfLines={2}
          style={{
            fontSize: 13,
            fontWeight: "700",
            color: COLORS.cream,
            lineHeight: 17,
          }}
        >
          {name}
        </Text>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 4,
          }}
        >
          <Text
            style={{
              fontSize: 13,
              fontWeight: "800",
              color: COLORS.amber,
            }}
          >
            {dish.price
              ? `${dish.currency === "EGP" ? "EGP " : ""}${dish.price}`
              : "—"}
          </Text>
          <View
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              backgroundColor: COLORS.amber,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ fontSize: 18, color: COLORS.night, fontWeight: "700", lineHeight: 20 }}>
              +
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

function WeatherChip({
  label,
  emoji,
  selected,
  disabled,
  onPress,
}: {
  label: string;
  emoji: string;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        borderRadius: 20,
        paddingHorizontal: 14,
        paddingVertical: 8,
        backgroundColor: selected ? COLORS.amber : COLORS.panel,
        borderWidth: 1.5,
        borderColor: selected ? COLORS.amber : COLORS.line,
        opacity: disabled ? 0.4 : 1,
        boxShadow: selected ? "0 3px 10px rgba(192,36,92,0.25)" : undefined,
      }}
    >
      <Text style={{ fontSize: 14 }}>{emoji}</Text>
      <Text
        style={{
          fontSize: 12,
          fontWeight: selected ? "700" : "500",
          color: selected ? COLORS.night : COLORS.dim,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function LoadingRow() {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingHorizontal: 20,
        paddingVertical: 12,
      }}
    >
      <ActivityIndicator color={COLORS.amber} />
      <Text style={{ fontSize: 12, color: COLORS.mute }}>Loading…</Text>
    </View>
  );
}

function ErrorRow({ onRetry }: { onRetry: () => void }) {
  return (
    <View
      style={{
        marginHorizontal: 20,
        borderRadius: 14,
        padding: 14,
        backgroundColor: COLORS.dangerBg,
        borderWidth: 1,
        borderColor: COLORS.dangerLine,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <Text style={{ fontSize: 12, color: COLORS.dangerText, flex: 1 }}>
        Couldn't load. Tap to retry.
      </Text>
      <Pressable
        onPress={onRetry}
        style={{
          paddingHorizontal: 12,
          paddingVertical: 6,
          borderRadius: 10,
          backgroundColor: COLORS.raised,
        }}
      >
        <Text style={{ fontSize: 11, fontWeight: "700", color: COLORS.cream }}>
          Retry
        </Text>
      </Pressable>
    </View>
  );
}

function EmptyRow({ message }: { message: string }) {
  return (
    <View
      style={{
        marginHorizontal: 20,
        borderRadius: 14,
        padding: 14,
        backgroundColor: COLORS.panel,
        borderWidth: 1,
        borderColor: COLORS.line,
      }}
    >
      <Text style={{ fontSize: 12, color: COLORS.mute }}>{message}</Text>
    </View>
  );
}
