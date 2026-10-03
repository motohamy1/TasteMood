import { Image } from "expo-image";
import { Link } from "expo-router";
import { Pressable } from "react-native";

import { tabIcon } from "@/components/tab-icons";
import { COLORS } from "@/lib/theme";

/**
 * Profile avatar button for screen headers — white frosted circle with a
 * deep-wine icon, matching the reference's light header buttons.
 */
export function ProfileButton() {
  return (
    <Link href="/profile" asChild>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open profile"
        style={{
          width: 42,
          height: 42,
          borderRadius: 21,
          backgroundColor: COLORS.panel,
          borderWidth: 1,
          borderColor: COLORS.line,
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 2px 10px rgba(126,16,57,0.10)",
        }}
        hitSlop={8}
      >
        <Image
          source={tabIcon("profile", COLORS.amberCta, 22)}
          style={{ width: 22, height: 22 }}
        />
      </Pressable>
    </Link>
  );
}
