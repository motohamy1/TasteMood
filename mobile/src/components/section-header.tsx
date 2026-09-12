import { Link } from "expo-router";
import { Text, View } from "react-native";

import { useT } from "@/i18n";

interface Props {
  title: string;
  actionLabel?: string;
  actionHref?: string;
}

/** Screen section header: bold title, "See all" link. */
export function SectionHeader({ title, actionLabel, actionHref }: Props) {
  const t = useT();

  return (
    <View className="flex-row items-center justify-between">
      <Text className="text-base font-bold text-cream">{title}</Text>
      {actionHref ? (
        <Link href={actionHref as never} asChild>
          <Text className="text-xs font-semibold text-accent">
            {actionLabel ?? t("common.seeAll")}
          </Text>
        </Link>
      ) : null}
    </View>
  );
}
