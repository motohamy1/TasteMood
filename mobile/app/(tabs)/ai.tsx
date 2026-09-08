import { useMemo, useState } from "react";
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
import { ProfileButton } from "@/components/profile-button";
import { RecommendationCard } from "@/components/recommendation-card";
import { DishSkeletonGrid } from "@/components/dish-skeleton";
import { EmptyState } from "@/components/empty-state";
import { AmbientGlow } from "@/components/ambient-glow";
import { cn } from "@/lib/cn";
import { COLORS } from "@/lib/theme";
import type { RecommendationRequest } from "@/types/recommendation";

const QUICK_PROMPTS: Array<{ label: string; payload: Partial<RecommendationRequest> }> = [
  { label: "Spicy & under 200 EGP", payload: { maxPrice: 200, tasteAttributes: ["SPICY"] } },
  { label: "Healthy & light", payload: { mealTypes: ["LIGHT"] } },
  { label: "Sweet treat", payload: { tasteAttributes: ["SWEET"], mealTypes: ["DESSERT"] } },
  { label: "Vegan", payload: { dietaryRestrictions: ["VEGAN"] } },
  { label: "Surprise me", payload: { surpriseMe: true } },
];

const MOODS: Array<{ emoji: string; label: string; query: string }> = [
  { emoji: "🔥", label: "Spicy", query: "something spicy with bold flavors" },
  { emoji: "🥗", label: "Light", query: "something light and healthy" },
  { emoji: "🍔", label: "Comfort", query: "comfort food, rich and filling" },
  { emoji: "🍰", label: "Sweet", query: "a sweet dessert" },
  { emoji: "🌱", label: "Vegan", query: "vegan dish" },
  { emoji: "🌙", label: "Late night", query: "quick late night snack" },
];

function CapsLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text className="text-[10px] font-semibold uppercase tracking-[0.12em] text-cream-mute">
      {children}
    </Text>
  );
}

