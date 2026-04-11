import type { ReactNode } from "react";
import { Text, View } from "react-native";
import { useAppTheme } from "@/core/theme";

type SectionTitleProps = {
  title: string;
  subtitle?: string;
  right?: ReactNode;
};

export function SectionTitle({ title, subtitle, right }: SectionTitleProps) {
<<<<<<< HEAD
  return (
    <View className="mb-4 flex-row items-start justify-between gap-3">
      <View className="min-w-0 flex-1">
        <Text className="text-[28px] font-bold tracking-tight text-slate-900">{title}</Text>
        {subtitle ? (
          <Text className="mt-1.5 text-sm leading-5 text-slate-500">{subtitle}</Text>
=======
  const { colors } = useAppTheme();

  return (
    <View className="mb-4 flex-row items-start justify-between gap-3">
      <View className="min-w-0 flex-1">
        <Text className="text-[28px] font-bold tracking-tight" style={{ color: colors.text }}>
          {title}
        </Text>
        {subtitle ? (
          <Text className="mt-1.5 text-sm leading-5" style={{ color: colors.textMuted }}>
            {subtitle}
          </Text>
>>>>>>> a74517a (dark mode, documentatiton, blank fix)
        ) : null}
      </View>
      {right ? <View className="shrink-0 flex-row items-center self-start">{right}</View> : null}
    </View>
  );
}
