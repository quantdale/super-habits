import React from "react";
import { Text, View } from "react-native";
import { toDateKey } from "@/lib/time";

type Props = { dueDate: string; compact?: boolean };

export function DueDateBadge({ dueDate, compact }: Props) {
  const today = toDateKey();
  const isOverdue = dueDate < today;
  const isToday = dueDate === today;

  const date = new Date(dueDate + "T12:00:00");
  const formatted = date.toLocaleDateString("en", {
    month: "short",
    day: "numeric",
  });

  const label = isToday ? "Today" : isOverdue ? `Overdue · ${formatted}` : formatted;
  const bgColor = isOverdue ? "#fef2f2" : isToday ? "#fffbeb" : "#f1f5f9";
  const txtColor = isOverdue ? "#dc2626" : isToday ? "#d97706" : "#64748b";

  if (compact) {
    return (
      <View
        className="self-start rounded-full px-2 py-1"
        style={{ backgroundColor: bgColor }}
      >
        <Text className="text-[10px] font-semibold" style={{ color: txtColor }}>
          {isOverdue ? "⚠" : isToday ? "•" : formatted}
        </Text>
      </View>
    );
  }

  return (
    <View
      className="self-start rounded-full px-2.5 py-1.5"
      style={{ backgroundColor: bgColor }}
    >
      <Text className="text-[11px] font-semibold" style={{ color: txtColor }}>
        {isOverdue ? "⚠ " : "📅 "}
        {label}
      </Text>
    </View>
  );
}
