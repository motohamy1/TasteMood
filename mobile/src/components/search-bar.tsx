import { Text, TextInput, View } from "react-native";
import { cn } from "@/lib/cn";
import { useT } from "@/i18n";
import { COLORS } from "@/lib/theme";

interface Props {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function SearchBar({
  value,
  onChangeText,
  placeholder,
  className,
}: Props) {
  const t = useT();

  return (
    <View
      className={cn(
        "flex-row items-center gap-2 px-3.5 h-11 rounded-full",
        "bg-ink-900 border border-ink-700",
        className
      )}
    >
      <Text className="text-sm">🔍</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder ?? t("dishes.searchPlaceholder")}
        placeholderTextColor={COLORS.mute}
        className="flex-1 text-[13px] text-cream"
        returnKeyType="search"
        autoCorrect={false}
        autoCapitalize="none"
      />
    </View>
  );
}
