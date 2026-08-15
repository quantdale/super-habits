import type { CalorieGoal } from '@/features/calories/types';
import type { PomodoroSettings } from '@/features/pomodoro/pomodoro.domain';

/** Versioned backup contract. Bump only with a coordinated schema migration. */
export const BACKUP_SCHEMA_VERSION = 2;
/** Version of the recoverable-settings payload contract. */
export const BACKUP_SETTINGS_VERSION = 2;
/** Local scope marker: when `backup.scope_version` is below this, backfill runs. */
export const BACKUP_SCOPE_VERSION = 2;

/**
 * Every locally durable, user-owned table in the recoverable backup scope,
 * in restore import order (parents before children).
 */
export const BACKUP_ENTITIES = [
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

export type BackupEntity = (typeof BACKUP_ENTITIES)[number];

/**
 * Entities that ride the durable outbox but are not local tables:
 * - `user_backup_settings` — synthetic id `settings`, payload built from the
 *   allowlisted settings snapshot at push time (outbox coalescing means the
 *   newest snapshot wins).
 * - `backup_manifest` — synthetic id `manifest`, payload is the manifest
 *   snapshot captured at enqueue time and stored in app_meta
 *   (`backup.pending_manifest`); never recomputed at push time.
 */
export const BACKUP_SYNTHETIC_ENTITIES = ['user_backup_settings', 'backup_manifest'] as const;

export type BackupSyntheticEntity = (typeof BACKUP_SYNTHETIC_ENTITIES)[number];

export const BACKUP_SETTINGS_RECORD_ID = 'settings';
export const BACKUP_MANIFEST_RECORD_ID = 'manifest';

/** Fixed canonical column order per entity (local schema order; user_id excluded). */
export const BACKUP_ENTITY_COLUMNS: Record<BackupEntity, readonly string[]> = {
  todos: [
    'id',
    'title',
    'notes',
    'completed',
    'due_date',
    'priority',
    'sort_order',
    'recurrence',
    'recurrence_id',
    'created_at',
    'updated_at',
    'deleted_at',
  ],
  habits: [
    'id',
    'name',
    'target_per_day',
    'reminder_time',
    'category',
    'icon',
    'color',
    'rule_history',
    'created_at',
    'updated_at',
    'deleted_at',
  ],
  habit_completions: ['id', 'habit_id', 'date_key', 'count', 'created_at', 'updated_at'],
  calorie_entries: [
    'id',
    'food_name',
    'calories',
    'protein',
    'carbs',
    'fats',
    'fiber',
    'meal_type',
    'consumed_on',
    'created_at',
    'updated_at',
    'deleted_at',
  ],
  saved_meals: [
    'id',
    'food_name',
    'calories',
    'protein',
    'carbs',
    'fats',
    'fiber',
    'meal_type',
    'use_count',
    'last_used_at',
    'created_at',
  ],
  workout_routines: ['id', 'name', 'description', 'created_at', 'updated_at', 'deleted_at'],
  routine_exercises: [
    'id',
    'routine_id',
    'name',
    'sort_order',
    'created_at',
    'updated_at',
    'deleted_at',
  ],
  routine_exercise_sets: [
    'id',
    'exercise_id',
    'set_number',
    'active_seconds',
    'rest_seconds',
    'created_at',
    'updated_at',
    'deleted_at',
  ],
  workout_logs: ['id', 'routine_id', 'notes', 'completed_at', 'created_at'],
  workout_session_exercises: ['id', 'log_id', 'exercise_name', 'sets_completed', 'created_at'],
  pomodoro_sessions: [
    'id',
    'started_at',
    'ended_at',
    'duration_seconds',
    'session_type',
    'created_at',
  ],
  linked_action_rules: [
    'id',
    'status',
    'direction_policy',
    'bidirectional_group_id',
    'source_feature',
    'source_entity_type',
    'source_entity_id',
    'trigger_type',
    'target_feature',
    'target_entity_type',
    'target_entity_id',
    'effect_type',
    'effect_payload',
    'created_at',
    'updated_at',
    'deleted_at',
  ],
};

/** Entities whose local rows carry a soft-delete tombstone column. */
export const BACKUP_SOFT_DELETE_ENTITIES: ReadonlySet<BackupEntity> = new Set([
  'todos',
  'habits',
  'calorie_entries',
  'workout_routines',
  'routine_exercises',
  'routine_exercise_sets',
  'linked_action_rules',
]);

/**
 * Entities where the product hard-deletes rows locally (no tombstone). A
 * `delete` outbox operation for these must issue an owner-scoped remote
 * DELETE because no local row remains to upsert.
 */
export const BACKUP_HARD_DELETE_ENTITIES: ReadonlySet<BackupEntity> = new Set([
  'habit_completions',
  'saved_meals',
]);

export type BackupState = 'v2_complete' | 'v1_legacy' | 'in_progress' | 'invalid' | 'unavailable';

export type EntityIntegrityMetadata = {
  count: number;
  checksum: string;
};

/** Local snapshot captured at enqueue time; the remote row mirrors this. */
export type BackupManifest = {
  backupSchemaVersion: number;
  generation: number;
  completedAt: string;
  entityMetadata: Partial<Record<BackupEntity, EntityIntegrityMetadata>>;
  settingsVersion: number;
};

/** Remote row shape for `backup_manifest`. */
export type RemoteBackupManifestRow = {
  user_id: string;
  backup_schema_version: number;
  generation: number;
  completed_at: string;
  entity_metadata: Record<string, EntityIntegrityMetadata>;
  settings_version: number;
  updated_at: string;
};

/** Remote row shape for `user_backup_settings`. */
export type RemoteUserBackupSettingsRow = {
  user_id: string;
  settings_version: number;
  payload: RecoverableSettingsV2;
  updated_at: string;
};

/**
 * Allowlisted recoverable settings contract. Keys are runtime-validated and
 * bounded; auth/sync/system/device state never appears here.
 */
export type RecoverableSettingsV2 = {
  calorieGoal: CalorieGoal | null;
  pomodoroSettings: PomodoroSettings | null;
  theme: {
    mode: string | null;
    slots: Record<string, string> | null;
  };
};

export type BackupBackfillStatus = 'idle' | 'running' | 'complete';

/** UI-facing summary of the current backup completeness state. */
export type BackupStatusSummary = {
  state: BackupState;
  lastCompleteAt: string | null;
  lastCompleteGeneration: number | null;
  pendingChangeCount: number;
  backfillStatus: BackupBackfillStatus;
  missingEntities: BackupEntity[];
};
