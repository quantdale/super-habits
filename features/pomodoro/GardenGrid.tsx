import React from "react";
import { View, Text, Pressable } from "react-native";
import Svg, { Circle, Ellipse, Line, Path } from "react-native-svg";
import { SECTION_COLORS } from "@/constants/sectionColors";
import type { PomodoroSession } from "./types";
import { formatSessionDuration } from "./pomodoro.domain";

type Props = {
  sessions: PomodoroSession[];
  accentColor?: string;
};

/**
 * Small plant icon for the garden grid.
 * Simplified version of FocusSprout at 32×32.
 */
function MiniPlant({ color = SECTION_COLORS.focus }: { color?: string }) {
  return (
    <Svg width={32} height={32} viewBox="0 0 32 32">
      {/* Soil */}
      <Ellipse cx={16} cy={27} rx={8} ry={3} fill="#92764f" opacity={0.5} />
      {/* Stem */}
      <Line
        x1={16}
        y1={26}
        x2={16}
        y2={10}
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
      />
      {/* Left leaf */}
      <Path d="M 16 18 Q 7 14 6 20 Q 11 22 16 18" fill="#22c55e" opacity={0.85} />
      {/* Right leaf */}
      <Path d="M 16 14 Q 25 10 26 16 Q 21 18 16 14" fill="#22c55e" opacity={0.85} />
      {/* Crown */}
      <Circle cx={16} cy={8} r={6} fill="#22c55e" opacity={0.8} />
      <Circle cx={16} cy={8} r={3} fill={color} opacity={0.6} />
    </Svg>
  );
}

export function GardenGrid({ sessions, accentColor = SECTION_COLORS.focus }: Props) {
  if (sessions.length === 0) {
    return (
      <View className="mx-1 my-2 items-center rounded-xl border border-slate-100 bg-white p-4">
        <Text className="text-center text-sm text-slate-500">
          Complete a session to start your garden
        </Text>
      </View>
    );
  }

  return (
    <View>
      <Text className="mb-3 px-1 text-xs text-slate-400">
        Your garden — {sessions.length} session
        {sessions.length !== 1 ? "s" : ""}
      </Text>
      <View className="flex-row flex-wrap gap-3 px-1">
        {sessions.map((session) => (
          <Pressable
            key={session.id}
            className="items-center"
            onPress={() => {
              // Future: show session detail tooltip
            }}
          >
            <MiniPlant color={accentColor} />
            <Text className="mt-0.5 text-xs text-slate-400">
              {formatSessionDuration(session.duration_seconds)}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
