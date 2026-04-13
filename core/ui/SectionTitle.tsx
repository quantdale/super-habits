import { Text, View } from "react-native";
import { useAppTheme } from "@/core/providers/ThemeProvider";

type SectionTitleProps = {
  title: string;
  subtitle?: string;
};

export function SectionTitle({ title, subtitle }: SectionTitleProps) {
  const { tokens } = useAppTheme();

  return (
    <View>
      <Text className="text-2xl font-bold" style={{ color: tokens.text }}>{title}</Text>
      {subtitle ? <Text className="mb-4 mt-1 text-sm" style={{ color: tokens.textMuted }}>{subtitle}</Text> : null}
    </View>
  );
}
