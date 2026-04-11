import type { ReactNode } from "react";
import { Text, View } from "react-native";

type SectionTitleProps = {
  title: string;
  subtitle?: string;
  right?: ReactNode;
};

export function SectionTitle({ title, subtitle, right }: SectionTitleProps) {
  return (
    <View className="mb-4 flex-row items-start justify-between gap-3">
      <View className="min-w-0 flex-1">
        <Text className="text-[28px] font-bold tracking-tight text-slate-900">{title}</Text>
        {subtitle ? (
          <Text className="mt-1.5 text-sm leading-5 text-slate-500">{subtitle}</Text>
        ) : null}
      </View>
      {right ? <View className="shrink-0 flex-row items-center self-start">{right}</View> : null}
    </View>
  );
}
