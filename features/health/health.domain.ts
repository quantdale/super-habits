import { formatKcal } from '@/features/calories/caloriesFormat';

/**
 * The Health summary's nutrition delta segment (pure).
 *
 * Over-goal copy matches the Calories screen's established pattern
 * (`CaloriesScreen` remainingLabel: "{formatKcal(overBy)} kcal over"); the
 * under-goal "{n} left" copy is unchanged. Over-goal must report how much the
 * user is over — a clamped "0 left" reads as exactly on goal.
 */
export function kcalGoalDeltaLabel(eaten: number, goal: number): string {
  return eaten > goal
    ? `${formatKcal(eaten - goal)} kcal over`
    : `${Math.max(goal - eaten, 0)} left`;
}
