import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  useMyPreferences,
  usePairTaste,
  useRecommendations,
  useRestaurantAreas,
  useUpdateMyPreferences,
} from "@/lib/queries";
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
  applyPersonalitySignal,
  emptyPersonalitySession,
  readPersonalitySession,
  todayKey,
  writePersonalitySession,
  type PersonalitySession,
} from "@/lib/personality-session";
import {
  completeUserPreferences,
  coreAnswerPatch,
  emptyGuestPersonalityProfile,
  mergeGuestPersonalityProfile,
  missingCoreFacets,
  nextCoreQuestionId,
  shouldGateCoreQuiz,
  type CoreQuestionId,
  type GuestPersonalityProfile,
} from "@/lib/personality-profile";
import { useGuestProfileStore } from "@/lib/guest-profile-store";
import { nearestArea } from "@/lib/browse-groups";
import { orderByLearnedAffinity } from "@/lib/personality-ranking";
import {
  isProbeDismissedForToday,
  pendingProbe,
  probeDismissedDate,
  type ProbeTopic,
} from "@/lib/personality-probe";
import { RecommendationCard } from "@/components/recommendation-card";
import { ProfileButton } from "@/components/profile-button";
import { DishSkeletonGrid } from "@/components/dish-skeleton";
import { EmptyState } from "@/components/empty-state";
import { AmbientGlow } from "@/components/ambient-glow";
import { cn } from "@/lib/cn";
import { COLORS } from "@/lib/theme";
import { pickLabel, displayName, useLang, useT } from "@/i18n";
import { foodEmoji } from "@/lib/food-emoji";
import { formatPrice } from "@/lib/format";
import { buildTraitBars, resolveTraitVector, type TraitId } from "@/lib/personality-traits";
import { recordInteraction } from "@/lib/api";
import { whyLine } from "@/lib/personality-why";
import { pairAnswerInput, shouldOfferPair } from "@/lib/personality-pair";
import type {
  PairTasteResponse,
  PersonalityContext,
  RecommendationItem,
  RecommendationRequest,
} from "@/types/recommendation";
import type { DietaryProperty, MealCharacteristic } from "@/types/dish";
import type { UserPreferences, PriceRange } from "@/types/user";
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
  { labelKey: "personality.glutenFree", value: ["GLUTEN_FREE"] },
  { labelKey: "personality.dairyFree", value: ["DAIRY_FREE"] },
  { labelKey: "personality.nutFree", value: ["NUT_FREE"] },
  { labelKey: "personality.lowCarb", value: ["LOW_CARB"] },
];

const SPICE_OPTIONS: Array<{ value: number; labelKey: TranslationKey }> = [
  { value: 0, labelKey: "personality.spice0" },
  { value: 1, labelKey: "personality.spice1" },
  { value: 2, labelKey: "personality.spice2" },
  { value: 3, labelKey: "personality.spice3" },
  { value: 4, labelKey: "personality.spice4" },
  { value: 5, labelKey: "personality.spice5" },
];

const MEAL_TYPE_OPTIONS: Array<{ value: MealCharacteristic; labelKey: TranslationKey }> = [
  { value: "BREAKFAST", labelKey: "personality.slotBreakfast" },
  { value: "LUNCH", labelKey: "personality.slotLunch" },
  { value: "DINNER", labelKey: "personality.slotDinner" },
  { value: "SNACK", labelKey: "personality.slotLateNight" },
];

const CORE_QUESTION_COPY: Record<CoreQuestionId, TranslationKey> = {
  dietary: "personality.coreDietary",
  cuisine: "personality.coreCuisine",
  mealType: "personality.coreMealType",
  spice: "personality.coreSpice",
  discovery: "personality.coreDiscovery",
};

const PROFILE_STATUS_LABEL: Record<ProfileCompleteness, TranslationKey> = {
  NOT_STARTED: "personality.statusNotStarted",
  IN_PROGRESS: "personality.statusInProgress",
  READY: "personality.statusReady",
};

const FOLLOW_UP_LABEL: Record<CoreQuestionId, TranslationKey> = {
  dietary: "personality.stepDietary",
  cuisine: "personality.stepTaste",
  mealType: "personality.stepMeals",
  spice: "personality.stepHeat",
  discovery: "personality.stepDiscovery",
};

/**
 * "Know you better" probe topics read in the user's language. The dimension
 * topics reuse the same vocabulary as the follow-up labels and trait bars so
 * the screen never shows a raw enum key ("tasteAttribute").
 */
const PROBE_TOPIC_LABEL: Record<ProbeTopic, TranslationKey> = {
  budget: "personality.probeBudgetQuestion",
  cuisine: "personality.traitBreadth",
  tasteAttribute: "personality.stepTaste",
  mealCharacteristic: "personality.stepMeals",
};

const PROBE_BUDGET_OPTIONS: Array<{ value: PriceRange; labelKey: TranslationKey }> = [
  { value: "BUDGET", labelKey: "price.budget" },
  { value: "MODERATE", labelKey: "price.moderate" },
  { value: "EXPENSIVE", labelKey: "price.expensive" },
  { value: "LUXURY", labelKey: "price.luxury" },
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

/**
 * Shared card shell. One padding/rounding/gap definition so every block on the
 * page breathes the same amount and the surface stays consistent.
 */
function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <View className={cn("bg-ink-900 border border-ink-700 rounded-2xl p-4 gap-3.5", className)}>
      {children}
    </View>
  );
}

/** Section header: small uppercase eyebrow over a readable title. */
function SectionHeader({
  eyebrow,
  title,
  action,
}: {
  eyebrow?: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <View className="flex-row items-end justify-between gap-3">
      <View className="gap-1 flex-1">
        {eyebrow ? (
          <Text className="text-[11px] leading-[14px] font-semibold uppercase tracking-[0.12em] text-cream-mute">
            {eyebrow}
          </Text>
        ) : null}
        <Text className="text-[16px] leading-[21px] font-bold text-cream">{title}</Text>
      </View>
      {action}
    </View>
  );
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
        "px-3.5 py-2 rounded-full border active:opacity-80",
        active ? "bg-brand-cta border-brand-cta" : "border-ink-700"
      )}
    >
      <Text className={cn("text-[13px] leading-[17px]", active ? "font-semibold text-night" : "text-cream")}>
        {label}
      </Text>
    </Pressable>
  );
}

