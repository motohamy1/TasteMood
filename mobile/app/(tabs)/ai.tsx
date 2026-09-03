import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useRecommendations } from "@/lib/queries";
import { RecommendationCard } from "@/components/recommendation-card";
import { DishSkeletonGrid } from "@/components/dish-skeleton";
import { EmptyState } from "@/components/empty-state";
import { SectionHeader } from "@/components/section-header";
import { cn } from "@/lib/cn";
import type { RecommendationRequest } from "@/types/recommendation";

const QUICK_PROMPTS: Array<{ label: string; payload: Partial<RecommendationRequest> }> = [
  { label: "🌶 Spicy & under 200 EGP", payload: { maxPrice: 200, tasteAttributes: ["SPICY"] } },
  { label: "🥗 Healthy & light", payload: { mealTypes: ["LIGHT"] } },
  { label: "🍰 Sweet treat", payload: { tasteAttributes: ["SWEET"], mealTypes: ["DESSERT"] } },
  { label: "🌱 Vegan", payload: { dietaryRestrictions: ["VEGAN"] } },
  { label: "🎲 Surprise me", payload: { surpriseMe: true } },
];

const MOODS: Array<{ emoji: string; label: string; query: string }> = [
  { emoji: "🔥", label: "Spicy", query: "something spicy with bold flavors" },
  { emoji: "🥗", label: "Light", query: "something light and healthy" },
  { emoji: "🍔", label: "Comfort", query: "comfort food, rich and filling" },
  { emoji: "🍰", label: "Sweet", query: "a sweet dessert" },
  { emoji: "🌱", label: "Vegan", query: "vegan dish" },
  { emoji: "🌙", label: "Late night", query: "quick late night snack" },
];

/**
 * Explore: browse by mood tiles or describe a craving — powered by the
 * AI recommendations engine. Requests fire only on explicit action
 * (submit / tile / prompt tap), never on keystroke — POSTing
 * /recommendations per character would burn the AI rate limit and
 * provider budget (CR-04).
 */
export default function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const [activePrompt, setActivePrompt] = useState<number | null>(null);
  const [activeMood, setActiveMood] = useState<number | null>(null);
  const [maxPrice, setMaxPrice] = useState<string>("");
  const [submitted, setSubmitted] = useState<RecommendationRequest | null>(
    null
  );

  function buildPayload(
    promptIdx: number | null,
    moodIdx: number | null
  ): RecommendationRequest | null {
    const trimmedQuery = query.trim();
    if (!trimmedQuery && promptIdx === null && moodIdx === null) return null;
    const parsedPrice = maxPrice.trim() ? Number(maxPrice) : NaN;
    const base: RecommendationRequest = {
      query:
        trimmedQuery ||
        (moodIdx !== null ? MOODS[moodIdx].query : undefined),
      maxPrice:
        Number.isFinite(parsedPrice) && parsedPrice > 0 ? parsedPrice : undefined,
      limit: 6,
    };
    return promptIdx !== null
      ? { ...base, ...QUICK_PROMPTS[promptIdx].payload }
      : base;
  }

  function handleSubmit() {
    const request = buildPayload(activePrompt, activeMood);
    if (request) setSubmitted(request);
  }

  function togglePrompt(idx: number) {
    const next = activePrompt === idx ? null : idx;
    setActivePrompt(next);
    if (next !== null) setActiveMood(null);
    const request = buildPayload(next, next !== null ? null : activeMood);
    if (request) setSubmitted(request);
    else if (next === null && activeMood === null) setSubmitted(null);
  }

  function toggleMood(idx: number) {
    const next = activeMood === idx ? null : idx;
    setActiveMood(next);
    if (next !== null) setActivePrompt(null);
    const request = buildPayload(null, next);
    if (request) setSubmitted(request);
    else setSubmitted(null);
  }

  const { data, isLoading, isError, error } = useRecommendations(submitted);

  const recs = data?.recommendations ?? [];

  return (
    <ScrollView
      className="flex-1 bg-[#FFF8F1]"
      contentContainerStyle={{
        paddingTop: insets.top + 12,
        paddingBottom: 96,
        gap: 16,
      }}
      contentInsetAdjustmentBehavior="automatic"
      showsVerticalScrollIndicator={false}
    >
      <View className="px-5 gap-1">
        <Text className="text-2xl font-bold text-neutral-900">Explore</Text>
        <Text className="text-sm text-neutral-600">
          Pick a mood or describe a craving — AI does the rest.
        </Text>
      </View>

      {/* Mood tiles */}
      <View className="gap-2">
        <View className="px-5">
          <SectionHeader title="Browse by mood" />
        </View>
        <View className="px-5 flex-row flex-wrap gap-2">
          {MOODS.map((m, i) => {
            const isActive = i === activeMood;
            return (
              <Pressable
                key={m.label}
                onPress={() => toggleMood(i)}
                className={cn(
                  "flex-row items-center gap-1.5 px-3.5 py-2.5 rounded-2xl border",
                  isActive
                    ? "bg-neutral-900 border-neutral-900"
                    : "bg-white border-neutral-200"
                )}
              >
                <Text className="text-base">{m.emoji}</Text>
                <Text
                  className={cn(
                    "text-xs font-semibold",
                    isActive ? "text-white" : "text-neutral-800"
                  )}
                >
                  {m.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* AI chef input */}
      <View className="px-5 gap-2">
        <SectionHeader title="Ask the AI chef" />
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
          <Text className="text-xs text-neutral-500">Max price</Text>
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
            className="ml-auto bg-brand-500 rounded-full px-4 h-9 items-center justify-center active:opacity-85"
          >
            <Text className="text-white text-xs font-semibold">Find dishes</Text>
          </Pressable>
        </View>

        <View className="flex-row flex-wrap gap-2">
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
      </View>

      {/* Results */}
      <View className="px-5">
        {isLoading ? (
          <View className="gap-3">
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
            icon="🧭"
            title="What are you craving?"
            description="Tap a mood or type a request to get started."
          />
        ) : recs.length === 0 ? (
          <EmptyState
            icon="🤔"
            title="No matches"
            description="Try loosening your filters."
          />
        ) : (
          <View className="gap-2">
            <SectionHeader title="For you" />
            <View className="flex-row flex-wrap gap-3">
              {recs.map((item) => (
                <View key={item.dish.id} className="basis-[48%] flex-1">
                  <RecommendationCard item={item} />
                </View>
              ))}
            </View>
          </View>
        )}
      </View>
    </ScrollView>
  );
}
