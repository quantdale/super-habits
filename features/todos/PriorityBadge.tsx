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
      className={`self-start rounded-full ${compact ? "px-2 py-1" : "px-2.5 py-1.5"}`}
      style={{ backgroundColor: cfg.bg }}
    >
      <Text
        className={compact ? "text-[10px] font-semibold" : "text-[11px] font-semibold"}
        style={{ color: cfg.text }}
      >
        {compact ? cfg.label[0] : cfg.label}
      </Text>
    </View>
  );
}
