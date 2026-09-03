import { Link } from "expo-router";
import { Text, View } from "react-native";

interface Props {
  title: string;
  actionLabel?: string;
  actionHref?: string;
}

/** Screen section header: bold title left, "See all" link right. */
export function SectionHeader({ title, actionLabel = "See all", actionHref }: Props) {
  return (
    <View className="flex-row items-center justify-between">
      <Text className="text-lg font-bold text-neutral-900">{title}</Text>
      {actionHref ? (
        <Link href={actionHref as never} asChild>
          <Text className="text-xs font-semibold text-brand-600">
            {actionLabel}
          </Text>
        </Link>
      ) : null}
    </View>
  );
}
