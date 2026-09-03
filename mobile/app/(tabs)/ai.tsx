import { useState } from "react";
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
import { RecommendationCard } from "@/components/recommendation-card";
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
  // Requests fire only on explicit action (submit / prompt tap), never on
  // keystroke — POSTing /recommendations per character would burn the AI
  // rate limit and provider budget (CR-04).
  const [submitted, setSubmitted] = useState<RecommendationRequest | null>(
    null
  );

  function buildPayload(promptIdx: number | null): RecommendationRequest | null {
    const trimmedQuery = query.trim();
    if (!trimmedQuery && promptIdx === null) return null;
    const parsedPrice = maxPrice.trim() ? Number(maxPrice) : NaN;
    const base: RecommendationRequest = {
      query: trimmedQuery || undefined,
      maxPrice:
        Number.isFinite(parsedPrice) && parsedPrice > 0 ? parsedPrice : undefined,
      limit: 6,
    };
    return promptIdx !== null
      ? { ...base, ...QUICK_PROMPTS[promptIdx].payload }
      : base;
  }

  function handleSubmit() {
    const request = buildPayload(activePrompt);
    if (request) setSubmitted(request);
  }

  function togglePrompt(idx: number) {
    const next = activePrompt === idx ? null : idx;
    setActivePrompt(next);
    const request = buildPayload(next);
    if (request) setSubmitted(request);
    else if (next === null) setSubmitted(null);
  }

  const { data, isLoading, isError, error } = useRecommendations(submitted);

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
          returnKeyType="search"
          onSubmitEditing={handleSubmit}
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
          <Pressable
            onPress={handleSubmit}
            className="ml-auto bg-brand-500 rounded-full px-4 h-9 items-center justify-center"
          >
            <Text className="text-white text-xs font-semibold">Find dishes</Text>
          </Pressable>
        </View>
      </View>

      <View className="flex-row flex-wrap gap-2 mt-1">
        {QUICK_PROMPTS.map((p, i) => {
          const isActive = i === activePrompt;
          return (
            <Pressable
              key={p.label}
              onPress={() => togglePrompt(i)}
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
      ) : submitted === null ? (
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
          {recs.map((item) => (
            <View key={item.dish.id} className="basis-[48%] flex-1">
              <RecommendationCard item={item} />
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}
