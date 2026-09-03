import { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { Link } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useDishes } from "@/lib/queries";
import { DishCard } from "@/components/dish-card";
import { FeaturedCard } from "@/components/featured-card";
import { SectionHeader } from "@/components/section-header";
import { DishSkeletonGrid } from "@/components/dish-skeleton";
import { CategoryPills } from "@/components/category-pills";
import { SearchBar } from "@/components/search-bar";
import { EmptyState } from "@/components/empty-state";

const CATEGORIES = [
  "All",
  "Italian",
  "Japanese",
  "Burgers",
  "Asian",
  "Desserts",
  "Healthy",
  "Spicy",
];

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

/**
 * Home ("Mobile Frame"): greeting header, search, categories,
 * featured carousel, then the filterable dish grid.
 */
export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");

  // Debounce the raw input into the query params (WR-03): without this every
  // keystroke is a new /dishes request and burns the rate-limit budget.
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

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

  return (
    <ScrollView
      className="flex-1 bg-[#FFF8F1]"
      contentContainerStyle={{
        paddingTop: insets.top + 12,
        paddingBottom: 96,
        gap: 16,
      }}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
      }
    >
      {/* Header */}
      <View className="px-5 gap-1">
        <Text className="text-sm text-neutral-500">{greeting()} 👋</Text>
        <Text className="text-2xl font-bold text-neutral-900">
          What are you craving today?
        </Text>
      </View>

      <View className="px-5">
        <SearchBar value={search} onChangeText={setSearch} />
      </View>

      <View>
        <View className="px-5 mb-2">
          <CategoryPills
            options={CATEGORIES}
            selected={category}
            onSelect={setCategory}
          />
        </View>
      </View>

      {isError ? (
        <View className="px-5">
          <EmptyState
            icon="⚠️"
            title="Couldn't load dishes"
            description={
              (error as Error)?.message ??
              "Check your backend is running and EXPO_PUBLIC_API_URL is correct."
            }
          />
        </View>
      ) : isLoading ? (
        <View className="px-5 flex-row flex-wrap gap-3">
          <DishSkeletonGrid count={6} />
        </View>
      ) : dishes.length === 0 ? (
        <View className="px-5">
          <EmptyState
            icon="🔍"
            title="No dishes found"
            description="Try a different search or category."
          />
        </View>
      ) : (
        <>
          {!isFiltering && featured.length > 0 ? (
            <View className="gap-2">
              <View className="px-5">
                <SectionHeader title="Featured" actionHref="/dishes" />
              </View>
              <FlatList
                data={featured}
                horizontal
                keyExtractor={(item) => item.id}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}
                renderItem={({ item, index }) => (
                  <FeaturedCard dish={item} rank={index + 1} />
                )}
              />
            </View>
          ) : null}

          <View className="px-5 gap-2">
            <SectionHeader
              title={isFiltering ? "Results" : "Popular near you"}
              actionHref="/dishes"
            />
            <View className="flex-row flex-wrap gap-3">
              {(isFiltering ? dishes : grid).map((item) => (
                <View key={item.id} className="basis-[48%] flex-1 min-w-[44%]">
                  <DishCard dish={item} className="flex-1" />
                </View>
              ))}
            </View>
            {!isFiltering && dishes.length > 5 ? (
              <Link href="/dishes" asChild>
                <Text className="text-center text-sm font-semibold text-brand-600 mt-1">
                  Browse all dishes →
                </Text>
              </Link>
            ) : null}
          </View>
        </>
      )}
    </ScrollView>
  );
}
