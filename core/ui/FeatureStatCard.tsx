import type { ReactNode } from "react";
import { Text, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { Card } from "@/core/ui/Card";
<<<<<<< HEAD
=======
import { useAppTheme } from "@/core/theme";
>>>>>>> a74517a (dark mode, documentatiton, blank fix)

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
<<<<<<< HEAD
  return (
    <Card variant="stat" accentColor={accentColor} className={["mb-0", className].filter(Boolean).join(" ")}>
      <View className="items-center py-1.5">
        <View
          className="mb-2 h-10 w-10 items-center justify-center rounded-xl"
          style={{ backgroundColor: `${accentColor}16` }}
=======
  const { colors } = useAppTheme();

  return (
    <Card
      variant="stat"
      accentColor={accentColor}
      className={["mb-0", className].filter(Boolean).join(" ")}
    >
      <View className="items-center py-1.5">
        <View
          className="mb-2 h-10 w-10 items-center justify-center rounded-xl"
          style={{ backgroundColor: `${accentColor}${colors.statusBarStyle === "dark" ? "24" : "16"}` }}
>>>>>>> a74517a (dark mode, documentatiton, blank fix)
        >
          <MaterialIcons name={icon} size={20} color={textColor} />
        </View>
        <View className="flex-row items-end gap-1">
<<<<<<< HEAD
          <Text
            className="text-[26px] font-bold tracking-tight"
            style={{ color: textColor }}
          >
=======
          <Text className="text-[26px] font-bold tracking-tight" style={{ color: textColor }}>
>>>>>>> a74517a (dark mode, documentatiton, blank fix)
            {value}
          </Text>
          {valueSuffix}
        </View>
<<<<<<< HEAD
        <Text className="mt-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
=======
        <Text
          className="mt-1 text-[11px] font-semibold uppercase tracking-[0.12em]"
          style={{ color: colors.textSubtle }}
        >
>>>>>>> a74517a (dark mode, documentatiton, blank fix)
          {label}
        </Text>
      </View>
    </Card>
  );
}
