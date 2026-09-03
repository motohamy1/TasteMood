import { Image } from "expo-image";
import { Link } from "expo-router";
import { Pressable, Text, View } from "react-native";

import type { DishSummary } from "@/types/dish";
import { cn } from "@/lib/cn";

interface Props {
  dish: DishSummary;
  className?: string;
}

function formatPrice(value: number, currency: string) {
  return `${value.toFixed(0)} ${currency}`;
}

export function DishCard({ dish, className }: Props) {
  return (
    <Link
      href={{ pathname: "/dish/[id]", params: { id: dish.id } }}
      asChild
    >
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
          source={{ uri: dish.imageUrl }}
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
            {dish.restaurantName}
            {dish.branchName ? ` · ${dish.branchName}` : ""}
          </Text>

          <View className="flex-row items-center justify-between mt-1">
            <Text className="text-base font-bold text-brand-600">
              {formatPrice(dish.price, dish.currency)}
            </Text>

            {typeof dish.rating === "number" ? (
              <View className="flex-row items-center gap-1">
                <Text className="text-xs">★</Text>
                <Text className="text-xs text-neutral-700">
                  {dish.rating.toFixed(1)}
                  {dish.reviewCount && dish.reviewCount > 0 ? ` (${dish.reviewCount})` : ""}
                </Text>
              </View>
            ) : null}
          </View>

          {dish.tasteAttributes.length > 0 && (
            <View className="flex-row flex-wrap gap-1 mt-1">
              {dish.tasteAttributes.slice(0, 3).map((tag) => (
                <View
                  key={tag}
                  className="bg-brand-50 px-2 py-0.5 rounded-full border border-brand-100"
                >
                  <Text className="text-[10px] text-brand-700 font-medium">
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
