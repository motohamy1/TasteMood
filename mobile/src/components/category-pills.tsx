import { Pressable, ScrollView, Text } from "react-native";
import { cn } from "@/lib/cn";

interface Props {
  options: string[];
  selected: string;
  onSelect: (value: string) => void;
}

export function CategoryPills({ options, selected, onSelect }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="gap-1.5 px-4"
      contentInsetAdjustmentBehavior="automatic"
    >
      {options.map((option) => {
        const isActive = option === selected;
        return (
          <Pressable
            key={option}
            onPress={() => onSelect(option)}
            className={cn(
              "px-3.5 py-1.5 rounded-full border",
              isActive ? "bg-brand-500 border-brand-500" : "border-ink-700"
            )}
          >
            <Text
              className={cn(
                "text-xs",
                isActive ? "font-semibold text-night" : "font-medium text-cream"
              )}
            >
              {option}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
