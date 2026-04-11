import React from "react";
import { Text, View } from "react-native";
import { useAppTheme } from "@/core/theme";
import { toDateKey } from "@/lib/time";

type Props = { dueDate: string; compact?: boolean };

export function DueDateBadge({ dueDate, compact }: Props) {
  const { colors } = useAppTheme();
  const today = toDateKey();
  const isOverdue = dueDate < today;
  const isToday = dueDate === today;

  const date = new Date(dueDate + "T12:00:00");
  const formatted = date.toLocaleDateString("en", {
    month: "short",
    day: "numeric",
  });

  const label = isToday ? "Today" : isOverdue ? `Overdue · ${formatted}` : formatted;
  const bgColor = isOverdue
    ? colors.dangerBackground
    : isToday
      ? colors.warningBackground
      : colors.badgeBackground;
  const txtColor = isOverdue
    ? colors.dangerText
    : isToday
      ? colors.warningText
      : colors.badgeText;

  if (compact) {
    return (
      <View
        style={{
          backgroundColor: bgColor,
          borderRadius: 4,
          paddingHorizontal: 4,
          paddingVertical: 1,
          alignSelf: "flex-start",
        }}
      >
        <Text style={{ fontSize: 9, fontWeight: "500", color: txtColor }}>
          {isOverdue ? "⚠" : isToday ? "•" : formatted}
        </Text>
      </View>
    );
  }

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
