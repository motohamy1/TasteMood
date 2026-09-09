import { Image } from "expo-image";
import { Link } from "expo-router";
import { Pressable, Text, View } from "react-native";

import type { DishSummary } from "@/types/dish";
import { cn } from "@/lib/cn";
import { formatPrice } from "@/lib/format";

interface Props {
  dish: DishSummary;
  className?: string;
}

export function DishCard({ dish, className }: Props) {
  return (
    <Link
      href={{ pathname: "/dish/[id]", params: { id: dish.id } }}
      asChild
    >
      <Pressable
        className={cn(
          "bg-brand-50 border border-cardline rounded-2xl overflow-hidden",
          "active:opacity-80",
          className
        )}
        style={{ borderCurve: "continuous" }}
      >
        <Image
          source={{ uri: dish.imageUrl }}
          className="w-full h-[88px] bg-wine-deep"
          contentFit="cover"
          transition={200}
          accessibilityLabel={`${dish.name} photo`}
        />

        <View className="p-2.5 gap-0.5">
          <Text
            numberOfLines={1}
            className="text-[13px] font-bold text-night"
          >
            {dish.name}
          </Text>

          <Text numberOfLines={1} className="text-[10px] text-cream-faint">
            {dish.restaurantName}
            {dish.branchName ? ` · ${dish.branchName}` : ""}
          </Text>

          <View className="flex-row items-center gap-1.5 mt-0.5">
            <Text className="text-[13px] font-extrabold text-brand-600">
              {formatPrice(dish.price, dish.currency)}
            </Text>

            {typeof dish.rating === "number" ? (
              <Text className="text-[10px] text-stone-600">
                ★ {dish.rating.toFixed(1)}
                {dish.reviewCount && dish.reviewCount > 0 ? ` (${dish.reviewCount})` : ""}
              </Text>
            ) : null}
          </View>

          {dish.tasteAttributes.length > 0 && (
            <View className="flex-row flex-wrap gap-1 mt-1">
              {dish.tasteAttributes.slice(0, 3).map((tag) => (
                <View
                  key={tag}
                  className="px-1.5 py-px rounded-full border border-brand-100"
                >
                  <Text className="text-[9px] text-brand-700 font-semibold">
                    {tag.toLowerCase().replace(/_/g, " ")}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </Pressable>
    </Link>
  );
}
