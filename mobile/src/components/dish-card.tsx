import { Image } from "expo-image";
import { Link } from "expo-router";
import { Pressable, Text, View } from "react-native";

import type { DishSummary } from "@/types/dish";
import { cn } from "@/lib/cn";
import { displayName, useLang, useT } from "@/i18n";
import { formatPrice } from "@/lib/format";
import { CARD_SHADOW, COLORS } from "@/lib/theme";
import { tabIcon } from "@/components/tab-icons";

interface Props {
  dish: DishSummary;
  className?: string;
}

export function DishCard({ dish, className }: Props) {
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
        className={cn(
          "overflow-hidden active:opacity-80",
          className
        )}
        style={{
          borderRadius: 18,
          backgroundColor: COLORS.panel,
          boxShadow: CARD_SHADOW,
        }}
      >
        {/* Photo */}
        <View
          style={{ width: "100%", height: 110, backgroundColor: COLORS.raised }}
        >
          {dish.imageUrl ? (
            <Image
              source={{ uri: dish.imageUrl }}
              style={{ width: "100%", height: 110 }}
              contentFit="cover"
              transition={200}
              accessibilityLabel={`${name} photo`}
            />
          ) : (
            <View
              style={{
                width: "100%",
                height: 110,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ fontSize: 44 }}>🍽</Text>
            </View>
          )}

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

        {/* Info */}
        <View style={{ padding: 10, gap: 3 }}>
          <Text
            numberOfLines={1}
            style={{
              fontSize: 13,
              fontWeight: "700",
              color: COLORS.cream,
            }}
          >
            {name}
          </Text>

          <Text
            numberOfLines={1}
            style={{ fontSize: 10, color: COLORS.mute }}
          >
            {displayName(lang, { name: dish.restaurantName, nameEn: dish.restaurantNameEn })}
            {dish.branchName ? ` · ${dish.branchName}` : ""}
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
              {formatPrice(dish.price, dish.currency)}
            </Text>

            <View
              style={{
                width: 26,
                height: 26,
                borderRadius: 13,
                backgroundColor: COLORS.amber,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text
                style={{
                  fontSize: 16,
                  color: COLORS.night,
                  fontWeight: "700",
                  lineHeight: 18,
                }}
              >
                +
              </Text>
            </View>
          </View>

          {typeof dish.rating === "number" ? (
            <Text style={{ fontSize: 10, color: COLORS.mute, marginTop: 1 }}>
              ★ {dish.rating.toFixed(1)}
              {dish.reviewCount && dish.reviewCount > 0 ? ` (${dish.reviewCount})` : ""}
            </Text>
          ) : null}
        </View>
      </Pressable>
    </Link>
  );
}
