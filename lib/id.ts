/**
 * Canonical ID prefixes (entity → prefix). Use only these at call sites.
 * Format: {prefix}_{timestamp_ms}_{8_random_chars}
 *
 * | Entity              | Prefix |
 * |---------------------|--------|
 * | todos               | todo   |
 * | habits              | habit  |
 * | habit_completions   | hcmp   |
 * | calorie_entries     | cal    |
 * | saved_meals         | smeal  |
 * | workout_routine     | wrk    |
 * | workout_log         | wrk    |
 * | routine_exercise    | ex     |
 * | routine_exercise_set| eset   |
 * | workout_session_ex  | wsex   |
 * | pomodoro_sessions   | pom    |
 * | guest (app_meta)    | guest  |
 * | recurring todo ser. | rec    |
 */
export function createId(prefix: string): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now()}_${random}`;
}
