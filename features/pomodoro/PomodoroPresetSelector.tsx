import React from 'react';
import { View, Text } from 'react-native';
import { useAppTheme } from '@/core/providers/themeContext';
import { PillChip } from '@/core/ui/PillChip';
import { POMODORO_SECTION_KEY, SECTION_COLORS } from '@/constants/sectionColors';
import type { PomodoroPreset } from './pomodoro.domain';

type Props = {
  presets: PomodoroPreset[];
  activePresetId: string | null;
  onSelect: (preset: PomodoroPreset) => void;
  disabled?: boolean;
};

/** Preset chips summarizing each preset's rhythm, e.g. "25/5 · long 15". */
export function PomodoroPresetSelector({ presets, activePresetId, onSelect, disabled }: Props) {
  const { tokens } = useAppTheme();
  const color = SECTION_COLORS[POMODORO_SECTION_KEY];

  return (
    <View>
      <Text
        className="mb-2 text-xs font-medium uppercase tracking-wide"
        style={{ color: tokens.textMuted }}
      >
        Preset
      </Text>
      <View className="flex-row flex-wrap gap-2">
        {presets.map((preset) => (
          <PillChip
            key={preset.id}
            label={`${preset.name} · ${preset.focusMinutes}/${preset.shortBreakMinutes}`}
            active={preset.id === activePresetId}
            color={color}
            onPress={() => !disabled && onSelect(preset)}
          />
        ))}
      </View>
    </View>
  );
}
