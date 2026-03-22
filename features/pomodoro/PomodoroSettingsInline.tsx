import React, { useState } from "react";
import { View, Text, TextInput } from "react-native";
import { Button } from "@/core/ui/Button";
import { SECTION_COLORS } from "@/constants/sectionColors";
import type { PomodoroSettings } from "./pomodoro.domain";

type Props = {
  settings: PomodoroSettings;
  onSave: (settings: PomodoroSettings) => void;
  onCancel: () => void;
};

export function PomodoroSettingsInline({ settings, onSave, onCancel }: Props) {
  const [focus, setFocus] = useState(String(settings.focusMinutes));
  const [shortBrk, setShortBrk] = useState(String(settings.shortBreakMinutes));
  const [longBrk, setLongBrk] = useState(String(settings.longBreakMinutes));
  const [sessions, setSessions] = useState(String(settings.sessionsBeforeLongBreak));

  const handleSave = () => {
    const f = Math.max(1, Math.min(99, parseInt(focus, 10) || 25));
    const s = Math.max(1, Math.min(30, parseInt(shortBrk, 10) || 5));
    const l = Math.max(1, Math.min(60, parseInt(longBrk, 10) || 15));
    const n = Math.max(2, Math.min(10, parseInt(sessions, 10) || 4));
    onSave({
      focusMinutes: f,
      shortBreakMinutes: s,
      longBreakMinutes: l,
      sessionsBeforeLongBreak: n,
    });
  };

  return (
    <View className="mx-4 mb-4 rounded-2xl bg-slate-50 p-4">
      <Text className="mb-3 text-sm font-medium text-slate-700">Timer durations</Text>

      {[
        { label: "Focus (min)", value: focus, set: setFocus },
        { label: "Short break (min)", value: shortBrk, set: setShortBrk },
        { label: "Long break (min)", value: longBrk, set: setLongBrk },
        { label: "Sessions before long break", value: sessions, set: setSessions },
      ].map(({ label, value, set }) => (
        <View key={label} className="mb-2 flex-row items-center justify-between">
          <Text className="flex-1 text-sm text-slate-600">{label}</Text>
          <TextInput
            value={value}
            onChangeText={set}
            keyboardType="number-pad"
            className="w-14 rounded-lg border border-slate-200 bg-white px-2 py-1 text-center text-sm text-slate-800"
            selectTextOnFocus
          />
        </View>
      ))}

      <View className="mt-3 flex-row gap-2">
        <View className="flex-1">
          <Button label="Save" onPress={handleSave} color={SECTION_COLORS.focus} />
        </View>
        <View className="flex-1">
          <Button label="Cancel" variant="ghost" onPress={onCancel} />
        </View>
      </View>
    </View>
  );
}