/**
 * Explore (AI Chef): describe a craving or pick a mood — powered by the AI
 * recommendations engine. Requests fire only on explicit action (submit /
 * tile / prompt tap), never on keystroke — POSTing /recommendations per
 * character would burn the AI rate limit and provider budget (CR-04).
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

  // Drop malformed items (missing dish) and dedupe by dish id — the
  // backend can return the same dish twice, and duplicate React keys
  // crash the whole results grid (thrown at the key={...} line).
  const recs = useMemo(() => {
    const seen = new Set<string>();
    return (data?.recommendations ?? []).filter((item) => {
      const id = item?.dish?.id;
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }, [data]);
  const intentTastes = submitted?.tasteAttributes ?? [];
  const intentPrice = submitted?.maxPrice;

  return (
    <View className="flex-1 bg-ink-950 overflow-hidden">
      <AmbientGlow />
      <ScrollView
        className="flex-1 bg-transparent"
        contentContainerStyle={{
          // gap lives on the inner View — ScrollView contentContainer
          // ignores gap on Android.
          paddingTop: insets.top + 12,
          paddingBottom: 110,
        }}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View className="gap-4">
        {/* Header */}
        <View className="px-4 flex-row items-start gap-3">
          <View className="flex-1 gap-1">
            <View className="flex-row items-center gap-1.5">
              <View className="w-2 h-2 rounded-full bg-brand-500" />
              <Text className="text-[10px] font-semibold uppercase tracking-[0.12em] text-brand-500">
                AI chef • Online
              </Text>
            </View>
            <Text className="text-2xl font-bold text-brand-50">
              What are you craving?
            </Text>
            <Text className="text-sm text-cream-mute leading-5">
              Describe a craving or pick a mood — the AI chef maps it to real
              dishes near you.
            </Text>
          </View>
          <ProfileButton />
        </View>

        {/* Craving input pill */}
        <View className="px-4">
          <View className="flex-row items-center gap-2 bg-ink-900 border border-brand-500 rounded-full pl-4 pr-1.5 py-1.5">
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="e.g. something spicy under 250 EGP…"
              placeholderTextColor={COLORS.mute}
              className="flex-1 text-[13px] text-cream"
              returnKeyType="search"
              onSubmitEditing={handleSubmit}
            />
            <TextInput
              value={maxPrice}
              onChangeText={setMaxPrice}
              placeholder="250 EGP"
              placeholderTextColor={COLORS.mute}
              keyboardType="numeric"
              className="w-[72px] text-center text-[11px] font-bold text-cream bg-ink-700 rounded-full py-1"
            />
            <Pressable
              onPress={handleSubmit}
              accessibilityRole="button"
              accessibilityLabel="Find dishes"
              className="w-9 h-9 rounded-full bg-brand-500 items-center justify-center active:opacity-85"
            >
              <Text className="text-[16px] font-bold text-night">↑</Text>
            </Pressable>
          </View>

          {/* Quick prompt chips */}
          <View className="flex-row flex-wrap gap-1.5 mt-3">
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
                      : "border-ink-700"
                  )}
                >
                  <Text
                    className={cn(
                      "text-[11px]",
                      isActive
                        ? "font-semibold text-night"
                        : "font-medium text-cream"
                    )}
                  >
                    {p.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Moods */}
        <View className="px-4 gap-2">
          <CapsLabel>Browse by mood</CapsLabel>
          <View className="flex-row flex-wrap gap-1.5">
            {MOODS.map((m, i) => {
              const isActive = i === activeMood;
              return (
                <Pressable
                  key={m.label}
                  onPress={() => toggleMood(i)}
                  className={cn(
                    "flex-row items-center gap-1.5 px-3 py-1.5 rounded-full border",
                    isActive
                      ? "bg-brand-500 border-brand-500"
                      : "border-ink-700"
                  )}
                >
                  <Text className="text-[13px]">{m.emoji}</Text>
                  <Text
                    className={cn(
                      "text-[11px]",
                      isActive
                        ? "font-semibold text-night"
                        : "font-medium text-cream"
                    )}
                  >
                    {m.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Echo of the submitted craving */}
        {submitted?.query ? (
          <View className="px-4 items-end gap-1.5">
            <View
              className="bg-brand-500 px-3.5 py-2.5 max-w-[85%]"
              style={{
                borderTopLeftRadius: 18,
                borderTopRightRadius: 18,
                borderBottomLeftRadius: 18,
                borderBottomRightRadius: 4,
              }}
            >
              <Text className="text-sm font-medium text-night leading-5">
                {submitted.query}
              </Text>
            </View>
            <Text className="text-[10px] font-semibold uppercase text-cream-mute">
              Query{submitted.maxPrice ? ` • maxPrice ${submitted.maxPrice}` : ""}
              {" • limit 6"}
            </Text>
          </View>
        ) : null}

        {/* Backend-intent panel */}
        {submitted !== null ? (
          <View className="px-4">
            <View className="bg-ink-900 border border-wine rounded-2xl p-3 gap-2">
              <Text className="text-xs font-semibold text-brand-50">
                Interpreted as — backend intent
              </Text>
              <View className="flex-row flex-wrap items-center gap-1.5">
                {intentTastes.map((t) => (
                  <View
                    key={t}
                    className="bg-wine px-2.5 py-1 rounded-full"
                  >
                    <Text className="text-[11px] font-semibold text-cream">
                      {t}
                    </Text>
                  </View>
                ))}
                {intentPrice ? (
                  <View className="bg-wine px-2.5 py-1 rounded-full">
                    <Text className="text-[11px] font-semibold text-cream">
                      ≤ {intentPrice} EGP
                    </Text>
                  </View>
                ) : null}
                {submitted.query ? (
                  <View className="border border-ink-700 px-2.5 py-1 rounded-full">
                    <Text className="text-[11px] font-semibold text-cream-mute" numberOfLines={1}>
                      free-text query
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
          </View>
        ) : null}

        {/* Results */}
        <View className="px-4">
          {isLoading ? (
            <View className="gap-3">
              <View className="flex-row items-center gap-1.5 bg-ink-900 border border-ink-700 rounded-xl px-2.5 py-2 self-start">
                <ActivityIndicator size="small" color={COLORS.amber} />
                <CapsLabel>Loading • AI chef thinking</CapsLabel>
              </View>
              <View className="flex-row flex-wrap gap-3">
                <DishSkeletonGrid count={4} />
              </View>
            </View>
          ) : isError ? (
            <View className="flex-row items-center gap-1.5 bg-brand-950 border border-[#7F1D1D] rounded-xl px-2.5 py-2">
              <Text className="text-xs">⚠️</Text>
              <Text className="text-[10px] font-semibold uppercase text-[#FECACA] flex-1">
                {(error as Error)?.message ??
                  "The AI service may be rate-limited — retry in a minute."}
              </Text>
            </View>
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
            <View className="gap-3">
              <CapsLabel>For you • {recs.length} picks</CapsLabel>
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
        </View>
      </ScrollView>
    </View>
  );
}
