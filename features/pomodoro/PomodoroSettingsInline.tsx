import React, { useState } from "react";
import { View, Text, TextInput } from "react-native";
import { useAppTheme } from "@/core/providers/ThemeProvider";
import { Button } from "@/core/ui/Button";
import { Card } from "@/core/ui/Card";
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
  const { tokens } = useAppTheme();
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
    <Card
      accentColor={SECTION_COLORS[POMODORO_SECTION_KEY]}
      className="mb-4"
      innerClassName="p-4"
    >
      <Text className="text-base font-semibold" style={{ color: tokens.text }}>Timer durations</Text>
      <Text className="mb-4 mt-1 text-sm" style={{ color: tokens.textMuted }}>
        Changes apply immediately and reset the current timer state.
      </Text>

      {[
        { label: "Focus (min)", value: focus, set: setFocus },
        { label: "Short break (min)", value: shortBrk, set: setShortBrk },
        { label: "Long break (min)", value: longBrk, set: setLongBrk },
        { label: "Sessions before long break", value: sessions, set: setSessions },
      ].map(({ label, value, set }) => (
        <View key={label} className="mb-2 flex-row items-center justify-between">
          <Text className="flex-1 pr-3 text-sm" style={{ color: tokens.textMuted }}>{label}</Text>
          <TextInput
            value={value}
            onChangeText={(t) => {
              setSettingsError(null);
              set(t);
            }}
            keyboardType="number-pad"
            className="w-16 rounded-2xl border px-3 py-2 text-center text-sm"
            style={{ borderColor: tokens.border, backgroundColor: tokens.surfaceElevated, color: tokens.text }}
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
    </Card>
  );
}
