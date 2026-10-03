import {
  Alert,
  DevSettings,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Link } from "expo-router";
import { useEffect, useState } from "react";

import { useAuthStore, selectIsSignedIn, selectUser } from "@/lib/auth-store";
import {
  useMyPreferences,
  useUpdateMyPreferences,
} from "@/lib/queries";
import { AmbientGlow } from "@/components/ambient-glow";
import { cn } from "@/lib/cn";
import { useLang, useLanguageStore, useT } from "@/i18n";
import { COLORS } from "@/lib/theme";
import { getPersonalityMetadata } from "@/lib/personality";
import {
  completeUserPreferences,
  emptyGuestPersonalityProfile,
} from "@/lib/personality-profile";
import { useGuestProfileStore } from "@/lib/guest-profile-store";
import type { MealCharacteristic } from "@/types/dish";
import type { UserPreferences } from "@/types/user";

const DIETARY_OPTIONS = [
  "VEGETARIAN",
  "VEGAN",
  "HALAL",
  "GLUTEN_FREE",
  "DAIRY_FREE",
  "NUT_FREE",
  "LOW_CARB",
] as const;

const SPICE_LEVELS = [0, 1, 2, 3, 4, 5] as const;

const MEAL_TYPE_OPTIONS: MealCharacteristic[] = ["BREAKFAST", "LUNCH", "DINNER", "SNACK"];

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
        "px-2.5 py-1 rounded-full border",
        active ? "bg-brand-cta border-brand-cta" : "border-ink-700"
      )}
    >
      <Text
        className={cn(
          "text-[11px]",
          active ? "font-semibold text-night" : "font-medium text-cream"
        )}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function LanguageSwitcher() {
  const t = useT();
  const lang = useLang();
  const setLang = useLanguageStore((s) => s.setLang);

  function choose(next: "en" | "ar") {
    if (next === lang) return;
    setLang(next);
    // forceRTL only takes effect after a restart (React Native limitation).
    Alert.alert(t("profile.restartTitle"), t("profile.restartBody"), [
      {
        text: t("profile.restartNow"),
        onPress: () => {
          if (__DEV__ && typeof DevSettings?.reload === "function") {
            DevSettings.reload();
          }
        },
      },
    ]);
  }

  return (
    <View className="bg-ink-900 border border-ink-700 rounded-2xl p-4 gap-2">
      <Text className="text-[13px] font-semibold text-cream">
        {t("profile.language")}
      </Text>
      <Text className="text-[11px] text-cream-mute">
        {t("profile.languageNote")}
      </Text>
      <View className="flex-row gap-1.5">
        {(
          [
            { value: "en", label: "English" },
            { value: "ar", label: "العربية" },
          ] as const
        ).map((option) => (
          <Pressable
            key={option.value}
            onPress={() => choose(option.value)}
            className={cn(
              "px-3 py-1.5 rounded-full border",
              lang === option.value ? "bg-brand-cta border-brand-cta" : "border-ink-700"
            )}
          >
            <Text
              className={cn(
                "text-xs",
                lang === option.value ? "font-bold text-night" : "font-medium text-cream"
              )}
            >
              {option.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

/**
 * Shared taste-profile editor. Signed-in callers persist through the API;
 * guest callers persist to the on-device guest profile. Both pass the same
 * patch shape so the two writers cannot drift.
 */
function PreferenceEditor({
  prefs,
  onPatch,
}: {
  prefs: UserPreferences;
  onPatch: (patch: Partial<UserPreferences>) => void;
}) {
  const t = useT();
  const [cuisinesInput, setCuisinesInput] = useState("");

  function toggleDietary(tag: (typeof DIETARY_OPTIONS)[number]) {
    const next = prefs.dietaryRestrictions.includes(tag)
      ? prefs.dietaryRestrictions.filter((value) => value !== tag)
      : [...prefs.dietaryRestrictions, tag];
    onPatch({ dietaryRestrictions: next });
  }

  function toggleMealType(tag: MealCharacteristic) {
    const next = prefs.preferredMealTypes.includes(tag)
      ? prefs.preferredMealTypes.filter((value) => value !== tag)
      : [...prefs.preferredMealTypes, tag];
    onPatch({ preferredMealTypes: next });
  }

  function addCuisines() {
    const additions = cuisinesInput
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    if (additions.length === 0) return;
    const next = Array.from(new Set([...prefs.preferredCuisines, ...additions]));
    onPatch({ preferredCuisines: next });
    setCuisinesInput("");
  }

  return (
    <View className="bg-ink-900 border border-ink-700 rounded-2xl p-4 gap-3">
      <Text className="text-[13px] font-semibold text-cream">
        {t("profile.spicePreference")}
      </Text>
      <View className="flex-row gap-1">
        {SPICE_LEVELS.map((level) => (
          <Pressable
            key={level}
            onPress={() => onPatch({ spicePreference: level })}
            className={cn(
              "flex-1 h-9 rounded-lg items-center justify-center",
              prefs.spicePreference === level ? "bg-brand-cta" : "bg-ink-950"
            )}
          >
            <Text
              className={cn(
                "text-xs",
                prefs.spicePreference === level ? "font-bold text-night" : "text-cream"
              )}
            >
              {level === 0 ? t("profile.spiceNone") : level === 5 ? "🌶🌶" : "🌶".repeat(level)}
            </Text>
          </Pressable>
        ))}
      </View>

      <View className="gap-1.5">
        <Text className="text-[13px] font-semibold text-cream">
          {t("profile.dietary")}
        </Text>
        <View className="flex-row flex-wrap gap-1.5">
          {DIETARY_OPTIONS.map((opt) => (
            <ToggleChip
              key={opt}
              active={prefs.dietaryRestrictions.includes(opt)}
              label={opt.toLowerCase().replace(/_/g, " ")}
              onPress={() => toggleDietary(opt)}
            />
          ))}
        </View>
      </View>

      <View className="gap-1.5">
        <Text className="text-[13px] font-semibold text-cream">
          {t("profile.mealTypes")}
        </Text>
        <View className="flex-row flex-wrap gap-1.5">
          {MEAL_TYPE_OPTIONS.map((opt) => (
            <ToggleChip
              key={opt}
              active={prefs.preferredMealTypes.includes(opt)}
              label={opt.toLowerCase()}
              onPress={() => toggleMealType(opt)}
            />
          ))}
        </View>
      </View>

      <View className="gap-1.5">
        <Text className="text-[13px] font-semibold text-cream">
          {t("profile.preferredCuisines")}
        </Text>
        <View className="flex-row flex-wrap gap-1.5">
          {prefs.preferredCuisines.map((c) => (
            <View key={c} className="bg-wine px-2.5 py-1 rounded-full">
              <Text className="text-[11px] font-semibold text-cream">{c}</Text>
            </View>
          ))}
        </View>
        <View className="flex-row items-center gap-2 mt-1">
          <TextInput
            value={cuisinesInput}
            onChangeText={setCuisinesInput}
            placeholder={t("profile.cuisinesPlaceholder")}
            placeholderTextColor={COLORS.mute}
            className="flex-1 bg-ink-950 border border-ink-700 rounded-full px-3 h-10 text-[13px] text-cream"
            autoCapitalize="words"
          />
          <Pressable
            onPress={addCuisines}
            className="bg-brand-cta px-4 h-10 rounded-full items-center justify-center active:opacity-85"
          >
            <Text className="text-night text-xs font-bold">{t("common.add")}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export default function ProfileScreen() {
  const isSignedIn = useAuthStore(selectIsSignedIn);
  const user = useAuthStore(selectUser);
  const signOut = useAuthStore((s) => s.signOut);
  const t = useT();

  const { data: prefs } = useMyPreferences();
  const updatePrefs = useUpdateMyPreferences();

  const guestProfile = useGuestProfileStore((state) => state.profile);
  const guestProfileReady = useGuestProfileStore((state) => state.hydrated);
  const hydrateGuestProfile = useGuestProfileStore((state) => state.hydrate);
  const persistGuestProfile = useGuestProfileStore((state) => state.persist);

  useEffect(() => {
    if (!guestProfileReady) void hydrateGuestProfile();
  }, [guestProfileReady, hydrateGuestProfile]);

  function patchSignedIn(patch: Partial<UserPreferences>) {
    const current = prefs ?? completeUserPreferences();
    updatePrefs.mutate({
      ...patch,
      inferredPreferences: {
        ...(current.inferredPreferences ?? {}),
        personality: {
          ...getPersonalityMetadata(current),
          ...("dietaryRestrictions" in patch ? { dietaryConfirmed: true } : {}),
          ...("preferredCuisines" in patch ? { cuisineConfirmed: true } : {}),
          ...("preferredMealTypes" in patch ? { mealTypesConfirmed: true } : {}),
          ...("spicePreference" in patch ? { spiceConfirmed: true } : {}),
        },
      },
    });
  }

  function patchGuest(patch: Partial<UserPreferences>) {
    const profile = guestProfile ?? emptyGuestPersonalityProfile();
    const next = {
      ...profile,
      preferences: {
        ...profile.preferences,
        ...patch,
        inferredPreferences: {
          ...(profile.preferences.inferredPreferences ?? {}),
          personality: {
            ...getPersonalityMetadata(profile.preferences),
            ...("dietaryRestrictions" in patch ? { dietaryConfirmed: true } : {}),
            ...("preferredCuisines" in patch ? { cuisineConfirmed: true } : {}),
            ...("preferredMealTypes" in patch ? { mealTypesConfirmed: true } : {}),
            ...("spicePreference" in patch ? { spiceConfirmed: true } : {}),
          },
        },
      },
    };
    void persistGuestProfile(next);
  }

  if (!isSignedIn) {
    return (
      <View className="flex-1 bg-ink-950 overflow-hidden">
        <AmbientGlow top={80} />
        <ScrollView
          className="flex-1 bg-transparent"
          contentContainerStyle={{ paddingTop: 16, paddingBottom: 40 }}
          contentInsetAdjustmentBehavior="automatic"
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View className="px-4 gap-3">
            <View className="gap-1">
              <Text className="text-[10px] font-semibold uppercase tracking-[0.12em] text-accent">
                {t("profile.tasteOnDevice")}
              </Text>
              <Text className="text-2xl font-bold text-cream">{t("profile.title")}</Text>
            </View>

            <View className="bg-ink-900 border border-ink-700 rounded-2xl p-4 gap-2">
              <Text className="text-base font-semibold text-cream">{t("profile.guest")}</Text>
              <Text className="text-xs text-cream-mute">{t("profile.guestTasteNote")}</Text>
            </View>

            {guestProfile ? (
              <PreferenceEditor
                prefs={completeUserPreferences(guestProfile.preferences)}
                onPatch={patchGuest}
              />
            ) : null}

            <Link href="/auth" asChild>
              <Pressable className="bg-brand-cta rounded-full py-3 items-center mt-2 active:opacity-85">
                <Text className="text-night text-sm font-bold">{t("common.signIn")}</Text>
              </Pressable>
            </Link>

            <LanguageSwitcher />
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-ink-950 overflow-hidden">
      <AmbientGlow top={80} />
      <ScrollView
        className="flex-1 bg-transparent"
        contentContainerStyle={{ paddingTop: 16, paddingBottom: 40 }}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View className="px-4 gap-4">
          <View className="gap-1">
            <Text className="text-[10px] font-semibold uppercase tracking-[0.12em] text-accent">
              {t("profile.youPreferences")}
            </Text>
            <Text className="text-2xl font-bold text-cream">{t("profile.title")}</Text>
          </View>

          <View className="bg-ink-900 border border-ink-700 rounded-2xl p-4 flex-row items-center gap-3">
            <View className="w-14 h-14 rounded-full bg-wine items-center justify-center">
              <Text className="text-lg font-bold text-cream">
                {user?.displayName?.[0]?.toUpperCase() ?? "?"}
              </Text>
            </View>
            <View className="flex-1">
              <Text className="text-base font-semibold text-cream">
                {user?.displayName ?? "TasteMood User"}
              </Text>
              <Text className="text-xs text-cream-mute">{user?.email}</Text>
            </View>
          </View>

          {prefs ? (
            <PreferenceEditor prefs={prefs} onPatch={patchSignedIn} />
          ) : null}

          <LanguageSwitcher />

          <Pressable
            onPress={signOut}
            className="bg-ink-900 border border-ink-700 rounded-full py-3 items-center active:opacity-70"
          >
            <Text className="text-sm text-cream-mute font-semibold">
              {t("common.signOut")}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}
