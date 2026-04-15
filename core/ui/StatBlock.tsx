import type { ReactNode } from "react";
import { Text, View } from "react-native";
import { Card } from "@/core/ui/Card";
import { useAppTheme } from "@/core/providers/ThemeProvider";

type StatBlockProps = {
  accentColor: string;
  icon?: ReactNode;
  value: ReactNode;
  label: string;
  detail?: string;
  className?: string;
  align?: "center" | "start";
};

export function StatBlock({
  accentColor,
  icon,
  value,
  label,
  detail,
  className,
  align = "center",
}: StatBlockProps) {
  const { tokens } = useAppTheme();
  const alignClassName = align === "start" ? "items-start text-left" : "items-center text-center";

  return (
    <Card variant="stat" accentColor={accentColor} className={["mb-0", className].filter(Boolean).join(" ")}>
      <View className={[alignClassName, "py-1"].join(" ")}>
        {icon ? <View className="mb-0.5">{icon}</View> : null}
        <Text
          className="text-xl font-bold tabular-nums"
          style={{ color: accentColor }}
        >
          {value}
        </Text>
        <Text className="mt-0.5 text-xs uppercase tracking-[0.6px]" style={{ color: tokens.textMuted }}>
          {label}
        </Text>
        {detail ? (
          <Text className="mt-1 text-xs" style={{ color: tokens.textMuted }}>
            {detail}
          </Text>
        ) : null}
      </View>
    </Card>
  );
}
