import { View } from "react-native";
import { COLORS } from "@/lib/theme";

const LAYERS = [
  { size: 700, opacity: 0.05 },
  { size: 520, opacity: 0.06 },
  { size: 360, opacity: 0.08 },
  { size: 220, opacity: 0.10 },
];

/**
 * Stacked low-opacity blush circles that mimic the reference design's soft
 * rose bokeh glow bleeding off the upper-right of every screen. Purely
 * decorative — must sit inside an overflow-hidden wrapper, behind content.
 */
export function AmbientGlow({ top = 60 }: { top?: number }) {
  return (
    <View pointerEvents="none" className="absolute" style={{ right: -120, top }}>
      {LAYERS.map(({ size, opacity }) => (
        <View
          key={size}
          style={{
            position: "absolute",
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: COLORS.glowBlush,
            opacity,
            right: size / 2,
            top: size / 2,
          }}
        />
      ))}
    </View>
  );
}
