import React from "react";
import { View, Text, Pressable } from "react-native";
import Svg, { Circle, Ellipse, Line, Path } from "react-native-svg";
import type { PomodoroSession } from "./types";
import { formatSessionTime } from "./pomodoro.domain";

type Props = {
  sessions: PomodoroSession[];
  accentColor?: string;
};

/**
 * Small plant icon for the garden grid.
 * Simplified version of FocusSprout at 32×32.
 */
function MiniPlant({ color = "#4f79ff" }: { color?: string }) {
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

export function GardenGrid({ sessions, accentColor = "#4f79ff" }: Props) {
  if (sessions.length === 0) {
    return (
      <View className="items-center py-6">
        <Text className="text-center text-sm text-slate-400">
          Complete a focus session to grow your first plant
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
              {formatSessionTime(session.started_at).replace(/Today /, "")}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
