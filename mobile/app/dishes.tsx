import { useEffect, useMemo, useState } from "react";
import { FlatList, RefreshControl, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useDishes } from "@/lib/queries";
import { DishCard } from "@/components/dish-card";
import { DishSkeletonGrid } from "@/components/dish-skeleton";
import { CategoryPills } from "@/components/category-pills";
import { SearchBar } from "@/components/search-bar";
import { EmptyState } from "@/components/empty-state";

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
    <View className="flex-1 bg-[#FFF8F1]">
      <FlatList
        data={dishes}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperClassName="gap-3"
        contentContainerClassName="px-4"
        contentContainerStyle={{
          paddingTop: 8,
          paddingBottom: insets.bottom + 24,
          gap: 12,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
        }
        ListHeaderComponent={
          <View className="gap-3 mb-2">
            <Text className="text-sm text-neutral-500">
              {isLoading ? "Loading…" : `${dishes.length} dishes`}
            </Text>
            <SearchBar value={search} onChangeText={setSearch} />
            <CategoryPills
              options={CUISINES}
              selected={cuisine}
              onSelect={setCuisine}
            />
          </View>
        }
        renderItem={({ item }) => <DishCard dish={item} className="flex-1" />}
        ListEmptyComponent={
          isLoading ? (
            <View className="flex-row flex-wrap gap-3">
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
          ) : (
            <EmptyState
              icon="🔍"
              title="No dishes found"
              description="Try a different search or cuisine."
            />
          )
        }
      />
    </View>
  );
}
