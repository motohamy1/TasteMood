import { Image } from "expo-image";
import { Link } from "expo-router";
import { Pressable, Text, View } from "react-native";

import type { RecommendationItem } from "@/types/recommendation";
import type { InteractionType } from "@/types/interaction";
import { cn } from "@/lib/cn";
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

  // Never crash the grid on a malformed item.
  if (!item?.dish?.id) return null;
  const { dish, restaurant, branch, distanceMeters, reason } = item;
  const distance = formatDistance(distanceMeters);
  const name = displayName(lang, dish);
  const isEstimated = dish.verificationStatus === "UNVERIFIED";

  return (
    <Link href={{ pathname: "/dish/[id]", params: { id: dish.id } }} asChild>
      <Pressable
        className={cn(
          "bg-brand-50 border border-cardline rounded-2xl overflow-hidden",
          "active:opacity-80",
          className
        )}
        style={{ borderCurve: "continuous" }}
      >
        <Image
          source={{ uri: dish.imageUrl ?? undefined }}
          className="w-full h-[84px] bg-wine-deep"
          contentFit="cover"
          transition={200}
          accessibilityLabel={`${name} photo`}
        />

        <View className="p-2.5 gap-1">
          <Text
            numberOfLines={1}
            className="text-[13px] leading-4 font-bold text-oncard"
          >
            {name}
          </Text>

          <Text numberOfLines={1} className="text-[10px] leading-3 text-oncard-muted">
            {restaurant ? displayName(lang, restaurant) : t("card.unknownRestaurant")}
            {branch?.name ? ` · ${branch.name}` : ""}
            {distance ? ` · ${distance}` : ""}
          </Text>

          <View className="flex-row items-center gap-2">
            <Text className="text-[13px] leading-4 font-extrabold text-oncard-price">
              {formatPrice(dish.price, dish.currency)}
            </Text>
            {isEstimated ? (
              <View className="px-1.5 py-px rounded-full border border-cardline">
                <Text className="text-[8px] font-semibold text-oncard-muted">
                  {t("dish.estimated")}
                </Text>
              </View>
            ) : null}
            {branch?.isOpen ? (
              <Text className="text-[8px] leading-[10px] font-bold text-success-ink uppercase">
                {t("card.openNow")}
              </Text>
            ) : null}
          </View>

          {reason ? (
            <Text numberOfLines={3} className="text-[11px] leading-[15px] text-oncard-tag">
              {reason}
            </Text>
          ) : null}

          {onFeedback ? (
            <View className="flex-row items-center gap-1.5 pt-1">
              <Text className="text-[9px] text-oncard-muted flex-1">{t("card.fitYourMood")}</Text>
              <Pressable
                onPress={(event) => {
                  event.stopPropagation();
                  onFeedback("LIKE");
                }}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel={`Like ${name}`}
              >
                <Text className="text-[14px]">👍</Text>
              </Pressable>
              <Pressable
                onPress={(event) => {
                  event.stopPropagation();
                  onFeedback("DISLIKE");
                }}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel={`Dislike ${name}`}
              >
                <Text className="text-[14px]">👎</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </Pressable>
    </Link>
  );
}
