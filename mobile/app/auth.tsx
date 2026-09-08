import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Stack, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuthStore } from "@/lib/auth-store";
import { AmbientGlow } from "@/components/ambient-glow";
import { cn } from "@/lib/cn";
import { COLORS } from "@/lib/theme";

/**
 * /auth — present modally from the Favourites / Personality / Profile screens.
 *
 * For now this is a dev-friendly screen that accepts either:
 *   1. A Supabase JWT pasted in (for testing the real path), or
 *   2. A `mock-user-...` / `mock-admin-...` token (the backend accepts these in dev)
 *
 * Swap the body for `supabase.auth.signInWithPassword()` once the
 * Supabase project is wired up — the rest of the app only depends on
 * `signInWithToken(token)`.
 */
export default function AuthScreen() {
  const insets = useSafeAreaInsets();
  const signInWithToken = useAuthStore((s) => s.signInWithToken);
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(t: string) {
    if (!t.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await signInWithToken(t.trim());
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View className="flex-1 bg-ink-950 overflow-hidden">
      <AmbientGlow />
      <ScrollView
        className="flex-1 bg-transparent"
        contentContainerClassName="px-5 gap-4"
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 32 }}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
      >
        <Stack.Screen
          options={{
            title: "Sign in",
            presentation: "modal",
          }}
        />

        <View className="gap-1">
          <Text className="text-[10px] font-semibold uppercase tracking-[0.12em] text-brand-500">
            Access • JWT
          </Text>
          <Text className="text-2xl font-bold text-brand-50">
            Welcome back
          </Text>
          <Text className="text-sm text-cream-mute">
            Sign in to sync your preferences, saved dishes, and AI history.
          </Text>
        </View>

        <View className="gap-2">
          <Text className="text-[10px] font-semibold uppercase tracking-[0.12em] text-cream-mute">
            Auth token
          </Text>
          <TextInput
            value={token}
            onChangeText={setToken}
            placeholder="paste a JWT, or use a mock-* token"
            placeholderTextColor={COLORS.mute}
            className="bg-ink-900 border border-ink-700 rounded-2xl px-4 py-3 text-sm text-cream"
            autoCapitalize="none"
            autoCorrect={false}
            multiline
            numberOfLines={3}
          />
          <Pressable
            onPress={() => submit(token)}
            disabled={busy || !token.trim()}
            className={cn(
              "rounded-full py-3 items-center",
              busy || !token.trim() ? "bg-ink-700" : "bg-brand-500 active:opacity-85"
            )}
          >
            {busy ? (
              <ActivityIndicator color={COLORS.night} />
            ) : (
              <Text
                className={cn(
                  "text-sm font-bold",
                  busy || !token.trim() ? "text-cream-mute" : "text-night"
                )}
              >
                Sign in
              </Text>
            )}
          </Pressable>

          {error ? (
            <Text className="text-xs text-[#FECACA]" selectable>
              {error}
            </Text>
          ) : null}
        </View>

        <View className="bg-ink-900 border border-wine rounded-2xl p-3 gap-1">
          <Text className="text-[10px] font-bold uppercase tracking-[0.12em] text-brand-500">
            Dev shortcuts
          </Text>
          <Text className="text-xs text-cream-dim">
            The backend accepts tokens starting with{" "}
            <Text className="font-mono">mock-</Text> in development. Try:
          </Text>
          <View className="flex-row flex-wrap gap-2 mt-1">
            {["mock-user-demo", "mock-admin-demo"].map((mock) => (
              <Pressable
                key={mock}
                onPress={() => submit(mock)}
                disabled={busy}
                className="border border-ink-700 px-3 py-1.5 rounded-full active:opacity-70"
              >
                <Text className="text-xs text-brand-500 font-medium">{mock}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
