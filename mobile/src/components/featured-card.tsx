import { Image } from "expo-image";
import { Link } from "expo-router";
import { Pressable, Text, View } from "react-native";

import type { DishSummary } from "@/types/dish";

interface Props {
  dish: DishSummary;
  rank: number;
}

/**
 * Wide featured card for the home carousel: photo left, info right,
 * rank badge, price + rating row.
 */
export function FeaturedCard({ dish, rank }: Props) {
  return (
    <Link
      href={{ pathname: "/dish/[id]", params: { id: dish.id } }}
      asChild
    >
      <Pressable
        className="flex-row bg-white rounded-3xl overflow-hidden border border-neutral-200 active:opacity-85"
        style={{
          width: 300,
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.06)",
          borderCurve: "continuous",
        }}
      >
        <View>
          <Image
            source={{ uri: dish.imageUrl }}
            style={{ width: 128, height: "100%", minHeight: 148 }}
            className="bg-brand-100"
            contentFit="cover"
            transition={200}
            accessibilityLabel={`${dish.name} photo`}
          />
          <View className="absolute top-2 left-2 bg-neutral-900/80 rounded-full px-2 py-0.5">
            <Text className="text-[11px] font-bold text-white">
              #{rank}
            </Text>
          </View>
        </View>

        <View className="flex-1 p-3 gap-1 justify-center">
          <Text
            numberOfLines={1}
            className="text-base font-bold text-neutral-900"
          >
            {dish.name}
          </Text>
          <Text numberOfLines={1} className="text-xs text-neutral-500">
            {dish.restaurantName}
            {dish.branchName ? ` · ${dish.branchName}` : ""}
          </Text>

          {typeof dish.rating === "number" ? (
            <View className="flex-row items-center gap-1">
              <Text className="text-xs text-amber-500">★</Text>
              <Text className="text-xs font-semibold text-neutral-700">
                {dish.rating.toFixed(1)}
                {dish.reviewCount && dish.reviewCount > 0
                  ? ` (${dish.reviewCount})`
                  : ""}
              </Text>
              <Text className="text-xs text-neutral-400">· {dish.cuisine}</Text>
            </View>
          ) : (
            <Text className="text-xs text-neutral-400">{dish.cuisine}</Text>
          )}

          <View className="flex-row items-center justify-between mt-1">
            <Text className="text-base font-bold text-brand-600">
              {dish.price.toFixed(0)} {dish.currency}
            </Text>
            {dish.tasteAttributes.length > 0 ? (
              <View className="bg-brand-50 px-2 py-0.5 rounded-full border border-brand-100">
                <Text className="text-[10px] text-brand-700 font-medium">
                  {dish.tasteAttributes[0].toLowerCase()}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </Pressable>
    </Link>
  );
}
