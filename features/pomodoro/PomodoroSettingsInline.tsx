import React, { useState } from "react";
import { View, Text, TextInput } from "react-native";
import { Button } from "@/core/ui/Button";
import { ValidationError } from "@/core/ui/ValidationError";
import { POMODORO_SECTION_KEY, SECTION_COLORS } from "@/constants/sectionColors";
import type { PomodoroSettings } from "./pomodoro.domain";
import { validatePomodoroSettings } from "@/lib/validation";

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
  const [settingsError, setSettingsError] = useState<string | null>(null);

  const handleSave = () => {
    const err = validatePomodoroSettings(focus, shortBrk, longBrk, sessions);
    if (err) {
      setSettingsError(err);
      return;
    }
    setSettingsError(null);
    onSave({
      focusMinutes: Number(focus.trim()),
      shortBreakMinutes: Number(shortBrk.trim()),
      longBreakMinutes: Number(longBrk.trim()),
      sessionsBeforeLongBreak: Number(sessions.trim()),
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
            onChangeText={(t) => {
              setSettingsError(null);
              set(t);
            }}
            keyboardType="number-pad"
            className="w-14 rounded-lg border border-slate-200 bg-white px-2 py-1 text-center text-sm text-slate-800"
            selectTextOnFocus
          />
        </View>
      ))}

      <ValidationError message={settingsError} />
      <View className="mt-3 flex-row gap-2">
        <View className="flex-1">
          <Button label="Save" onPress={handleSave} color={SECTION_COLORS[POMODORO_SECTION_KEY]} />
        </View>
        <View className="flex-1">
          <Button
            label="Cancel"
            variant="ghost"
            onPress={() => {
              setSettingsError(null);
              onCancel();
            }}
          />
        </View>
      </View>
    </View>
  );
}
