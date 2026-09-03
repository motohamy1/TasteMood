import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Link } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useRecommendations } from "@/lib/queries";
import { DishCard } from "@/components/dish-card";
import { DishSkeletonGrid } from "@/components/dish-skeleton";
import { EmptyState } from "@/components/empty-state";
import { cn } from "@/lib/cn";
import type { RecommendationRequest } from "@/types/recommendation";

const QUICK_PROMPTS: Array<{ label: string; payload: Partial<RecommendationRequest> }> = [
  { label: "🌶 Spicy & under 200 EGP", payload: { maxPrice: 200, tasteAttributes: ["SPICY"] } },
  { label: "🥗 Healthy & light", payload: { mealTypes: ["LIGHT"] } },
  { label: "🍰 Sweet treat", payload: { tasteAttributes: ["SWEET"], mealTypes: ["DESSERT"] } },
  { label: "🌱 Vegan", payload: { dietaryRestrictions: ["VEGAN"] } },
  { label: "🎲 Surprise me", payload: { surpriseMe: true } },
];

export default function AiScreen() {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const [activePrompt, setActivePrompt] = useState<number | null>(null);
  const [maxPrice, setMaxPrice] = useState<string>("");

  const payload = useMemo<RecommendationRequest | null>(() => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery && activePrompt === null) return null;
    const base: RecommendationRequest = {
      query: trimmedQuery || undefined,
      maxPrice: maxPrice ? Number(maxPrice) : undefined,
      limit: 6,
    };
    if (activePrompt !== null) {
      return { ...base, ...QUICK_PROMPTS[activePrompt].payload };
    }
    return base;
  }, [query, activePrompt, maxPrice]);

  const { data, isLoading, isError, error } = useRecommendations(
    payload ?? { limit: 6 }
  );

  const recs = data?.recommendations ?? [];

  return (
    <ScrollView
      className="flex-1 bg-brand-50"
      contentContainerClassName="px-4 gap-3"
      contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 32 }}
      contentInsetAdjustmentBehavior="automatic"
    >
      <Text className="text-2xl font-bold text-neutral-900">AI Chef</Text>
      <Text className="text-sm text-neutral-600">
        Describe a craving or pick a mood — we&apos;ll suggest dishes.
      </Text>

      <View className="gap-2 mt-2">
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="e.g. something spicy under 250 EGP"
          placeholderTextColor="#a3a3a3"
          className="bg-white border border-neutral-200 rounded-2xl px-4 py-3 text-sm text-neutral-900"
          multiline
          numberOfLines={2}
        />
        <View className="flex-row items-center gap-2">
          <Text className="text-xs text-neutral-500">Max price (optional)</Text>
          <TextInput
            value={maxPrice}
            onChangeText={setMaxPrice}
            placeholder="250"
            placeholderTextColor="#a3a3a3"
            keyboardType="numeric"
            className="bg-white border border-neutral-200 rounded-full px-3 h-9 text-sm text-neutral-900 min-w-[80px]"
          />
          <Text className="text-xs text-neutral-500">EGP</Text>
        </View>
      </View>

      <View className="flex-row flex-wrap gap-2 mt-1">
        {QUICK_PROMPTS.map((p, i) => {
          const isActive = i === activePrompt;
          return (
            <Pressable
              key={p.label}
              onPress={() => setActivePrompt(isActive ? null : i)}
              className={cn(
                "px-3 py-1.5 rounded-full border",
                isActive
                  ? "bg-brand-500 border-brand-500"
                  : "bg-white border-neutral-200"
              )}
            >
              <Text
                className={cn(
                  "text-xs font-medium",
                  isActive ? "text-white" : "text-neutral-700"
                )}
              >
                {p.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {data?.explanation ? (
        <View className="bg-brand-50 border border-brand-100 rounded-2xl p-3">
          <Text className="text-xs font-semibold text-brand-700 uppercase mb-1">
            Why these?
          </Text>
          <Text className="text-sm text-neutral-800 leading-5">
            {data.explanation}
          </Text>
        </View>
      ) : null}

      {isLoading ? (
        <View className="gap-3 mt-2">
          <ActivityIndicator color="#f97316" />
          <View className="flex-row flex-wrap gap-3">
            <DishSkeletonGrid count={4} />
          </View>
        </View>
      ) : isError ? (
        <EmptyState
          icon="⚠️"
          title="Couldn't get recommendations"
          description={
            (error as Error)?.message ??
            "The AI service may be rate-limited — try again in a minute."
          }
        />
      ) : payload === null ? (
        <EmptyState
          icon="✨"
          title="What are you craving?"
          description="Type a request or tap a mood above to get started."
        />
      ) : recs.length === 0 ? (
        <EmptyState
          icon="🤔"
          title="No matches"
          description="Try loosening your filters."
        />
      ) : (
        <View className="flex-row flex-wrap gap-3 mt-2">
          {recs.map((dish) => (
            <View key={dish.id} className="basis-[48%] flex-1">
              <DishCard dish={dish} />
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}
