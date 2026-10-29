import { useEffect, type ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { createAnimatedComponent, useAnimatedProps } from 'react-native-reanimated';
import { Circle, Svg } from 'react-native-svg';

import { useAppTheme } from '@/core/providers/themeContext';
import { radius } from '@/core/theme/designTokens';
import { useProgressFill } from '@/core/ui/motion/useProgressFill';

const AnimatedCircle = createAnimatedComponent(Circle);

/** Clamps a progress fraction to 0..1; NaN resolves to 0. Worklet-safe. */
function clampProgressFraction(fraction: number): number {
  'worklet';
  if (Number.isNaN(fraction)) return 0;
  return Math.min(1, Math.max(0, fraction));
}

/**
 * ProgressRing (v2 §6): 10px stroke with round caps on a `surfaceSunken`
 * track, section **bright** fill. Used for quantitative CheckNode rings and
 * stat dials; the XP ring passes Gold as `accentColor`.
 *
 * The arc animates through P4's `useProgressFill` shared value (450ms
 * ease-out-cubic); under Reduce Motion the arc snaps with only the 120ms
 * opacity cross-fade and no sweep.
 *
 * Accessibility: a `progressbar` role with `min 0 / max 1 / now` (clamped),
 * mirrored as `aria-valuenow`/`aria-valuemin`/`aria-valuemax` because this
 * RN-web does not map `accessibilityValue` to the DOM reliably.
 */
export type ProgressRingProps = {
  /** Fill fraction. Out-of-range and NaN values clamp to 0..1. */
  progress: number;
  /** Outer diameter in px. */
  size?: number;
  /** Stroke width; the §6 default is 10. */
  stroke?: number;
  /** Arc hue — a section bright (§5.1). Defaults to brand bright. */
  accentColor?: string;
  /** Track hue. Defaults to `surfaceSunken`. */
  trackColor?: string;
  /** Centered label/number slot. */
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  accessibilityLabel?: string;
};

export function ProgressRing({
  progress,
  size = 64,
  stroke = 10,
  accentColor,
  trackColor,
  children,
  style,
  testID,
  accessibilityLabel,
}: ProgressRingProps) {
  const { tokens } = useAppTheme();
  const { fillTo, progress: fill } = useProgressFill();
  const clamped = clampProgressFraction(progress);

  useEffect(() => {
    fillTo(clamped);
  });

  const center = size / 2;
  const arcRadius = Math.max(0, center - stroke / 2);
  const circumference = 2 * Math.PI * arcRadius;

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - clampProgressFraction(fill.value)),
  }));

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
      style={[{ width: size, height: size }, style]}
    >
      <Svg width={size} height={size}>
        <Circle
          cx={center}
          cy={center}
          r={arcRadius}
          stroke={trackColor ?? tokens.surfaceSunken}
          strokeWidth={stroke}
          fill="none"
        />
        <AnimatedCircle
          cx={center}
          cy={center}
          r={arcRadius}
          stroke={accentColor ?? tokens.primaryBright}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          rotation={-90}
          originX={center}
          originY={center}
          animatedProps={animatedProps}
        />
      </Svg>
      {children ? (
        <View
          pointerEvents="box-none"
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: radius.full,
          }}
        >
          {children}
        </View>
      ) : null}
    </View>
  );
}
