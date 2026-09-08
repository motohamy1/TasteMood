import {
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Link } from "expo-router";
import { useState } from "react";

import { useAuthStore, selectIsSignedIn, selectUser } from "@/lib/auth-store";
import {
  useMyPreferences,
  useUpdateMyPreferences,
} from "@/lib/queries";
import { AmbientGlow } from "@/components/ambient-glow";
import { cn } from "@/lib/cn";
import { COLORS } from "@/lib/theme";

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
        active ? "bg-brand-500 border-brand-500" : "border-ink-700"
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

export default function ProfileScreen() {
  const isSignedIn = useAuthStore(selectIsSignedIn);
  const user = useAuthStore(selectUser);
  const signOut = useAuthStore((s) => s.signOut);

  const { data: prefs } = useMyPreferences();
  const updatePrefs = useUpdateMyPreferences();

  const [cuisinesInput, setCuisinesInput] = useState("");

  if (!isSignedIn) {
    return (
      <View className="flex-1 bg-ink-950 overflow-hidden">
        <AmbientGlow top={80} />
        <ScrollView
          className="flex-1 bg-transparent"
          contentContainerStyle={{
            paddingTop: 16,
            paddingBottom: 40,
          }}
          contentInsetAdjustmentBehavior="automatic"
          showsVerticalScrollIndicator={false}
        >
          <View className="px-4 gap-3">
          <View className="gap-1">
            <Text className="text-[10px] font-semibold uppercase tracking-[0.12em] text-brand-500">
              You • Guest
            </Text>
            <Text className="text-2xl font-bold text-brand-50">Profile</Text>
          </View>

          <View className="bg-ink-900 border border-ink-700 rounded-2xl p-4 flex-row items-center gap-3">
            <View className="w-14 h-14 rounded-full bg-wine border border-ink-700 items-center justify-center">
              <Text className="text-2xl">👤</Text>
            </View>
            <View className="flex-1">
              <Text className="text-base font-semibold text-cream">
                Guest
              </Text>
              <Text className="text-xs text-cream-mute">
                Sign in to sync your preferences
              </Text>
            </View>
          </View>

          <Link href="/auth" asChild>
            <Pressable className="bg-brand-500 rounded-full py-3 items-center mt-2 active:opacity-85">
              <Text className="text-night text-sm font-bold">Sign in</Text>
            </Pressable>
          </Link>
          </View>
        </ScrollView>
      </View>
    );
  }

  function toggleDietary(tag: (typeof DIETARY_OPTIONS)[number]) {
    if (!prefs) return;
    const next = prefs.dietaryRestrictions.includes(tag)
      ? prefs.dietaryRestrictions.filter((t) => t !== tag)
      : [...prefs.dietaryRestrictions, tag];
    updatePrefs.mutate({ dietaryRestrictions: next });
  }

  function setSpice(level: number) {
    updatePrefs.mutate({ spicePreference: level });
  }

  function addCuisines() {
    if (!prefs) return;
    const additions = cuisinesInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (additions.length === 0) return;
    const next = Array.from(new Set([...prefs.preferredCuisines, ...additions]));
    updatePrefs.mutate({ preferredCuisines: next });
    setCuisinesInput("");
  }

  return (
    <View className="flex-1 bg-ink-950 overflow-hidden">
      <AmbientGlow top={80} />
      <ScrollView
        className="flex-1 bg-transparent"
        contentContainerStyle={{
          paddingTop: 16,
          paddingBottom: 40,
        }}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View className="px-4 gap-4">
        <View className="gap-1">
          <Text className="text-[10px] font-semibold uppercase tracking-[0.12em] text-brand-500">
            You • Preferences
          </Text>
          <Text className="text-2xl font-bold text-brand-50">Profile</Text>
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
          <View className="bg-ink-900 border border-ink-700 rounded-2xl p-4 gap-3">
            <Text className="text-[13px] font-semibold text-cream">
              Spice preference
            </Text>
            <View className="flex-row gap-1">
              {SPICE_LEVELS.map((level) => (
                <Pressable
                  key={level}
                  onPress={() => setSpice(level)}
                  className={cn(
                    "flex-1 h-9 rounded-lg items-center justify-center",
                    prefs.spicePreference === level
                      ? "bg-brand-500"
                      : "bg-ink-950"
                  )}
                >
                  <Text
                    className={cn(
                      "text-xs",
                      prefs.spicePreference === level
                        ? "font-bold text-night"
                        : "text-cream"
                    )}
                  >
                    {level === 0 ? "None" : level === 5 ? "🌶🌶" : "🌶".repeat(level)}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View className="gap-1.5">
              <Text className="text-[13px] font-semibold text-cream">
                Dietary
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
                Preferred cuisines
              </Text>
              <View className="flex-row flex-wrap gap-1.5">
                {prefs.preferredCuisines.map((c) => (
                  <View
                    key={c}
                    className="bg-wine px-2.5 py-1 rounded-full"
                  >
                    <Text className="text-[11px] font-semibold text-cream">
                      {c}
                    </Text>
                  </View>
                ))}
              </View>
              <View className="flex-row items-center gap-2 mt-1">
                <TextInput
                  value={cuisinesInput}
                  onChangeText={setCuisinesInput}
                  placeholder="Italian, Japanese…"
                  placeholderTextColor={COLORS.mute}
                  className="flex-1 bg-ink-950 border border-ink-700 rounded-full px-3 h-10 text-[13px] text-cream"
                  autoCapitalize="words"
                />
                <Pressable
                  onPress={addCuisines}
                  className="bg-brand-500 px-4 h-10 rounded-full items-center justify-center active:opacity-85"
                >
                  <Text className="text-night text-xs font-bold">Add</Text>
                </Pressable>
              </View>
            </View>
          </View>
        ) : null}

        <Pressable
          onPress={signOut}
          className="bg-ink-900 border border-ink-700 rounded-full py-3 items-center active:opacity-70"
        >
          <Text className="text-sm text-cream-mute font-semibold">
            Sign out
          </Text>
        </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}
