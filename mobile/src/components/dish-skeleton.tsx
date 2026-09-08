import { View } from "react-native";

/** Pulsing placeholder card shown while /dishes is loading. */
export function DishSkeleton() {
  return (
    <View className="bg-ink-900 border border-ink-700 rounded-2xl overflow-hidden">
      <View className="w-full h-[88px] bg-ink-800" />
      <View className="p-2.5 gap-1.5">
        <View className="h-3.5 w-3/4 rounded bg-ink-800" />
        <View className="h-2.5 w-1/2 rounded bg-ink-800" />
        <View className="flex-row justify-between mt-1">
          <View className="h-3.5 w-14 rounded bg-ink-800" />
          <View className="h-2.5 w-10 rounded bg-ink-800" />
        </View>
      </View>
    </View>
  );
}

export function DishSkeletonGrid({ count = 4 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <DishSkeleton key={i} />
      ))}
    </>
  );
}
