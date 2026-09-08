import { Image } from "expo-image";
import { Link } from "expo-router";
import { Pressable } from "react-native";

import { tabIcon } from "@/components/tab-icons";

/** Soft single-layer amber halo — matches the Paper header button. */
const PROFILE_BUTTON_GLOW = "0 2px 14px rgba(219, 147, 56, 0.27)";

/**
 * Amber profile shortcut shown in the top-right of every tab screen's
 * header — profile is no longer a tab of its own.
 */
export function ProfileButton() {
  return (
    <Link href="/profile" asChild>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open profile"
        className="w-10 h-10 rounded-full bg-brand-500 border border-brand-200/60 items-center justify-center active:opacity-85 shrink-0"
        style={{ boxShadow: PROFILE_BUTTON_GLOW }}
        hitSlop={8}
      >
        <Image
          source={tabIcon("profile", "#431407", 22)}
          style={{ width: 22, height: 22 }}
        />
      </Pressable>
    </Link>
  );
}
