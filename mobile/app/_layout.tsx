import "../src/global.css";

import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  QueryClient,
  QueryClientProvider,
  QueryCache,
  MutationCache,
} from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { I18nManager } from "react-native";
import { useEffect, useMemo } from "react";

import { AuthError } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { useLanguageStore } from "@/i18n";
import { COLORS } from "@/lib/theme";

// Full RTL mirroring for Arabic (Q25): mirrored layout is applied whenever the
// stored language is Arabic — takes effect on app start/restart.
I18nManager.allowRTL(true);

export default function RootLayout() {
  const hydrateLanguage = useLanguageStore((s) => s.hydrate);

  useEffect(() => {
    void hydrateLanguage();
  }, [hydrateLanguage]);

  const queryClient = useMemo(() => {
    // Session expiry (WR-06): any authed call rejecting with 401 means the
    // stored token is dead — sign out instead of failing silently forever.
    const onAuthError = (error: Error) => {
      if (error instanceof AuthError) {
        void useAuthStore.getState().signOut();
      }
    };
    return new QueryClient({
      queryCache: new QueryCache({ onError: onAuthError }),
      mutationCache: new MutationCache({ onError: onAuthError }),
      defaultOptions: {
        queries: {
          retry: 1,
          staleTime: 30_000,
          refetchOnWindowFocus: false,
        },
      },
    });
  }, []);

  const hydrate = useAuthStore((s) => s.hydrate);
  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: COLORS.ink950 },
            }}
          >
            <Stack.Screen name="(tabs)" />
            <Stack.Screen
              name="dishes"
              options={{
                headerShown: true,
                title: "All dishes",
                headerBackTitle: "Back",
                presentation: "card",
                headerStyle: { backgroundColor: COLORS.ink950 },
                headerTintColor: COLORS.cream,
                headerTitleStyle: { color: COLORS.cream, fontWeight: "700" },
              }}
            />
            <Stack.Screen
              name="profile"
              options={{
                headerShown: true,
                title: "Profile",
                headerBackTitle: "Back",
                presentation: "card",
                headerStyle: { backgroundColor: COLORS.ink950 },
                headerTintColor: COLORS.cream,
                headerTitleStyle: { color: COLORS.cream, fontWeight: "700" },
              }}
            />
            <Stack.Screen
              name="dish/[id]"
              options={{
                headerShown: false,
                presentation: "card",
              }}
            />
            <Stack.Screen
              name="auth"
              options={{
                headerShown: true,
                title: "Sign in",
                presentation: "modal",
                headerBackTitle: "Close",
                headerStyle: { backgroundColor: COLORS.ink950 },
                headerTintColor: COLORS.cream,
                headerTitleStyle: { color: COLORS.cream, fontWeight: "700" },
              }}
            />
          </Stack>
          <StatusBar style="light" />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
