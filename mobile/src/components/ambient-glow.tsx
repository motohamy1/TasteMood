import { View } from "react-native";

const LAYERS = [
  { size: 660, opacity: 0.1 },
  { size: 500, opacity: 0.12 },
  { size: 350, opacity: 0.13 },
  { size: 210, opacity: 0.14 },
];

/**
 * Stacked low-opacity wine circles that fake the design's soft radial
 * ember glow bleeding off the upper-left of every screen. Purely
 * decorative — must sit inside an overflow-hidden wrapper, behind content.
 */
export function AmbientGlow({ top = 120 }: { top?: number }) {
  return (
    <View pointerEvents="none" className="absolute" style={{ left: -110, top }}>
      {LAYERS.map(({ size, opacity }) => (
        <View
          key={size}
          className="absolute bg-glow"
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            opacity,
            left: size / 2,
            top: size / 2,
          }}
        />
      ))}
    </View>
  );
}
