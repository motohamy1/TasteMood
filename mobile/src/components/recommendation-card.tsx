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
  const { dish, restaurant, branch, distanceMeters, reason } = item;
  const distance = formatDistance(distanceMeters);

  return (
    <Link href={{ pathname: "/dish/[id]", params: { id: dish.id } }} asChild>
      <Pressable
        className={cn(
          "bg-white rounded-2xl overflow-hidden border border-neutral-200",
          "active:opacity-80",
          className
        )}
        style={{
          boxShadow: "0 2px 6px rgba(0, 0, 0, 0.05)",
          borderCurve: "continuous",
        }}
      >
        <Image
          source={{ uri: dish.imageUrl ?? undefined }}
          className="w-full h-40 bg-neutral-100"
          contentFit="cover"
          transition={200}
          accessibilityLabel={`${dish.name} photo`}
        />

        <View className="p-3 gap-1">
          <Text
            numberOfLines={1}
            className="text-base font-semibold text-neutral-900"
          >
            {dish.name}
          </Text>

          <Text numberOfLines={1} className="text-xs text-neutral-500">
            {restaurant.name}
            {branch?.name ? ` · ${branch.name}` : ""}
            {distance ? ` · ${distance}` : ""}
          </Text>

          <View className="flex-row items-center justify-between mt-1">
            <Text className="text-base font-bold text-brand-600">
              {formatPrice(dish.price, dish.currency)}
            </Text>
            {branch?.isOpen ? (
              <Text className="text-[10px] font-semibold text-emerald-600 uppercase">
                Open now
              </Text>
            ) : null}
          </View>

          {reason ? (
            <Text numberOfLines={3} className="text-[11px] text-brand-700 mt-1">
              {reason}
            </Text>
          ) : null}
        </View>
      </Pressable>
    </Link>
  );
}
