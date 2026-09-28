import { Linking, Pressable, Text, View } from "react-native";
import { Link } from "expo-router";

import type { RecommendationItem } from "@/types/recommendation";
import type { InteractionType } from "@/types/interaction";
import { DishPhoto } from "@/components/dish-photo";
import { cn } from "@/lib/cn";
import { foodEmoji } from "@/lib/food-emoji";
import { displayName, useLang, useT } from "@/i18n";
import { formatDistance, formatPrice } from "@/lib/format";

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
      className={cn(
        "bg-brand-50 border border-cardline rounded-2xl overflow-hidden",
        className
      )}
      style={{ borderCurve: "continuous" }}
    >
      <Link href={{ pathname: "/dish/[id]", params: { id: dish.id } }} asChild>
        <Pressable className="flex-row active:opacity-80">
          <DishPhoto
            uri={dish.imageUrl}
            emoji={foodEmoji(dish)}
            className="w-[108px] min-h-[132px]"
            emojiSize={34}
            accessibilityLabel={`${name} photo`}
          />

          <View className="flex-1 min-w-0 p-3 gap-1.5">
            <Text numberOfLines={2} className="text-[15px] leading-5 font-bold text-oncard">
              {name}
            </Text>
            <Text numberOfLines={1} className="text-xs font-semibold text-oncard-muted">
              {restaurantName}
              {branch?.name ? ` · ${branch.name}` : ""}
            </Text>

            {branch?.address ? (
              <Text numberOfLines={2} className="text-[11px] leading-4 text-oncard-muted">
                {branch.address}
              </Text>
            ) : null}

            <View className="flex-row flex-wrap items-center gap-1.5 pt-0.5">
              <Text className="text-[14px] leading-5 font-extrabold text-oncard-price">
                {formatPrice(dish.price, dish.currency)}
              </Text>
              {isEstimated ? (
                <View className="px-1.5 py-0.5 rounded-full border border-cardline">
                  <Text className="text-[9px] font-semibold text-oncard-muted">
                    {t("dish.estimated")}
                  </Text>
                </View>
              ) : null}
              {dish.status === "ACTIVE" ? (
                <View className="px-1.5 py-0.5 rounded-full border border-cardline">
                  <Text className="text-[9px] font-semibold text-oncard-muted">
                    {t("card.menuListed")}
                  </Text>
                </View>
              ) : null}
            </View>

            {reason ? (
              <Text numberOfLines={2} className="text-[11px] leading-[15px] text-oncard-tag">
                {reason}
              </Text>
            ) : null}
          </View>
        </Pressable>
      </Link>

      <View className="flex-row items-center justify-between border-t border-cardline px-3 py-2">
        <View className="flex-1 flex-row flex-wrap items-center gap-2">
          {branch?.isOpen === true ? (
            <Text className="text-[10px] font-bold text-success-ink">{t("card.openNow")}</Text>
          ) : branch?.isOpen === false ? (
            <Text className="text-[10px] font-bold text-danger">{t("card.closedNow")}</Text>
          ) : (
            <Text className="text-[10px] font-medium text-oncard-muted">
              {t("card.hoursUnknown")}
            </Text>
          )}
          {distance ? (
            <Text className="text-[10px] text-oncard-muted">· {distance}</Text>
          ) : null}
        </View>

        {mapUrl ? (
          <Pressable
            onPress={() => void Linking.openURL(mapUrl)}
            accessibilityRole="button"
            accessibilityLabel={t("card.viewOnMap")}
            className="rounded-xl border border-cardline px-2.5 py-1.5 active:opacity-80"
          >
            <Text className="text-[10px] font-semibold text-oncard">⌖ {t("card.viewOnMap")}</Text>
          </Pressable>
        ) : null}

        {onFeedback ? (
          <View className="flex-row items-center gap-2 pl-2">
            <Text className="text-[9px] text-oncard-muted">{t("card.fitYourMood")}</Text>
            <Pressable
              onPress={() => onFeedback("LIKE")}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={`Like ${name}`}
            >
              <Text className="text-[14px]">👍</Text>
            </Pressable>
            <Pressable
              onPress={() => onFeedback("DISLIKE")}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={`Dislike ${name}`}
            >
              <Text className="text-[14px]">👎</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </View>
  );
}
