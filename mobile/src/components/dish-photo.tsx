import { Image } from "expo-image";
import { Text, View } from "react-native";

import { cn } from "@/lib/cn";

interface Props {
  /** Real photo URL; when null/undefined the emoji placeholder shows instead. */
  uri?: string | null;
  /** Placeholder glyph shown when there is no image yet. */
  emoji: string;
  /** Container classes — controls size, corner radius and placeholder tint. */
  className?: string;
  emojiSize?: number;
  accessibilityLabel?: string;
}

/**
 * A dish image surface that degrades gracefully: renders the real photo when
 * the catalog has one, otherwise a soft tile with a representative food emoji.
 * Because every current dish has `imageUrl: null`, this is what the whole
 * browse UI actually shows today — it upgrades to photos with no further work
 * once images are populated.
 */
export function DishPhoto({
  uri,
  emoji,
  className,
  emojiSize = 26,
  accessibilityLabel,
}: Props) {
  if (uri) {
    return (
      <Image
        source={{ uri }}
        className={cn("bg-[#ECECEC]", className)}
        contentFit="cover"
        transition={200}
        accessibilityLabel={accessibilityLabel}
      />
    );
  }

  return (
    <View
      className={cn("items-center justify-center overflow-hidden", className)}
      accessibilityLabel={accessibilityLabel}
    >
      <Text style={{ fontSize: emojiSize }} accessibilityRole="image">
        {emoji}
      </Text>
    </View>
  );
}
