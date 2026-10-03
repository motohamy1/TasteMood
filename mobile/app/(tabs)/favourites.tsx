import {
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Link } from "expo-router";
import { Image } from "expo-image";

import { useAuthStore, selectIsSignedIn } from "@/lib/auth-store";
import { useSavedDishes, useUnsaveDish } from "@/lib/saved-dishes";
import { DishCard } from "@/components/dish-card";
import { DishSkeletonGrid } from "@/components/dish-skeleton";
import { AmbientGlow } from "@/components/ambient-glow";
import { tabIcon } from "@/components/tab-icons";
import { useT } from "@/i18n";
import { COLORS } from "@/lib/theme";

export default function FavouritesScreen() {
  const insets = useSafeAreaInsets();
  const t = useT();
  const isSignedIn = useAuthStore(selectIsSignedIn);

  const { data: dishes, isLoading: loadingDishes } = useSavedDishes();
  const unsaveDishMutation = useUnsaveDish();
  const visibleDishes = dishes ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.ink950, overflow: "hidden" }}>
      <AmbientGlow top={0} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: insets.top + 12,
          paddingBottom: insets.bottom + 90,
          paddingHorizontal: 20,
          gap: 0,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 24 }}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text
              style={{
                fontSize: 12,
                fontWeight: "700",
                textTransform: "uppercase",
                letterSpacing: 1,
                color: COLORS.amber,
              }}
            >
              {t("favourites.saved")}
            </Text>
            <Text style={{ fontSize: 26, fontWeight: "800", color: COLORS.cream }}>
              {t("favourites.saved")}
            </Text>
            <Text style={{ fontSize: 13, color: COLORS.mute }}>
              {t("favourites.subtitle")}
            </Text>
          </View>
          <Link href="/profile" asChild>
            <Pressable
              style={{
                width: 42,
                height: 42,
                borderRadius: 21,
                backgroundColor: COLORS.panel,
                borderWidth: 1,
                borderColor: COLORS.line,
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 2px 10px rgba(126,16,57,0.10)",
              }}
            >
              <Image
                source={tabIcon("profile", COLORS.amberCta, 22)}
                style={{ width: 22, height: 22 }}
              />
            </Pressable>
          </Link>
        </View>

        {!isSignedIn ? (
          <View
            style={{
              backgroundColor: COLORS.panel,
              borderRadius: 20,
              padding: 20,
              borderWidth: 1,
              borderColor: COLORS.line,
              gap: 10,
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: "700", color: COLORS.cream }}>
              {t("favourites.signInTitle")}
            </Text>
            <Text style={{ fontSize: 13, color: COLORS.mute }}>
              {t("favourites.signInNote")}
            </Text>
            <Link href="/auth" asChild>
              <Pressable
                style={{
                  backgroundColor: COLORS.amberCta,
                  borderRadius: 20,
                  paddingHorizontal: 20,
                  paddingVertical: 10,
                  alignSelf: "flex-start",
                  marginTop: 4,
                  boxShadow: "0 4px 12px rgba(126,16,57,0.30)",
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: "700", color: COLORS.night }}>
                  {t("common.signIn")}
                </Text>
              </Pressable>
            </Link>
          </View>
        ) : loadingDishes ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 8 }}>
            <DishSkeletonGrid count={4} />
          </View>
        ) : visibleDishes.length === 0 ? (
          <View
            style={{
              alignItems: "center",
              justifyContent: "center",
              paddingVertical: 60,
              gap: 12,
            }}
          >
            <Text style={{ fontSize: 56 }}>♡</Text>
            <Text style={{ fontSize: 18, fontWeight: "700", color: COLORS.cream }}>
              {t("favourites.nothingSaved")}
            </Text>
            <Text style={{ fontSize: 13, color: COLORS.mute, textAlign: "center" }}>
              {t("favourites.nothingSavedDesc")}
            </Text>
          </View>
        ) : (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14, marginTop: 4 }}>
            {visibleDishes.map((dish) => (
              <View key={dish.id} style={{ width: "47%", gap: 8 }}>
                <DishCard dish={dish} />
                <Pressable
                  onPress={() => unsaveDishMutation.mutate(dish.id)}
                  style={{
                    borderWidth: 1,
                    borderColor: COLORS.line,
                    borderRadius: 20,
                    paddingVertical: 7,
                    alignItems: "center",
                    backgroundColor: COLORS.panel,
                  }}
                >
                  <Text style={{ fontSize: 11, color: COLORS.mute }}>{t("common.remove")}</Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
