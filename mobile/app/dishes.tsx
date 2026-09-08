import { useEffect, useMemo, useState } from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useDishes } from "@/lib/queries";
import { DishCard } from "@/components/dish-card";
import { DishSkeletonGrid } from "@/components/dish-skeleton";
import { CategoryPills } from "@/components/category-pills";
import { SearchBar } from "@/components/search-bar";
import { EmptyState } from "@/components/empty-state";
import { AmbientGlow } from "@/components/ambient-glow";

const CUISINES = [
  "All",
  "Italian",
  "Japanese",
  "Burgers",
  "Asian",
  "Desserts",
  "Healthy",
  "Spicy",
  "Egyptian",
  "Mexican",
];

/**
 * Dishes: the full browse-all screen. Search + cuisine filter over a
 * 2-column grid. Reached from Home's "See all".
 */
export default function DishesScreen() {
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState("");
  const [cuisine, setCuisine] = useState("All");

  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const params = useMemo(
    () => ({
      search: debouncedSearch || undefined,
      cuisine: cuisine !== "All" ? cuisine : undefined,
      limit: 40,
    }),
    [debouncedSearch, cuisine]
  );

  const { data, isLoading, isError, error, refetch, isRefetching } =
    useDishes(params);

  const dishes = data ?? [];

  return (
    <View className="flex-1 bg-ink-950 overflow-hidden">
      <AmbientGlow top={80} />
      <ScrollView
        className="flex-1 bg-transparent"
        contentContainerClassName="px-4"
        contentContainerStyle={{
          paddingTop: 8,
          paddingBottom: insets.bottom + 24,
          gap: 12,
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
        <View className="gap-3">
          <View className="flex-row items-center justify-between">
            <Text className="text-[10px] font-semibold uppercase tracking-[0.12em] text-brand-500">
              {isLoading ? "Loading…" : `${dishes.length} dishes`}
            </Text>
            <Text className="text-[10px] font-semibold uppercase tracking-[0.08em] text-cream-mute">
              pull to refresh
            </Text>
          </View>
          <SearchBar value={search} onChangeText={setSearch} />
          <CategoryPills
            options={CUISINES}
            selected={cuisine}
            onSelect={setCuisine}
          />
        </View>

        {isLoading ? (
          <View className="flex-row flex-wrap gap-2.5">
            <DishSkeletonGrid count={6} />
          </View>
        ) : isError ? (
          <EmptyState
            icon="⚠️"
            title="Couldn't load dishes"
            description={
              (error as Error)?.message ?? "Please try again later."
            }
          />
        ) : dishes.length === 0 ? (
          <EmptyState
            icon="🔍"
            title="No dishes found"
            description="Try a different search or cuisine."
          />
        ) : (
          <View className="flex-row flex-wrap gap-2.5">
            {dishes.map((item) => (
              <View key={item.id} className="basis-[48%] flex-1 min-w-[44%]">
                <DishCard dish={item} className="flex-1" />
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
