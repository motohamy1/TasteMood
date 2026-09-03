import { Text, View } from "react-native";

interface Props {
  title: string;
  description?: string;
  icon?: string;
}

export function EmptyState({ title, description, icon = "🍽" }: Props) {
  return (
    <View className="items-center justify-center py-16 px-6 gap-2">
      <Text className="text-5xl">{icon}</Text>
      <Text className="text-base font-semibold text-neutral-900 text-center">
        {title}
      </Text>
      {description ? (
        <Text className="text-sm text-neutral-500 text-center max-w-xs">
          {description}
        </Text>
      ) : null}
    </View>
  );
}
