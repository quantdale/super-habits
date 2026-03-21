import React from "react";
import { Text, View } from "react-native";
import type { TodoPriority } from "./types";

const CONFIG: Record<TodoPriority, { label: string; bg: string; text: string }> = {
  urgent: { label: "Urgent", bg: "#fef2f2", text: "#dc2626" },
  normal: { label: "Normal", bg: "#f1f5f9", text: "#64748b" },
  low: { label: "Low", bg: "#f0fdf4", text: "#16a34a" },
};

type Props = { priority: TodoPriority };

export function PriorityBadge({ priority }: Props) {
  const cfg = CONFIG[priority];
  return (
    <View
      style={{
        backgroundColor: cfg.bg,
        borderRadius: 4,
        paddingHorizontal: 6,
        paddingVertical: 2,
        alignSelf: "flex-start",
      }}
    >
      <Text style={{ fontSize: 11, fontWeight: "500", color: cfg.text }}>{cfg.label}</Text>
    </View>
  );
}
