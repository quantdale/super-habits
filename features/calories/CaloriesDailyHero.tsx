import { Pressable, View } from 'react-native';
import { useAppTheme } from '@/core/providers/themeContext';
import { Card } from '@/core/ui/Card';
import { ProgressBar } from '@/core/ui/ProgressBar';
import { Text } from '@/core/ui/Text';
import { CALORIES_HERO_BAR_HEIGHT } from './caloriesHero.visual';
import { formatDayContext, formatKcal } from './caloriesFormat';

type Props = {
  /** The `metric` headline: "1,400 kcal left" / "400 kcal over" (rendered once). */
  label: string;
  /** Calories logged on the day the summary describes. */
  consumed: number;
  /** Daily calorie goal. */
  goal: number;
  over: boolean;
  /** Goal progress percent (0–100, capped). */
  percent: number;
  /** Amount over goal; only rendered when `over`. */
  overBy: number;
  /** Day the summary describes (local date key). */
  dateKey: string;
  /** Berry fill resolved for the flat face (`caloriesHeroVisual.barFill`). */
  barFill: string;
  /** Berry-aware caption ink resolved for the flat face. */
  mutedInk: string;
  /** Berry-aware metric ink resolved for the flat face. */
  metricInk: string;
  onEditGoal: () => void;
};

/**
 * The daily summary — the Calories `depth.flat` hero (V3 W10 R5 hierarchy,
 * restyled by Playful Momentum P17 per §7 "Calories").
 *
 * Anatomy, in the blueprint's order: the remaining-kcal `metric` headline
 * (§5.5 30/36 800 tabular), the consumed-of-goal context, one 14px Berry
 * progress bar (§6 ProgressBar), the goal as one quiet control, and a factual
 * over-goal caption. No StatBlock trio, no donut, no second rendering of any
 * daily fact — the W10 duplicate-UI contract holds because this card is the
 * only place the remaining/over number appears.
 *
 * P17 rule: ONE hue. `barFill` is the Berry tier that clears the 3:1 non-text
 * floor against BOTH the sunken track and the flat face in the current
 * appearance (`caloriesHeroVisual`); `metricInk` is that same theme-resolved
 * Berry pair, so the bright Berry that reads 2.58:1 on a white card never
 * paints a number or a bar there.
 */
export function CaloriesDailyHero({
  label,
  consumed,
  goal,
  over,
  percent,
  overBy,
  dateKey,
  barFill,
  mutedInk,
  metricInk,
  onEditGoal,
}: Props) {
  const { tokens } = useAppTheme();

  return (
    <Card className="mb-4" innerClassName="p-5">
      {/* The metric owns the first line so it never has to share the row with
          the goal pill (at 360 the number needs the full card width). */}
      <Text variant="metric" style={{ color: metricInk }}>
        {label}
      </Text>

      <View className="mt-1 flex-row flex-wrap items-center justify-between gap-2">
        <Text variant="caption" className="min-w-0 flex-1" style={{ color: mutedInk }}>
          {formatDayContext(dateKey)} · {formatKcal(consumed)} of {formatKcal(goal)} kcal logged
        </Text>
        <Pressable
          onPress={onEditGoal}
          accessibilityRole="button"
          accessibilityLabel="Edit daily calorie goal"
          className="rounded-full px-3 py-1.5"
          style={{ backgroundColor: tokens.surface, borderWidth: 1, borderColor: tokens.border }}
        >
          <Text variant="label" style={{ color: tokens.text }}>
            Edit goal
          </Text>
        </Pressable>
      </View>

      <ProgressBar
        progress={percent / 100}
        accentColor={barFill}
        height={CALORIES_HERO_BAR_HEIGHT}
        className="mt-3"
        accessibilityLabel="Daily calories progress"
      />

      {over ? (
        <Text variant="caption" tone="warning" className="mt-2">
          {formatKcal(overBy)} kcal over goal
        </Text>
      ) : null}
    </Card>
  );
}
