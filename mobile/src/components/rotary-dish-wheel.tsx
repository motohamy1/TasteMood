import React, { useCallback, useEffect, useState } from "react";
import {
  Dimensions,
  Pressable,
  Text,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type SharedValue,
} from "react-native-reanimated";
import { Image } from "expo-image";
import { router } from "expo-router";

import type { RecommendationItem } from "@/types/recommendation";
import { displayName, useLang, useT } from "@/i18n";
import { formatDistance, formatPrice } from "@/lib/format";
import { foodEmoji } from "@/lib/food-emoji";
import { CARD_SHADOW, COLORS } from "@/lib/theme";
import { MOODS } from "@/lib/recommendations";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// Wheel dimensions & geometry matching the circular dial reference
const CONTAINER_HEIGHT = 440;
const RADIUS = SCREEN_WIDTH * 0.76;
const CENTER_X = -SCREEN_WIDTH * 0.22;
const CENTER_Y = CONTAINER_HEIGHT * 0.48;
const DISC_RADIUS = RADIUS * 0.94;
const ANGLE_STEP = 33 * (Math.PI / 180); // ~33 deg per plate
const PLATE_SIZE = 132;

interface Props {
  items: RecommendationItem[];
  query?: string;
  activeMood?: number | null;
  onPanStateChange?: (isPanning: boolean) => void;
}

interface PlateProps {
  item: RecommendationItem;
  index: number;
  rotation: SharedValue<number>;
  isActive: boolean;
  onPress: () => void;
}