function TraitBar({
  label,
  pct,
  confidence,
  confidenceLabel,
  expanded,
  onToggle,
  sourcesLabel,
  sourceLines,
  ctaLabel,
}: {
  label: string;
  pct: number;
  confidence: "measured" | "low-signal";
  confidenceLabel: string;
  expanded: boolean;
  onToggle: () => void;
  sourcesLabel: string;
  sourceLines: string[];
  ctaLabel: string;
}) {
  const clamped = Math.max(4, Math.min(100, pct));
  return (
    <Pressable onPress={onToggle} hitSlop={8} className="gap-2 py-1">
      <View className="flex-row justify-between items-center">
        <View className="flex-row items-center gap-2">
          <View
            className={confidence === "measured" ? "w-2 h-2 rounded-full bg-success" : "w-2 h-2 rounded-full bg-clay-400"}
            accessibilityLabel={confidenceLabel}
          />
          <Text className="text-[12px] leading-[16px] font-semibold uppercase tracking-[0.08em] text-cream-mute">
            {label}
          </Text>
        </View>
        <Text className="text-[12px] leading-[16px] font-bold text-cream">{clamped}%</Text>
      </View>
      <View className="h-[6px] rounded-[3px] bg-ink-700 overflow-hidden">
        <View className="h-[6px] rounded-[3px] bg-brand-500" style={{ width: `${clamped}%` }} />
      </View>
      {expanded ? (
        <View className="gap-1.5 pt-1.5">
          <Text className="text-[12px] leading-[16px] font-semibold text-cream">
            {sourcesLabel} · {confidenceLabel}
          </Text>
          {sourceLines.map((line) => (
            <Text key={line} className="text-[12px] leading-[17px] text-cream-mute">
              {line}
            </Text>
          ))}
          {confidence === "low-signal" ? (
            <Link href="/profile" asChild>
              <Pressable hitSlop={8} className="pt-1">
                <Text className="text-[12px] leading-[16px] font-semibold text-accent">{ctaLabel}</Text>
              </Pressable>
            </Link>
          ) : null}
        </View>
      ) : null}
    </Pressable>
  );
}

