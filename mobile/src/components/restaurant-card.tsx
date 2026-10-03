import { Link } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { Image } from "expo-image";

import { cn } from "@/lib/cn";
import { displayName, pickLabel, useLang, useT } from "@/i18n";
import { formatDistance } from "@/lib/format";
import type { RestaurantCardItem } from "@/types/restaurant";
import { CARD_SHADOW, COLORS } from "@/lib/theme";

interface Props {
  item: RestaurantCardItem;
  className?: string;
}

/**
 * Place card for the browse rails — dark food-delivery style.
 * Photo on top (or emoji placeholder), then name + cuisine + status.
 */
export function RestaurantCard({ item, className }: Props) {
  const t = useT();
  const lang = useLang();

  const name = displayName(lang, item);
  const cuisines = item.cuisines
    .slice(0, 2)
    .map((cuisine) => pickLabel(lang, cuisine.name, cuisine.nameAr ?? undefined))
    .join(" · ");
  const place = item.area
    ? pickLabel(lang, item.area.name, item.area.nameAr)
    : item.address;
  const distance = formatDistance(item.distanceMeters);

  return (
    <Link href={{ pathname: "/restaurant/[id]", params: { id: item.id } }} asChild>
      <Pressable
        className={cn("overflow-hidden active:opacity-80", className)}
        style={{
          borderRadius: 18,
          backgroundColor: COLORS.panel,
          boxShadow: CARD_SHADOW,
        }}
      >
        {/* Photo */}
        <View style={{ width: "100%", height: 120, backgroundColor: COLORS.raised }}>
          {item.photoUrl ? (
            <Image
              source={{ uri: item.photoUrl }}
              style={{ width: "100%", height: 120 }}
              contentFit="cover"
              transition={200}
              accessibilityLabel={`${name} photo`}
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

          {/* Open/closed badge */}
          <View
            style={{
              position: "absolute",
              top: 8,
              right: 8,
              backgroundColor: COLORS.pillOnPhoto,
              borderRadius: 8,
              paddingHorizontal: 7,
              paddingVertical: 3,
            }}
          >
            <Text
              style={{
                fontSize: 9,
                fontWeight: "700",
                color:
                  item.isOpen === true
                    ? COLORS.successText
                    : item.isOpen === false
                    ? COLORS.dangerText
                    : COLORS.dim,
              }}
            >
              {item.isOpen === true
                ? t("card.openNow")
                : item.isOpen === false
                ? t("card.closedNow")
                : t("card.hoursUnknown")}
            </Text>
          </View>
        </View>

        {/* Info */}
        <View style={{ padding: 10, gap: 3 }}>
          <Text
            numberOfLines={2}
            style={{
              fontSize: 14,
              lineHeight: 18,
              fontWeight: "700",
              color: COLORS.cream,
            }}
          >
            {name}
          </Text>

          {cuisines ? (
            <Text numberOfLines={1} style={{ fontSize: 11, fontWeight: "600", color: COLORS.accentText }}>
              {cuisines}
            </Text>
          ) : null}

          {place ? (
            <Text numberOfLines={1} style={{ fontSize: 11, color: COLORS.mute }}>
              📍 {place}
              {distance ? ` · ${distance}` : ""}
            </Text>
          ) : null}

          {item.branchesCount && item.branchesCount > 1 ? (
            <Text style={{ fontSize: 10, color: COLORS.mute }}>
              {t("browse.branchCount", { count: item.branchesCount })}
            </Text>
          ) : null}
        </View>
      </Pressable>
    </Link>
  );
}
