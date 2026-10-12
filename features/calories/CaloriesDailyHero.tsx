import { Pressable, View } from 'react-native';
import { useAppTheme } from '@/core/providers/themeContext';
import { Card } from '@/core/ui/Card';
import { Text } from '@/core/ui/Text';
import { formatDayContext, formatKcal } from './caloriesFormat';

type Props = {
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
  accentColor: string;
  onEditGoal: () => void;
};

/**
 * The one daily summary surface (V3 W10, R5): the remaining-kcal fact lives in
 * the screen title, so this card carries the *context* for that number —
 * consumed-of-goal, one progress bar, the goal itself as one quiet control,
 * and a factual over-goal caption. No StatBlock trio, no donut, no duplicated
 * totals: each daily fact renders exactly once on the Calories surface.
 */
export function CaloriesDailyHero({
  consumed,
  goal,
  over,
  percent,
  overBy,
  dateKey,
  accentColor,
  onEditGoal,
}: Props) {
  const { tokens } = useAppTheme();

  return (
    <Card variant="hero" accentColor={accentColor} className="mb-4">
      <View className="flex-row flex-wrap items-center justify-between gap-2">
        <Text variant="caption" tone="muted" className="min-w-0 flex-1">
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
            Goal {formatKcal(goal)}
          </Text>
        </Pressable>
      </View>

      <View
        className="mt-3 h-2.5 w-full overflow-hidden rounded-full"
        style={{ backgroundColor: tokens.surfaceSunken }}
      >
        {/* Over-target stays informational (blueprint Gate F): accent fill and
            a factual caption in the neutral-caution tone — never danger red,
            never shame copy. */}
        <View
          className="h-full rounded-full"
          style={{ width: `${percent}%`, backgroundColor: accentColor }}
        />
      </View>

      {over ? (
        <Text variant="caption" tone="warning" className="mt-2">
          {formatKcal(overBy)} kcal over goal
        </Text>
      ) : null}
    </Card>
  );
}
