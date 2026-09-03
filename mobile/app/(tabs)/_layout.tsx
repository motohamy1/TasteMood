import { Tabs } from "expo-router";
import { Text, View } from "react-native";
import { cn } from "@/lib/cn";

/**
 * Simple SF-symbol-style icon glyphs rendered as text to keep zero deps.
 * Swap for `expo-symbols` later for proper icons.
 */
function TabIcon({
  focused,
  glyph,
  label,
}: {
  focused: boolean;
  glyph: string;
  label: string;
}) {
  return (
    <View
      className={cn(
        "items-center justify-center py-1 px-3 rounded-full",
        focused ? "bg-brand-100" : "bg-transparent"
      )}
    >
      <Text
        className={cn(
          "text-lg",
          focused ? "text-brand-600" : "text-neutral-500"
        )}
      >
        {glyph}
      </Text>
      <Text
        className={cn(
          "text-[10px] mt-0.5",
          focused ? "text-brand-600 font-semibold" : "text-neutral-500"
        )}
      >
        {label}
      </Text>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: "#ffffff",
          borderTopColor: "#fed7aa",
          height: 70,
          paddingTop: 8,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} glyph="🍽" label="Home" />
          ),
        }}
      />
      <Tabs.Screen
        name="saved"
        options={{
          title: "Saved",
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} glyph="♥" label="Saved" />
          ),
        }}
      />
      <Tabs.Screen
        name="ai"
        options={{
          title: "Explore",
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} glyph="🧭" label="Explore" />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} glyph="👤" label="Profile" />
          ),
        }}
      />
    </Tabs>
  );
}
