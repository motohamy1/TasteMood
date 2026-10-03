import { Image } from "expo-image";
import { Link } from "expo-router";
import { Pressable, Text, View } from "react-native";

import type { DishSummary } from "@/types/dish";
import { displayName, useLang, useT } from "@/i18n";
import { formatPrice } from "@/lib/format";
import { CARD_SHADOW, COLORS } from "@/lib/theme";

interface Props {
  dish: DishSummary;
  rank: number;
}

/**
 * Wide featured card — dark food-delivery style.
 * Photo left, info right, rank badge overlay, orange price.
 */
export function FeaturedCard({ dish, rank }: Props) {
  const t = useT();
  const lang = useLang();
  const name = displayName(lang, dish);
  const isEstimated = dish.verificationStatus === "UNVERIFIED";

  return (
    <Link
      href={{ pathname: "/dish/[id]", params: { id: dish.id } }}
      asChild
    >
      <Pressable
        style={{
          flexDirection: "row",
          backgroundColor: COLORS.panel,
          borderRadius: 18,
          overflow: "hidden",
          width: 300,
          height: 168,
          flexShrink: 0,
          boxShadow: CARD_SHADOW,
        }}
        className="active:opacity-85"
      >
        <View>
          {dish.imageUrl ? (
            <Image
              source={{ uri: dish.imageUrl }}
              style={{ width: 128, height: 168 }}
              contentFit="cover"
              transition={200}
              accessibilityLabel={`${name} photo`}
            />
          ) : (
            <View
              style={{
                width: 128,
                height: 168,
                backgroundColor: COLORS.raised,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ fontSize: 44 }}>🍽</Text>
            </View>
          )}
          {/* Rank badge */}
          <View
            style={{
              position: "absolute",
              top: 8,
              left: 8,
              backgroundColor: COLORS.amberCta,
              borderRadius: 8,
              paddingHorizontal: 8,
              paddingVertical: 3,
            }}
          >
            <Text style={{ fontSize: 10, fontWeight: "700", color: COLORS.night }}>
              #{rank}
            </Text>
          </View>
        </View>

        <View style={{ flex: 1, padding: 12, gap: 4, justifyContent: "center" }}>
          <Text
            numberOfLines={1}
            style={{ fontSize: 14, fontWeight: "700", color: COLORS.cream }}
          >
            {name}
          </Text>
          <Text numberOfLines={1} style={{ fontSize: 11, color: COLORS.mute }}>
            {displayName(lang, { name: dish.restaurantName, nameEn: dish.restaurantNameEn })}
            {dish.branchName ? ` · ${dish.branchName}` : ""}
          </Text>

          {typeof dish.rating === "number" ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Text style={{ fontSize: 11, color: COLORS.amber }}>★</Text>
              <Text style={{ fontSize: 11, fontWeight: "600", color: COLORS.cream }}>
                {dish.rating.toFixed(1)}
                {dish.reviewCount && dish.reviewCount > 0
                  ? ` (${dish.reviewCount})`
                  : ""}
              </Text>
              {dish.cuisine ? (
                <Text style={{ fontSize: 10, color: COLORS.mute }}>· {dish.cuisine}</Text>
              ) : null}
            </View>
          ) : (
            dish.cuisine ? (
              <Text style={{ fontSize: 10, color: COLORS.mute }}>{dish.cuisine}</Text>
            ) : null
          )}

          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 2 }}>
            <Text style={{ fontSize: 14, fontWeight: "800", color: COLORS.amber }}>
              {formatPrice(dish.price, dish.currency)}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              {isEstimated ? (
                <View
                  style={{
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                    borderRadius: 6,
                    borderWidth: 1,
                    borderColor: COLORS.line,
                  }}
                >
                  <Text style={{ fontSize: 8, fontWeight: "600", color: COLORS.mute }}>
                    {t("dish.estimated")}
                  </Text>
                </View>
              ) : null}
              {dish.tasteAttributes.length > 0 ? (
                <View
                  style={{
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                    borderRadius: 6,
                    backgroundColor: COLORS.raised,
                    borderWidth: 1,
                    borderColor: COLORS.line,
                  }}
                >
                  <Text style={{ fontSize: 8, fontWeight: "600", color: COLORS.accentText }}>
                    {dish.tasteAttributes[0].toLowerCase()}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>
      </Pressable>
    </Link>
  );
}
