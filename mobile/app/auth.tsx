import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Stack, router, Link } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuthStore } from "@/lib/auth-store";
import { AmbientGlow } from "@/components/ambient-glow";
import { cn } from "@/lib/cn";
import { useT } from "@/i18n";
import { COLORS } from "@/lib/theme";

export default function AuthScreen() {
  const insets = useSafeAreaInsets();
  const t = useT();
  const signInWithEmail = useAuthStore((s) => s.signInWithEmail);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!email.trim() || !password) return;
    setBusy(true);
    setError(null);
    try {
      await signInWithEmail(email.trim(), password);
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setBusy(false);
    }
  }

  const canSubmit = email.trim().length > 0 && password.length > 0;

  return (
    <View className="flex-1 bg-ink-950 overflow-hidden">
      <AmbientGlow />
      <ScrollView
        className="flex-1 bg-transparent"
        contentContainerClassName="px-5 gap-4"
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 32 }}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Stack.Screen
          options={{
            title: t("common.signIn"),
            presentation: "modal",
          }}
        />

        <View className="gap-1">
          <Text className="text-[10px] font-semibold uppercase tracking-[0.12em] text-accent">
            {t("common.signIn")}
          </Text>
          <Text className="text-2xl font-bold text-brand-50">
            {t("auth.welcomeBack")}
          </Text>
          <Text className="text-sm text-cream-mute">
            {t("auth.signInSubtitle")}
          </Text>
        </View>

        <View className="gap-3">
          <View className="gap-1.5">
            <Text className="text-[10px] font-semibold uppercase tracking-[0.12em] text-cream-mute">
              {t("auth.email")}
            </Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder={t("auth.emailPlaceholder")}
              placeholderTextColor={COLORS.mute}
              className="bg-ink-900 border border-ink-700 rounded-2xl px-4 py-3 text-sm text-cream"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              autoComplete="email"
              textContentType="emailAddress"
            />
          </View>

          <View className="gap-1.5">
            <Text className="text-[10px] font-semibold uppercase tracking-[0.12em] text-cream-mute">
              {t("auth.password")}
            </Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder={t("auth.passwordPlaceholder")}
              placeholderTextColor={COLORS.mute}
              className="bg-ink-900 border border-ink-700 rounded-2xl px-4 py-3 text-sm text-cream"
              secureTextEntry
              autoCapitalize="none"
              autoComplete="password"
              textContentType="password"
            />
          </View>

          <Pressable
            onPress={submit}
            disabled={busy || !canSubmit}
            className={cn(
              "rounded-full py-3 items-center",
              busy || !canSubmit ? "bg-ink-700" : "bg-brand-cta active:opacity-85"
            )}
          >
            {busy ? (
              <ActivityIndicator color={COLORS.night} />
            ) : (
              <Text
                className={cn(
                  "text-sm font-bold",
                  busy || !canSubmit ? "text-cream-mute" : "text-night"
                )}
              >
                {t("common.signIn")}
              </Text>
            )}
          </Pressable>

          {error ? (
            <Text className="text-xs text-danger" selectable>
              {error}
            </Text>
          ) : null}

          <View className="flex-row items-center justify-center gap-1 mt-1">
            <Text className="text-xs text-cream-mute">{t("auth.noAccount")}</Text>
            <Link href="/sign-up" asChild>
              <Pressable className="py-1">
                <Text className="text-xs font-semibold text-accent">
                  {t("auth.signUp")}
                </Text>
              </Pressable>
            </Link>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
