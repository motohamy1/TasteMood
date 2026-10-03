import { useEffect, useRef } from "react";
import { Animated, Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { tabIcon } from "@/components/tab-icons";
import { useLang } from "@/i18n";
import { COLORS } from "@/lib/theme";
import { useKeyboardVisible } from "@/lib/use-keyboard-visible";

/** Standalone AI Floating Tab Button (Alone from the rest of the tabs). */
function AITabButton({
  focused,
  onPress,
  label,
}: {
  focused: boolean;
  onPress: () => void;
  label: string;
}) {
  const scaleAnim = useRef(new Animated.Value(focused ? 1.05 : 1)).current;

  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: focused ? 1.05 : 1,
      useNativeDriver: true,
      friction: 6,
      tension: 100,
    }).start();
  }, [focused, scaleAnim]);

  return (
    <View
      style={{
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: focused ? COLORS.amberCta : COLORS.panel,
        borderWidth: 1.5,
        borderColor: focused ? COLORS.amber : COLORS.line,
        elevation: 6,
        shadowColor: "#2A0F1C",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        overflow: "hidden",
      }}
    >
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityState={{ selected: focused }}
        style={{
          width: "100%",
          height: "100%",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Animated.View
          style={{
            alignItems: "center",
            justifyContent: "center",
            gap: 2,
            transform: [{ scale: scaleAnim }],
          }}
        >
          <Image
            source={tabIcon("ai", focused ? COLORS.night : COLORS.amber, 20)}
            style={{ width: 20, height: 20 }}
            accessibilityLabel="AI"
          />
          <Text
            numberOfLines={1}
            style={{
              fontSize: 9.5,
              fontWeight: "800",
              color: focused ? COLORS.night : COLORS.amber,
              letterSpacing: 0.3,
              textTransform: "uppercase",
            }}
          >
            {label}
          </Text>
        </Animated.View>
      </Pressable>
    </View>
  );
}

/** Main Tab Item inside the floating capsule. */
function MainTabItem({
  focused,
  onPress,
  label,
  iconName,
}: {
  focused: boolean;
  onPress: () => void;
  label: string;
  iconName: string;
}) {
  const scaleAnim = useRef(new Animated.Value(focused ? 1.05 : 1)).current;

  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: focused ? 1.05 : 1,
      useNativeDriver: true,
      friction: 6,
      tension: 100,
    }).start();
  }, [focused, scaleAnim]);

  const activeColor = COLORS.amber;
  const idleColor = COLORS.mute;

  return (
    <View
      style={{
        flex: 1,
        height: "100%",
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 2,
      }}
    >
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityState={{ selected: focused }}
        style={{
          width: "100%",
          height: 44,
          borderRadius: 22,
          backgroundColor: focused ? COLORS.wine : "transparent",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Animated.View
          style={{
            alignItems: "center",
            justifyContent: "center",
            gap: 2,
            transform: [{ scale: scaleAnim }],
          }}
        >
          <Image
            source={tabIcon(iconName, focused ? activeColor : idleColor, 20)}
            style={{ width: 20, height: 20 }}
          />
          <Text
            numberOfLines={1}
            style={{
              fontSize: 9.5,
              fontWeight: focused ? "700" : "500",
              color: focused ? activeColor : idleColor,
              letterSpacing: 0.1,
            }}
          >
            {label}
          </Text>
        </Animated.View>
      </Pressable>
    </View>
  );
}

/**
 * Custom Floating Tab Bar:
 * - Standalone AI button on the left (isolated from the other tabs)
 * - Rounded floating capsule on the right holding Personality, Explore, Loved
 * - Floats ~5px from the bottom with Android elevation & iOS shadows
 */
function CustomTabBar({ state, navigation }: any) {
  const insets = useSafeAreaInsets();
  const lang = useLang();
  const keyboardVisible = useKeyboardVisible();
  const routes: Array<{ key: string; name: string }> = state.routes;
  const currentRouteName = routes[state.index]?.name;

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

  const TAB_LABELS: Record<string, string> = {
    ai: "AI",
    personality: lang === "ar" ? "شخصيتي" : "Personality",
    index: lang === "ar" ? "استكشف" : "Explore",
    favourites: lang === "ar" ? "المفضلة" : "Loved",
  };

  const TAB_ICON_NAMES: Record<string, string> = {
    ai: "ai",
    personality: "personality",
    index: "index",
    favourites: "favourites",
  };

  const aiRoute = routes.find((r) => r.name === "ai");
  const isAIFocused = currentRouteName === "ai";

  // Ordered list of the rest of the tabs
  const mainTabNames = ["personality", "index", "favourites"];
  const mainRoutes = mainTabNames
    .map((name) => routes.find((r) => r.name === name))
    .filter(Boolean) as Array<{ key: string; name: string }>;

  return (
    <View
      style={{
        position: "absolute",
        left: 14,
        right: 14,
        bottom: insets.bottom > 0 ? insets.bottom + 5 : 6,
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        zIndex: 50,
      }}
    >
      {/* ── Standalone AI Tab (Alone from the rest of the tabs) ── */}
      {aiRoute ? (
        <AITabButton
          focused={isAIFocused}
          onPress={() => goTo("ai", isAIFocused)}
          label={TAB_LABELS.ai}
        />
      ) : null}

      {/* ── Main Floating Capsule: Personality, Explore, Loved ── */}
      <View
        style={{
          flex: 1,
          height: 56,
          borderRadius: 28,
          backgroundColor: COLORS.panel,
          borderWidth: 1.5,
          borderColor: COLORS.line,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 4,
          elevation: 6,
          shadowColor: "#2A0F1C",
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.12,
          shadowRadius: 8,
        }}
      >
        {mainRoutes.map((route) => {
          const focused = currentRouteName === route.name;
          const label = TAB_LABELS[route.name] ?? route.name;
          const iconName = TAB_ICON_NAMES[route.name] ?? route.name;

          return (
            <MainTabItem
              key={route.key}
              focused={focused}
              onPress={() => goTo(route.name, focused)}
              label={label}
              iconName={iconName}
            />
          );
        })}
      </View>
    </View>
  );
}

export default function TabsLayout() {
  const lang = useLang();

  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        animation: "fade",
      }}
      initialRouteName="index"
    >
      <Tabs.Screen
        name="ai"
        options={{
          title: "AI",
        }}
      />
      <Tabs.Screen
        name="personality"
        options={{
          title: lang === "ar" ? "شخصيتي" : "Personality",
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: lang === "ar" ? "استكشف" : "Explore",
        }}
      />
      <Tabs.Screen
        name="favourites"
        options={{
          title: lang === "ar" ? "المفضلة" : "Loved",
        }}
      />
    </Tabs>
  );
}
