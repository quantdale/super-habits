import { useEffect } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';

import { Text } from '@/core/ui/Text';
import { useAppTheme } from '@/core/providers/themeContext';
import { radius, spacing } from '@/core/theme/designTokens';
import { useProgressFill } from '@/core/ui/motion/useProgressFill';

/**
 * ProgressBar (v2 §6): 14px tall, radius full, `surfaceSunken` track, section
 * **bright** fill with a 4px lighter top highlight (`rgba(255,255,255,0.35)`),
 * and an optional value label pinned inside on the right. The XP bar passes
 * Gold as `accentColor`.
 *
 * The fill animates through P4's `useProgressFill` (450ms ease-out-cubic +
 * one 300ms sweep); under Reduce Motion the width snaps with only the 120ms
 * opacity cross-fade and no sweep.
 *
 * Accessibility: a `progressbar` role with `min 0 / max 1 / now` (clamped),
 * mirrored as `aria-valuenow`/`aria-valuemin`/`aria-valuemax` because this
 * RN-web does not map `accessibilityValue` to the DOM reliably.
 */
export type ProgressBarProps = {
  /** Fill fraction. Out-of-range and NaN values clamp to 0..1. */
  progress: number;
  /** Fill hue — a section bright (§5.1). Defaults to brand bright. */
  accentColor?: string;
  /** Optional value label rendered inside the bar on the right. */
  valueLabel?: string;
  /** Track height. The §6 default is 14. */
  height?: number;
  className?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  accessibilityLabel?: string;
};

/** Clamps a progress fraction to 0..1; NaN resolves to 0. */
function clampProgressFraction(fraction: number): number {
  if (Number.isNaN(fraction)) return 0;
  return Math.min(1, Math.max(0, fraction));
}

export function ProgressBar({
  progress,
  accentColor,
  valueLabel,
  height = 14,
  className,
  style,
  testID,
  accessibilityLabel,
}: ProgressBarProps) {
  const { tokens } = useAppTheme();
  const { fillTo, fillStyle, sweepStyle } = useProgressFill();
  const clamped = clampProgressFraction(progress);

  // `fillTo` is a fresh closure each render; running it every render keeps the
  // shared value in step without depending on its identity (it only writes
  // shared values, so it never re-renders).
  useEffect(() => {
    fillTo(clamped);
  });

  return (
    <View
      testID={testID}
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 1, now: clamped }}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={1}
      aria-valuenow={clamped}
      className={className}
      style={[
        {
          height,
          borderRadius: radius.full,
          backgroundColor: tokens.surfaceSunken,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      <Animated.View
        style={[
          fillStyle,
          {
            height: '100%',
            borderRadius: radius.full,
            backgroundColor: accentColor ?? tokens.primaryBright,
            overflow: 'hidden',
          },
        ]}
      >
        {/* Static 4px lighter top highlight (§6). */}
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 4,
            backgroundColor: 'rgba(255,255,255,0.35)',
          }}
        />
        {/* One 300ms sweep per fill (§5.8); never runs under reduced motion. */}
        <Animated.View
          style={[
            sweepStyle,
            {
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(255,255,255,0.35)',
            },
          ]}
        />
      </Animated.View>
      {valueLabel ? (
        <View
          style={{
            position: 'absolute',
            top: 0,
            right: spacing.sm,
            bottom: 0,
            justifyContent: 'center',
          }}
        >
          <Text variant="label" style={{ color: tokens.text }} accessibilityElementsHidden>
            {valueLabel}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
