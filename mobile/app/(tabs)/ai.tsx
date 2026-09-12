import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";

import { useRecommendations } from "@/lib/queries";
import { ProfileButton } from "@/components/profile-button";
import { RecommendationCard } from "@/components/recommendation-card";
import { DishSkeletonGrid } from "@/components/dish-skeleton";
import { EmptyState } from "@/components/empty-state";
import { AmbientGlow } from "@/components/ambient-glow";
import { tabIcon } from "@/components/tab-icons";
import { useKeyboardVisible } from "@/lib/use-keyboard-visible";
import { cn } from "@/lib/cn";
import { COLORS } from "@/lib/theme";
import {
  MOODS,
  PRICE_PRESETS,
  buildRecommendationRequest,
} from "@/lib/recommendations";
import { useT } from "@/i18n";
import type { RecommendationRequest } from "@/types/recommendation";

function CapsLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text className="text-[10px] font-semibold uppercase tracking-[0.12em] text-cream-mute">
      {children}
    </Text>
  );
}

/**
 * Explore (AI Chef): describe a craving, pick a mood, set a price — powered
 * by the AI recommendations engine. Requests fire only on explicit confirm
 * (submit / Find dishes tap), never on option select or keystroke — POSTing
 * /recommendations per tap would burn the AI rate limit and provider budget
 * (CR-04), and picking e.g. Spicy must not auto-generate until the user
 * confirms. Payload building lives in lib/recommendations.
 */
