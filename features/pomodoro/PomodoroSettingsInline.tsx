import React, { useEffect, useState } from "react";
import { View, Text, TextInput } from "react-native";
import { Button } from "@/core/ui/Button";
import { Modal } from "@/core/ui/Modal";
import { ValidationError } from "@/core/ui/ValidationError";
import { SECTION_COLORS } from "@/constants/sectionColors";
import { useAppTheme } from "@/core/theme";
import type { PomodoroSettings } from "./pomodoro.domain";
import { validatePomodoroSettings } from "@/lib/validation";

type Props = {
  visible: boolean;
  settings: PomodoroSettings;
  onSave: (settings: PomodoroSettings) => void;
  onClose: () => void;
};

export function PomodoroSettingsInline({ visible, settings, onSave, onClose }: Props) {
<<<<<<< HEAD
=======
  const { colors } = useAppTheme();
>>>>>>> a74517a (dark mode, documentatiton, blank fix)
  const [focus, setFocus] = useState(String(settings.focusMinutes));
  const [shortBrk, setShortBrk] = useState(String(settings.shortBreakMinutes));
  const [longBrk, setLongBrk] = useState(String(settings.longBreakMinutes));
  const [sessions, setSessions] = useState(String(settings.sessionsBeforeLongBreak));
  const [settingsError, setSettingsError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setFocus(String(settings.focusMinutes));
    setShortBrk(String(settings.shortBreakMinutes));
    setLongBrk(String(settings.longBreakMinutes));
    setSessions(String(settings.sessionsBeforeLongBreak));
    setSettingsError(null);
  }, [visible, settings]);

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
    <Modal title="Timer settings" visible={visible} onClose={onClose} scroll>
<<<<<<< HEAD
      <Text className="mb-6 text-sm text-slate-400">Durations are saved on this device.</Text>
=======
      <Text className="mb-6 text-sm" style={{ color: colors.textSubtle }}>
        Durations are saved on this device.
      </Text>
>>>>>>> a74517a (dark mode, documentatiton, blank fix)
      {[
        { label: "Focus (min)", value: focus, set: setFocus },
        { label: "Short break (min)", value: shortBrk, set: setShortBrk },
        { label: "Long break (min)", value: longBrk, set: setLongBrk },
        { label: "Sessions before long break", value: sessions, set: setSessions },
      ].map(({ label, value, set }) => (
        <View key={label} className="mb-3 flex-row items-center justify-between gap-3">
<<<<<<< HEAD
          <Text className="flex-1 text-sm text-slate-600">{label}</Text>
=======
          <Text className="flex-1 text-sm" style={{ color: colors.textMuted }}>
            {label}
          </Text>
>>>>>>> a74517a (dark mode, documentatiton, blank fix)
          <TextInput
            value={value}
            onChangeText={(t) => {
              setSettingsError(null);
              set(t);
            }}
            keyboardType="number-pad"
<<<<<<< HEAD
            className="w-16 rounded-xl border border-slate-200 bg-white px-3 py-2 text-center text-sm text-slate-800"
=======
            className="w-16 rounded-xl border px-3 py-2 text-center text-sm"
            style={{
              borderColor: colors.inputBorder,
              backgroundColor: colors.inputBackground,
              color: colors.inputText,
            }}
            placeholderTextColor={colors.inputPlaceholder}
>>>>>>> a74517a (dark mode, documentatiton, blank fix)
            selectTextOnFocus
          />
        </View>
      ))}

      <ValidationError message={settingsError} />
      <View className="mt-6 flex-row gap-3">
        <View className="flex-1">
          <Button label="Save" onPress={handleSave} color={SECTION_COLORS.focus} />
        </View>
        <View className="flex-1">
          <Button
            label="Cancel"
            variant="ghost"
            onPress={() => {
              setSettingsError(null);
              onClose();
            }}
          />
        </View>
      </View>
    </Modal>
  );
}
