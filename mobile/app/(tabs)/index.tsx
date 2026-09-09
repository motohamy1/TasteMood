import { useMemo, useState } from "react";
import {
  FlatList,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { Link } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useCuisines, useDishes } from "@/lib/queries";
import { ProfileButton } from "@/components/profile-button";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { DishCard } from "@/components/dish-card";
import { FeaturedCard } from "@/components/featured-card";
import { SectionHeader } from "@/components/section-header";
import { DishSkeletonGrid } from "@/components/dish-skeleton";
import { CategoryPills } from "@/components/category-pills";
import { SearchBar } from "@/components/search-bar";
import { EmptyState } from "@/components/empty-state";
import { AmbientGlow } from "@/components/ambient-glow";
import { pickLabel, useLang, useT } from "@/i18n";

/**
 * Home (Discover): greeting header, search, cuisine pills (API-driven),
 * featured carousel, then the filterable dish grid.
 */
export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const t = useT();
  const lang = useLang();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");

  // Debounce the raw input into the query params (WR-03): without this every
  // keystroke is a new /dishes request and burns the rate-limit budget.
  const debouncedSearch = useDebouncedValue(search.trim());

  const { data: cuisines } = useCuisines();
  const pillOptions = useMemo(
    () => [
      { value: "All", label: t("common.all") },
      ...(cuisines ?? []).map((c) => ({
        value: c.name,
        label: pickLabel(lang, c.name, c.nameAr ?? undefined),
      })),
    ],
    [cuisines, lang, t]
  );

  const params = useMemo(
    () => ({
      search: debouncedSearch || undefined,
      cuisine: category !== "All" ? category : undefined,
      limit: 20,
    }),
    [debouncedSearch, category]
  );

  const { data, isLoading, isError, error, refetch, isRefetching } =
    useDishes(params);

  const dishes = data ?? [];
  const featured = useMemo(() => dishes.slice(0, 5), [dishes]);
  const grid = useMemo(() => dishes.slice(5), [dishes]);
  const isFiltering = debouncedSearch !== "" || category !== "All";

  const hour = new Date().getHours();
  const greeting =
    hour < 12
      ? t("home.greetingMorning")
      : hour < 18
        ? t("home.greetingAfternoon")
        : t("home.greetingEvening");

  return (
    <View className="flex-1 bg-ink-950 overflow-hidden">
      <AmbientGlow top={80} />
      <ScrollView
        className="flex-1 bg-transparent"
        contentContainerStyle={{
          // gap lives on the inner View — ScrollView contentContainer
          // ignores gap on Android.
          paddingTop: insets.top + 12,
          paddingBottom: 110,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor="#DB9338"
            colors={["#DB9338"]}
          />
        }
      >
        <View className="gap-4">
        {/* Header */}
        <View className="px-4 flex-row items-start gap-3">
          <View className="flex-1 gap-1">
            <View className="flex-row items-center gap-1.5">
              <View className="w-2 h-2 rounded-full bg-brand-500" />
              <Text className="text-[10px] font-semibold uppercase tracking-[0.12em] text-brand-500">
                {t("home.discover")} • {greeting}
              </Text>
            </View>
            <Text className="text-2xl font-bold text-brand-50">
              {t("home.cravingTitle")}
            </Text>
            <Text className="text-[13px] text-cream-mute">
              {t("home.cravingSubtitle")}
            </Text>
          </View>
          <ProfileButton />
        </View>

        <View className="px-4">
          <SearchBar value={search} onChangeText={setSearch} />
        </View>

        <View>
          <View className="mb-2">
            <CategoryPills
              options={pillOptions}
              selected={category}
              onSelect={setCategory}
            />
          </View>
        </View>

        {isError ? (
          <View className="px-4">
            <EmptyState
              icon="⚠️"
              title={t("home.loadError")}
              description={
                (error as Error)?.message ??
                "Check your backend is running and EXPO_PUBLIC_API_URL is correct."
              }
            />
          </View>
        ) : isLoading ? (
          <View className="px-4 flex-row flex-wrap gap-3">
            <DishSkeletonGrid count={6} />
          </View>
        ) : dishes.length === 0 ? (
          <View className="px-4">
            <EmptyState
              icon="🔍"
              title={t("home.noDishes")}
              description={t("home.noDishesDesc")}
            />
          </View>
        ) : (
          <>
            {!isFiltering && featured.length > 0 ? (
              <View className="gap-2">
                <View className="px-4">
                  <SectionHeader title={t("home.featured")} actionHref="/dishes" />
                </View>
                <FlatList
                  data={featured}
                  horizontal
                  keyExtractor={(item) => item.id}
                  showsHorizontalScrollIndicator={false}
                  style={{ flexGrow: 0, height: 168 }}
                  contentContainerStyle={{ paddingHorizontal: 16, gap: 10, alignItems: "center" }}
                  renderItem={({ item, index }) => (
                    <FeaturedCard dish={item} rank={index + 1} />
                  )}
                />
              </View>
            ) : null}

            <View className="px-4 gap-3">
              <SectionHeader
                title={isFiltering ? t("home.results") : t("home.popularNearYou")}
                actionHref="/dishes"
              />
              <View className="flex-row flex-wrap gap-2.5">
                {(isFiltering ? dishes : grid).map((item) => (
                  <View key={item.id} className="basis-[48%] flex-1 min-w-[44%]">
                    <DishCard dish={item} className="flex-1" />
                  </View>
                ))}
              </View>
              {!isFiltering && dishes.length > 5 ? (
                <Link href="/dishes" asChild>
                  <Text className="text-center text-sm font-semibold text-brand-500 mt-1">
                    {t("home.browseAll")}
                  </Text>
                </Link>
              ) : null}
            </View>
          </>
        )}
        </View>
      </ScrollView>
    </View>
  );
}
