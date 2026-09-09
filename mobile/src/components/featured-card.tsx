import { Image } from "expo-image";
import { Link } from "expo-router";
import { Pressable, Text, View } from "react-native";

import type { DishSummary } from "@/types/dish";
import { displayName, useLang, useT } from "@/i18n";
import { formatPrice } from "@/lib/format";

interface Props {
  dish: DishSummary;
  rank: number;
}

/**
 * Wide featured card for the home carousel: photo and info, rank badge,
 * price + rating row — cream card language from the design.
 */
export function FeaturedCard({ dish, rank }: Props) {
  const t = useT();
  const lang = useLang();
  const name = displayName(lang, dish);
  const isEstimated = dish.verificationStatus === "UNVERIFIED";

  return (
    <Link
      href={{ pathname: "/dish/[id]", params: { id: dish.id } }}
      asChild
    >
      <Pressable
        className="flex-row bg-brand-50 border border-cardline rounded-2xl overflow-hidden active:opacity-85"
        style={{ width: 300, height: 168, flexShrink: 0, borderCurve: "continuous" }}
      >
        <View>
          <Image
            source={{ uri: dish.imageUrl }}
            style={{ width: 128, height: 168 }}
            className="bg-wine-deep"
            contentFit="cover"
            transition={200}
            accessibilityLabel={`${name} photo`}
          />
          <View className="absolute top-2 left-2 bg-wine rounded-full px-2 py-0.5">
            <Text className="text-[10px] font-bold text-cream">
              #{rank}
            </Text>
          </View>
        </View>

        <View className="flex-1 p-3 gap-1 justify-center">
          <Text
            numberOfLines={1}
            className="text-[13px] font-bold text-night"
          >
            {name}
          </Text>
          <Text numberOfLines={1} className="text-[10px] text-cream-faint">
            {displayName(lang, { name: dish.restaurantName, nameEn: dish.restaurantNameEn })}
            {dish.branchName ? ` · ${dish.branchName}` : ""}
          </Text>

          {typeof dish.rating === "number" ? (
            <View className="flex-row items-center gap-1">
              <Text className="text-[11px] text-brand-500">★</Text>
              <Text className="text-[11px] font-semibold text-stone-600">
                {dish.rating.toFixed(1)}
                {dish.reviewCount && dish.reviewCount > 0
                  ? ` (${dish.reviewCount})`
                  : ""}
              </Text>
              <Text className="text-[10px] text-cream-faint">· {dish.cuisine}</Text>
            </View>
          ) : (
            <Text className="text-[10px] text-cream-faint">{dish.cuisine}</Text>
          )}

          <View className="flex-row items-center justify-between mt-0.5">
            <Text className="text-[13px] font-extrabold text-brand-600">
              {formatPrice(dish.price, dish.currency)}
            </Text>
            <View className="flex-row items-center gap-1">
              {isEstimated ? (
                <View className="px-1.5 py-px rounded-full border border-ink-700">
                  <Text className="text-[8px] font-semibold text-cream-mute">
                    {t("dish.estimated")}
                  </Text>
                </View>
              ) : null}
              {dish.tasteAttributes.length > 0 ? (
                <View className="px-1.5 py-px rounded-full border border-brand-100">
                  <Text className="text-[9px] text-brand-700 font-semibold">
                    {dish.tasteAttributes[0].toLowerCase()}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>
      </Pressable>
    </Link>
  );
}
