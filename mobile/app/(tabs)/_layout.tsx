import { Image } from "expo-image";
import { Pressable, Text, View } from "react-native";
import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { cn } from "@/lib/cn";
import { tabIcon } from "@/components/tab-icons";
import { useT } from "@/i18n";
import { AI_BUTTON_GLOW, COLORS } from "@/lib/theme";
import { useKeyboardVisible } from "@/lib/use-keyboard-visible";

/**
 * Tab bar matching the Paper design: a glowing amber spark button floating
 * beside a warm shell pill holding the other tabs, with a wine-tinted
 * active slot.
 */
function CustomTabBar({ state, navigation }: any) {
  const insets = useSafeAreaInsets();
  const keyboardVisible = useKeyboardVisible();
  const routes: Array<{ key: string; name: string }> = state.routes;
  const index: number = state.index;
  const spark = routes.find((r) => r.name === "ai");
  const rest = routes.filter((r) => r.name !== "ai");
  const sparkFocused = spark ? index === routes.indexOf(spark) : false;

  // The keyboard covers this area anyway — hiding avoids the bar riding up
  // with the Android adjustResize window shrink. Only the focused input
  // area should rise.
  if (keyboardVisible) return null;

  function goTo(name: string, focused: boolean) {
    const event = navigation.emit({
      type: "tabPress",
      target: name,
      canPreventDefault: true,
    });
    if (!focused && !event.defaultPrevented) {
      navigation.navigate(name);
    }
  }

  return (
    <View
      className="absolute left-0 right-0 flex-row items-center px-4 gap-3"
      style={{ bottom: insets.bottom + 12 }}
    >
      {spark ? (
        <Pressable
          onPress={() => goTo(spark.name, sparkFocused)}
          accessibilityRole="button"
          className={cn(
            "w-[66px] h-[66px] rounded-full items-center justify-center border",
            sparkFocused
              ? "bg-brand-300 border-brand-200"
              : "bg-brand-500 border-brand-200/60"
          )}
          style={{ boxShadow: AI_BUTTON_GLOW }}
        >
          <Image
            source={tabIcon("ai", COLORS.onAmber, 26)}
            style={{ width: 26, height: 26 }}
            accessibilityLabel="AI chef"
          />
        </Pressable>
      ) : null}

      <View
        className="flex-1 flex-row items-center h-[66px] rounded-full border-[1.5px]"
        style={{
          backgroundColor: COLORS.shell,
          borderColor: COLORS.shellLine,
          boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.55)",
        }}
      >
        {rest.map((route) => {
          const focused = index === routes.indexOf(route);
          return (
            <Pressable
              key={route.key}
              onPress={() => goTo(route.name, focused)}
              accessibilityRole="button"
              className={cn(
                "flex-1 items-center justify-center h-[54px] rounded-full mx-0.5",
                focused && "bg-shell-active"
              )}
            >
              <Image
                source={tabIcon(
                  route.name,
                  focused ? COLORS.iconOn : COLORS.iconIdle
                )}
                style={{ width: 24, height: 24 }}
              />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function TabsLayout() {
  const t = useT();

  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tabs.Screen name="index" options={{ title: t("home.discover") }} />
      <Tabs.Screen name="personality" options={{ title: t("personality.title") }} />
      <Tabs.Screen name="favourites" options={{ title: t("favourites.saved") }} />
      <Tabs.Screen name="ai" options={{ title: t("ai.chefOnline") }} />
    </Tabs>
  );
}
