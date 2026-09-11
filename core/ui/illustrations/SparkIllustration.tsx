import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, Stop } from 'react-native-svg';
import { useAppTheme } from '@/core/providers/themeContext';

type SparkIllustrationProps = {
  /** Primary hue of the art; defaults to the brand primary. */
  color?: string;
  size?: number;
};

/**
 * Built-in decorative art for empty states and hero moments.
 *
 * Drawn in SVG (no bitmap assets): a soft blob field with a spark burst, using
 * the caller's accent so the same shape reads as "Habits green" or "Workout
 * orange" without new files. Illustrations are always decorative — the text
 * beside them carries the meaning.
 */
export function SparkIllustration({ color, size = 120 }: SparkIllustrationProps) {
  const { tokens } = useAppTheme();
  const hue = color ?? tokens.primary;

  return (
    <Svg width={size} height={size} viewBox="0 0 120 120" accessibilityElementsHidden>
      <Defs>
        <LinearGradient id="sparkBlob" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={hue} stopOpacity="0.35" />
          <Stop offset="1" stopColor={hue} stopOpacity="0.12" />
        </LinearGradient>
        <LinearGradient id="sparkCore" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={hue} stopOpacity="1" />
          <Stop offset="1" stopColor={hue} stopOpacity="0.72" />
        </LinearGradient>
      </Defs>

      <Path
        d="M60 6c22 0 44 14 47 38 3 24-12 48-36 56-24 8-50-4-58-27C5 50 16 22 38 12c7-3 15-6 22-6Z"
        fill="url(#sparkBlob)"
      />
      <Ellipse cx="60" cy="104" rx="34" ry="7" fill={hue} opacity="0.16" />
      <Circle cx="60" cy="58" r="26" fill="url(#sparkCore)" />
      <Path
        d="M60 34l6.4 14.6L82 55l-15.6 6.4L60 76l-6.4-14.6L38 55l15.6-6.4L60 34Z"
        fill={tokens.onSolid}
        opacity="0.92"
      />
    </Svg>
  );
}
