import { Link } from "expo-router";
import { Text, View } from "react-native";

import { useT } from "@/i18n";
import { COLORS } from "@/lib/theme";

interface Props {
  title: string;
  actionLabel?: string;
  actionHref?: string;
}

/** Screen section header: bold title on dark, orange "See all" link. */
export function SectionHeader({ title, actionLabel, actionHref }: Props) {
  const t = useT();

  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
      <Text style={{ fontSize: 17, fontWeight: "800", color: COLORS.cream }}>{title}</Text>
      {actionHref ? (
        <Link href={actionHref as never} asChild>
          <Text style={{ fontSize: 12, fontWeight: "700", color: COLORS.amber }}>
            {actionLabel ?? t("common.seeAll")}
          </Text>
        </Link>
      ) : null}
    </View>
  );
}
