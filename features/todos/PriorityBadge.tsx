import React from "react";
import { Text, View } from "react-native";
import type { TodoPriority } from "./types";

const CONFIG: Record<TodoPriority, { label: string; bg: string; text: string }> = {
  urgent: { label: "Urgent", bg: "#fef2f2", text: "#dc2626" },
  normal: { label: "Normal", bg: "#f1f5f9", text: "#64748b" },
  low: { label: "Low", bg: "#f0fdf4", text: "#16a34a" },
};

type Props = { priority: TodoPriority; compact?: boolean };

export function PriorityBadge({ priority, compact }: Props) {
  const cfg = CONFIG[priority];
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
