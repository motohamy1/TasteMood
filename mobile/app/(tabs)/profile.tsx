import {
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Link } from "expo-router";
import { useState } from "react";

import { useAuthStore, selectIsSignedIn, selectUser } from "@/lib/auth-store";
import {
  useMyPreferences,
  useUpdateMyPreferences,
} from "@/lib/queries";
import { cn } from "@/lib/cn";

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
        "px-3 py-1.5 rounded-full border",
        active
          ? "bg-brand-500 border-brand-500"
          : "bg-white border-neutral-200"
      )}
    >
      <Text
        className={cn(
          "text-xs font-medium",
          active ? "text-white" : "text-neutral-700"
        )}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const isSignedIn = useAuthStore(selectIsSignedIn);
  const user = useAuthStore(selectUser);
  const signOut = useAuthStore((s) => s.signOut);

  const { data: prefs } = useMyPreferences();
  const updatePrefs = useUpdateMyPreferences();

  const [cuisinesInput, setCuisinesInput] = useState("");

  if (!isSignedIn) {
    return (
      <ScrollView
        className="flex-1 bg-brand-50"
        contentContainerClassName="px-4 gap-3"
        contentContainerStyle={{
          paddingTop: insets.top + 8,
          paddingBottom: 32,
        }}
        contentInsetAdjustmentBehavior="automatic"
      >
        <Text className="text-2xl font-bold text-neutral-900">Profile</Text>

        <View className="bg-white rounded-2xl border border-neutral-200 p-4 mt-2 flex-row items-center gap-3">
          <View className="w-14 h-14 rounded-full bg-brand-100 items-center justify-center">
            <Text className="text-2xl">👤</Text>
          </View>
          <View className="flex-1">
            <Text className="text-base font-semibold text-neutral-900">
              Guest
            </Text>
            <Text className="text-xs text-neutral-500">
              Sign in to sync your preferences
            </Text>
          </View>
        </View>

        <Link href="/auth" asChild>
          <Pressable className="bg-brand-500 rounded-full py-3 items-center mt-2">
            <Text className="text-white text-sm font-semibold">Sign in</Text>
          </Pressable>
        </Link>
      </ScrollView>
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
    <ScrollView
      className="flex-1 bg-brand-50"
      contentContainerClassName="px-4 gap-4"
      contentContainerStyle={{
        paddingTop: insets.top + 8,
        paddingBottom: 32,
      }}
      contentInsetAdjustmentBehavior="automatic"
    >
      <Text className="text-2xl font-bold text-neutral-900">Profile</Text>

      <View className="bg-white rounded-2xl border border-neutral-200 p-4 flex-row items-center gap-3">
        <View className="w-14 h-14 rounded-full bg-brand-100 items-center justify-center">
          <Text className="text-2xl">
            {user?.displayName?.[0]?.toUpperCase() ?? "👤"}
          </Text>
        </View>
        <View className="flex-1">
          <Text className="text-base font-semibold text-neutral-900">
            {user?.displayName ?? "TasteMood User"}
          </Text>
          <Text className="text-xs text-neutral-500">{user?.email}</Text>
        </View>
      </View>

      {prefs ? (
        <View className="bg-white rounded-2xl border border-neutral-200 p-4 gap-3">
          <Text className="text-sm font-semibold text-neutral-900">
            Spice preference
          </Text>
          <View className="flex-row gap-1">
            {SPICE_LEVELS.map((level) => (
              <Pressable
                key={level}
                onPress={() => setSpice(level)}
                className={cn(
                  "flex-1 h-9 rounded-md items-center justify-center",
                  prefs.spicePreference === level
                    ? "bg-brand-500"
                    : "bg-neutral-100"
                )}
              >
                <Text
                  className={cn(
                    "text-sm font-medium",
                    prefs.spicePreference === level
                      ? "text-white"
                      : "text-neutral-700"
                  )}
                >
                  {level === 0 ? "None" : level === 5 ? "🌶🌶🌶" : "🌶".repeat(level)}
                </Text>
              </Pressable>
            ))}
          </View>

          <View className="gap-1">
            <Text className="text-sm font-semibold text-neutral-900">
              Dietary
            </Text>
            <View className="flex-row flex-wrap gap-2">
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

          <View className="gap-1">
            <Text className="text-sm font-semibold text-neutral-900">
              Preferred cuisines
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {prefs.preferredCuisines.map((c) => (
                <View
                  key={c}
                  className="bg-neutral-100 px-3 py-1 rounded-full"
                >
                  <Text className="text-xs text-neutral-700">{c}</Text>
                </View>
              ))}
            </View>
            <View className="flex-row items-center gap-2 mt-1">
              <TextInput
                value={cuisinesInput}
                onChangeText={setCuisinesInput}
                placeholder="Italian, Japanese…"
                placeholderTextColor="#a3a3a3"
                className="flex-1 bg-neutral-50 border border-neutral-200 rounded-full px-3 h-10 text-sm text-neutral-900"
                autoCapitalize="words"
              />
              <Pressable
                onPress={addCuisines}
                className="bg-brand-500 px-3 h-10 rounded-full items-center justify-center"
              >
                <Text className="text-white text-xs font-semibold">Add</Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}

      <Pressable
        onPress={signOut}
        className="bg-white border border-neutral-200 rounded-full py-3 items-center"
      >
        <Text className="text-sm text-neutral-700 font-semibold">Sign out</Text>
      </Pressable>
    </ScrollView>
  );
}
