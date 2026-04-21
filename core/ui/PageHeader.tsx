import type { ReactNode } from "react";
import { Text, View } from "react-native";
import { useAppTheme } from "@/core/providers/ThemeProvider";

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
};

export function PageHeader({ title, subtitle, actions, className }: PageHeaderProps) {
  const { tokens } = useAppTheme();

  return (
    <View
      className={["flex-row items-start justify-between gap-4", className].filter(Boolean).join(" ")}
    >
      <View className="min-w-0 flex-1">
        <Text className="text-2xl font-bold leading-tight" style={{ color: tokens.text }}>
          {title}
        </Text>
        {subtitle ? (
          <Text className="mt-1.5 text-sm leading-6" style={{ color: tokens.textMuted }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {actions ? <View className="shrink-0 flex-row items-center gap-2 pt-0.5">{actions}</View> : null}
    </View>
  );
}
