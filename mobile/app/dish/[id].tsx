import { Stack, useLocalSearchParams, Link, router } from "expo-router";
import { Image } from "expo-image";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Switch,
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
import { COLORS } from "@/lib/theme";
import { tabIcon } from "@/components/tab-icons";
import { displayDescription, displayName, useLang, useT } from "@/i18n";
import { formatPrice } from "@/lib/format";

const SPICE_LEVELS = [
  { value: "Regular", labelKey: "dish.mild", label: "Regular" },
  { value: "Medium", labelKey: "dish.medium", label: "Large" },
  { value: "Hot", labelKey: "dish.hot", label: "X Large" },
] as const;

/**
 * Dish Detail — reference design:
 * • Edge-to-edge hero photo (takes upper 45% of screen)
 * • Back button (dark pill) top-left, heart button (dark pill) top-right
 * • Bottom sheet-style info panel overlapping the photo
 * • Taste badge, title, rating + price row, description
 * • Customize: size pills, toggle rows (Add-ons)
 * • Quantity stepper + Add to Cart CTA at the bottom
 */
export default function DishDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const t = useT();
  const lang = useLang();
  const { data: dish, isLoading, isError, error, refetch } = useDish(id);
  const isSignedIn = useAuthStore(selectIsSignedIn);

  const { data: savedIds } = useSavedDishIds();
  const isSaved = isDishSaved(savedIds, dish?.id);
  const saveDish = useSaveDish();
  const unsaveDish = useUnsaveDish();
  const recordViewDish = useRecordViewDish();

  const [portion, setPortion] = useState(1);
  const [size, setSize] = useState<"Regular" | "Medium" | "Hot">("Regular");
  const [addCheese, setAddCheese] = useState(true);
  const [extraPatty, setExtraPatty] = useState(false);
  const [addBacon, setAddBacon] = useState(true);

  useEffect(() => {
    if (dish?.id && isSignedIn) {
      recordViewDish.mutate(dish.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dish?.id, isSignedIn]);

  function toggleSave() {
    if (!dish) return;
    if (!isSignedIn) return;
    if (isSaved) {
      unsaveDish.mutate(dish.id);
    } else {
      saveDish.mutate(dish.id);
    }
  }

  if (isLoading) {
    return (
      <View
        style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.ink950 }}
      >
        <Stack.Screen options={{ title: t("dish.loading") }} />
        <ActivityIndicator size="large" color={COLORS.amber} />
      </View>
    );
  }

  if (isError || !dish) {
    return (
      <View
        style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.ink950, paddingHorizontal: 24 }}
      >
        <Stack.Screen options={{ title: t("dish.notFound") }} />
        <Text style={{ fontSize: 48, marginBottom: 8 }}>⚠️</Text>
        <Text style={{ fontSize: 18, fontWeight: "700", color: COLORS.cream, textAlign: "center" }}>
          {t("dish.notFoundTitle")}
        </Text>
        <Text style={{ fontSize: 14, color: COLORS.mute, textAlign: "center", marginTop: 4 }}>
          {(error as Error)?.message ?? t("dish.notFoundDesc")}
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
          <Text style={{ color: COLORS.night, fontSize: 14, fontWeight: "700" }}>
            {t("common.retry")}
          </Text>
        </Pressable>
      </View>
    );
  }

  const dishName = displayName(lang, dish);
  const description = displayDescription(lang, dish);
  const price = formatPrice(dish.price, dish.currency);
  const totalPrice = dish.price
    ? formatPrice(dish.price * portion, dish.currency)
    : price;

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.ink950 }}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* ── Hero Photo — edge to edge ── */}
      <View style={{ height: 320, backgroundColor: COLORS.raised }}>
        {dish.imageUrl ? (
          <Image
            source={{ uri: dish.imageUrl }}
            style={{ width: "100%", height: 320 }}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <View
            style={{
              width: "100%",
              height: 320,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ fontSize: 72 }}>🍽</Text>
          </View>
        )}

        {/* Gradient overlay bottom of photo */}
        <View
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 100,
            backgroundColor: "rgba(43,5,21,0.0)",
          }}
          pointerEvents="none"
        />

        {/* Back button */}
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
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

        {/* Heart / Save button */}
        <Pressable
          onPress={isSignedIn ? toggleSave : () => router.push("/auth")}
          accessibilityRole="button"
          style={{
            position: "absolute",
            top: insets.top + 8,
            right: 16,
            width: 38,
            height: 38,
            borderRadius: 19,
            backgroundColor: isSaved ? COLORS.amber : COLORS.pillOnPhoto,
            alignItems: "center",
            justifyContent: "center",
            boxShadow: isSaved
              ? "0 2px 10px rgba(192,36,92,0.40)"
              : "0 2px 8px rgba(43,5,21,0.18)",
          }}
        >
          <Image
            source={tabIcon(
              isSaved ? "heart-filled" : "favourites",
              isSaved ? COLORS.night : COLORS.amber,
              18
            )}
            style={{ width: 18, height: 18 }}
          />
        </Pressable>
      </View>

      {/* ── Info Sheet — overlaps photo ── */}
      <ScrollView
        style={{ flex: 1, marginTop: -30 }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 110 }}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={{
            backgroundColor: COLORS.ink950,
            borderTopLeftRadius: 30,
            borderTopRightRadius: 30,
            paddingTop: 22,
            paddingHorizontal: 20,
            gap: 0,
          }}
        >
          {/* Taste badge + menu dots row */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 12,
            }}
          >
            {dish.tasteAttributes.length > 0 ? (
              <View
                style={{
                  backgroundColor: COLORS.amber,
                  borderRadius: 8,
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: "700", color: COLORS.night }}>
                  {dish.tasteAttributes[0].toLowerCase().replace(/_/g, " ")}
                </Text>
              </View>
            ) : dish.cuisine ? (
              <View
                style={{
                  backgroundColor: COLORS.raised,
                  borderRadius: 8,
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderWidth: 1,
                  borderColor: COLORS.line,
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: "600", color: COLORS.dim }}>
                  {dish.cuisine}
                </Text>
              </View>
            ) : (
              <View />
            )}
            <View
              style={{ flexDirection: "row", gap: 4 }}
            >
              {[0, 1, 2].map((i) => (
                <View
                  key={i}
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: 2.5,
                    backgroundColor: COLORS.line,
                  }}
                />
              ))}
            </View>
          </View>

          {/* Title */}
          <Text
            style={{
              fontSize: 24,
              fontWeight: "800",
              color: COLORS.cream,
              lineHeight: 28,
              marginBottom: 8,
            }}
          >
            {dishName}
          </Text>

          {/* Rating + Price row */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 14,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              {typeof dish.rating === "number" ? (
                <>
                  <Text style={{ fontSize: 14, color: COLORS.amber }}>★</Text>
                  <Text style={{ fontSize: 14, fontWeight: "700", color: COLORS.cream }}>
                    {dish.rating.toFixed(1)}
                  </Text>
                  {dish.reviewCount && dish.reviewCount > 0 ? (
                    <Text style={{ fontSize: 13, color: COLORS.mute }}>
                      ({dish.reviewCount})
                    </Text>
                  ) : null}
                </>
              ) : null}
            </View>
            <Text
              style={{ fontSize: 20, fontWeight: "800", color: COLORS.amber }}
            >
              {price}
            </Text>
          </View>

          {/* Description */}
          {description ? (
            <Text
              style={{
                fontSize: 13,
                lineHeight: 20,
                color: COLORS.dim,
                marginBottom: 22,
              }}
            >
              {description}
            </Text>
          ) : null}

          {/* ── Customize Section ── */}
          <Text
            style={{
              fontSize: 17,
              fontWeight: "800",
              color: COLORS.cream,
              marginBottom: 14,
            }}
          >
            Customize
          </Text>

          {/* Size pills */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginBottom: 16,
              gap: 10,
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: "600", color: COLORS.dim, width: 100 }}>
              {t("dish.portion")}
            </Text>
            <View style={{ flex: 1, flexDirection: "row", gap: 8 }}>
              {SPICE_LEVELS.map((level) => {
                const active = size === level.value;
                return (
                  <Pressable
                    key={level.value}
                    onPress={() => setSize(level.value as any)}
                    style={{
                      flex: 1,
                      paddingVertical: 8,
                      borderRadius: 20,
                      alignItems: "center",
                      backgroundColor: active ? COLORS.amber : COLORS.raised,
                      borderWidth: 1,
                      borderColor: active ? COLORS.amber : COLORS.line,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: active ? "700" : "500",
                        color: active ? COLORS.night : COLORS.dim,
                      }}
                    >
                      {level.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Toggle rows — add-ons */}
          {[
            { label: "Add Cheese", value: addCheese, setter: setAddCheese },
            { label: "Extra Patty", value: extraPatty, setter: setExtraPatty },
            ...(dish.ingredients.length > 0
              ? [{ label: "Add Bacon", value: addBacon, setter: setAddBacon }]
              : []),
          ].map(({ label, value, setter }) => (
            <View
              key={label}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingVertical: 12,
                borderBottomWidth: 1,
                borderBottomColor: COLORS.line,
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: "600", color: COLORS.cream }}>
                {label}
              </Text>
              <Switch
                value={value}
                onValueChange={setter}
                trackColor={{ false: COLORS.raised, true: COLORS.amber }}
                thumbColor={COLORS.panel}
                ios_backgroundColor={COLORS.raised}
              />
            </View>
          ))}

          {/* Dietary tags */}
          {dish.dietaryProperties.length > 0 ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 16 }}>
              {dish.dietaryProperties.map((tag) => (
                <View
                  key={tag}
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    borderRadius: 10,
                    backgroundColor: COLORS.successBg,
                    borderWidth: 1,
                    borderColor: COLORS.successLine,
                  }}
                >
                  <Text style={{ fontSize: 10, fontWeight: "600", color: COLORS.successText }}>
                    {tag.toLowerCase().replace(/_/g, " ")}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          {/* AI explanation */}
          {dish.aiExplanation ? (
            <View
              style={{
                marginTop: 16,
                padding: 12,
                borderRadius: 14,
                backgroundColor: COLORS.wine,
                borderWidth: 1,
                borderColor: COLORS.wineDeep,
              }}
            >
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: "700",
                  color: COLORS.amberCta,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                  marginBottom: 4,
                }}
              >
                {t("dish.whyThisDish")}
              </Text>
              <Text style={{ fontSize: 12, lineHeight: 18, color: COLORS.dim }}>
                {dish.aiExplanation}
              </Text>
            </View>
          ) : null}

          {/* Nutrient tiles */}
          {(typeof dish.calories === "number" || typeof dish.prepTimeMinutes === "number") ? (
            <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
              {typeof dish.calories === "number" ? (
                <View
                  style={{
                    flex: 1,
                    backgroundColor: COLORS.panel,
                    borderRadius: 14,
                    padding: 10,
                    borderWidth: 1,
                    borderColor: COLORS.line,
                  }}
                >
                  <Text style={{ fontSize: 9, textTransform: "uppercase", color: COLORS.mute }}>
                    Calories
                  </Text>
                  <Text style={{ fontSize: 14, fontWeight: "700", color: COLORS.cream, marginTop: 3 }}>
                    {dish.calories} kcal
                  </Text>
                </View>
              ) : null}
              {typeof dish.prepTimeMinutes === "number" ? (
                <View
                  style={{
                    flex: 1,
                    backgroundColor: COLORS.panel,
                    borderRadius: 14,
                    padding: 10,
                    borderWidth: 1,
                    borderColor: COLORS.line,
                  }}
                >
                  <Text style={{ fontSize: 9, textTransform: "uppercase", color: COLORS.mute }}>
                    Prep time
                  </Text>
                  <Text style={{ fontSize: 14, fontWeight: "700", color: COLORS.cream, marginTop: 3 }}>
                    {dish.prepTimeMinutes} min
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
      </ScrollView>

      {/* ── Bottom CTA Bar ── */}
      <View
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          paddingBottom: insets.bottom + 8,
          paddingTop: 12,
          paddingHorizontal: 20,
          backgroundColor: COLORS.ink950,
          borderTopWidth: 1,
          borderTopColor: COLORS.line,
          flexDirection: "row",
          alignItems: "center",
          gap: 16,
        }}
      >
        {/* Quantity stepper */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 14,
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderRadius: 20,
            backgroundColor: COLORS.panel,
            borderWidth: 1,
            borderColor: COLORS.line,
          }}
        >
          <Pressable
            onPress={() => setPortion((p) => Math.max(1, p - 1))}
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              borderWidth: 1.5,
              borderColor: COLORS.line,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ fontSize: 16, color: COLORS.cream, fontWeight: "700", lineHeight: 18 }}>
              −
            </Text>
          </Pressable>
          <Text style={{ fontSize: 16, fontWeight: "700", color: COLORS.cream, minWidth: 16, textAlign: "center" }}>
            {portion}
          </Text>
          <Pressable
            onPress={() => setPortion((p) => Math.min(9, p + 1))}
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              backgroundColor: COLORS.amber,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ fontSize: 16, color: COLORS.night, fontWeight: "700", lineHeight: 18 }}>
              +
            </Text>
          </Pressable>
        </View>

        {/* Add to Cart */}
        <Pressable
          style={{
            flex: 1,
            height: 50,
            borderRadius: 25,
            backgroundColor: COLORS.amberCta,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            boxShadow: "0 6px 16px rgba(126,16,57,0.35)",
          }}
        >
          <Text style={{ fontSize: 15, fontWeight: "800", color: COLORS.night }}>
            {isSignedIn ? "Add to Cart" : t("common.signIn")}
          </Text>
          <View
            style={{
              backgroundColor: "rgba(255,255,255,0.22)",
              borderRadius: 14,
              paddingHorizontal: 10,
              paddingVertical: 4,
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: "700", color: COLORS.night }}>
              {totalPrice}
            </Text>
          </View>
        </Pressable>
      </View>
    </View>
  );
}
