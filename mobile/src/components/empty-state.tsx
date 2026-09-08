import { Text, View } from "react-native";

interface Props {
  title: string;
  description?: string;
  icon?: string;
}

export function EmptyState({ title, description, icon = "🍽" }: Props) {
  return (
    <View className="items-center justify-center py-14 px-6 gap-3">
      <View className="w-16 h-16 rounded-full bg-ink-900 border border-ink-700 items-center justify-center">
        <Text className="text-2xl">{icon}</Text>
      </View>
      <Text className="text-base font-semibold text-cream text-center">
        {title}
      </Text>
      {description ? (
        <Text className="text-sm text-cream-mute text-center max-w-xs">
          {description}
        </Text>
      ) : null}
    </View>
  );
}
