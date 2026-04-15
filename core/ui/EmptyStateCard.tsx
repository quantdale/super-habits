import type { ReactNode } from "react";
import { Text, View } from "react-native";
import { Card } from "@/core/ui/Card";
import { useAppTheme } from "@/core/providers/ThemeProvider";

type EmptyStateCardProps = {
  accentColor: string;
  title: string;
  description?: string;
  icon?: ReactNode;
  className?: string;
};

export function EmptyStateCard({
  accentColor,
  title,
  description,
  icon,
  className,
}: EmptyStateCardProps) {
  const { tokens } = useAppTheme();

  return (
    <Card accentColor={accentColor} className={className}>
      <View className="items-center py-1">
        {icon ? <View className="mb-2">{icon}</View> : null}
        <Text className="text-center text-sm font-semibold" style={{ color: tokens.text }}>
          {title}
        </Text>
        {description ? (
          <Text className="mt-1 text-center text-xs leading-5" style={{ color: tokens.textMuted }}>
            {description}
          </Text>
        ) : null}
      </View>
    </Card>
  );
}
