import { View } from 'react-native';
import { PillChip } from '@/core/ui/PillChip';
import { useAppTheme } from '@/core/providers/themeContext';
import type { CommandMode } from './commandModePreference';
import { AI_ASK_EXPERIMENT_ENABLED } from './types';
import { commandModeOptions } from './commandSurface';

// The offered modes are a pure function of the rollout flag
// (features/command/commandSurface.ts), so the render boundary and its
// coverage cannot disagree: an ordinary build renders Create only, and a
// rollout build adds Ask and Auto with no further configuration.
const COMMAND_MODE_OPTIONS = commandModeOptions(AI_ASK_EXPERIMENT_ENABLED);

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
