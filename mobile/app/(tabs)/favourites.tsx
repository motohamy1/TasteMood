import {
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Link } from "expo-router";

import { useAuthStore, selectIsSignedIn } from "@/lib/auth-store";
import { useSavedDishes, useUnsaveDish } from "@/lib/saved-dishes";
import { DishCard } from "@/components/dish-card";
import { ProfileButton } from "@/components/profile-button";
import { DishSkeletonGrid } from "@/components/dish-skeleton";
import { EmptyState } from "@/components/empty-state";
import { AmbientGlow } from "@/components/ambient-glow";
import { useT } from "@/i18n";

export default function FavouritesScreen() {
  const insets = useSafeAreaInsets();
  const t = useT();
  const isSignedIn = useAuthStore(selectIsSignedIn);

  const { data: dishes, isLoading: loadingDishes } = useSavedDishes();
  const unsaveDishMutation = useUnsaveDish();
  const visibleDishes = dishes ?? [];

  return (
    <View className="flex-1 bg-ink-950 overflow-hidden">
      <AmbientGlow top={80} />
      <ScrollView
        className="flex-1 bg-transparent"
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 110 }}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
      >
        {/* gap on an inner View — ScrollView contentContainer ignores gap on Android */}
        <View className="px-4 gap-3">
        <View className="flex-row items-start gap-3">
          <View className="flex-1 gap-1">
            <Text className="text-[10px] font-semibold uppercase tracking-[0.12em] text-brand-500">
              {t("favourites.saved")} • GET /favourites
            </Text>
            <Text className="text-2xl font-bold text-brand-50">
              {t("favourites.saved")}
            </Text>
            <Text className="text-[13px] text-cream-mute">
              {t("favourites.subtitle")}
            </Text>
          </View>
          <ProfileButton />
        </View>

        {!isSignedIn ? (
          <View className="bg-ink-900 border border-wine rounded-2xl p-4 gap-2">
            <Text className="text-sm font-semibold text-cream">
              {t("favourites.signInTitle")}
            </Text>
            <Text className="text-xs text-cream-mute">
              {t("favourites.signInNote")}
            </Text>
            <Link href="/auth" asChild>
              <Pressable className="bg-brand-500 rounded-full px-4 py-2 self-start mt-1 active:opacity-85">
                <Text className="text-night text-sm font-bold">{t("common.signIn")}</Text>
              </Pressable>
            </Link>
          </View>
        ) : loadingDishes ? (
          <View className="flex-row flex-wrap gap-2.5 mt-2">
            <DishSkeletonGrid count={4} />
          </View>
        ) : visibleDishes.length === 0 ? (
          <EmptyState
            icon="♥"
            title={t("favourites.nothingSaved")}
            description={t("favourites.nothingSavedDesc")}
          />
        ) : (
          <View className="flex-row flex-wrap gap-2.5 mt-2">
            {visibleDishes.map((dish) => (
              <View key={dish.id} className="basis-[48%] flex-1 gap-1.5">
                <DishCard dish={dish} />
                <Pressable
                  onPress={() => unsaveDishMutation.mutate(dish.id)}
                  className="border border-ink-700 rounded-full py-1 items-center active:opacity-70"
                >
                  <Text className="text-[11px] text-cream-mute">{t("common.remove")}</Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}
        </View>
      </ScrollView>
    </View>
  );
}
