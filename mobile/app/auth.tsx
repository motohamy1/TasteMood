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
import { cn } from "@/lib/cn";

/**
 * /auth — present modally from the Saved / Profile screens.
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
    <ScrollView
      className="flex-1 bg-white"
      contentContainerClassName="px-5 gap-4"
      contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 32 }}
      contentInsetAdjustmentBehavior="automatic"
    >
      <Stack.Screen
        options={{
          title: "Sign in",
          presentation: "modal",
        }}
      />

      <Text className="text-2xl font-bold text-neutral-900">Welcome back</Text>
      <Text className="text-sm text-neutral-600">
        Sign in to sync your preferences, saved dishes, and AI history.
      </Text>

      <View className="gap-2">
        <Text className="text-xs font-semibold text-neutral-500 uppercase">
          Auth token
        </Text>
        <TextInput
          value={token}
          onChangeText={setToken}
          placeholder="paste a JWT, or use a mock-* token"
          placeholderTextColor="#a3a3a3"
          className="bg-neutral-50 border border-neutral-200 rounded-2xl px-4 py-3 text-sm text-neutral-900"
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
            busy || !token.trim() ? "bg-brand-200" : "bg-brand-500"
          )}
        >
          {busy ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text className="text-white text-sm font-semibold">Sign in</Text>
          )}
        </Pressable>

        {error ? (
          <Text className="text-xs text-red-600" selectable>
            {error}
          </Text>
        ) : null}
      </View>

      <View className="bg-brand-50 border border-brand-100 rounded-2xl p-3 gap-1">
        <Text className="text-xs font-semibold text-brand-700 uppercase">
          Dev shortcuts
        </Text>
        <Text className="text-xs text-neutral-700">
          The backend accepts tokens starting with{" "}
          <Text className="font-mono">mock-</Text> in development. Try:
        </Text>
        <View className="flex-row flex-wrap gap-2 mt-1">
          {["mock-user-demo", "mock-admin-demo"].map((mock) => (
            <Pressable
              key={mock}
              onPress={() => submit(mock)}
              disabled={busy}
              className="bg-white border border-brand-200 px-3 py-1.5 rounded-full"
            >
              <Text className="text-xs text-brand-700 font-medium">{mock}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}
