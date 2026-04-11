import type { ReactNode } from "react";
import { Text, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { Card } from "@/core/ui/Card";

type FeatureStatCardProps = {
  icon: keyof typeof MaterialIcons.glyphMap;
  value: string | number;
  label: string;
  accentColor: string;
  textColor: string;
  className?: string;
  valueSuffix?: ReactNode;
};

export function FeatureStatCard({
  icon,
  value,
  label,
  accentColor,
  textColor,
  className,
  valueSuffix,
}: FeatureStatCardProps) {
  return (
    <Card variant="stat" accentColor={accentColor} className={["mb-0", className].filter(Boolean).join(" ")}>
      <View className="items-center py-1.5">
        <View
          className="mb-2 h-10 w-10 items-center justify-center rounded-xl"
          style={{ backgroundColor: `${accentColor}16` }}
        >
          <MaterialIcons name={icon} size={20} color={textColor} />
        </View>
        <View className="flex-row items-end gap-1">
          <Text
            className="text-[26px] font-bold tracking-tight"
            style={{ color: textColor }}
          >
            {value}
          </Text>
          {valueSuffix}
        </View>
        <Text className="mt-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
          {label}
        </Text>
      </View>
    </Card>
  );
}
