import { View } from 'react-native';
import { useAppTheme } from '@/core/providers/themeContext';
import { Button } from '@/core/ui/Button';
import { Card } from '@/core/ui/Card';
import { Text } from '@/core/ui/Text';
import { radius } from '@/core/theme/designTokens';
import { CALORIES_MINI_BAR_HEIGHT } from './caloriesHero.visual';
import { formatGrams } from './caloriesFormat';

export type MacroSummaryRow = {
  key: string;
  label: string;
  actual: number;
  target: number;
  percent: number;
  remaining: number;
  over: boolean;
};

type Props = {
  rows: MacroSummaryRow[];
  /** Berry fill resolved for the flat face (`caloriesHeroVisual.barFill`). */
  barFill: string;
  /** Berry-aware muted ink resolved for the flat face. */
  mutedInk: string;
  onEditTargets: () => void;
};

/**
 * Macro summary (V3 W10, restyled by Playful Momentum P17): protein, carbs and
 * fats as three **labeled mini bars** — one row per macro with the logged/target
 * pair, the factual remainder, and an 8px Berry bar. A macro whose target is
 * unset or zero renders no row. The proportional donut that used to repeat these
 * three values stays removed and the three `0g / N g` pairs the W10 contract
 * asserts are unchanged.
 *
 * One hue: every bar on the screen — the hero's 14px daily bar and these three
 * mini bars — uses the same resolved Berry tier, so the surface never reads as
 * a rainbow row (§4.2 "one hue per job"). The mini bars are static fills (no
 * per-row sweep): they sit inside a static summary, so only the hero bar
 * animates its value change.
 *
 * Accessibility: each bar is a decorative mark next to the same numbers stated
 * as text (`P 95g / 150g`), so it is hidden from assistive tech rather than
 * announced as a second, unlabeled progress value.
 */
export function CaloriesMacroSummary({ rows, barFill, mutedInk, onEditTargets }: Props) {
  const { tokens } = useAppTheme();

  return (
    <Card className="mb-4">
      <View className="mb-3 flex-row items-center justify-between gap-2">
        <Text variant="titleMd">Macros</Text>
        <Button
          label="Edit targets"
          variant="ghost"
          size="sm"
          accessibilityLabel="Edit daily macro targets"
          onPress={onEditTargets}
        />
      </View>
      <View className="gap-3">
        {rows.map((row) => (
          <View key={row.key}>
            <View className="mb-1 flex-row flex-wrap items-center justify-between gap-x-3">
              <Text variant="bodyMd">{row.label}</Text>
              <View className="flex-row items-center gap-2">
                <Text variant="bodyMd" style={{ color: tokens.text }}>
                  {formatGrams(row.actual)}g / {formatGrams(row.target)}g
                </Text>
                <Text variant="caption" style={{ color: mutedInk }}>
                  {row.over
                    ? `${formatGrams(row.actual - row.target)}g over`
                    : `${row.remaining}g left`}
                </Text>
              </View>
            </View>
            <View
              accessibilityElementsHidden
              importantForAccessibility="no"
              style={{
                height: CALORIES_MINI_BAR_HEIGHT,
                borderRadius: radius.full,
                backgroundColor: tokens.surfaceSunken,
                overflow: 'hidden',
              }}
            >
              <View
                style={{
                  // Berry is used at 100% width for an over-target row so the
                  // mark never disappears; the numeric caption states the excess.
                  width: `${Math.min(100, Math.max(0, row.percent))}%`,
                  height: '100%',
                  borderRadius: radius.full,
                  backgroundColor: barFill,
                }}
              />
            </View>
          </View>
        ))}
      </View>
    </Card>
  );
}
