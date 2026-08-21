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
  'user_backup_settings',
  'backup_manifest',
] as const;

export type BackupRestEntity = (typeof BACKUP_REST_ENTITIES)[number];

export function isBackupRestEntity(name: string): name is BackupRestEntity {
  return (BACKUP_REST_ENTITIES as readonly string[]).includes(name);
}
