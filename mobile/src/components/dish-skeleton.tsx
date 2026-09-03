import { View } from "react-native";

/** Pulsing placeholder card shown while /dishes is loading. */
export function DishSkeleton() {
  return (
    <View
      className="bg-white rounded-2xl overflow-hidden border border-neutral-200"
      style={{
        boxShadow: "0 2px 6px rgba(0, 0, 0, 0.05)",
        borderCurve: "continuous",
      }}
    >
      <View className="w-full h-40 bg-neutral-200" />
      <View className="p-3 gap-2">
        <View className="h-4 w-3/4 rounded bg-neutral-200" />
        <View className="h-3 w-1/2 rounded bg-neutral-200" />
        <View className="flex-row justify-between mt-2">
          <View className="h-4 w-16 rounded bg-neutral-200" />
          <View className="h-3 w-12 rounded bg-neutral-200" />
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