function DishPlate({ item, index, rotation, isActive, onPress }: PlateProps) {
  const animatedStyle = useAnimatedStyle(() => {
    // Current angle relative to the center focal point (0 rad)
    const relAngle = index * ANGLE_STEP - rotation.value;

    // Position along the circular perimeter
    const x = CENTER_X + RADIUS * Math.cos(relAngle) - PLATE_SIZE / 2;
    const y = CENTER_Y + RADIUS * Math.sin(relAngle) - PLATE_SIZE / 2;

    const absAngle = Math.abs(relAngle);

    // Scale: Focal item is scaled up (1.18x), neighboring items scale down
    const scale = interpolate(
      absAngle,
      [0, ANGLE_STEP, ANGLE_STEP * 2, ANGLE_STEP * 3],
      [1.18, 0.88, 0.72, 0.58],
      Extrapolation.CLAMP
    );

    // Opacity: smoothly fades out items further along the arc
    const opacity = interpolate(
      absAngle,
      [0, ANGLE_STEP * 1.5, ANGLE_STEP * 2.5],
      [1, 0.85, 0.35],
      Extrapolation.CLAMP
    );

    const zIndex = Math.round(100 - absAngle * 25);

    return {
      position: "absolute",
      left: x,
      top: y,
      transform: [{ scale }],
      opacity,
      zIndex,
    };
  });

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={item.dish.name}
        className="active:opacity-90"
        style={{
          width: PLATE_SIZE,
          height: PLATE_SIZE,
          borderRadius: PLATE_SIZE / 2,
          backgroundColor: "#FFFFFF",
          borderWidth: isActive ? 4 : 3,
          borderColor: isActive ? COLORS.amber : "#FFFFFF",
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.28,
          shadowRadius: 10,
          elevation: 12,
          overflow: "hidden",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {item.dish.imageUrl ? (
          <Image
            source={{ uri: item.dish.imageUrl }}
            style={{ width: "100%", height: "100%" }}
            contentFit="cover"
            transition={150}
          />
        ) : (
          <View
            style={{
              width: "100%",
              height: "100%",
              backgroundColor: COLORS.raised,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ fontSize: 46 }}>{foodEmoji(item.dish)}</Text>
          </View>
        )}

        {/* Circular glass lens overlay on active plate */}
        {isActive ? (
          <View
            style={{
              position: "absolute",
              bottom: 8,
              right: 8,
              width: 30,
              height: 30,
              borderRadius: 15,
              backgroundColor: "rgba(255, 255, 255, 0.85)",
              borderWidth: 1.5,
              borderColor: "rgba(255, 255, 255, 0.95)",
              alignItems: "center",
              justifyContent: "center",
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.2,
              shadowRadius: 4,
            }}
          >
            <Text style={{ fontSize: 13 }}>✨</Text>
          </View>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

export function RotaryDishWheel({
  items,
  query,
  activeMood,
  onPanStateChange,
}: Props) {
  const t = useT();
  const lang = useLang();
  const [activeIndex, setActiveIndex] = useState(0);

  const rotation = useSharedValue(0);
  const startRotation = useSharedValue(0);

  // Sync active index when items change
  useEffect(() => {
    setActiveIndex(0);
    rotation.value = 0;
  }, [items, rotation]);

  const snapToIndex = useCallback(
    (index: number) => {
      const clamped = Math.max(0, Math.min(items.length - 1, index));
      setActiveIndex(clamped);
      rotation.value = withSpring(clamped * ANGLE_STEP, {
        damping: 18,
        stiffness: 140,
        mass: 0.8,
      });
    },
    [items.length, rotation]
  );

  const panGesture = Gesture.Pan()
    .activeOffsetY([-6, 6])
    .onBegin(() => {
      startRotation.value = rotation.value;
      if (onPanStateChange) {
        runOnJS(onPanStateChange)(true);
      }
    })
    .onUpdate((e) => {
      const deltaAngle = -(e.translationY / RADIUS) * 1.05;
      const maxAngle = (items.length - 1) * ANGLE_STEP;
      const targetAngle = startRotation.value + deltaAngle;

      // Elastic resistance past boundaries
      if (targetAngle < 0) {
        rotation.value = targetAngle * 0.25;
      } else if (targetAngle > maxAngle) {
        rotation.value = maxAngle + (targetAngle - maxAngle) * 0.25;
      } else {
        rotation.value = targetAngle;
      }
    })
    .onEnd((e) => {
      const maxAngle = (items.length - 1) * ANGLE_STEP;
      // Inertial momentum projection
      const projectedAngle = rotation.value - (e.velocityY / RADIUS) * 0.22;
      const targetIndex = Math.max(
        0,
        Math.min(items.length - 1, Math.round(projectedAngle / ANGLE_STEP))
      );

      rotation.value = withSpring(targetIndex * ANGLE_STEP, {
        damping: 20,
        stiffness: 150,
        mass: 0.8,
      });
      runOnJS(setActiveIndex)(targetIndex);
    })
    .onFinalize(() => {
      if (onPanStateChange) {
        runOnJS(onPanStateChange)(false);
      }
    });

  const activeItem = items[activeIndex] ?? items[0];

  // Dynamic label for the left pill tag
  const leftTagLabel =
    query?.trim() ||
    (activeMood !== null && activeMood !== undefined && MOODS[activeMood]
      ? t(MOODS[activeMood].labelKey)
      : t("home.featured"));

  return (
    <View className="gap-4">
      {/* Clock Wheel Stage */}
      <GestureDetector gesture={panGesture}>
        <View
          style={{
            height: CONTAINER_HEIGHT,
            width: "100%",
            position: "relative",
            overflow: "hidden",
            borderRadius: 28,
            backgroundColor: "#F4EFF2",
          }}
        >
          {/* Deep dark circular disc on the left - clock wheel backdrop */}
          <View
            style={{
              position: "absolute",
              width: DISC_RADIUS * 2,
              height: DISC_RADIUS * 2,
              borderRadius: DISC_RADIUS,
              left: CENTER_X - DISC_RADIUS * 0.05,
              top: CENTER_Y - DISC_RADIUS,
              backgroundColor: "#140811",
              shadowColor: "#000",
              shadowOffset: { width: 4, height: 0 },
              shadowOpacity: 0.35,
              shadowRadius: 16,
              elevation: 8,
            }}
          />

          {/* Left Pill Tag (e.g. "Select Pasta" / Craving label) */}
          <View
            style={{
              position: "absolute",
              left: 0,
              top: CENTER_Y - 22,
              backgroundColor: "#FFFFFF",
              borderTopRightRadius: 22,
              borderBottomRightRadius: 22,
              paddingVertical: 10,
              paddingLeft: 14,
              paddingRight: 18,
              zIndex: 150,
              shadowColor: "#000",
              shadowOffset: { width: 2, height: 3 },
              shadowOpacity: 0.16,
              shadowRadius: 6,
              elevation: 9,
              maxWidth: SCREEN_WIDTH * 0.42,
            }}
          >
            <Text
              numberOfLines={1}
              style={{
                fontSize: 14,
                fontWeight: "700",
                color: COLORS.cream,
                letterSpacing: -0.2,
              }}
            >
              {leftTagLabel}
            </Text>
          </View>

          {/* Rotary Dish Plates along the perimeter */}
          {items.map((item, idx) => (
            <DishPlate
              key={item.dish.id}
              item={item}
              index={idx}
              rotation={rotation}
              isActive={idx === activeIndex}
              onPress={() => {
                if (idx === activeIndex) {
                  router.push({
                    pathname: "/dish/[id]",
                    params: { id: item.dish.id },
                  });
                } else {
                  snapToIndex(idx);
                }
              }}
            />
          ))}

          {/* Subtle scroll hint indicator */}
          <View
            style={{
              position: "absolute",
              right: 12,
              top: 14,
              backgroundColor: "rgba(255,255,255,0.75)",
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 12,
            }}
          >
            <Text style={{ fontSize: 11, fontWeight: "600", color: COLORS.dim }}>
              {activeIndex + 1} / {items.length} ↕
            </Text>
          </View>
        </View>
      </GestureDetector>

      {/* Active Dish Detail Card */}
      {activeItem ? (
        <Pressable
          onPress={() =>
            router.push({
              pathname: "/dish/[id]",
              params: { id: activeItem.dish.id },
            })
          }
          className="active:opacity-90"
          style={{
            backgroundColor: COLORS.panel,
            borderRadius: 20,
            padding: 16,
            borderWidth: 1,
            borderColor: COLORS.line,
            boxShadow: CARD_SHADOW,
          }}
        >
          <View className="flex-row items-start justify-between gap-3">
            <View className="flex-1 gap-1">
              <Text
                className="text-base font-bold text-cream"
                numberOfLines={1}
              >
                {displayName(lang, activeItem.dish)}
              </Text>
              <Text className="text-xs text-dim" numberOfLines={1}>
                {displayName(lang, activeItem.restaurant)}
                {activeItem.distanceMeters !== null
                  ? ` · ${formatDistance(activeItem.distanceMeters)}`
                  : ""}
              </Text>
            </View>

            <View className="items-end">
              <Text className="text-base font-bold text-amber">
                {formatPrice(
                  activeItem.dish.price,
                  activeItem.dish.currency
                )}
              </Text>
            </View>
          </View>

          {/* AI Reason explanation */}
          {activeItem.reason ? (
            <View className="mt-3 pt-2.5 border-t border-line/60">
              <Text
                className="text-xs italic leading-4 text-dim"
                numberOfLines={2}
              >
                ✨ {activeItem.reason}
              </Text>
            </View>
          ) : null}

          {/* Action Row */}
          <View className="mt-3 flex-row items-center justify-between">
            <Text className="text-xs font-semibold text-accentText">
              {t("common.seeAll")} →
            </Text>
            <View className="bg-brand-cta rounded-full px-3 py-1.5">
              <Text className="text-xs font-bold text-night">
                {t("common.all")}
              </Text>
            </View>
          </View>
        </Pressable>
      ) : null}
    </View>
  );
}
