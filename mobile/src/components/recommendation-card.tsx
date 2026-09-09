import { Image } from "expo-image";
import { Link } from "expo-router";
import { Pressable, Text, View } from "react-native";

import type { RecommendationItem } from "@/types/recommendation";
import { cn } from "@/lib/cn";
import { formatDistance, formatPrice } from "@/lib/format";

interface Props {
  item: RecommendationItem;
  className?: string;
}

export function RecommendationCard({ item, className }: Props) {
  // Never crash the grid on a malformed item.
  if (!item?.dish?.id) return null;
  const { dish, restaurant, branch, distanceMeters, reason } = item;
  const distance = formatDistance(distanceMeters);

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
          accessibilityLabel={`${dish.name} photo`}
        />

        <View className="p-2.5 gap-1">
          <Text
            numberOfLines={1}
            className="text-[13px] leading-4 font-bold text-night"
          >
            {dish.name}
          </Text>

          <Text numberOfLines={1} className="text-[10px] leading-3 text-cream-faint">
            {restaurant?.name ?? "Unknown restaurant"}
            {branch?.name ? ` · ${branch.name}` : ""}
            {distance ? ` · ${distance}` : ""}
          </Text>

          <View className="flex-row items-center gap-2">
            <Text className="text-[13px] leading-4 font-extrabold text-brand-600">
              {formatPrice(dish.price, dish.currency)}
            </Text>
            {branch?.isOpen ? (
              <Text className="text-[8px] leading-[10px] font-bold text-emerald-600 uppercase">
                Open now
              </Text>
            ) : null}
          </View>

          {reason ? (
            <Text numberOfLines={3} className="text-[11px] leading-[15px] text-brand-700">
              {reason}
            </Text>
          ) : null}
        </View>
      </Pressable>
    </Link>
  );
}
