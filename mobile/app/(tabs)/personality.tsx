import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Link } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useMyPreferences, useRecommendations, useUpdateMyPreferences } from "@/lib/queries";
import { useAuthStore, selectIsSignedIn, selectUser } from "@/lib/auth-store";
import {
  formatDistance,
  useClock,
  useLiveContext,
} from "@/lib/live-context";
import {
  CUISINE_OPTIONS,
  DISCOVERY_OPTIONS,
  PERSONALITY_MOODS,
  SLOT_LABELS,
  WEATHER_OPTIONS,
  buildPersonalityRequest,
  getPersonalityMetadata,
  getProfileCompleteness,
  profileSignature,
  type DiscoveryPreference,
  type PersonalityMealSlot,
  type ProfileCompleteness,
  type WeatherCondition,
} from "@/lib/personality";
import {
  emptyPersonalitySession,
  readPersonalitySession,
  todayKey,
  writePersonalitySession,
  type PersonalitySession,
} from "@/lib/personality-session";
import { RecommendationCard } from "@/components/recommendation-card";
import { ProfileButton } from "@/components/profile-button";
import { DishSkeletonGrid } from "@/components/dish-skeleton";
import { EmptyState } from "@/components/empty-state";
import { AmbientGlow } from "@/components/ambient-glow";
import { cn } from "@/lib/cn";
import { COLORS } from "@/lib/theme";
import { pickLabel, useLang, useT } from "@/i18n";
import { recordInteraction } from "@/lib/api";
import type { RecommendationItem, RecommendationRequest } from "@/types/recommendation";
import type { DietaryProperty } from "@/types/dish";
import type { UserPreferences } from "@/types/user";
import type { InteractionType } from "@/types/interaction";
import type { TranslationKey } from "@/i18n/dictionaries";

const DIETARY_OPTIONS: Array<{
  labelKey: TranslationKey;
  value: DietaryProperty[];
}> = [
  { labelKey: "personality.noRestrictions", value: [] },
  { labelKey: "personality.vegetarian", value: ["VEGETARIAN"] },
  { labelKey: "personality.vegan", value: ["VEGAN"] },
  { labelKey: "personality.halal", value: ["HALAL"] },
];

const SPICE_OPTIONS: Array<{ value: number; labelKey: TranslationKey }> = [
  { value: 0, labelKey: "personality.spice0" },
  { value: 1, labelKey: "personality.spice1" },
  { value: 2, labelKey: "personality.spice2" },
  { value: 3, labelKey: "personality.spice3" },
  { value: 4, labelKey: "personality.spice4" },
  { value: 5, labelKey: "personality.spice5" },
];

const PROFILE_STATUS_LABEL: Record<ProfileCompleteness, TranslationKey> = {
  NOT_STARTED: "personality.statusNotStarted",
  IN_PROGRESS: "personality.statusInProgress",
  READY: "personality.statusReady",
};

const SETUP_STEP_LABELS: TranslationKey[] = [
  "personality.stepTaste",
  "personality.stepDietary",
  "personality.stepHeat",
  "personality.stepDiscovery",
];

interface AppliedSnapshot {
  profile: string;
  mood: string | null;
  weather: WeatherCondition | null;
  mealSlot: PersonalityMealSlot | null;
  freeText: string;
  radiusKm: number;
}

