export function calculateHabitProgress(count: number, targetPerDay: number): number {
  if (targetPerDay <= 0) return 0;
  return Math.min(1, count / targetPerDay);
}
