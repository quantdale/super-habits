import React from "react";
import { Text, View } from "react-native";
import { useAppTheme } from "@/core/theme";
import type { TodoPriority } from "./types";

type Props = { priority: TodoPriority; compact?: boolean };

export function PriorityBadge({ priority, compact }: Props) {
  const { colors } = useAppTheme();

  const config: Record<TodoPriority, { label: string; bg: string; text: string }> = {
    urgent: { label: "Urgent", bg: colors.dangerBackground, text: colors.dangerText },
    normal: { label: "Normal", bg: colors.badgeBackground, text: colors.badgeText },
    low: { label: "Low", bg: colors.successBackground, text: colors.successText },
  };

  const cfg = config[priority];
  return (
    <View
      style={{
        backgroundColor: cfg.bg,
        borderRadius: 4,
        paddingHorizontal: compact ? 4 : 6,
        paddingVertical: compact ? 1 : 2,
        alignSelf: "flex-start",
      }}
    >
      <Text style={{ fontSize: compact ? 9 : 11, fontWeight: "500", color: cfg.text }}>
        {compact ? cfg.label[0] : cfg.label}
      </Text>
    </View>
  );
}
