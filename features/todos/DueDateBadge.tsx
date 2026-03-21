import React from "react";
import { Text, View } from "react-native";
import { toDateKey } from "@/lib/time";

type Props = { dueDate: string };

export function DueDateBadge({ dueDate }: Props) {
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

  return (
    <View
      style={{
        backgroundColor: bgColor,
        borderRadius: 4,
        paddingHorizontal: 6,
        paddingVertical: 2,
        alignSelf: "flex-start",
      }}
    >
      <Text style={{ fontSize: 11, fontWeight: "500", color: txtColor }}>
        {isOverdue ? "⚠ " : "📅 "}
        {label}
      </Text>
    </View>
  );
}
