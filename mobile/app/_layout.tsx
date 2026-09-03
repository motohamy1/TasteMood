import "../src/global.css";

import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useEffect, useMemo } from "react";

import { useAuthStore } from "@/lib/auth-store";

export default function RootLayout() {
  const queryClient = useMemo(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            staleTime: 30_000,
            refetchOnWindowFocus: false,
          },
        },
      }),
    []
  );

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
              contentStyle: { backgroundColor: "#fff7ed" },
            }}
          >
            <Stack.Screen name="(tabs)" />
            <Stack.Screen
              name="dish/[id]"
              options={{
                headerShown: true,
                title: "Dish details",
                headerBackTitle: "Back",
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
              }}
            />
          </Stack>
          <StatusBar style="dark" />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
