import { View } from 'react-native';
import { useAppTheme } from '@/core/providers/themeContext';

type ProgressBarProps = {
  /** 0–1; values outside the range are clamped. */
  progress: number;
  height?: number;
  /** Fill color; defaults to theme interactive color. Pass a neutral tone for over-target states. */
  color?: string;
  trackColor?: string;
  /** Accessible name, e.g. "Calories today". */
  accessibilityLabel?: string;
};

/**
 * Shared determinate progress bar. Callers supply textual values alongside
 * the bar — color/shape alone never carries the status (Design DNA §15).
 */
export function ProgressBar({
  progress,
  height = 8,
  color,
  trackColor,
  accessibilityLabel,
}: ProgressBarProps) {
  const { tokens } = useAppTheme();
  const clamped = Math.max(0, Math.min(1, progress));
  const fill = color ?? tokens.button;
  const track = trackColor ?? tokens.surfaceElevated;

  return (
    <View
      accessible={Boolean(accessibilityLabel)}
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
      className="w-full overflow-hidden rounded-full"
      style={{ height, backgroundColor: track }}
    >
      <View
        className="h-full rounded-full"
        style={{ width: `${clamped * 100}%`, backgroundColor: fill }}
      />
    </View>
  );
}