function archetypeKey(spice: number, cuisines: number): TranslationKey {
  if (spice >= 4 && cuisines >= 3) return "personality.archetypeSpicyExplorer";
  if (spice >= 3) return "personality.archetypeHeatSeeker";
  if (spice <= 1 && cuisines <= 1) return "personality.archetypeComfortPurist";
  return "personality.archetypeCuriousGrazer";
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

function ToggleChip({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={cn(
        "px-2.5 py-1.5 rounded-full border active:opacity-80",
        active ? "bg-brand-500 border-brand-500" : "border-ink-700"
      )}
    >
      <Text className={cn("text-[11px]", active ? "font-semibold text-night" : "text-cream")}>
        {label}
      </Text>
    </Pressable>
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
        <Text className="text-[9px] leading-[12px] font-bold text-brand-50">{clamped}%</Text>
      </View>
      <View className="h-[4px] rounded-[2px] bg-ink-700 overflow-hidden">
        <View className="h-[4px] rounded-[2px] bg-brand-500" style={{ width: `${clamped}%` }} />
      </View>
    </View>
  );
}

function firstIncompleteSetupStep(prefs?: UserPreferences | null): number {
  if (!prefs) return 0;
  const metadata = getPersonalityMetadata(prefs);
  if (!prefs.preferredCuisines.length) return 0;
  if (!metadata.dietaryConfirmed && !prefs.dietaryRestrictions.length) return 1;
  if (!metadata.spiceConfirmed && prefs.spicePreference === 2) return 2;
  if (!metadata.discoveryPreference) return 3;
  return 0;
}

type FeedbackType = Extract<InteractionType, "LIKE" | "DISLIKE" | "NOT_INTERESTED">;

interface RecommendationResultsProps {
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => Promise<unknown>;
  picks: RecommendationItem[];
  weather: WeatherCondition | null;
  radiusKm: number;
  setRadiusKm: (radiusKm: number) => void;
  onIgnoreWeather: () => void;
  feedback: Record<string, InteractionType>;
  onFeedback?: (item: RecommendationItem, type: FeedbackType) => void;
}

function RecommendationResults({
  isLoading,
  isError,
  error,
  refetch,
  picks,
  weather,
  radiusKm,
  setRadiusKm,
  onIgnoreWeather,
  feedback,
  onFeedback,
}: RecommendationResultsProps) {
  const t = useT();

  return (
    <>
      <View className="px-4 gap-2.5">
        <View className="flex-row items-baseline justify-between">
          <Text className="text-[13px] leading-[16px] font-bold text-brand-50">{t("personality.todaysPicks")}</Text>
          <Text className="text-[10px] leading-[12px] font-semibold text-brand-500">{picks.length ? t("personality.matched", { count: picks.length }) : ""}</Text>
        </View>
        {isLoading ? (
          <View className="flex-row flex-wrap gap-2.5"><DishSkeletonGrid count={4} /></View>
        ) : isError ? (
          <View className="flex-row items-center gap-1.5 bg-brand-950 border border-[#7F1D1D] rounded-xl px-2.5 py-2">
            <Text className="text-xs">⚠️</Text>
            <Text className="text-[10px] font-semibold uppercase text-[#FECACA] flex-1">
              {error?.message ?? t("personality.unavailable")}
            </Text>
            <Pressable onPress={() => void refetch()}><Text className="text-[10px] font-bold text-brand-500">{t("common.retry")}</Text></Pressable>
          </View>
        ) : picks.length === 0 ? (
          <View className="gap-2">
            <EmptyState icon="🤔" title={t("personality.noCloseMatches")} description={t("personality.noCloseMatchesDesc")} />
            <View className="flex-row gap-2">
              {weather ? <Pressable onPress={onIgnoreWeather} className="flex-1 border border-ink-700 rounded-full py-2 items-center"><Text className="text-[10px] font-semibold text-cream">{t("personality.ignoreWeather")}</Text></Pressable> : null}
              {radiusKm === 10 ? <Pressable onPress={() => setRadiusKm(25)} className="flex-1 border border-ink-700 rounded-full py-2 items-center"><Text className="text-[10px] font-semibold text-cream">{t("personality.widen25")}</Text></Pressable> : null}
            </View>
          </View>
        ) : (
          <View className="flex-row flex-wrap gap-2.5">
            {picks.map((item) => (
              <View key={item.dish.id} className="basis-[48%] flex-1">
                <RecommendationCard
                  item={item}
                  onFeedback={onFeedback ? (type) => onFeedback(item, type) : undefined}
                />
                {feedback[item.dish.id] ? <Text className="text-[9px] text-brand-500 text-center mt-1">{t("personality.signalSaved")}</Text> : null}
              </View>
            ))}
          </View>
        )}
      </View>

      {picks.length > 0 ? (
        <View className="px-4">
          <View className="bg-ink-900 border border-ink-700 rounded-2xl p-3.5 gap-2">
            <Text className="text-[13px] leading-[16px] font-bold text-brand-50">{t("personality.whyTheseFit")}</Text>
            <Text className="text-[11px] leading-[15px] text-cream-mute">
              {picks[0]?.reason ?? t("personality.whyTheseFit")}
            </Text>
            <Text className="text-[10px] leading-[12px] font-semibold tracking-[0.04em] text-brand-500">
              {t("personality.aiInterprets")}
            </Text>
          </View>
        </View>
      ) : null}
    </>
  );
}

export default function PersonalityScreen() {
  const insets = useSafeAreaInsets();
  const t = useT();
  const lang = useLang();
  const isSignedIn = useAuthStore(selectIsSignedIn);
  const user = useAuthStore(selectUser);
  const { data: prefs, isLoading: loadingPrefs } = useMyPreferences();
  const updatePrefs = useUpdateMyPreferences();

  const clock = useClock();
  const live = useLiveContext();
  const [session, setSession] = useState<PersonalitySession>(emptyPersonalitySession);
  const [sessionReady, setSessionReady] = useState(false);
  const [profileDraft, setProfileDraft] = useState<UserPreferences | null>(null);
  const [submitted, setSubmitted] = useState<RecommendationRequest | null>(null);
  const [applied, setApplied] = useState<AppliedSnapshot | null>(null);
  const [freeText, setFreeText] = useState("");
  const [radiusKm, setRadiusKm] = useState(10);
  const [setupStep, setSetupStep] = useState(0);
  const [savingSetup, setSavingSetup] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Record<string, InteractionType>>({});

  const effectivePrefs = profileDraft ?? prefs;
  const profileStatus = getProfileCompleteness(effectivePrefs);
  const metadata = getPersonalityMetadata(effectivePrefs);
  const discoveryPreference: DiscoveryPreference = metadata.discoveryPreference ?? "FAMILIAR";
  const weather = session.weatherEnabled
    ? session.weatherOverride ?? live.weatherCategory
    : null;
  const mealSlot = session.timeEnabled
    ? session.mealSlotOverride ?? clock.slot
    : null;

  useEffect(() => {
    setSessionReady(false);
    setProfileDraft(null);
    setSubmitted(null);
    setApplied(null);
    setFreeText("");
    setRadiusKm(10);
    setFeedback({});
  }, [isSignedIn, user?.id]);

  useEffect(() => {
    if (prefs) setProfileDraft(prefs);
  }, [prefs]);

  useEffect(() => {
    let active = true;
    if (!isSignedIn) {
      setSession(emptyPersonalitySession());
      setSessionReady(true);
      return () => {
        active = false;
      };
    }

    void readPersonalitySession(user?.id).then((stored) => {
      if (!active) return;
      setSession(stored);
      setSessionReady(true);
    });

    return () => {
      active = false;
    };
  }, [isSignedIn, user?.id]);

  useEffect(() => {
    if (profileStatus !== "READY") {
      setSetupStep((current) => Math.max(current, firstIncompleteSetupStep(effectivePrefs)));
    }
  }, [effectivePrefs, profileStatus]);

  function currentSnapshot(nextPrefs = effectivePrefs): AppliedSnapshot {
    return {
      profile: profileSignature(nextPrefs),
      mood: session.mood,
      weather,
      mealSlot,
      freeText: freeText.trim(),
      radiusKm,
    };
  }

  function requestFor(nextPrefs = effectivePrefs): RecommendationRequest {
    return buildPersonalityRequest({
      prefs: nextPrefs,
      mood: session.mood,
      weather,
      mealSlot,
      freeText,
      discoveryPreference: getPersonalityMetadata(nextPrefs).discoveryPreference ?? discoveryPreference,
      latitude: live.latitude,
      longitude: live.longitude,
      radiusKm,
    });
  }

  useEffect(() => {
    if (!sessionReady || live.loading || (isSignedIn && loadingPrefs) || submitted) return;
    const request = requestFor();
    setSubmitted(request);
    setApplied(currentSnapshot());
  }, [sessionReady, live.loading, isSignedIn, loadingPrefs, submitted]);

  const isDirty = applied
    ? JSON.stringify(applied) !== JSON.stringify(currentSnapshot())
    : false;

  const recommendation = useRecommendations(submitted);
  const picks = useMemo(
    () => dedupe(recommendation.data?.recommendations ?? []).slice(0, 8),
    [recommendation.data]
  );
  const avgMatch = useMemo(() => {
    if (!picks.length) return null;
    const raw = picks.reduce((sum, item) => sum + (item.score ?? 0), 0) / picks.length;
    return Math.round(raw <= 1 ? raw * 100 : raw);
  }, [picks]);
  const nearestDistance = formatDistance(
    picks.reduce<number | null>((nearest, item) => {
      const distance = item.distanceMeters;
      if (distance == null) return nearest;
      return nearest == null ? distance : Math.min(nearest, distance);
    }, null)
  );

  function persistSession(next: PersonalitySession) {
    setSession(next);
    if (isSignedIn) void writePersonalitySession(next, user?.id);
  }

  function patchSession(patch: Partial<PersonalitySession>) {
    persistSession({ ...session, ...patch });
  }

  function updatePicks() {
    const request = requestFor();
    setSubmitted(request);
    setApplied(currentSnapshot());
  }

  function sendFeedback(item: RecommendationItem, type: InteractionType) {
    if (!isSignedIn) return;
    setFeedback((current) => ({ ...current, [item.dish.id]: type }));
    void recordInteraction({
      dishId: item.dish.id,
      restaurantId: item.restaurant.id,
      branchId: item.branch.id,
      interactionType: type,
    }).catch(() => {
      setFeedback((current) => {
        const next = { ...current };
        delete next[item.dish.id];
        return next;
      });
    });
  }

  async function saveStablePreference(
    patch: Partial<UserPreferences>,
    personalityPatch: Record<string, unknown>
  ) {
    if (!effectivePrefs) return null;
    const currentInferred = effectivePrefs.inferredPreferences ?? {};
    const nextInferred = {
      ...currentInferred,
      personality: {
        ...getPersonalityMetadata(effectivePrefs),
        ...personalityPatch,
      },
    };
    const next = await updatePrefs.mutateAsync({
      ...patch,
      inferredPreferences: nextInferred,
    });
    setProfileDraft(next);
    const request = requestFor(next);
    setSubmitted(request);
    setApplied(currentSnapshot(next));
    return next;
  }

  async function answerSetup(value: string | number | DietaryProperty[]) {
    if (savingSetup || !effectivePrefs) return;
    setSavingSetup(true);
    setSetupError(null);
    try {
      if (setupStep === 0 && typeof value === "string") {
        await saveStablePreference({ preferredCuisines: [value] }, {});
      } else if (setupStep === 1 && Array.isArray(value)) {
        await saveStablePreference(
          { dietaryRestrictions: value },
          { dietaryConfirmed: true }
        );
      } else if (setupStep === 2 && typeof value === "number") {
        await saveStablePreference({ spicePreference: value }, { spiceConfirmed: true });
      } else if (setupStep === 3 && typeof value === "string") {
        await saveStablePreference({}, { discoveryPreference: value });
      }
      setSetupStep((step) => Math.min(3, step + 1));
    } catch (error) {
      setSetupError(error instanceof Error ? error.message : "Could not save that answer.");
    } finally {
      setSavingSetup(false);
    }
  }

  const spice = effectivePrefs?.spicePreference ?? 0;
  const cuisines = effectivePrefs?.preferredCuisines ?? [];
  const refreshing = recommendation.isRefetching;
  const weatherOption = WEATHER_OPTIONS.find((option) => option.value === weather);
  const timeLabel = mealSlot
    ? pickLabel(lang, SLOT_LABELS[mealSlot].word, SLOT_LABELS[mealSlot].labelAr)
    : t("personality.timeNotShaping");

  useEffect(() => {
    const id = setInterval(() => {
      if (todayKey() === session.dateKey) return;
      const next = emptyPersonalitySession();
      setSession(next);
      setSubmitted(null);
      setApplied(null);
      setFreeText("");
      if (isSignedIn) void writePersonalitySession(next, user?.id);
    }, 30_000);
    return () => clearInterval(id);
  }, [isSignedIn, session.dateKey, user?.id]);

  return (
    <View className="flex-1 bg-ink-950 overflow-hidden">
      <AmbientGlow top={80} />
      <ScrollView
        className="flex-1 bg-transparent"
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 110 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void recommendation.refetch()}
            tintColor="#DB9338"
            colors={["#DB9338"]}
          />
        }
      >
        <View className="gap-3.5">
          <View className="px-4 flex-row items-start gap-3">
            <View className="flex-1 gap-1">
              <View className="flex-row items-center gap-1.5">
                <View className="w-2 h-2 rounded-full bg-brand-500" />
                <Text className="text-[10px] leading-[12px] font-semibold uppercase tracking-[0.12em] text-brand-500">
                  {t("personality.live")}
                </Text>
              </View>
              <Text className="text-[24px] leading-[28px] font-bold text-brand-50">
                {t("personality.title")}
              </Text>
              <Text className="text-[13px] leading-[16px] text-cream-mute">
                {t("personality.subtitle")}
              </Text>
            </View>
            <ProfileButton />
          </View>

          <RecommendationResults
            isLoading={recommendation.isLoading}
            isError={recommendation.isError}
            error={recommendation.error as Error | null}
            refetch={recommendation.refetch}
            picks={picks}
            weather={weather}
            radiusKm={radiusKm}
            setRadiusKm={setRadiusKm}
            onIgnoreWeather={() => patchSession({ weatherEnabled: false })}
            feedback={feedback}
            onFeedback={isSignedIn ? sendFeedback : undefined}
          />

          <View className="px-4">
            <View className="bg-ink-900 border border-ink-700 rounded-2xl p-3.5 gap-3">
              <View className="flex-row items-center gap-2.5">
                <View className="w-[38px] h-[38px] rounded-[10px] bg-wine-deep items-center justify-center">
                  <Text className="text-[18px] leading-[22px]">🌶️</Text>
                </View>
                <View className="flex-1 gap-0.5">
                  <Text className="text-[10px] leading-[12px] font-semibold tracking-[0.12em] text-brand-500 uppercase">
                    {loadingPrefs && isSignedIn
                      ? t("personality.readingProfile")
                      : t(archetypeKey(spice, cuisines.length))}
                  </Text>
                  <Text className="text-[11px] leading-[14px] text-cream-mute">
                    {avgMatch !== null
                      ? t("personality.matchWithSession", { pct: avgMatch })
                      : t(PROFILE_STATUS_LABEL[profileStatus])}
                  </Text>
                </View>
                <Link href="/profile" asChild>
                  <Pressable hitSlop={8}>
                    <Text className="text-[11px] leading-[14px] font-semibold text-brand-500">{t("common.edit")}</Text>
                  </Pressable>
                </Link>
              </View>
              <TraitBar label={t("personality.heat")} pct={spice * 20} />
              <TraitBar label={t("personality.adventure")} pct={cuisines.length * 25 + (discoveryPreference === "CURIOUS" ? 25 : 0)} />
              {!isSignedIn ? (
                <Link href="/auth" asChild>
                  <Pressable hitSlop={4}>
                    <Text className="text-[11px] leading-[14px] font-semibold text-brand-500">
                      {t("personality.signInToSave")}
                    </Text>
                  </Pressable>
                </Link>
              ) : null}
            </View>
          </View>

          {isSignedIn && profileStatus !== "READY" ? (
            <View className="px-4">
              <View className="bg-wine-deep border border-wine rounded-2xl p-3.5 gap-3">
                <View className="gap-1">
                  <Text className="text-[13px] font-bold text-brand-50">
                    {profileStatus === "NOT_STARTED" ? t("personality.getToKnow") : t("personality.keepShaping")}
                  </Text>
                  <Text className="text-[11px] leading-[15px] text-cream-mute">
                    {t("personality.setupHint", { part: t(SETUP_STEP_LABELS[setupStep]) })}
                  </Text>
                </View>
                {setupStep === 0 ? (
                  <View className="flex-row flex-wrap gap-1.5">
                    {CUISINE_OPTIONS.map((cuisine) => (
                      <ToggleChip key={cuisine} label={cuisine} active={cuisines.includes(cuisine)} onPress={() => void answerSetup(cuisine)} />
                    ))}
                  </View>
                ) : null}
                {setupStep === 1 ? (
                  <View className="flex-row flex-wrap gap-1.5">
                    {DIETARY_OPTIONS.map((option) => (
                      <ToggleChip key={option.labelKey} label={t(option.labelKey)} active={false} onPress={() => void answerSetup(option.value)} />
                    ))}
                  </View>
                ) : null}
                {setupStep === 2 ? (
                  <View className="flex-row flex-wrap gap-1.5">
                    {SPICE_OPTIONS.map((option) => (
                      <ToggleChip key={option.value} label={t(option.labelKey)} active={spice === option.value} onPress={() => void answerSetup(option.value)} />
                    ))}
                  </View>
                ) : null}
                {setupStep === 3 ? (
                  <View className="gap-1.5">
                    {DISCOVERY_OPTIONS.map((option) => (
                      <Pressable key={option.value} onPress={() => void answerSetup(option.value)} className="bg-ink-950 border border-ink-700 rounded-xl px-3 py-2 active:opacity-80">
                        <Text className="text-xs font-semibold text-cream">{pickLabel(lang, option.label, option.labelAr)}</Text>
                        <Text className="text-[10px] text-cream-mute">{pickLabel(lang, option.description, option.descriptionAr)}</Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
                {savingSetup ? <ActivityIndicator color={COLORS.amber} /> : null}
                {setupError ? <Text className="text-[10px] font-semibold text-[#FECACA]">{setupError}</Text> : null}
              </View>
            </View>
          ) : null}

          <View className="px-4 gap-2">
            <View className="flex-row items-end justify-between">
              <View className="gap-1 flex-1">
                <Text className="text-[9px] leading-[12px] font-semibold uppercase tracking-[0.12em] text-cream-mute">
                  {t("personality.tuneTodaysPicks")}
                </Text>
                <Text className="text-[13px] leading-[16px] font-bold text-brand-50">
                  {t("personality.whatSoundsRight")}
                </Text>
              </View>
              {isDirty ? (
                <Text className="text-[10px] font-semibold text-brand-500">{t("personality.changesWaiting")}</Text>
              ) : null}
            </View>
            <View className="flex-row flex-wrap gap-1.5">
              {PERSONALITY_MOODS.map((option) => (
                <ToggleChip
                  key={option.id}
                  label={`${option.emoji} ${pickLabel(lang, option.label, option.labelAr)}`}
                  active={session.mood === option.id}
                  onPress={() => patchSession({ mood: session.mood === option.id ? null : option.id })}
                />
              ))}
            </View>
            <View className="flex-row items-center gap-2 bg-ink-900 border border-ink-700 rounded-xl px-3 py-1.5">
              <TextInput
                value={freeText}
                onChangeText={setFreeText}
                placeholder={t("personality.tellAi")}
                placeholderTextColor={COLORS.mute}
                className="flex-1 text-[12px] text-cream"
                returnKeyType="done"
                onSubmitEditing={updatePicks}
              />
              <Pressable onPress={updatePicks} className="bg-brand-500 rounded-full px-3 py-2 active:opacity-80">
                <Text className="text-[10px] font-bold text-night">{t("common.update")}</Text>
              </Pressable>
            </View>
          </View>

          <View className="px-4 gap-2">
            <Text className="text-[9px] leading-[12px] font-semibold uppercase tracking-[0.12em] text-cream-mute">
              {t("personality.liveFactors")}
            </Text>
            <View className="bg-ink-900 border border-ink-700 rounded-2xl p-3 gap-3">
              <View className="gap-1.5">
                <View className="flex-row items-center justify-between">
                  <Text className="text-[11px] font-semibold text-cream">
                    {weatherOption?.emoji ?? live.emoji ?? "🌤️"} {t("personality.weather")}
                  </Text>
                  <Pressable onPress={() => patchSession({ weatherEnabled: !session.weatherEnabled })}>
                    <Text className="text-[10px] font-semibold text-brand-500">
                      {session.weatherEnabled ? t("common.on") : t("common.off")}
                    </Text>
                  </Pressable>
                </View>
                <Text className="text-[10px] text-cream-mute">
                  {live.tempC !== null && live.condition ? `${live.tempC}°C · ${live.condition}` : live.unavailable ? t("personality.weatherUnavailable") : t("personality.checkingWeather")}
                </Text>
                <View className="flex-row flex-wrap gap-1.5">
                  {WEATHER_OPTIONS.map((option) => (
                    <ToggleChip key={option.value} label={`${option.emoji} ${pickLabel(lang, option.label, option.labelAr)}`} active={weather === option.value && session.weatherEnabled} onPress={() => patchSession({ weatherOverride: option.value, weatherEnabled: true })} />
                  ))}
                </View>
              </View>
              <View className="h-px bg-ink-700" />
              <View className="gap-1.5">
                <View className="flex-row items-center justify-between">
                  <Text className="text-[11px] font-semibold text-cream">🕰️ {t("personality.timeSlot")}</Text>
                  <Pressable onPress={() => patchSession({ timeEnabled: !session.timeEnabled })}>
                    <Text className="text-[10px] font-semibold text-brand-500">{session.timeEnabled ? t("common.on") : t("common.off")}</Text>
                  </Pressable>
                </View>
                <Text className="text-[10px] text-cream-mute">
                  {session.timeEnabled ? `${clock.clock} · ${timeLabel}` : t("personality.timeNotShaping")}
                </Text>
                <View className="flex-row flex-wrap gap-1.5">
                  {(Object.keys(SLOT_LABELS) as PersonalityMealSlot[]).map((slot) => (
                    <ToggleChip key={slot} label={`${SLOT_LABELS[slot].emoji} ${pickLabel(lang, SLOT_LABELS[slot].word, SLOT_LABELS[slot].labelAr)}`} active={mealSlot === slot && session.timeEnabled} onPress={() => patchSession({ mealSlotOverride: slot, timeEnabled: true })} />
                  ))}
                </View>
              </View>
              <View className="flex-row flex-wrap gap-1.5">
                <View className="bg-wine px-2.5 py-1 rounded-full">
                  <Text className="text-[10px] font-semibold text-cream">📍 {live.city ?? t("personality.locationOff")}{nearestDistance ? ` · ${nearestDistance}` : ""}</Text>
                </View>
                <View className="bg-wine px-2.5 py-1 rounded-full">
                  <Text className="text-[10px] font-semibold text-cream">{discoveryPreference === "CURIOUS" ? t("personality.discoveryOn") : t("personality.familiarFirst")}</Text>
                </View>
                {radiusKm > 10 ? (
                  <View className="bg-wine px-2.5 py-1 rounded-full">
                    <Text className="text-[10px] font-semibold text-cream">{t("personality.withinKm", { km: radiusKm })}</Text>
                  </View>
                ) : null}
              </View>
            </View>
            {isDirty ? (
              <Pressable onPress={updatePicks} className="bg-brand-500 rounded-full py-3 items-center active:opacity-80">
                <Text className="text-sm font-bold text-night">{t("personality.updatePicks")}</Text>
              </Pressable>
            ) : null}
          </View>

        </View>
      </ScrollView>
    </View>
  );
}
