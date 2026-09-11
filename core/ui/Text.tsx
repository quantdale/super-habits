import { StyleSheet, Text as RNText, type TextProps, type TextStyle } from 'react-native';
import { useAppTheme } from '@/core/providers/themeContext';
import { fonts, typography, type TypographyRole } from '@/core/theme/designTokens';
import type { ThemeTokens } from '@/core/theme/tokens';

/**
 * The app's single text primitive.
 *
 * Pop carries weight in the *family* (Nunito ships as one file per weight) and
 * RN does not synthesise weights for a custom family, so this component is the
 * one place that maps a role/weight onto `Nunito_400Regular` …
 * `Nunito_900Black`. Every screen imports `Text` from here, which is why the
 * whole product changed typeface in one move.
 *
 * Two inputs are honoured for backwards compatibility while screens migrate:
 * a `font-*` utility in `className`, and a literal `fontWeight` in `style`.
 * A role/variant always wins over both.
 */

export type TextTone =
  'default' | 'muted' | 'accent' | 'onAccent' | 'inverse' | 'success' | 'danger' | 'warning';

export type AppTextProps = TextProps & {
  /** Typography role from the design tokens. Defaults to `bodyMd`. */
  variant?: TypographyRole;
  /** Semantic color role; defaults to primary text. */
  tone?: TextTone;
};

const CLASSNAME_WEIGHT_FAMILIES: readonly [string, string][] = [
  ['font-black', fonts.black],
  ['font-extrabold', fonts.black],
  ['font-bold', fonts.bold],
  ['font-semibold', fonts.semibold],
  ['font-medium', fonts.medium],
  ['font-light', fonts.regular],
  ['font-extralight', fonts.regular],
  ['font-thin', fonts.regular],
  ['font-normal', fonts.regular],
];

/** Numeric CSS/RN weights collapse onto the five shipped families. */
function familyFromWeight(weight: TextStyle['fontWeight']): string | null {
  if (weight === undefined || weight === null) return null;
  const numeric = typeof weight === 'number' ? weight : Number.parseInt(weight, 10);
  if (!Number.isFinite(numeric)) {
    // Named weights ("bold", "600") that failed to parse still map sanely.
    return typeof weight === 'string' && weight === 'bold' ? fonts.bold : null;
  }
  if (numeric >= 800) return fonts.black;
  if (numeric >= 700) return fonts.bold;
  if (numeric >= 600) return fonts.semibold;
  if (numeric >= 500) return fonts.medium;
  return fonts.regular;
}

function familyFromClassName(className: string | undefined): string | null {
  if (!className) return null;
  for (const [utility, family] of CLASSNAME_WEIGHT_FAMILIES) {
    if (className.includes(utility)) return family;
  }
  return null;
}

function toneColor(tone: TextTone, tokens: ThemeTokens): string {
  switch (tone) {
    case 'muted':
      return tokens.textMuted;
    case 'accent':
      return tokens.accent;
    case 'onAccent':
      return tokens.textOnAccent;
    case 'inverse':
      return tokens.background;
    case 'success':
      return tokens.successText;
    case 'danger':
      return tokens.dangerText;
    case 'warning':
      return tokens.warningText;
    case 'default':
      return tokens.text;
  }
}

export function Text({
  variant = 'bodyMd',
  tone = 'default',
  className,
  style,
  ...rest
}: AppTextProps) {
  const { tokens } = useAppTheme();
  const role = typography[variant];
  const flat = StyleSheet.flatten(style) as TextStyle | undefined;
  const family =
    familyFromClassName(className) ?? familyFromWeight(flat?.fontWeight) ?? role.fontFamily;

  // `fontWeight` is intentionally dropped: with a weight-specific family it
  // would ask the platform to synthesise a second bold on top of Nunito's.
  const { fontWeight: _ignoredWeight, ...roleStyle } = role;

  return (
    <RNText
      {...rest}
      className={className}
      style={[roleStyle, { fontFamily: family, color: toneColor(tone, tokens) }, style]}
    />
  );
}