export default function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const t = useT();
  const keyboardVisible = useKeyboardVisible();
  const [query, setQuery] = useState("");
  const [activeMood, setActiveMood] = useState<number | null>(null);
  const [maxPriceInput, setMaxPriceInput] = useState("");
  const [submitted, setSubmitted] = useState<RecommendationRequest | null>(
    null
  );

  // Staged (unconfirmed) request from the current selections. Nothing is
  // sent to the backend until handleSubmit copies it into `submitted`.
  const pending = useMemo(
    () =>
      buildRecommendationRequest({
        query,
        activeMood,
        maxPriceInput,
      }),
    [query, activeMood, maxPriceInput]
  );

  const hasPendingChanges =
    JSON.stringify(pending ?? null) !== JSON.stringify(submitted ?? null);

  // Price preset highlight derives from the input — one source of truth,
  // so custom values simply leave every preset unhighlighted.
  const parsedPresetPrice = maxPriceInput.trim() ? Number(maxPriceInput) : NaN;
  const activePrice =
    maxPriceInput.trim() === ""
      ? 0
      : PRICE_PRESETS.findIndex(
          (p) => p.maxPrice !== null && p.maxPrice === parsedPresetPrice
        );

  function handleSubmit() {
    // Confirm action: the ONLY place that fires the AI request.
    if (pending) setSubmitted(pending);
    else setSubmitted(null);
  }

  function toggleMood(idx: number) {
    // Select only — do NOT submit. User confirms via Find dishes.
    setActiveMood(activeMood === idx ? null : idx);
  }

  function togglePrice(idx: number) {
    // Select only — do NOT submit. User confirms via Find dishes.
    if (idx === activePrice) {
      setMaxPriceInput("");
      return;
    }
    const preset = PRICE_PRESETS[idx];
    setMaxPriceInput(preset.maxPrice === null ? "" : String(preset.maxPrice));
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
          paddingBottom: 24,
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
              <Text className="text-[10px] font-semibold uppercase tracking-[0.12em] text-accent">
                {t("ai.chefOnline")}
              </Text>
            </View>
            <Text className="text-2xl font-bold text-brand-50">
              {t("home.cravingTitle")}
            </Text>
            <Text className="text-sm text-cream-mute leading-5">
              {t("ai.subtitle")}
            </Text>
          </View>
          <ProfileButton />
        </View>

        {/* Craving input lives in the bottom composer (below, outside
            the ScrollView) — chat-style, above the floating tab bar. */}

        {/* Mood */}
        <View className="px-4 gap-2">
          <CapsLabel>{t("ai.browseByMood")}</CapsLabel>
          <View className="flex-row flex-wrap gap-1.5">
            {MOODS.map((m, i) => {
              const isActive = i === activeMood;
              return (
                <Pressable
                  key={m.labelKey}
                  onPress={() => toggleMood(i)}
                  className={cn(
                    "flex-row items-center gap-1.5 px-3 py-1.5 rounded-full border",
                    isActive
                      ? "bg-brand-cta border-brand-cta"
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
                    {t(m.labelKey)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Price */}
        <View className="px-4 gap-2">
          <CapsLabel>{t("ai.priceSection")}</CapsLabel>
          <View className="flex-row flex-wrap items-center gap-1.5">
            {PRICE_PRESETS.map((p, i) => {
              const isActive = i === activePrice;
              return (
                <Pressable
                  key={p.maxPrice === null ? "any" : String(p.maxPrice)}
                  onPress={() => togglePrice(i)}
                  className={cn(
                    "px-3 py-1.5 rounded-full border",
                    isActive
                      ? "bg-brand-cta border-brand-cta"
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
                    {p.maxPrice === null
                      ? t("ai.priceAny")
                      : t("ai.priceUnder", { price: p.maxPrice })}
                  </Text>
                </Pressable>
              );
            })}
            <TextInput
              value={maxPriceInput}
              onChangeText={setMaxPriceInput}
              placeholder={t("ai.customMaxPlaceholder")}
              placeholderTextColor={COLORS.mute}
              keyboardType="numeric"
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
              className="w-[110px] text-center text-[11px] font-bold text-cream bg-ink-700 border border-ink-700 rounded-full py-1.5 px-2"
            />
          </View>
        </View>

        {/* Confirm bar — selections stage only; AI fires on confirm */}
        {pending !== null && hasPendingChanges ? (
          <View className="px-4">
            <Pressable
              onPress={handleSubmit}
              accessibilityRole="button"
              accessibilityLabel={t("ai.findDishes")}
              className="flex-row items-center justify-center gap-2 bg-brand-cta rounded-full py-3 active:opacity-85"
            >
              <Text className="text-sm font-bold text-night">
                {t("ai.findDishes")}
              </Text>
              <Image
                source={tabIcon("send", COLORS.night, 16)}
                style={{ width: 16, height: 16 }}
              />
            </Pressable>
          </View>
        ) : null}

        {/* Echo of the submitted craving */}
        {submitted?.query ? (
          <View className="px-4 items-end gap-1.5">
            <View
              className="bg-brand-cta px-3.5 py-2.5 max-w-[85%]"
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
              <Text className="text-xs font-semibold text-cream">
                Interpreted as — backend intent
              </Text>
              <View className="flex-row flex-wrap items-center gap-1.5">
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
                <CapsLabel>{t("ai.thinking")}</CapsLabel>
              </View>
              <View className="flex-row flex-wrap gap-3">
                <DishSkeletonGrid count={4} />
              </View>
            </View>
          ) : isError ? (
            <View className="flex-row items-center gap-1.5 bg-danger-bg border border-danger-line rounded-xl px-2.5 py-2">
              <Text className="text-xs">⚠️</Text>
              <Text className="text-[10px] font-semibold uppercase text-danger flex-1">
                {(error as Error)?.message ?? t("ai.rateLimited")}
              </Text>
            </View>
          ) : submitted === null ? (
            <EmptyState
              icon="🧭"
              title={t("ai.emptyTitle")}
              description={t("ai.emptyDesc")}
            />
          ) : recs.length === 0 ? (
            <EmptyState
              icon="🤔"
              title={t("ai.noMatches")}
              description={t("ai.noMatchesDesc")}
            />
          ) : (
            <View className="gap-3">
              <CapsLabel>{t("ai.forYou", { count: recs.length })}</CapsLabel>
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

      {/* Bottom chat composer — fixed above the floating tab bar
          (66px pill + 12px offset), rising with the keyboard. While the
          keyboard is open the tab bar hides, so the composer docks just
          above the keyboard instead of floating at tab-bar clearance. */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View
          className="px-4 pt-2 bg-ink-950"
          style={{ paddingBottom: keyboardVisible ? 12 : insets.bottom + 90 }}
        >
          <View className="flex-row items-center gap-2 bg-ink-900 border border-brand-500 rounded-full pl-4 pr-1.5 py-1.5">
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={t("ai.inputPlaceholder")}
              placeholderTextColor={COLORS.mute}
              className="flex-1 text-[13px] text-cream"
              returnKeyType="search"
              onSubmitEditing={handleSubmit}
            />
            <Pressable
              onPress={handleSubmit}
              accessibilityRole="button"
              accessibilityLabel={t("ai.findDishes")}
              className="w-9 h-9 rounded-full bg-brand-cta items-center justify-center active:opacity-85"
            >
              <Image
                source={tabIcon("send", COLORS.night, 18)}
                style={{ width: 18, height: 18 }}
              />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
