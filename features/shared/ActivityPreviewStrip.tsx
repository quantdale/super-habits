import React from "react";
import { View, Text, ScrollView } from "react-native";

export type ActivityDay = {
  dateKey: string;
  active: boolean;
  value?: number;
};

type Props = {
  days: ActivityDay[];
  accentColor: string;
  statLabel: string;
  emptyLabel?: string;
};

const CELL = 18;
const GAP = 3;

function blendAccent(accentHex: string, value: number): string {
  const m = accentHex.match(/^#([0-9a-fA-F]{6})$/);
  const neutral = { r: 0xe2, g: 0xe8, b: 0xf0 };
  if (!m) return accentHex;
  const r0 = parseInt(m[1].slice(0, 2), 16);
  const g0 = parseInt(m[1].slice(2, 4), 16);
  const b0 = parseInt(m[1].slice(4, 6), 16);
  const t = 0.4 + value * 0.6;
  const r = Math.round(neutral.r + (r0 - neutral.r) * t);
  const g = Math.round(neutral.g + (g0 - neutral.g) * t);
  const b = Math.round(neutral.b + (b0 - neutral.b) * t);
  return `#${[r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
}

export function ActivityPreviewStrip({
  days,
  accentColor,
  statLabel,
  emptyLabel = "No activity yet",
}: Props) {
  const hasAny = days.some((d) => d.active);

  return (
    <View className="mb-3">
      <Text className="text-xs text-slate-500 mb-1.5">
        {hasAny ? statLabel : emptyLabel}
      </Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} scrollEventThrottle={16}>
        <View className="flex-row" style={{ gap: GAP }}>
          {days.map((day, i) => {
            let bg: string;
            if (!day.active) {
              bg = "#e2e8f0";
            } else if (day.value !== undefined) {
              bg = blendAccent(accentColor, day.value);
            } else {
              bg = accentColor;
            }
            return (
              <View
                key={day.dateKey}
                style={{
                  width: CELL,
                  height: CELL,
                  borderRadius: 3,
                  backgroundColor: bg,
                  borderWidth: i === 0 ? 1.5 : 0,
                  borderColor: i === 0 ? accentColor : "transparent",
                }}
              />
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}
