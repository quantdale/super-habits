/**
 * Authoritative remote-backup surface for the account/recovery E2E boundary.
 *
 * This is the single source of truth for which `/rest/v1/<entity>` routes the
 * shared account Supabase mock recognizes. It must equal the production backup
 * contract — every `BACKUP_ENTITIES` table plus every
 * `BACKUP_SYNTHETIC_ENTITIES` record.
 *
 * It is intentionally a standalone list (no `@/core/backup/backup.types` import)
 * so the Playwright E2E tree never depends on tsconfig path-alias resolution.
 * `tests/accountSupabaseMock.drift.test.ts` enforces exact equality with the
 * production constants; a future backup-scope addition must update this list or
 * the drift test fails before account journeys can silently 404 it.
 */
export const BACKUP_REST_ENTITIES = [
  'todos',
  'habits',
  'habit_completions',
  'calorie_entries',
  'saved_meals',
  'workout_routines',
  'routine_exercises',
  'routine_exercise_sets',
  'workout_logs',
  'workout_session_exercises',
  'workout_session_sets',
  'pomodoro_sessions',
  'linked_action_rules',
  'weekly_reviews',
  'projects',
  'goals',
  'daily_plans',
  'custom_exercises',
  'workout_weekly_plan',
  'workout_schedule_overrides',
  'body_weight_entries',
  'todo_recurrence_series',
  'user_backup_settings',
  'backup_manifest',
] as const;

export type BackupRestEntity = (typeof BACKUP_REST_ENTITIES)[number];

// Frozen transport scopes, independently checked against production in the
// drift suite. Never derive an old epoch by accepting arbitrary manifest keys.
const scope2 = [
  'todos',
  'habits',
  'habit_completions',
  'calorie_entries',
  'saved_meals',
  'workout_routines',
  'routine_exercises',
  'routine_exercise_sets',
  'workout_logs',
  'workout_session_exercises',
  'pomodoro_sessions',
  'linked_action_rules',
] as const;
const scope3 = [...scope2, 'weekly_reviews'] as const;
const scope4 = [...scope3, 'projects', 'goals', 'daily_plans'] as const;
const scope5 = [...scope4, 'workout_session_sets'] as const;
const scope6 = [
  ...scope5,
  'custom_exercises',
  'workout_weekly_plan',
  'workout_schedule_overrides',
  'body_weight_entries',
] as const;
const scope7 = [...scope6] as const;
const scope8 = [...scope7, 'todo_recurrence_series'] as const;
const scope9 = [...scope8] as const;

export const BACKUP_GENERATION_ENTITY_SCOPES: Readonly<
  Record<number, readonly BackupRestEntity[]>
> = {
  2: scope2,
  3: scope3,
  4: scope4,
  5: scope5,
  6: scope6,
  7: scope7,
  8: scope8,
  9: scope9,
};

export function isBackupRestEntity(name: string): name is BackupRestEntity {
  return (BACKUP_REST_ENTITIES as readonly string[]).includes(name);
}