function CoreQuiz({
  question,
  step,
  dietaryDraft,
  onDietaryDraft,
  onAnswer,
  saving,
  error,
}: {
  question: CoreQuestionId;
  step: number;
  dietaryDraft: DietaryProperty[];
  onDietaryDraft: (next: DietaryProperty[]) => void;
  onAnswer: (value: string) => void;
  saving: boolean;
  error: string | null;
}) {
  const t = useT();
  const lang = useLang();

  function toggleDietary(tag: DietaryProperty) {
    onDietaryDraft(
      dietaryDraft.includes(tag)
        ? dietaryDraft.filter((value) => value !== tag)
        : [...dietaryDraft, tag]
    );
  }

  return (
    <View className="px-4">
      <View className="bg-wine border border-wine-deep rounded-2xl p-4 gap-4">
        <View className="gap-1.5">
          <Text className="text-[11px] leading-[14px] font-semibold tracking-[0.12em] text-accent uppercase">
            {t("personality.coreProgress", { step, total: 5 })}
          </Text>
          <Text className="text-[17px] leading-[23px] font-bold text-cream">
            {t(CORE_QUESTION_COPY[question])}
          </Text>
        </View>

        {question === "dietary" ? (
          <>
            <View className="flex-row flex-wrap gap-2">
              <ToggleChip
                label={t("personality.noRestrictions")}
                active={dietaryDraft.length === 0}
                onPress={() => onDietaryDraft([])}
              />
              {DIETARY_OPTIONS.filter((option) => option.value.length > 0).map((option) => (
                <ToggleChip
                  key={option.labelKey}
                  label={t(option.labelKey)}
                  active={dietaryDraft.includes(option.value[0])}
                  onPress={() => toggleDietary(option.value[0])}
                />
              ))}
            </View>
            <Pressable
              onPress={() => onAnswer(dietaryDraft.length ? dietaryDraft.join(",") : "NONE")}
              className="bg-brand-cta rounded-full py-3.5 items-center active:opacity-80"
            >
              <Text className="text-[15px] font-bold text-night">{t("personality.coreContinue")}</Text>
            </Pressable>
          </>
        ) : null}

        {question === "cuisine" ? (
          <View className="flex-row flex-wrap gap-2">
            {CUISINE_OPTIONS.map((cuisine) => (
              <ToggleChip
                key={cuisine}
                label={cuisine}
                active={false}
                onPress={() => onAnswer(cuisine)}
              />
            ))}
            <ToggleChip
              label={t("personality.coreDepends")}
              active={false}
              onPress={() => onAnswer("NONE")}
            />
          </View>
        ) : null}

        {question === "mealType" ? (
          <View className="flex-row flex-wrap gap-2">
            {MEAL_TYPE_OPTIONS.map((option) => (
              <ToggleChip
                key={option.value}
                label={t(option.labelKey)}
                active={false}
                onPress={() => onAnswer(option.value)}
              />
            ))}
            <ToggleChip
              label={t("personality.coreDepends")}
              active={false}
              onPress={() => onAnswer("NONE")}
            />
          </View>
        ) : null}

        {question === "spice" ? (
          <View className="flex-row flex-wrap gap-2">
            {SPICE_OPTIONS.map((option) => (
              <ToggleChip
                key={option.value}
                label={t(option.labelKey)}
                active={false}
                onPress={() => onAnswer(String(option.value))}
              />
            ))}
          </View>
        ) : null}

        {question === "discovery" ? (
          <View className="gap-2">
            {DISCOVERY_OPTIONS.map((option) => (
              <Pressable
                key={option.value}
                onPress={() => onAnswer(option.value)}
                className="bg-ink-950 border border-ink-700 rounded-2xl px-4 py-3 gap-1 active:opacity-80"
              >
                <Text className="text-[14px] leading-[19px] font-semibold text-cream">
                  {pickLabel(lang, option.label, option.labelAr)}
                </Text>
                <Text className="text-[12px] leading-[17px] text-cream-mute">
                  {pickLabel(lang, option.description, option.descriptionAr)}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {saving ? <ActivityIndicator color={COLORS.amber} /> : null}
        {error ? <Text className="text-[12px] font-semibold text-danger">{error}</Text> : null}
      </View>
    </View>
  );
}

type FeedbackType = Extract<InteractionType, "LIKE" | "DISLIKE" | "NOT_INTERESTED">;

interface PairTasteCardProps {
  pair: [RecommendationItem, RecommendationItem];
  onChoose: (item: RecommendationItem) => void;
  onSkip: () => void;
  chosen: boolean;
}

/**
 * One compact, tappable pair option: visual, name, venue and price — the
 * "light touch" the ticket asks for, rather than a full recommendation card.
 * The whole row is the tap target, so choosing needs no feedback glyphs.
 */
function PairOption({
  item,
  onPress,
}: {
  item: RecommendationItem;
  onPress: () => void;
}) {
  const lang = useLang();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className="flex-row items-center gap-3 bg-ink-900 border border-ink-700 rounded-2xl p-3 active:opacity-80"
    >
      <View className="w-[52px] h-[52px] rounded-xl bg-ink-800 items-center justify-center overflow-hidden">
        {item.dish.imageUrl ? (
          <Image source={{ uri: item.dish.imageUrl }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
        ) : (
          <Text className="text-[22px]">{foodEmoji(item.dish)}</Text>
        )}
      </View>
      <View className="flex-1 gap-0.5" style={{ minWidth: 0 }}>
        <Text numberOfLines={1} className="text-[14px] leading-[19px] font-bold text-cream">
          {displayName(lang, item.dish)}
        </Text>
        <Text numberOfLines={1} className="text-[12px] leading-[16px] font-semibold text-cream-mute">
          {displayName(lang, item.restaurant)}
        </Text>
        <Text className="text-[13px] leading-[18px] font-bold text-accent">
          {formatPrice(item.dish.price, item.dish.currency)}
        </Text>
      </View>
      <Text className="text-[18px] text-accent">›</Text>
    </Pressable>
  );
}

/**
 * "Which of these two sounds more you tonight?" — two real, verified-
 * available cards from the pair-taste endpoint. One tap records the pick as
 * an ordinary LIKE (a recommendation signal, never a stable preference) and
 * retires the card; skipping is frictionless. Fully dismissible, and its
 * absence never affects the main recommendations.
 */
function PairTasteCard({ pair, onChoose, onSkip, chosen }: PairTasteCardProps) {
  const t = useT();
  return (
    <View className="px-4">
      <View className="bg-wine border border-wine-deep rounded-2xl p-4 gap-3.5">
        <View className="flex-row items-start justify-between gap-3">
          <View className="gap-1.5 flex-1">
            <Text className="text-[15px] leading-[20px] font-bold text-cream">
              {t("personality.pairTitle")}
            </Text>
            <Text className="text-[13px] leading-[18px] text-cream-mute">
              {chosen ? t("personality.pairChosen") : t("personality.pairSubtitle")}
            </Text>
          </View>
          <Pressable onPress={onSkip} hitSlop={8}>
            <Text className="text-[13px] leading-[18px] font-semibold text-accent">
              {t("personality.pairSkip")}
            </Text>
          </Pressable>
        </View>
        {!chosen ? (
          <View className="gap-3">
            {pair.map((item) => (
              <PairOption key={item.dish.id} item={item} onPress={() => onChoose(item)} />
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

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
  context: PersonalityContext;
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
  context,
}: RecommendationResultsProps) {
  const t = useT();
  const lang = useLang();

  return (
    <>
      <View className="px-4 gap-4">
        <SectionHeader
          title={t("personality.todaysPicks")}
          action={
            picks.length ? (
              <Text className="text-[12px] leading-[16px] font-semibold text-accent">
                {t("personality.matched", { count: picks.length })}
              </Text>
            ) : null
          }
        />
        {isLoading ? (
          <View className="gap-3"><DishSkeletonGrid count={3} /></View>
        ) : isError ? (
          <View className="flex-row items-center gap-2.5 bg-danger-bg border border-danger-line rounded-2xl px-4 py-3.5">
            <Text className="text-base">⚠️</Text>
            <Text className="text-[13px] leading-[17px] font-semibold text-danger flex-1">
              {error?.message ?? t("personality.unavailable")}
            </Text>
            <Pressable onPress={() => void refetch()} hitSlop={8}>
              <Text className="text-[13px] font-bold text-accent">{t("common.retry")}</Text>
            </Pressable>
          </View>
        ) : picks.length === 0 ? (
          <View className="gap-3">
            <EmptyState icon="🤔" title={t("personality.noCloseMatches")} description={t("personality.noCloseMatchesDesc")} />
            <View className="flex-row gap-3">
              {weather ? (
                <Pressable
                  onPress={onIgnoreWeather}
                  className="flex-1 border border-ink-700 rounded-full py-3 items-center active:opacity-80"
                >
                  <Text className="text-[13px] font-semibold text-cream">{t("personality.ignoreWeather")}</Text>
                </Pressable>
              ) : null}
              {radiusKm === 10 ? (
                <Pressable
                  onPress={() => setRadiusKm(25)}
                  className="flex-1 border border-ink-700 rounded-full py-3 items-center active:opacity-80"
                >
                  <Text className="text-[13px] font-semibold text-cream">{t("personality.widen25")}</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        ) : (
          <View className="gap-3.5">
            {picks.map((item) => (
              <View key={item.dish.id} className="gap-2">
                <RecommendationCard
                  item={item}
                  onFeedback={onFeedback ? (type) => onFeedback(item, type) : undefined}
                />
                <Text className="text-[12px] leading-[17px] text-cream-mute px-1" numberOfLines={2}>
                  {whyLine(item.scoreBreakdown, item, context, lang)}
                </Text>
                {feedback[item.dish.id] ? (
                  <Text className="text-[12px] leading-[16px] font-semibold text-accent px-1">
                    {t("personality.signalSaved")}
                  </Text>
                ) : null}
              </View>
            ))}
          </View>
        )}
      </View>

      {picks.length > 0 ? (
        <View className="px-4">
          <Card>
            <View className="gap-2">
              <Text className="text-[15px] leading-[20px] font-bold text-cream">
                {t("personality.whyTheseFit")}
              </Text>
              <Text className="text-[13px] leading-[19px] text-cream-mute">
                {picks[0]?.reason ?? t("personality.whyTheseFit")}
              </Text>
            </View>
            <Text className="text-[11px] leading-[15px] font-semibold tracking-[0.04em] text-accent">
              {t("personality.aiInterprets")}
            </Text>
          </Card>
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
  const areas = useRestaurantAreas();

  const clock = useClock();
  const live = useLiveContext();
  const [session, setSession] = useState<PersonalitySession>(emptyPersonalitySession);
  const [sessionReady, setSessionReady] = useState(false);
  const guestProfile = useGuestProfileStore((state) => state.profile);
  const guestProfileReady = useGuestProfileStore((state) => state.hydrated);
  const hydrateGuestProfile = useGuestProfileStore((state) => state.hydrate);
  const persistGuestProfile = useGuestProfileStore((state) => state.persist);
  const resetGuestProfile = useGuestProfileStore((state) => state.reset);
  const [profileDraft, setProfileDraft] = useState<UserPreferences | null>(null);
  const [submitted, setSubmitted] = useState<RecommendationRequest | null>(null);
  const [applied, setApplied] = useState<AppliedSnapshot | null>(null);
  const [freeText, setFreeText] = useState("");
  const [radiusKm, setRadiusKm] = useState(10);
  const [savingSetup, setSavingSetup] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [dietaryDraft, setDietaryDraft] = useState<DietaryProperty[]>([]);
  const [feedback, setFeedback] = useState<Record<string, InteractionType>>({});
  const [expandedTrait, setExpandedTrait] = useState<TraitId | null>(null);
  const [pairDismissed, setPairDismissed] = useState(false);
  const [pairAnswered, setPairAnswered] = useState(false);
  const mergeAttempted = useRef(false);

  const guestPreferences = guestProfile
    ? completeUserPreferences(guestProfile.preferences)
    : null;
  const effectivePrefs: UserPreferences | null | undefined = isSignedIn
    ? profileDraft ?? prefs
    : guestPreferences;
  const prefsReady = isSignedIn ? !!effectivePrefs : guestProfileReady;
  const profileStatus = getProfileCompleteness(effectivePrefs);
  const metadata = getPersonalityMetadata(effectivePrefs);
  const discoveryPreference: DiscoveryPreference = metadata.discoveryPreference ?? "FAMILIAR";
  // One resolved vector for the bars and the probe: signed-in users read the
  // server profile's learned vector, guests the on-device session vector. Both
  // must agree, or the probe would ask about a dimension the bars already show
  // as measured (and vice versa).
  const resolvedVector = useMemo(
    () =>
      resolveTraitVector(
        isSignedIn,
        session.tasteVector,
        (effectivePrefs?.inferredPreferences as { tasteVector?: unknown } | null | undefined)?.tasteVector
      ),
    [isSignedIn, session.tasteVector, effectivePrefs]
  );
  const traitBars = useMemo(
    () =>
      buildTraitBars({
        vector: resolvedVector,
        spicePreference: effectivePrefs?.spicePreference,
        preferredCuisines: effectivePrefs?.preferredCuisines,
        preferredMealTypes: effectivePrefs?.preferredMealTypes,
        discoveryPreference,
      }),
    [resolvedVector, effectivePrefs, discoveryPreference]
  );
  // Pair-taste hard dietary constraint: signed-in users' restrictions live on
  // the server profile, but guests' live only on-device, so they must travel
  // with the request. Passing them for both is harmless — the backend unions
  // the two sources and dedupes.
  const pairDiet = useMemo(
    () => effectivePrefs?.dietaryRestrictions ?? [],
    [effectivePrefs?.dietaryRestrictions]
  );
  const weather = session.weatherEnabled
    ? session.weatherOverride ?? live.weatherCategory
    : null;
  const mealSlot = session.timeEnabled
    ? session.mealSlotOverride ?? clock.slot
    : null;
  const context: PersonalityContext = {
    ...(weather ? { weather } : {}),
    ...(mealSlot ? { mealSlot } : {}),
    ...(session.mood ? { mood: session.mood } : {}),
  };
  const coreAnswers = isSignedIn
    ? metadata.coreAnswers ?? {}
    : guestProfile?.coreAnswers ?? {};
  const coreQuestion = nextCoreQuestionId(coreAnswers);
  const coreStarted = Object.keys(coreAnswers).length > 0;
  const showCoreQuiz =
    prefsReady &&
    coreQuestion !== null &&
    (coreStarted ||
      shouldGateCoreQuiz(isSignedIn ? effectivePrefs : null, isSignedIn ? null : guestProfile));
  const followUpFacets = useMemo(
    () => (showCoreQuiz ? [] : missingCoreFacets(effectivePrefs)),
    [showCoreQuiz, effectivePrefs]
  );
  const followUpQuestion = followUpFacets[0] ?? null;
  const showFollowUp =
    prefsReady &&
    !showCoreQuiz &&
    followUpQuestion !== null &&
    sessionReady &&
    session.followUpShownDate !== todayKey();
  // "Know you better" probe card: non-blocking, at most one pending topic,
  // budget first, hidden once dismissed today or everything is measured.
  const probe = useMemo(
    () =>
      prefsReady && !showCoreQuiz && sessionReady
        ? pendingProbe(effectivePrefs ?? null, resolvedVector)
        : null,
    [prefsReady, showCoreQuiz, sessionReady, effectivePrefs, resolvedVector],
  );
  const probeDismissed = isProbeDismissedForToday(
    probeDismissedDate(isSignedIn ? effectivePrefs : guestPreferences),
    todayKey(),
  );
  const showProbe = probe !== null && !probeDismissed && !showFollowUp;

  useEffect(() => {
    setSessionReady(false);
    setProfileDraft(null);
    setSubmitted(null);
    setApplied(null);
    setFreeText("");
    setRadiusKm(10);
    setFeedback({});
    setDietaryDraft([]);
    mergeAttempted.current = false;
  }, [isSignedIn, user?.id]);

  useEffect(() => {
    if (prefs) setProfileDraft(prefs);
  }, [prefs]);

  // The guest profile is process-wide state; hydrate it once per app run.
  useEffect(() => {
    if (!guestProfileReady) void hydrateGuestProfile();
  }, [guestProfileReady, hydrateGuestProfile]);

  useEffect(() => {
    let active = true;
    // Guests get the full loop too: their vector lives under the "guest"
    // scope and survives restarts and the daily reset.
    void readPersonalitySession(isSignedIn ? user?.id : undefined).then((stored) => {
      if (!active) return;
      setSession(stored);
      setSessionReady(true);
    });
    return () => {
      active = false;
    };
  }, [isSignedIn, user?.id]);

  useEffect(() => {
    if (effectivePrefs) setDietaryDraft(effectivePrefs.dietaryRestrictions);
  }, [effectivePrefs]);

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
    const isNearby =
      live.latitude != null &&
      live.longitude != null &&
      nearestArea(areas.data ?? [], live.latitude, live.longitude, 100) !== null;

    return buildPersonalityRequest({
      prefs: nextPrefs,
      mood: session.mood,
      weather,
      mealSlot,
      freeText,
      discoveryPreference: getPersonalityMetadata(nextPrefs).discoveryPreference ?? discoveryPreference,
      latitude: isNearby ? live.latitude : undefined,
      longitude: isNearby ? live.longitude : undefined,
      radiusKm,
    });
  }

  function submitRequest(request: RecommendationRequest) {
    setSubmitted(request);
    setApplied(currentSnapshot());
    // Remember the live context so an explicit save from Dish Details records
    // the same context this session's picks were shaped by.
    void writePersonalitySession(
      { ...session, lastContext: request.personalityContext ?? null },
      isSignedIn ? user?.id : undefined
    );
  }

  useEffect(() => {
    if (!sessionReady || !guestProfileReady || live.loading || (isSignedIn && loadingPrefs) || submitted) {
      return;
    }
    if (showCoreQuiz) return;
    submitRequest(requestFor());
  }, [sessionReady, guestProfileReady, live.loading, isSignedIn, loadingPrefs, submitted, showCoreQuiz]);

  const isDirty = applied
    ? JSON.stringify(applied) !== JSON.stringify(currentSnapshot())
    : false;

  const recommendation = useRecommendations(showCoreQuiz ? null : submitted);
  // Pair-taste is fetched only once the page is past the core quiz and the
  // user hasn't dismissed it, so the extra request never runs needlessly and
  // never competes with the main recommendations. An answered pair keeps its
  // data (stale, non-refetching) so the card can show its "Noted" state.
  const pairEnabled = !showCoreQuiz && submitted !== null && !pairDismissed;
  const pair = usePairTaste(pairEnabled ? submitted : null, pairDiet);
  const pairData = pair.data as PairTasteResponse | undefined;
  const showPair =
    pairEnabled &&
    shouldOfferPair({
      pair: pairData?.pair,
      dismissed: pairDismissed,
      showCoreQuiz,
    });
  const picks = useMemo(() => {
    const base = dedupe(recommendation.data?.recommendations ?? []).slice(0, 8);
    return isSignedIn
      ? base
      : orderByLearnedAffinity(base, {
          tasteVector: session.tasteVector,
          contextTasteVector: session.contextTasteVector,
        }, context);
  }, [recommendation.data, isSignedIn, session.tasteVector, session.contextTasteVector, context]);
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
    void writePersonalitySession(next, isSignedIn ? user?.id : undefined);
  }

  function patchSession(patch: Partial<PersonalitySession>) {
    persistSession({ ...session, ...patch });
  }

  function updatePicks() {
    submitRequest(requestFor());
  }

  function sendFeedback(item: RecommendationItem, type: InteractionType) {
    if (!isSignedIn) return;
    setFeedback((current) => ({ ...current, [item.dish.id]: type }));
    void recordInteraction({
      dishId: item.dish.id,
      restaurantId: item.restaurant.id,
      branchId: item.branch.id,
      interactionType: type,
      ...(Object.keys(context).length > 0 ? { personalityContext: context } : {}),
    }).catch(() => {
      setFeedback((current) => {
        const next = { ...current };
        delete next[item.dish.id];
        return next;
      });
    });
  }

  const guestFeedbackDelta: Record<FeedbackType, number> = {
    LIKE: 1,
    DISLIKE: -1,
    NOT_INTERESTED: 0,
  };

  function guestFeedback(item: RecommendationItem, type: FeedbackType) {
    setFeedback((current) => ({ ...current, [item.dish.id]: type }));
    persistSession(applyPersonalitySignal(session, item, guestFeedbackDelta[type], context));
  }

  // Pair answer: the chosen dish travels the ordinary feedback path (LIKE) —
  // signed-in users post it as a recommendation signal, guests fold it into
  // their local vector. No special-casing, and the card retires either way.
  function answerPair(item: RecommendationItem) {
    const answer = pairAnswerInput(item);
    if (!answer) return;
    setPairAnswered(true);
    setFeedback((current) => ({ ...current, [item.dish.id]: "LIKE" }));
    if (isSignedIn) {
      void recordInteraction({
        dishId: answer.dishId,
        restaurantId: answer.restaurantId,
        branchId: answer.branchId,
        interactionType: answer.interactionType,
        ...(Object.keys(context).length > 0 ? { personalityContext: context } : {}),
      }).catch(() => {
        setFeedback((current) => {
          const next = { ...current };
          delete next[item.dish.id];
          return next;
        });
      });
    } else {
      persistSession(applyPersonalitySignal(session, item, 1, context));
    }
  }

  function skipPair() {
    setPairDismissed(true);
  }

  async function saveStablePreference(
    patch: Partial<UserPreferences>,
    personalityPatch: Record<string, unknown>,
    submit = true
  ) {
    if (!effectivePrefs) return null;
    const next = await updatePrefs.mutateAsync({
      ...patch,
      inferredPreferences: {
        ...(effectivePrefs.inferredPreferences ?? {}),
        personality: {
          ...getPersonalityMetadata(effectivePrefs),
          ...personalityPatch,
        },
      },
    });
    setProfileDraft(next);
    if (submit) submitRequest(requestFor(next));
    return next;
  }

  async function answerCore(question: CoreQuestionId, value: string) {
    if (savingSetup || !effectivePrefs) return;
    setSavingSetup(true);
    setSetupError(null);
    try {
      const nextAnswers = { ...coreAnswers, [question]: value };
      const complete = nextCoreQuestionId(nextAnswers) === null;
      const { patch, meta } = coreAnswerPatch(question, value);
      const personalityPatch = {
        ...meta,
        coreAnswers: nextAnswers,
        ...(complete ? { coreCompleted: true } : {}),
      };
      if (isSignedIn) {
        await saveStablePreference(patch, personalityPatch, false);
      } else {
        const profile = guestProfile ?? emptyGuestPersonalityProfile();
        const nextProfile: GuestPersonalityProfile = {
          ...profile,
          preferences: {
            ...profile.preferences,
            ...patch,
            inferredPreferences: {
              ...(profile.preferences.inferredPreferences ?? {}),
              personality: {
                ...getPersonalityMetadata(profile.preferences),
                ...personalityPatch,
              },
            },
          },
          coreAnswers: nextAnswers,
          coreCompleted: complete || profile.coreCompleted,
        };
        await persistGuestProfile(nextProfile);
      }
    } catch (error) {
      setSetupError(error instanceof Error ? error.message : t("personality.answerSaveFailed"));
    } finally {
      setSavingSetup(false);
    }
  }

  async function answerFollowUp(question: CoreQuestionId, value: string) {
    if (savingSetup || !effectivePrefs) return;
    setSavingSetup(true);
    setSetupError(null);
    try {
      const { patch, meta } = coreAnswerPatch(question, value);
      const personalityPatch = {
        ...meta,
        coreAnswers: { ...coreAnswers, [question]: value },
        followUpShownDate: todayKey(),
      };
      if (isSignedIn) {
        await saveStablePreference(patch, personalityPatch, false);
      } else {
        const profile = guestProfile ?? emptyGuestPersonalityProfile();
        const nextProfile: GuestPersonalityProfile = {
          ...profile,
          preferences: {
            ...profile.preferences,
            ...patch,
            inferredPreferences: {
              ...(profile.preferences.inferredPreferences ?? {}),
              personality: {
                ...getPersonalityMetadata(profile.preferences),
                ...personalityPatch,
              },
            },
          },
          coreAnswers: { ...profile.coreAnswers, [question]: value },
          followUpShownDate: todayKey(),
        };
        await persistGuestProfile(nextProfile);
      }
    } catch (error) {
      setSetupError(error instanceof Error ? error.message : t("personality.answerSaveFailed"));
    } finally {
      setSavingSetup(false);
    }
  }

  function dismissFollowUp() {
    patchSession({ followUpShownDate: todayKey() });
    if (!isSignedIn && guestProfile) {
      void persistGuestProfile({ ...guestProfile, followUpShownDate: todayKey() });
    } else if (isSignedIn && effectivePrefs) {
      void saveStablePreference({}, { followUpShownDate: todayKey() }, false);
    }
  }

  // Budget-ceiling probe answer: saves via the same stable-preference path as
  // follow-ups (signed-in) or the guest profile persist (guest). Never blocks
  // recommendations — the card is purely additive. The chosen `preferredPriceRange`
  // is itself the record of the answer; no separate confirmation flag is kept.
  async function answerProbeBudget(value: PriceRange) {
    if (savingSetup || !effectivePrefs) return;
    setSavingSetup(true);
    setSetupError(null);
    try {
      const patch = { preferredPriceRange: value };
      if (isSignedIn) {
        await saveStablePreference(patch, {}, false);
      } else {
        const profile = guestProfile ?? emptyGuestPersonalityProfile();
        const nextProfile: GuestPersonalityProfile = {
          ...profile,
          preferences: {
            ...profile.preferences,
            ...patch,
          },
        };
        await persistGuestProfile(nextProfile);
      }
    } catch (error) {
      setSetupError(error instanceof Error ? error.message : t("personality.answerSaveFailed"));
    } finally {
      setSavingSetup(false);
    }
  }

  // Dismiss retires the probe for the session/day via the metadata date,
  // mirroring the followUpShownDate/todayKey pattern.
  function dismissProbe() {
    const patch = { probeDismissedDate: todayKey() };
    if (!isSignedIn) {
      const profile = guestProfile ?? emptyGuestPersonalityProfile();
      void persistGuestProfile({
        ...profile,
        preferences: {
          ...profile.preferences,
          inferredPreferences: {
            ...(profile.preferences.inferredPreferences ?? {}),
            personality: {
              ...getPersonalityMetadata(profile.preferences),
              ...patch,
            },
          },
        },
      });
    } else if (effectivePrefs) {
      void saveStablePreference({}, patch, false);
    }
  }

  useEffect(() => {
    if (!isSignedIn || !guestProfileReady || !guestProfile || !effectivePrefs) return;
    if (mergeAttempted.current) return;
    const hasGuestData =
      guestProfile.coreCompleted ||
      Object.keys(guestProfile.coreAnswers).length > 0 ||
      Object.keys(guestProfile.preferences).length > 0;
    const hasGuestSignals =
      Object.keys(session.tasteVector.cuisine).length > 0 ||
      Object.keys(session.tasteVector.tasteAttribute).length > 0 ||
      Object.keys(session.tasteVector.mealCharacteristic).length > 0 ||
      Object.keys(session.contextTasteVector.weather).length > 0 ||
      Object.keys(session.contextTasteVector.mealSlot).length > 0 ||
      Object.keys(session.contextTasteVector.mood).length > 0;
    if (!hasGuestData && !hasGuestSignals) return;
    mergeAttempted.current = true;
    void (async () => {
      try {
        const merge = mergeGuestPersonalityProfile(effectivePrefs, guestProfile, session);
        if (merge.alreadyMerged) return;
        const next = await updatePrefs.mutateAsync(merge.update);
        setProfileDraft(next);
        await resetGuestProfile();
        await writePersonalitySession(emptyPersonalitySession(), undefined);
      } catch {
        // Guest merge is best-effort; the local profile stays intact on failure.
      }
    })();
  }, [isSignedIn, guestProfileReady, guestProfile, effectivePrefs, session, updatePrefs]);

  const spice = effectivePrefs?.spicePreference ?? 0;
  const cuisines = effectivePrefs?.preferredCuisines ?? [];
  const refreshing = recommendation.isRefetching;
  const weatherOption = WEATHER_OPTIONS.find((option) => option.value === weather);
  const timeLabel = mealSlot
    ? pickLabel(lang, SLOT_LABELS[mealSlot].word, SLOT_LABELS[mealSlot].labelAr)
    : t("personality.timeNotShaping");
  const tasteSummary = cuisines.length
    ? cuisines.slice(0, 3).join(" · ")
    : t("personality.noCuisinesYet");

  useEffect(() => {
    const id = setInterval(() => {
      if (todayKey() === session.dateKey) return;
      // Daily reset clears mood/weather/time context but carries learned
      // signals forward — signals do not expire with the day.
      const next = {
        ...emptyPersonalitySession(),
        tasteVector: session.tasteVector,
        contextTasteVector: session.contextTasteVector,
      };
      setSession(next);
      setSubmitted(null);
      setApplied(null);
      setFreeText("");
      void writePersonalitySession(next, isSignedIn ? user?.id : undefined);
    }, 30_000);
    return () => clearInterval(id);
  }, [
    isSignedIn,
    session.dateKey,
    session.tasteVector,
    session.contextTasteVector,
    user?.id,
  ]);

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
            tintColor={COLORS.amber}
            colors={[COLORS.amber]}
          />
        }
      >
        <View className="gap-7">
          <View className="px-4 flex-row items-start gap-4">
            <View className="flex-1 gap-2">
              <View className="flex-row items-center gap-2">
                <View className="w-2 h-2 rounded-full bg-brand-500" />
                <Text className="text-[11px] leading-[14px] font-semibold uppercase tracking-[0.14em] text-accent">
                  {t("personality.live")}
                </Text>
              </View>
              <Text className="text-[30px] leading-[36px] font-bold text-cream">
                {t("personality.title")}
              </Text>
              <Text className="text-[15px] leading-[21px] text-cream-mute">
                {showCoreQuiz ? t("personality.coreSubtitle") : t("personality.subtitle")}
              </Text>
            </View>
            <ProfileButton />
          </View>

          {showCoreQuiz && coreQuestion ? (
            <CoreQuiz
              question={coreQuestion}
              step={Object.keys(coreAnswers).length + 1}
              dietaryDraft={dietaryDraft}
              onDietaryDraft={setDietaryDraft}
              onAnswer={(value) => void answerCore(coreQuestion, value)}
              saving={savingSetup}
              error={setupError}
            />
          ) : (
            <>
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
                onFeedback={isSignedIn ? sendFeedback : guestFeedback}
                context={context}
              />

              {showPair && pairData ? (
                <PairTasteCard
                  pair={pairData.pair}
                  onChoose={answerPair}
                  onSkip={skipPair}
                  chosen={pairAnswered}
                />
              ) : null}

              <View className="px-4">
                <Card className="gap-4">
                  <View className="flex-row items-center gap-3">
                    <View className="w-[44px] h-[44px] rounded-xl bg-wine-deep items-center justify-center">
                      <Text className="text-[20px] leading-[24px]">🌶️</Text>
                    </View>
                    <View className="flex-1 gap-1">
                      <Text className="text-[11px] leading-[14px] font-semibold tracking-[0.12em] text-accent uppercase">
                        {loadingPrefs && isSignedIn
                          ? t("personality.readingProfile")
                          : t(archetypeKey(spice, cuisines.length))}
                      </Text>
                      <Text className="text-[13px] leading-[18px] text-cream-mute">
                        {avgMatch !== null
                          ? t("personality.matchWithSession", { pct: avgMatch })
                          : t(PROFILE_STATUS_LABEL[profileStatus])}
                      </Text>
                    </View>
                    <Link href="/profile" asChild>
                      <Pressable hitSlop={8}>
                        <Text className="text-[13px] leading-[18px] font-semibold text-accent">{t("common.edit")}</Text>
                      </Pressable>
                    </Link>
                  </View>
                  <Text className="text-[13px] leading-[19px] text-cream-mute">
                    {t("personality.tasteSummary", { cuisines: tasteSummary })}
                  </Text>
                  <View className="gap-3 pt-1">
                    {traitBars.map((bar) => {
                    const labelKey =
                      bar.id === "heat"
                        ? ("personality.heat" as const)
                        : bar.id === "adventure"
                          ? ("personality.adventure" as const)
                          : bar.id === "breadth"
                            ? ("personality.traitBreadth" as const)
                            : ("personality.traitMealPattern" as const);
                    const sourceLines = bar.sources.map((source) =>
                      source.kind === "signal"
                        ? t("personality.traitSourceSignal", {
                            count: String(Math.abs(source.net ?? 0)),
                            name: source.name,
                          })
                        : t("personality.traitSourceSetup", {
                            name: source.name,
                            value: source.value ?? "",
                          })
                    );
                    return (
                      <TraitBar
                        key={bar.id}
                        label={t(labelKey)}
                        pct={bar.pct}
                        confidence={bar.confidence}
                        confidenceLabel={t(
                          bar.confidence === "measured"
                            ? "personality.traitMeasured"
                            : "personality.traitLowSignal",
                          { count: String(bar.signalCount) }
                        )}
                        expanded={expandedTrait === bar.id}
                        onToggle={() => setExpandedTrait((current) => (current === bar.id ? null : bar.id))}
                        sourcesLabel={t("personality.traitSources")}
                        sourceLines={sourceLines}
                        ctaLabel={
                          bar.confidence === "low-signal"
                            ? t("personality.traitAdjustSetup")
                            : t("personality.traitShapeTaste")
                        }
                      />
                    );
                  })}
                  </View>
                  {!isSignedIn ? (
                    <Link href="/auth" asChild>
                      <Pressable hitSlop={8}>
                        <Text className="text-[13px] leading-[18px] font-semibold text-accent">
                          {t("personality.signInToSave")}
                        </Text>
                      </Pressable>
                    </Link>
                  ) : null}
                </Card>
              </View>

              {showFollowUp && followUpQuestion ? (
                <View className="px-4">
                  <View className="bg-wine border border-wine-deep rounded-2xl p-4 gap-3.5">
                    <View className="flex-row items-start justify-between gap-3">
                      <View className="gap-1.5 flex-1">
                        <Text className="text-[15px] leading-[20px] font-bold text-cream">
                          {t("personality.followUpTitle")}
                        </Text>
                        <Text className="text-[13px] leading-[18px] text-cream-mute">
                          {t("personality.followUpHint", {
                            part: t(FOLLOW_UP_LABEL[followUpQuestion]),
                          })}
                        </Text>
                      </View>
                      <Pressable onPress={dismissFollowUp} hitSlop={8}>
                        <Text className="text-[13px] leading-[18px] font-semibold text-accent">
                          {t("personality.followUpSkip")}
                        </Text>
                      </Pressable>
                    </View>
                    <Text className="text-[14px] leading-[20px] font-semibold text-cream">
                      {t(CORE_QUESTION_COPY[followUpQuestion])}
                    </Text>
                    {followUpQuestion === "dietary" ? (
                      <View className="flex-row flex-wrap gap-2">
                        {DIETARY_OPTIONS.map((option) => (
                          <ToggleChip
                            key={option.labelKey}
                            label={t(option.labelKey)}
                            active={false}
                            onPress={() =>
                              void answerFollowUp(
                                "dietary",
                                option.value.length ? option.value.join(",") : "NONE"
                              )
                            }
                          />
                        ))}
                      </View>
                    ) : followUpQuestion === "cuisine" ? (
                      <View className="flex-row flex-wrap gap-2">
                        {CUISINE_OPTIONS.map((cuisine) => (
                          <ToggleChip
                            key={cuisine}
                            label={cuisine}
                            active={false}
                            onPress={() => void answerFollowUp("cuisine", cuisine)}
                          />
                        ))}
                      </View>
                    ) : followUpQuestion === "mealType" ? (
                      <View className="flex-row flex-wrap gap-2">
                        {MEAL_TYPE_OPTIONS.map((option) => (
                          <ToggleChip
                            key={option.value}
                            label={t(option.labelKey)}
                            active={false}
                            onPress={() => void answerFollowUp("mealType", option.value)}
                          />
                        ))}
                      </View>
                    ) : followUpQuestion === "spice" ? (
                      <View className="flex-row flex-wrap gap-2">
                        {SPICE_OPTIONS.map((option) => (
                          <ToggleChip
                            key={option.value}
                            label={t(option.labelKey)}
                            active={spice === option.value}
                            onPress={() => void answerFollowUp("spice", String(option.value))}
                          />
                        ))}
                      </View>
                    ) : (
                      <View className="gap-1.5">
                        {DISCOVERY_OPTIONS.map((option) => (
                          <Pressable
                            key={option.value}
                            onPress={() => void answerFollowUp("discovery", option.value)}
                            className="bg-ink-950 border border-ink-700 rounded-2xl px-4 py-3 gap-1 active:opacity-80"
                          >
                            <Text className="text-[14px] leading-[19px] font-semibold text-cream">
                              {pickLabel(lang, option.label, option.labelAr)}
                            </Text>
                            <Text className="text-[12px] leading-[17px] text-cream-mute">
                              {pickLabel(lang, option.description, option.descriptionAr)}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    )}
                    {savingSetup ? <ActivityIndicator color={COLORS.amber} /> : null}
                    {setupError ? <Text className="text-[12px] font-semibold text-danger">{setupError}</Text> : null}
                  </View>
                </View>
              ) : null}

              {showProbe && probe ? (
                <View className="px-4">
                  <Card className="gap-3.5">
                    <View className="flex-row items-start justify-between gap-3">
                      <View className="gap-1.5 flex-1">
                        <Text className="text-[15px] leading-[20px] font-bold text-cream">
                          {t("personality.probeTitle")}
                        </Text>
                        <Text className="text-[13px] leading-[18px] text-cream-mute">
                          {probe.topic === "budget"
                            ? t("personality.probeBudgetHint")
                            : t("personality.probeDimensionHint", {
                                part: t(PROBE_TOPIC_LABEL[probe.topic]),
                              })}
                        </Text>
                      </View>
                      <Pressable onPress={dismissProbe} hitSlop={8}>
                        <Text className="text-[13px] leading-[18px] font-semibold text-accent">
                          {t("personality.probeSkip")}
                        </Text>
                      </Pressable>
                    </View>
                    {probe.topic === "budget" ? (
                      <>
                        <Text className="text-[14px] leading-[20px] font-semibold text-cream">
                          {t("personality.probeBudgetQuestion")}
                        </Text>
                        <View className="flex-row flex-wrap gap-2">
                          {PROBE_BUDGET_OPTIONS.map((option) => (
                            <ToggleChip
                              key={option.value}
                              label={t(option.labelKey)}
                              active={effectivePrefs?.preferredPriceRange === option.value}
                              onPress={() => void answerProbeBudget(option.value)}
                            />
                          ))}
                        </View>
                      </>
                    ) : null}
                    {savingSetup ? <ActivityIndicator color={COLORS.amber} /> : null}
                    {setupError ? <Text className="text-[12px] font-semibold text-danger">{setupError}</Text> : null}
                  </Card>
                </View>
              ) : null}

              <View className="px-4 gap-4">
                <SectionHeader
                  eyebrow={t("personality.tuneTodaysPicks")}
                  title={t("personality.whatSoundsRight")}
                  action={
                    isDirty ? (
                      <Text className="text-[12px] leading-[16px] font-semibold text-accent">
                        {t("personality.changesWaiting")}
                      </Text>
                    ) : null
                  }
                />
                <View className="flex-row flex-wrap gap-2">
                  {PERSONALITY_MOODS.map((option) => (
                    <ToggleChip
                      key={option.id}
                      label={`${option.emoji} ${pickLabel(lang, option.label, option.labelAr)}`}
                      active={session.mood === option.id}
                      onPress={() => patchSession({ mood: session.mood === option.id ? null : option.id })}
                    />
                  ))}
                </View>
                <View className="flex-row items-center gap-2.5 bg-ink-900 border border-ink-700 rounded-2xl px-4 py-2.5">
                  <TextInput
                    value={freeText}
                    onChangeText={setFreeText}
                    placeholder={t("personality.tellAi")}
                    placeholderTextColor={COLORS.mute}
                    className="flex-1 text-[14px] py-1 text-cream"
                    returnKeyType="done"
                    onSubmitEditing={updatePicks}
                  />
                  <Pressable
                    onPress={updatePicks}
                    className="bg-brand-cta rounded-full px-4 py-2.5 active:opacity-80"
                  >
                    <Text className="text-[13px] font-bold text-night">{t("common.update")}</Text>
                  </Pressable>
                </View>
              </View>

              <View className="px-4 gap-4">
                <SectionHeader title={t("personality.liveFactors")} />
                <Card className="gap-4">
                  <View className="gap-3">
                    <View className="flex-row items-center justify-between gap-3">
                      <Text className="text-[14px] leading-[19px] font-semibold text-cream">
                        {weatherOption?.emoji ?? live.emoji ?? "🌤️"} {t("personality.weather")}
                      </Text>
                      <Pressable onPress={() => patchSession({ weatherEnabled: !session.weatherEnabled })} hitSlop={8}>
                        <Text className="text-[13px] leading-[18px] font-semibold text-accent">
                          {session.weatherEnabled ? t("common.on") : t("common.off")}
                        </Text>
                      </Pressable>
                    </View>
                    <Text className="text-[12px] leading-[17px] text-cream-mute">
                      {live.tempC !== null && live.condition ? `${live.tempC}°C · ${live.condition}` : live.unavailable ? t("personality.weatherUnavailable") : t("personality.checkingWeather")}
                    </Text>
                    <View className="flex-row flex-wrap gap-2">
                      {WEATHER_OPTIONS.map((option) => (
                        <ToggleChip key={option.value} label={`${option.emoji} ${pickLabel(lang, option.label, option.labelAr)}`} active={weather === option.value && session.weatherEnabled} onPress={() => patchSession({ weatherOverride: option.value, weatherEnabled: true })} />
                      ))}
                    </View>
                  </View>
                  <View className="h-px bg-ink-700" />
                  <View className="gap-3">
                    <View className="flex-row items-center justify-between gap-3">
                      <Text className="text-[14px] leading-[19px] font-semibold text-cream">🕰️ {t("personality.timeSlot")}</Text>
                      <Pressable onPress={() => patchSession({ timeEnabled: !session.timeEnabled })} hitSlop={8}>
                        <Text className="text-[13px] leading-[18px] font-semibold text-accent">{session.timeEnabled ? t("common.on") : t("common.off")}</Text>
                      </Pressable>
                    </View>
                    <Text className="text-[12px] leading-[17px] text-cream-mute">
                      {session.timeEnabled ? `${clock.clock} · ${timeLabel}` : t("personality.timeNotShaping")}
                    </Text>
                    <View className="flex-row flex-wrap gap-2">
                      {(Object.keys(SLOT_LABELS) as PersonalityMealSlot[]).map((slot) => (
                        <ToggleChip key={slot} label={`${SLOT_LABELS[slot].emoji} ${pickLabel(lang, SLOT_LABELS[slot].word, SLOT_LABELS[slot].labelAr)}`} active={mealSlot === slot && session.timeEnabled} onPress={() => patchSession({ mealSlotOverride: slot, timeEnabled: true })} />
                      ))}
                    </View>
                  </View>
                  <View className="flex-row flex-wrap gap-2">
                    <View className="bg-wine px-3 py-1.5 rounded-full">
                      <Text className="text-[12px] leading-[16px] font-semibold text-cream">📍 {live.city ?? t("personality.locationOff")}{nearestDistance ? ` · ${nearestDistance}` : ""}</Text>
                    </View>
                    <View className="bg-wine px-3 py-1.5 rounded-full">
                      <Text className="text-[12px] leading-[16px] font-semibold text-cream">{discoveryPreference === "CURIOUS" ? t("personality.discoveryOn") : t("personality.familiarFirst")}</Text>
                    </View>
                    {radiusKm > 10 ? (
                      <View className="bg-wine px-3 py-1.5 rounded-full">
                        <Text className="text-[12px] leading-[16px] font-semibold text-cream">{t("personality.withinKm", { km: radiusKm })}</Text>
                      </View>
                    ) : null}
                  </View>
                </Card>
                {isDirty ? (
                  <Pressable onPress={updatePicks} className="bg-brand-cta rounded-full py-4 items-center active:opacity-80">
                    <Text className="text-[15px] font-bold text-night">{t("personality.updatePicks")}</Text>
                  </Pressable>
                ) : null}
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
