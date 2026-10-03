import { Linking, Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import { Link } from "expo-router";

import type { RecommendationItem } from "@/types/recommendation";
import type { InteractionType } from "@/types/interaction";
import { cn } from "@/lib/cn";
import { foodEmoji } from "@/lib/food-emoji";
import { displayName, useLang, useT } from "@/i18n";
import { formatDistance, formatPrice } from "@/lib/format";
import { CARD_SHADOW, COLORS } from "@/lib/theme";
import { tabIcon } from "@/components/tab-icons";

interface Props {
  item: RecommendationItem;
  className?: string;
  onFeedback?: (type: Extract<InteractionType, "LIKE" | "DISLIKE" | "NOT_INTERESTED">) => void;
}

export function RecommendationCard({ item, className, onFeedback }: Props) {
  const t = useT();
  const lang = useLang();

  if (!item?.dish?.id) return null;
  const { dish, restaurant, branch, distanceMeters, reason } = item;
  const distance = formatDistance(distanceMeters);
  const name = displayName(lang, dish);
  const restaurantName = restaurant
    ? displayName(lang, restaurant)
    : t("card.unknownRestaurant");
  const isEstimated = dish.verificationStatus === "UNVERIFIED";
  const hasCoordinates =
    branch &&
    Number.isFinite(branch.latitude) &&
    Number.isFinite(branch.longitude) &&
    (branch.latitude !== 0 || branch.longitude !== 0);
  const mapQuery = hasCoordinates
    ? `${branch.latitude},${branch.longitude}`
    : [restaurantName, branch?.address].filter(Boolean).join(", ");
  const mapUrl = mapQuery
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`
    : null;

  return (
    <View
      className={cn("overflow-hidden", className)}
      style={{
        borderRadius: 18,
        backgroundColor: COLORS.panel,
        boxShadow: CARD_SHADOW,
      }}
    >
      <Link href={{ pathname: "/dish/[id]", params: { id: dish.id } }} asChild>
        <Pressable style={{ flexDirection: "row" }} className="active:opacity-80">
          {/* Photo */}
          <View
            style={{
              width: 108,
              minHeight: 120,
              backgroundColor: COLORS.raised,
            }}
          >
            {dish.imageUrl ? (
              <Image
                source={{ uri: dish.imageUrl }}
                style={{ width: 108, minHeight: 120 }}
                contentFit="cover"
                transition={200}
                accessibilityLabel={`${name} photo`}
              />
            ) : (
              <View
                style={{
                  width: 108,
                  minHeight: 120,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ fontSize: 36 }}>{foodEmoji(dish)}</Text>
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
                  borderRadius: 7,
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                }}
              >
                <Text style={{ fontSize: 8, fontWeight: "700", color: COLORS.onCardTag }}>
                  {dish.tasteAttributes[0].toLowerCase().replace(/_/g, " ")}
                </Text>
              </View>
            ) : null}
          </View>

          {/* Info */}
          <View style={{ flex: 1, minWidth: 0, padding: 12, gap: 5 }}>
            <Text
              numberOfLines={2}
              style={{
                fontSize: 15,
                lineHeight: 20,
                fontWeight: "700",
                color: COLORS.cream,
              }}
            >
              {name}
            </Text>
            <Text
              numberOfLines={1}
              style={{ fontSize: 11, fontWeight: "600", color: COLORS.mute }}
            >
              {restaurantName}
              {branch?.name ? ` · ${branch.name}` : ""}
            </Text>

            {branch?.address ? (
              <Text
                numberOfLines={2}
                style={{ fontSize: 10, lineHeight: 14, color: COLORS.mute }}
              >
                {branch.address}
              </Text>
            ) : null}

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginTop: 4,
              }}
            >
              <Text
                style={{ fontSize: 14, lineHeight: 20, fontWeight: "800", color: COLORS.amber }}
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
                <Text style={{ fontSize: 16, color: COLORS.night, fontWeight: "700", lineHeight: 18 }}>
                  +
                </Text>
              </View>
            </View>

            {reason ? (
              <Text
                numberOfLines={2}
                style={{ fontSize: 10, lineHeight: 14, color: COLORS.accentText, fontStyle: "italic" }}
              >
                {reason}
              </Text>
            ) : null}
          </View>
        </Pressable>
      </Link>

      {/* Bottom meta row */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          borderTopWidth: 1,
          borderTopColor: COLORS.line,
          paddingHorizontal: 12,
          paddingVertical: 8,
        }}
      >
        <View style={{ flex: 1, flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
          {branch?.isOpen === true ? (
            <Text style={{ fontSize: 10, fontWeight: "700", color: COLORS.successText }}>
              {t("card.openNow")}
            </Text>
          ) : branch?.isOpen === false ? (
            <Text style={{ fontSize: 10, fontWeight: "700", color: COLORS.dangerText }}>
              {t("card.closedNow")}
            </Text>
          ) : (
            <Text style={{ fontSize: 10, color: COLORS.mute }}>
              {t("card.hoursUnknown")}
            </Text>
          )}
          {distance ? (
            <Text style={{ fontSize: 10, color: COLORS.mute }}>· {distance}</Text>
          ) : null}
        </View>

        {mapUrl ? (
          <Pressable
            onPress={() => void Linking.openURL(mapUrl)}
            accessibilityRole="button"
            style={{
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: COLORS.line,
            }}
          >
            <Text style={{ fontSize: 10, fontWeight: "600", color: COLORS.accentText }}>
              ⌖ {t("card.viewOnMap")}
            </Text>
          </Pressable>
        ) : null}

        {onFeedback ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingLeft: 8 }}>
            <Pressable
              onPress={() => onFeedback("LIKE")}
              hitSlop={6}
              accessibilityRole="button"
            >
              <Text style={{ fontSize: 14 }}>👍</Text>
            </Pressable>
            <Pressable
              onPress={() => onFeedback("DISLIKE")}
              hitSlop={6}
              accessibilityRole="button"
            >
              <Text style={{ fontSize: 14 }}>👎</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </View>
  );
}
