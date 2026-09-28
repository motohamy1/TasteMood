import { Link } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { DishPhoto } from "@/components/dish-photo";
import { cn } from "@/lib/cn";
import { displayName, pickLabel, useLang, useT } from "@/i18n";
import { formatDistance } from "@/lib/format";
import type { RestaurantCardItem } from "@/types/restaurant";

interface Props {
  item: RestaurantCardItem;
  className?: string;
}

/**
 * Place card for the browse rails and the restaurant detail entry point.
 * Shows what the catalogue actually has today: name, cuisines, area/address,
 * open state, distance. Photos upgrade in place once `coverImageUrl` is filled.
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
        className={cn(
          "bg-brand-50 border border-cardline rounded-2xl overflow-hidden",
          "active:opacity-80",
          className
        )}
        style={{ borderCurve: "continuous" }}
      >
        <View className="flex-row">
          <DishPhoto
            uri={item.photoUrl}
            emoji="🍽"
            className="w-[92px] min-h-[116px] bg-wine-deep"
            emojiSize={30}
            accessibilityLabel={`${name} photo`}
          />

          <View className="flex-1 min-w-0 p-3 gap-1">
            <Text numberOfLines={2} className="text-[15px] leading-5 font-bold text-oncard">
              {name}
            </Text>

            {cuisines ? (
              <Text numberOfLines={1} className="text-[11px] font-semibold text-oncard-tag">
                {cuisines}
              </Text>
            ) : null}

            {place ? (
              <Text numberOfLines={2} className="text-[11px] leading-4 text-oncard-muted">
                {place}
              </Text>
            ) : null}

            <View className="flex-row flex-wrap items-center gap-2 pt-0.5">
              {item.isOpen === true ? (
                <Text className="text-[10px] font-bold text-success-ink">
                  {t("card.openNow")}
                </Text>
              ) : item.isOpen === false ? (
                <Text className="text-[10px] font-bold text-danger">
                  {t("card.closedNow")}
                </Text>
              ) : (
                <Text className="text-[10px] font-medium text-oncard-muted">
                  {t("card.hoursUnknown")}
                </Text>
              )}
              {distance ? (
                <Text className="text-[10px] text-oncard-muted">· {distance}</Text>
              ) : null}
              {item.branchesCount && item.branchesCount > 1 ? (
                <Text className="text-[10px] text-oncard-muted">
                  · {t("browse.branchCount", { count: item.branchesCount })}
                </Text>
              ) : null}
            </View>
          </View>
        </View>
      </Pressable>
    </Link>
  );
}
