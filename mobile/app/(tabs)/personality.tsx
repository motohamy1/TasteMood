import { useMemo, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { Link } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useMyPreferences, useRecommendations } from "@/lib/queries";
import { useAuthStore, selectIsSignedIn } from "@/lib/auth-store";
import {
  formatDistance,
  useClock,
  useLiveContext,
  type MealSlot,
} from "@/lib/live-context";
import { RecommendationCard } from "@/components/recommendation-card";
import { ProfileButton } from "@/components/profile-button";
import { DishSkeletonGrid } from "@/components/dish-skeleton";
import { EmptyState } from "@/components/empty-state";
import { AmbientGlow } from "@/components/ambient-glow";
import type { RecommendationItem, RecommendationRequest } from "@/types/recommendation";
import type { MealCharacteristic } from "@/types/dish";

const PICK_LIMIT = 6;
const DRINK_LIMIT = 4;
const GRID_CAP = 4;

const SLOT_LABELS: Record<MealSlot, { word: string; emoji: string }> = {
  breakfast: { word: "breakfast", emoji: "🌅" },
  lunch: { word: "lunch", emoji: "🕛" },
  dinner: { word: "dinner", emoji: "🌆" },
  "late-night": { word: "late-night", emoji: "🌙" },
};

const SLOT_MEALS: Record<MealSlot, MealCharacteristic> = {
  breakfast: "BREAKFAST",
  lunch: "LUNCH",
  dinner: "DINNER",
  "late-night": "SNACK",
};

const PRICE_CAPS: Record<string, number | undefined> = {
  BUDGET: 150,
  MODERATE: 350,
  EXPENSIVE: 800,
  LUXURY: undefined,
};

function archetypeName(spice: number, cuisines: number): string {
  if (spice >= 4 && cuisines >= 3) return "THE SPICY EXPLORER";
  if (spice >= 3) return "THE HEAT SEEKER";
  if (spice <= 1 && cuisines <= 1) return "THE COMFORT PURIST";
  return "THE CURIOUS GRAZER";
}

function dedupe(items: RecommendationItem[]): RecommendationItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const id = item?.dish?.id;
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

/** Food first, drinks woven in after every other pick — Paper shows one mixed grid. */
function interleave(food: RecommendationItem[], drinks: RecommendationItem[]) {
  const out: RecommendationItem[] = [];
  const seen = new Set<string>();
  // A dish can appear in BOTH result sets (a beverage-tagged "food" hit) —
  // dedupe across the merged list or the duplicate React key crashes the grid.
  const push = (item: RecommendationItem | undefined) => {
    const id = item?.dish?.id;
    if (id && !seen.has(id)) {
      seen.add(id);
      out.push(item);
    }
  };
  const max = Math.max(food.length, drinks.length);
  for (let i = 0; i < max; i++) {
    push(food[i]);
    if (i % 2 === 0) push(drinks[i]);
  }
  return out.slice(0, GRID_CAP);
}

function FactorChip({ emoji, label }: { emoji: string; label: string }) {
  return (
    <View className="flex-row items-center gap-[5px] rounded-full bg-ink-900 border border-ink-700 py-1.5 px-[11px]">
      <Text className="text-[11px] leading-[14px]">{emoji}</Text>
      <Text className="text-[11px] leading-[14px] text-cream">{label}</Text>
    </View>
  );
}

function TraitBar({ label, pct }: { label: string; pct: number }) {
  const clamped = Math.max(4, Math.min(100, pct));
  return (
    <View className="gap-1">
      <View className="flex-row justify-between">
        <Text className="text-[9px] leading-[12px] font-semibold uppercase tracking-[0.1em] text-cream-mute">
          {label}
        </Text>
        <Text className="text-[9px] leading-[12px] font-bold text-brand-50">
          {clamped}%
        </Text>
      </View>
      <View className="h-[4px] rounded-[2px] bg-ink-700 overflow-hidden">
        <View
          className="h-[4px] rounded-[2px] bg-brand-500"
          style={{ width: `${clamped}%` }}
        />
      </View>
    </View>
  );
}

/**
 * Personality — mirrors the Paper artboard 1:1: archetype card with trait
 * bars, five live-factor chips (weather, time-of-day, place + distance,
 * budget, state), a mixed food+drinks pick grid and a "why these fit"
 * footer. Two structured POST /recommendations fire per factor change only.
 */
