import { View } from 'react-native';
import { PillChip } from '@/core/ui/PillChip';
import { useAppTheme } from '@/core/providers/ThemeProvider';
import type { CommandMode } from './commandModePreference';

const COMMAND_MODE_OPTIONS: { value: CommandMode; label: string }[] = [
  { value: 'ask', label: 'Ask' },
  { value: 'create', label: 'Create' },
  { value: 'auto', label: 'Auto' },
];

export function ModeToggle({
  mode,
  onChange,
}: {
  mode: CommandMode;
  onChange: (nextMode: CommandMode) => void;
}) {
  const { tokens } = useAppTheme();

  return (
    <View className="flex-row flex-wrap gap-2">
      {COMMAND_MODE_OPTIONS.map((option) => (
        <PillChip
          key={option.value}
          label={option.label}
          active={mode === option.value}
          color={tokens.textMuted}
          onPress={() => onChange(option.value)}
        />
      ))}
    </View>
  );
}
