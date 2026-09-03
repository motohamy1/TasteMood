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
      contentContainerClassName="gap-2 px-4"
      contentInsetAdjustmentBehavior="automatic"
    >
      {options.map((option) => {
        const isActive = option === selected;
        return (
          <Pressable
            key={option}
            onPress={() => onSelect(option)}
            className={cn(
              "px-4 py-2 rounded-full border",
              isActive
                ? "bg-brand-500 border-brand-500"
                : "bg-white border-neutral-200"
            )}
          >
            <Text
              className={cn(
                "text-sm font-medium",
                isActive ? "text-white" : "text-neutral-700"
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