export default function PersonalityScreen() {
  const insets = useSafeAreaInsets();
  const isSignedIn = useAuthStore(selectIsSignedIn);
  const { data: prefs, isLoading: loadingPrefs } = useMyPreferences();

  const clock = useClock();
  const live = useLiveContext();
  const [clockTick, setClockTick] = useState(0);

  const slot = SLOT_LABELS[clock.slot];
  const meal = SLOT_MEALS[clock.slot];

  const spice = prefs?.spicePreference ?? 0;
  const cuisines = prefs?.preferredCuisines ?? [];
  const diet = prefs?.dietaryRestrictions ?? [];
  const maxPrice = prefs?.preferredPriceRange
    ? PRICE_CAPS[prefs.preferredPriceRange]
    : undefined;

  const foodPayload: RecommendationRequest = useMemo(
    () => ({
      mealTypes: [meal],
      cuisines: cuisines.length ? cuisines : undefined,
      tasteAttributes: spice >= 3 ? ["SPICY"] : undefined,
      dietaryRestrictions: diet.length ? diet : undefined,
      maxPrice,
      limit: PICK_LIMIT,
    }),
    // clockTick keeps the payload key fresh on pull-to-refresh
    [meal, spice, maxPrice, diet.join(","), cuisines.join(","), clockTick]
  );

  const drinkPayload: RecommendationRequest = useMemo(
    () => ({ mealTypes: ["BEVERAGE"], limit: DRINK_LIMIT }),
    [clockTick]
  );

  const food = useRecommendations(foodPayload);
  const drinks = useRecommendations(drinkPayload);

  const picks = useMemo(() => interleave(
    dedupe(food.data?.recommendations ?? []),
    dedupe(drinks.data?.recommendations ?? [])
  ), [food.data, drinks.data]);

  const avgMatch = useMemo(() => {
    const all = dedupe(food.data?.recommendations ?? []);
    if (all.length === 0) return null;
    const raw = all.reduce((acc, p) => acc + (p.score ?? 0), 0) / all.length;
    return Math.round(raw <= 1 ? raw * 100 : raw);
  }, [food.data]);

  const nearestDistance = formatDistance(food.data?.recommendations?.[0]?.distanceMeters);

  const refreshing = food.isRefetching || drinks.isRefetching;
  function onRefresh() {
    setClockTick((t) => t + 1);
    void food.refetch();
    void drinks.refetch();
  }

  const heatPct = spice * 20;
  const adventurePct =
    cuisines.length * 25 + (diet.length ? 0 : 12) + Math.min(12, spice * 3);

  const weatherLabel =
    live.tempC !== null
      ? `${live.tempC}°C · ${live.condition ?? "outside"}`
      : live.loading
        ? "checking weather…"
        : "weather off";
  const placeLabel =
    live.city
      ? `${live.city}${nearestDistance ? ` · ${nearestDistance}` : ""}`
      : live.loading
        ? "locating…"
        : "location off";

  return (
    <View className="flex-1 bg-ink-950 overflow-hidden">
      <AmbientGlow top={80} />
      <ScrollView
        className="flex-1 bg-transparent"
        contentContainerStyle={{
          // Gap lives on an inner View: gap in a ScrollView
          // contentContainerStyle is unreliable on Android.
          paddingTop: insets.top + 8,
          paddingBottom: 110,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#DB9338"
            colors={["#DB9338"]}
          />
        }
      >
        <View className="gap-3.5">
        {/* Header */}
        <View className="px-4 flex-row items-start gap-3">
          <View className="flex-1 gap-1">
            <View className="flex-row items-center gap-1.5">
              <View className="w-2 h-2 rounded-full bg-brand-500" />
              <Text className="text-[10px] leading-[12px] font-semibold uppercase tracking-[0.12em] text-brand-500">
                Personality • GET /recs?live=true
              </Text>
            </View>
            <Text className="text-[24px] leading-[28px] font-bold text-brand-50">
              Your taste, decoded.
            </Text>
            <Text className="text-[13px] leading-[16px] text-cream-mute">
              Picks shaped by who you are — and what&apos;s happening right now.
            </Text>
          </View>
          <ProfileButton />
        </View>

        {/* Archetype card */}
        <View className="px-4">
          <View className="bg-ink-900 border border-ink-700 rounded-2xl p-3.5 gap-3">
            <View className="flex-row items-center gap-2.5">
              <View className="w-[38px] h-[38px] rounded-[10px] bg-wine-deep items-center justify-center shrink-0">
                <Text className="text-[18px] leading-[22px]">🌶️</Text>
              </View>
              <View className="flex-1 gap-0.5">
                <Text className="text-[10px] leading-[12px] font-semibold tracking-[0.12em] text-brand-500 uppercase">
                  {loadingPrefs && isSignedIn
                    ? "Reading your profile…"
                    : archetypeName(spice, cuisines.length)}
                </Text>
                <Text className="text-[11px] leading-[14px] text-cream-mute">
                  {isSignedIn && avgMatch !== null
                    ? `${avgMatch}% match with this week's picks`
                    : isSignedIn
                      ? "Mapping your taste to tonight's picks"
                      : "Sign in to map food + drinks to your personality"}
                </Text>
              </View>
              <Link href="/profile" asChild>
                <Pressable hitSlop={8}>
                  <Text className="text-[11px] leading-[14px] font-semibold text-brand-500">
                    Edit
                  </Text>
                </Pressable>
              </Link>
            </View>

            <TraitBar label="Heat" pct={heatPct} />
            <TraitBar label="Adventure" pct={adventurePct} />

            {isSignedIn ? (
              <Link href="/profile" asChild>
                <Pressable hitSlop={4}>
                  <Text className="text-[11px] leading-[14px] font-semibold text-brand-500">
                    Retake 2-min taste quiz →
                  </Text>
                </Pressable>
              </Link>
            ) : (
              <Link href="/auth" asChild>
                <Pressable hitSlop={4}>
                  <Text className="text-[11px] leading-[14px] font-semibold text-brand-500">
                    Sign in to save your taste profile →
                  </Text>
                </Pressable>
              </Link>
            )}
          </View>
        </View>

        {/* Live factors */}
        <View className="px-4 gap-2">
          <Text className="text-[9px] leading-[12px] font-semibold uppercase tracking-[0.12em] text-cream-mute">
            Live factors shaping this page
          </Text>
          <View className="flex-row flex-wrap gap-2">
            <FactorChip
              emoji={live.emoji ?? "☀️"}
              label={weatherLabel}
            />
            <FactorChip emoji={slot.emoji} label={`${clock.clock} · ${slot.word}`} />
            <FactorChip emoji="📍" label={placeLabel} />
            <FactorChip
              emoji="💸"
              label={maxPrice ? `≤ ${maxPrice} EGP` : "No budget cap"}
            />
            <FactorChip
              emoji={spice >= 3 ? "🌶️" : "🥗"}
              label={
                spice >= 3
                  ? `Spice ${spice}/5`
                  : diet.length
                    ? diet[0].toLowerCase().replace(/_/g, " ")
                    : "Mild-first"
              }
            />
          </View>
        </View>

        {/* Tonight's picks — food + drinks, one mixed grid */}
        <View className="px-4 gap-2.5">
          <View className="flex-row items-baseline justify-between">
            <Text className="text-[13px] leading-[16px] font-bold text-brand-50">
              Tonight&apos;s picks · food + drinks
            </Text>
            <Text className="text-[10px] leading-[12px] font-semibold text-brand-500">
              {picks.length > 0 ? `${picks.length} matched` : ""}
            </Text>
          </View>
          {food.isLoading ? (
            <View className="flex-row flex-wrap gap-2.5">
              <DishSkeletonGrid count={4} />
            </View>
          ) : food.isError ? (
            <View className="flex-row items-center gap-1.5 bg-brand-950 border border-[#7F1D1D] rounded-xl px-2.5 py-2">
              <Text className="text-xs">⚠️</Text>
              <Text className="text-[10px] font-semibold uppercase text-[#FECACA] flex-1">
                {(food.error as Error)?.message ??
                  "The recommendation engine may be rate-limited — pull to retry."}
              </Text>
            </View>
          ) : picks.length === 0 ? (
            <EmptyState
              icon="🤔"
              title="No matches yet"
              description="Widen your preferences in Profile, then pull to refresh."
            />
          ) : (
            <View className="flex-row flex-wrap gap-2.5">
              {picks.map((item) => (
                <View key={item.dish.id} className="basis-[48%] flex-1">
                  <RecommendationCard item={item} />
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Why these fit — right now */}
        <View className="px-4">
          <View className="bg-ink-900 border border-ink-700 rounded-2xl p-3.5 gap-1.5">
            <Text className="text-[13px] leading-[16px] font-bold text-brand-50">
              Why these fit — right now
            </Text>
            <Text className="text-[11px] leading-[15px] text-cream-mute">
              {`${archetypeName(spice, cuisines.length).toLowerCase().replace(/^the /, "")} personality × ${
                live.tempC !== null ? `${live.tempC}°C ${live.condition}` : slot.word
              } × ${slot.word} window${
                maxPrice ? ` → picks under ${maxPrice} EGP` : " → fresh picks for now"
              }${cuisines.length ? `, leaning ${cuisines.slice(0, 2).join("+")}` : ""}.`}
            </Text>
            <Text className="text-[10px] leading-[12px] font-semibold tracking-[0.04em] text-brand-500">
              Factors are live · pull to refresh
            </Text>
          </View>
        </View>
        </View>
      </ScrollView>
    </View>
  );
}
