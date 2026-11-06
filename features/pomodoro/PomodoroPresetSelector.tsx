import { useState } from 'react';
import { View } from 'react-native';
import { Button } from '@/core/ui/Button';
import { Modal } from '@/core/ui/Modal';
import { OptionRow } from '@/core/ui/OptionRow';
import { POMODORO_SECTION_KEY, SECTION_COLORS } from '@/constants/sectionColors';
import type { PomodoroPreset } from './pomodoro.domain';

type Props = {
  presets: PomodoroPreset[];
  activePresetId: string | null;
  onSelect: (preset: PomodoroPreset) => void;
  disabled?: boolean;
};

/** Row label summarizing each preset's rhythm, e.g. "Sprint · 15/3". */
function presetLabel(preset: PomodoroPreset): string {
  return `${preset.name} · ${preset.focusMinutes}/${preset.shortBreakMinutes}`;
}

/**
 * Preset picker (Playful Momentum §7 Focus): the presets live as OptionRows in
 * a bottom sheet behind a single trigger. Selecting a row applies it to the
 * next timer and closes the sheet. The manager (create/edit/delete) stays a
 * separate surface.
 */
export function PomodoroPresetSelector({ presets, activePresetId, onSelect, disabled }: Props) {
  const [sheetVisible, setSheetVisible] = useState(false);
  const color = SECTION_COLORS[POMODORO_SECTION_KEY];

  return (
    <View>
      <Button
        label="Choose preset"
        variant="ghost"
        disabled={disabled}
        onPress={() => setSheetVisible(true)}
      />
      <Modal
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        title="Presets"
        modalLayout="bottom-sheet"
        scroll
      >
        <View className="gap-2">
          {presets.map((preset) => (
            <OptionRow
              key={preset.id}
              label={presetLabel(preset)}
              selected={preset.id === activePresetId}
              accentColor={color}
              onPress={() => {
                onSelect(preset);
                setSheetVisible(false);
              }}
            />
          ))}
        </View>
      </Modal>
    </View>
  );
}
