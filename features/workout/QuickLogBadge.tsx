import { Text } from '@/core/ui/Text';
import { View } from 'react-native';
import { SECTION_COLORS } from '@/constants/sectionColors';

const COLOR = SECTION_COLORS.workout;

/**
 * Pop pill marking a quick-logged workout session (one-tap complete, no
 * per-exercise tracking). Workout-tint fill + tinted outline — the same
 * section-hue treatment as the history stat tiles — with `label`-role copy.
 */
export function QuickLogBadge() {
  return (
    <View
      accessibilityRole="text"
      accessibilityLabel="Quick-logged session"
      className="shrink-0 self-start rounded-full border px-2.5 py-1"
      style={{ borderColor: `${COLOR}55`, backgroundColor: `${COLOR}14` }}
    >
      <Text variant="label" style={{ color: COLOR }}>
        Quick log
      </Text>
    </View>
  );
}
