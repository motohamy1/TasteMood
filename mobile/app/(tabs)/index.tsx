import { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  RefreshControl,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useDishes } from "@/lib/queries";
import { DishCard } from "@/components/dish-card";
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

  return (
    <View className="flex-1 bg-brand-50">
      <FlatList
        data={data ?? []}
        keyExtractor={(item) => item.id}
        contentContainerClassName="px-4 pb-24"
        contentContainerStyle={{
          paddingTop: insets.top + 8,
          gap: 12,
        }}
        showsVerticalScrollIndicator={false}
        numColumns={2}
        columnWrapperClassName="gap-3"
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
        }
        ListHeaderComponent={
          <View className="gap-3 mb-2">
            <Text className="text-2xl font-bold text-neutral-900">
              Discover
            </Text>
            <Text className="text-sm text-neutral-600">
              AI-curated dishes tailored to your taste
            </Text>

            <SearchBar value={search} onChangeText={setSearch} />

            <CategoryPills
              options={CATEGORIES}
              selected={category}
              onSelect={setCategory}
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
                (error as Error)?.message ??
                "Check your backend is running and EXPO_PUBLIC_API_URL is correct."
              }
            />
          ) : (
            <EmptyState
              icon="🔍"
              title="No dishes found"
              description="Try a different search or category."
            />
          )
        }
      />
    </View>
  );
}
