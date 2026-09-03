import { Text, TextInput, View } from "react-native";
import { cn } from "@/lib/cn";

interface Props {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function SearchBar({
  value,
  onChangeText,
  placeholder = "Search dishes, cuisines…",
  className,
}: Props) {
  return (
    <View
      className={cn(
        "flex-row items-center gap-2 px-3 h-11 rounded-full bg-white border border-neutral-200",
        className
      )}
    >
      <Text className="text-base">🔍</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#a3a3a3"
        className="flex-1 text-sm text-neutral-900"
        returnKeyType="search"
        autoCorrect={false}
        autoCapitalize="none"
      />
    </View>
  );
}
