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
import { formatPlaceRating, placeKindLabel } from "@/lib/place-card";
import { COLORS } from "@/lib/theme";
import { tabIcon } from "@/components/tab-icons";
import type { TranslationKey } from "@/i18n/dictionaries";

const PRICE_KEYS: Record<string, TranslationKey> = {
  BUDGET: "price.budget",
  MODERATE: "price.moderate",
  EXPENSIVE: "price.expensive",
  LUXURY: "price.luxury",
};

/**
 * Place detail — light wine system.
 * Edge-to-edge cover photo, frosted back button, info sheet below.
 */
export default function RestaurantDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const t = useT();
  const lang = useLang();
  const { data: place, isLoading, isError, error, refetch } = useRestaurant(id);

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.ink950 }}>
        <Stack.Screen options={{ title: t("restaurant.loading") }} />
        <ActivityIndicator size="large" color={COLORS.amber} />
      </View>
    );
  }

  if (isError || !place) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.ink950, paddingHorizontal: 24 }}>
        <Stack.Screen options={{ title: t("restaurant.notFound") }} />
        <Text style={{ fontSize: 48, marginBottom: 8 }}>🍽</Text>
        <Text style={{ fontSize: 18, fontWeight: "700", color: COLORS.cream, textAlign: "center" }}>
          {t("restaurant.notFoundTitle")}
        </Text>
        <Text style={{ fontSize: 13, color: COLORS.mute, textAlign: "center", marginTop: 4 }}>
          {(error as Error)?.message ?? t("restaurant.notFoundDesc")}
        </Text>
        <Pressable
          onPress={() => refetch()}
          style={{
            marginTop: 16,
            paddingHorizontal: 20,
            paddingVertical: 10,
            borderRadius: 20,
            backgroundColor: COLORS.amberCta,
            boxShadow: "0 4px 12px rgba(126,16,57,0.30)",
          }}
        >
          <Text style={{ fontSize: 14, fontWeight: "700", color: COLORS.night }}>
            {t("common.retry")}
          </Text>
        </Pressable>
      </View>
    );
  }

  const name = displayName(lang, place);
  const areaLabel = place.area
    ? pickLabel(lang, place.area.nameEn, place.area.nameAr)
    : null;
  // WHAT the place is, first; the source's rating only when it has one.
  const kindLabel = placeKindLabel(place.placeKind, lang);
  const ratingText = formatPlaceRating(
    place.branch?.rating ?? null,
    place.branch?.reviewsCount ?? null
  );

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.ink950, overflow: "hidden" }}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Hero photo */}
      <View style={{ height: 280, backgroundColor: COLORS.raised }}>
        {place.coverImageUrl ? (
          <Image
            source={{ uri: place.coverImageUrl }}
            style={{ width: "100%", height: 280 }}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <View style={{ width: "100%", height: 280, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontSize: 64 }}>🍽</Text>
          </View>
        )}

        {/* Back button */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("common.back")}
          onPress={() => router.back()}
          style={{
            position: "absolute",
            top: insets.top + 8,
            left: 16,
            width: 38,
            height: 38,
            borderRadius: 19,
            backgroundColor: COLORS.pillOnPhoto,
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 2px 8px rgba(43,5,21,0.18)",
          }}
        >
          <Image
            source={tabIcon("back", COLORS.amberCta, 18)}
            style={{ width: 18, height: 18 }}
          />
        </Pressable>
      </View>

      <ScrollView
        style={{ flex: 1, marginTop: -30 }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Info sheet */}
        <View
          style={{
            backgroundColor: COLORS.ink950,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            paddingTop: 20,
            paddingHorizontal: 20,
            gap: 0,
          }}
        >
          {/* Name + cuisine tags */}
          <Text
            style={{
              fontSize: 24,
              fontWeight: "800",
              color: COLORS.cream,
              lineHeight: 28,
              marginBottom: 10,
            }}
          >
            {name}
          </Text>

          <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6, marginBottom: 14 }}>
            {kindLabel ? (
              <Text style={{ fontSize: 11, fontWeight: "800", color: COLORS.accentText }}>
                {kindLabel}
              </Text>
            ) : null}
            {place.cuisines.map((cuisine) => (
              <View
                key={cuisine.slug}
                style={{
                  backgroundColor: COLORS.amber,
                  borderRadius: 8,
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: "700", color: COLORS.night }}>
                  {pickLabel(lang, cuisine.name, cuisine.nameAr ?? undefined)}
                </Text>
              </View>
            ))}
            <View
              style={{
                backgroundColor: COLORS.panel,
                borderRadius: 8,
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderWidth: 1,
                borderColor: COLORS.line,
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: "600", color: COLORS.dim }}>
                {t(PRICE_KEYS[place.priceRange] ?? "price.moderate")}
              </Text>
            </View>
            <Text style={{ fontSize: 11, color: COLORS.mute }}>
              {t("browse.branchCount", { count: place.branchesCount })}
            </Text>
            {ratingText ? (
              <Text style={{ fontSize: 11, color: COLORS.mute }}>★ {ratingText}</Text>
            ) : null}
          </View>

          {place.description ? (
            <Text style={{ fontSize: 13, lineHeight: 20, color: COLORS.dim, marginBottom: 20 }}>
              {place.description}
            </Text>
          ) : null}

          {/* Branches */}
          <Text style={{ fontSize: 18, fontWeight: "800", color: COLORS.cream, marginBottom: 12 }}>
            {t("restaurant.branches")}
          </Text>

          <View style={{ gap: 10, marginBottom: 24 }}>
            {place.branches.map((branch) => {
              const branchArea = branch.area
                ? pickLabel(lang, branch.area.nameEn, branch.area.nameAr)
                : null;
              const distance = formatDistance(
                branch.id === place.branch?.id ? place.distanceMeters : null
              );
              const mapUrl =
                branch.mapsUrl ??
                `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                  `${name}, ${branch.address}`
                )}`;

              return (
                <View
                  key={branch.id}
                  style={{
                    backgroundColor: COLORS.panel,
                    borderWidth: 1,
                    borderColor: COLORS.line,
                    borderRadius: 18,
                    padding: 14,
                    gap: 6,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <Text
                      numberOfLines={1}
                      style={{ flex: 1, fontSize: 14, fontWeight: "700", color: COLORS.cream }}
                    >
                      {branch.name || name}
                      {branchArea ? ` · ${branchArea}` : ""}
                    </Text>                      <Text
                        style={{
                          fontSize: 10,
                          fontWeight: "700",
                          color:
                            branch.isOpen === true
                              ? COLORS.successText
                              : branch.isOpen === false
                              ? COLORS.dangerText
                              : COLORS.mute,
                        }}
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

                  <Text style={{ fontSize: 11, lineHeight: 16, color: COLORS.mute }}>
                    {branch.address}
                    {distance ? ` · ${distance}` : ""}
                  </Text>

                  {branch.atmospheres.length > 0 ? (
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
                      {branch.atmospheres.map((atmosphere) => (
                        <View
                          key={atmosphere}
                          style={{
                            backgroundColor: COLORS.raised,
                            borderRadius: 8,
                            paddingHorizontal: 8,
                            paddingVertical: 3,
                          }}
                        >
                          <Text style={{ fontSize: 10, color: COLORS.dim }}>
                            {atmosphere}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ) : null}

                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
                    <Pressable
                      onPress={() => void Linking.openURL(mapUrl)}
                      accessibilityRole="button"
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 7,
                        borderRadius: 12,
                        backgroundColor: COLORS.raised,
                        borderWidth: 1,
                        borderColor: COLORS.line,
                      }}
                    >
                      <Text style={{ fontSize: 11, fontWeight: "600", color: COLORS.accentText }}>
                        ⌖ {t("card.viewOnMap")}
                      </Text>
                    </Pressable>
                    {branch.phone && /[0-9]{6,}/.test(branch.phone) ? (
                      <Pressable
                        onPress={() => void Linking.openURL(`tel:${branch.phone}`)}
                        accessibilityRole="button"
                        style={{
                          paddingHorizontal: 12,
                          paddingVertical: 7,
                          borderRadius: 12,
                          backgroundColor: COLORS.raised,
                          borderWidth: 1,
                          borderColor: COLORS.line,
                        }}
                      >
                        <Text style={{ fontSize: 11, fontWeight: "600", color: COLORS.dim }}>
                          {branch.phone}
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>

          {/* Dishes */}
          <Text style={{ fontSize: 18, fontWeight: "800", color: COLORS.cream, marginBottom: 12 }}>
            {t("restaurant.dishesHere")}
          </Text>

          {place.dishes.length === 0 ? (
            <View
              style={{
                backgroundColor: COLORS.panel,
                borderWidth: 1,
                borderColor: COLORS.line,
                borderRadius: 18,
                padding: 16,
                gap: 4,
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: "600", color: COLORS.cream }}>
                {t("restaurant.noDishes")}
              </Text>
              <Text style={{ fontSize: 12, lineHeight: 16, color: COLORS.mute }}>
                {t("restaurant.noDishesDesc")}
              </Text>
            </View>
          ) : (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
              {place.dishes.map((dish) => (
                <View key={dish.id} style={{ width: "47%" }}>
                  <DishCard dish={dish} />
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
