import { MaterialIcons } from "@expo/vector-icons";
import { Text, View } from "react-native";
import { useAppTheme } from "@/core/providers/ThemeProvider";
import { Card } from "./Card";

type FeatureStatCardProps = {
  accentColor: string;
  textColor: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  title: string;
  value: string | number;
  subtitle: string;
  note?: string;
  className?: string;
};

export function FeatureStatCard({
  accentColor,
  textColor,
  icon,
  title,
  value,
  subtitle,
  note,
  className,
}: FeatureStatCardProps) {
  const { tokens } = useAppTheme();

  return (
    <Card accentColor={accentColor} className={["mb-0", className].filter(Boolean).join(" ")}>
      <View className="flex-row items-start justify-between gap-3">
        <View className="min-w-0 flex-1">
          <View className="flex-row items-center gap-3">
            <View
              className="h-11 w-11 items-center justify-center rounded-xl"
              style={{ backgroundColor: `${accentColor}18` }}
            >
              <MaterialIcons name={icon} size={22} color={textColor} />
            </View>
            <View className="min-w-0 flex-1">
              <Text className="text-sm font-semibold" style={{ color: tokens.text }}>
                {title}
              </Text>
              <Text className="mt-0.5 text-xs" style={{ color: tokens.textMuted }}>
                {subtitle}
              </Text>
            </View>
          </View>

          <Text className="mt-4 text-3xl font-bold tabular-nums tracking-tight" style={{ color: tokens.text }}>
            {value}
          </Text>
          {note ? (
            <Text className="mt-1 text-sm" style={{ color: tokens.textMuted }}>
              {note}
            </Text>
          ) : null}
        </View>
      </View>
    </Card>
  );
}
