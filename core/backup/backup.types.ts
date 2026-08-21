import type { CalorieGoal } from '@/features/calories/types';
import type { PomodoroPreset, PomodoroSettings } from '@/features/pomodoro/pomodoro.domain';
import type { TimeOfDay } from '@/core/notifications/reminderPlanning';

/** Versioned backup contract. Bump only with a coordinated schema migration. */
export const BACKUP_SCHEMA_VERSION = 2;
/** Version of the recoverable-settings payload contract. */
export const BACKUP_SETTINGS_VERSION = 3;
/**
 * Versioned *recoverable scope* marker — the exact set of entities covered by
 * a backup. Bumped from 3 → 4 when Projects/Goals/Daily Plans (and the new
 * Todo/Habit `project_id`/`goal_id`/`completed_at` columns) joined the
 * recoverable scope during the Productivity Expansion Wave V1 hardening.
 * Bumped from 4 → 5 when the hardening wave v2 promoted durable user-domain
 * state: habit lifecycle columns, Pomodoro session metadata, per-set workout
 * load/reps (`workout_session_sets`), and real workout session timing.
 *
 * Scope is deliberately distinct from `BACKUP_SCHEMA_VERSION`: the row *shape*
 * stayed compatible (new columns are nullable), so the schema version did not
 * need to bump, but the recoverable *set* grew, so the scope version did.
 *
 * Local marker: when `backup.scope_version` is below this, backfill runs.
 */
export const BACKUP_SCOPE_VERSION = 5;

/**
 * Every locally durable, user-owned table in the recoverable backup scope,
 * in restore import order (parents before children).
 *
 * Ordering note: the original 13 entities keep their historical positions so
 * existing Portable V1 files canonicalize/verify with an unchanged entity
 * order (checksum stability). The three planning entities are appended at the
 * end; their restore import order is enforced explicitly by the Restore
 * pipeline (Projects → Goals → Todos/Habits → Daily Plans), not by this array.
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
  'weekly_reviews',
  'projects',
  'goals',
  'daily_plans',
  'workout_session_sets',
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
    'project_id',
    'goal_id',
    'completed_at',
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
    'project_id',
    'goal_id',
    'status',
    'lifecycle_history',
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
  workout_logs: [
    'id',
    'routine_id',
    'notes',
    'completed_at',
    'created_at',
    'started_at',
    'ended_at',
    'duration_seconds',
  ],
  workout_session_exercises: ['id', 'log_id', 'exercise_name', 'sets_completed', 'created_at'],
  pomodoro_sessions: [
    'id',
    'started_at',
    'ended_at',
    'duration_seconds',
    'session_type',
    'created_at',
    'linked_todo_id',
    'linked_todo_title',
    'note',
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
  weekly_reviews: [
    'id',
    'week_key',
    'week_start_date',
    'week_end_date',
    'next_week_start_date',
    'completed_at',
    'status',
    'summary_payload',
    'plan_payload',
    'reflection',
    'created_at',
    'updated_at',
    'deleted_at',
  ],
  projects: [
    'id',
    'name',
    'description',
    'color',
    'status',
    'target_date',
    'sort_order',
    'created_at',
    'updated_at',
    'deleted_at',
    'completed_at',
  ],
  goals: [
    'id',
    'project_id',
    'title',
    'description',
    'horizon',
    'target_date',
    'status',
    'progress_percent',
    'created_at',
    'updated_at',
    'deleted_at',
    'completed_at',
  ],
  daily_plans: [
    'id',
    'date_key',
    'intention',
    'top_todo_ids',
    'focus_target_minutes',
    'notes',
    'reflection',
    'energy_score',
    'status',
    'created_at',
    'updated_at',
    'deleted_at',
    'completed_at',
  ],
  workout_session_sets: [
    'id',
    'session_exercise_id',
    'set_number',
    'weight',
    'reps',
    'weight_unit',
    'completed',
    'created_at',
  ],
};

/**
 * Historical Portable V1 canonical columns, snapshotted exactly as they were
 * when V1 files (formatVersion 1) were exported. V1 files must canonicalize
 * and verify with these columns so their stored checksums still match — the
 * current `BACKUP_ENTITY_COLUMNS` adds `project_id`/`goal_id`/`completed_at`
 * to `todos` and adds the three planning entities, which would otherwise
 * change the V1 payload checksum. Habits are ongoing scheduled entities and
 * have no terminal completion state, so `completed_at` is intentionally
 * excluded from the Habit canonical columns (only Todos/Projects/Goals/Daily
 * Plans carry it). Only entities present in the V1 scope are listed.
 */
export const PORTABLE_V1_ENTITY_COLUMNS: Partial<Record<BackupEntity, readonly string[]>> = {
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
  weekly_reviews: [
    'id',
    'week_key',
    'week_start_date',
    'week_end_date',
    'next_week_start_date',
    'completed_at',
    'status',
    'summary_payload',
    'plan_payload',
    'reflection',
    'created_at',
    'updated_at',
    'deleted_at',
  ],
};

/**
 * Scope V4 canonical columns, snapshotted exactly as they were when scope 4
 * was current (before the hardening wave v2 V5 bump). Scope-4 manifests and
 * Portable formatVersion-2/scope-4 files must canonicalize and verify against
 * these columns so their stored checksums still match — the current
 * `BACKUP_ENTITY_COLUMNS` appends habit lifecycle columns, Pomodoro session
 * metadata columns, workout timing columns, and the `workout_session_sets`
 * entity, which would otherwise change stored checksums.
 */
export const BACKUP_SCOPE_V4_ENTITY_COLUMNS: Partial<Record<BackupEntity, readonly string[]>> = {
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
    'project_id',
    'goal_id',
    'completed_at',
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
    'project_id',
    'goal_id',
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
  weekly_reviews: [
    'id',
    'week_key',
    'week_start_date',
    'week_end_date',
    'next_week_start_date',
    'completed_at',
    'status',
    'summary_payload',
    'plan_payload',
    'reflection',
    'created_at',
    'updated_at',
    'deleted_at',
  ],
  projects: [
    'id',
    'name',
    'description',
    'color',
    'status',
    'target_date',
    'sort_order',
    'created_at',
    'updated_at',
    'deleted_at',
    'completed_at',
  ],
  goals: [
    'id',
    'project_id',
    'title',
    'description',
    'horizon',
    'target_date',
    'status',
    'progress_percent',
    'created_at',
    'updated_at',
    'deleted_at',
    'completed_at',
  ],
  daily_plans: [
    'id',
    'date_key',
    'intention',
    'top_todo_ids',
    'focus_target_minutes',
    'notes',
    'reflection',
    'energy_score',
    'status',
    'created_at',
    'updated_at',
    'deleted_at',
    'completed_at',
  ],
};

/**
 * Known historical recoverable-scope epochs, recorded EXACTLY. A manifest or
 * portable file is restorable only when its entity set matches one of these
 * (or the current scope) exactly — never via permissive "missing table =
 * empty" inference. The entities appear in their historical canonical order.
 */
export const KNOWN_HISTORICAL_BACKUP_SCOPE_V2_ENTITY_SET = [
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

export const KNOWN_HISTORICAL_BACKUP_SCOPE_V3_ENTITY_SET = [
  ...KNOWN_HISTORICAL_BACKUP_SCOPE_V2_ENTITY_SET,
  'weekly_reviews',
] as const;

export const KNOWN_HISTORICAL_BACKUP_SCOPE_V4_ENTITY_SET = [
  ...KNOWN_HISTORICAL_BACKUP_SCOPE_V3_ENTITY_SET,
  'projects',
  'goals',
  'daily_plans',
] as const;

/** Current (hardened wave v2) recoverable scope epoch. */
export const CURRENT_BACKUP_SCOPE_ENTITY_SET = BACKUP_ENTITIES;

function sortedEquals(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((value, index) => value === sb[index]);
}

/**
 * Resolve a manifest/file's recoverable scope from its explicit scope version
 * (new manifests) or its exact entity set (historical manifests that predate
 * scope versioning). Returns null when the scope is unknown or NEWER than this
 * app understands (a newer scope must surface as `unsupported_version`, never
 * silently verify as "current"), and when the entity set matches none of the
 * known epochs — partial/unknown scopes are never inferred permissively ("a
 * missing table is just empty").
 */
export function resolveBackupScope(input: {
  backupScopeVersion?: number | null;
  entityMetadata: Partial<Record<BackupEntity, unknown>>;
}): { scope: number; entitySet: readonly BackupEntity[] } | null {
  if (typeof input.backupScopeVersion === 'number') {
    if (input.backupScopeVersion === BACKUP_SCOPE_VERSION) {
      return { scope: BACKUP_SCOPE_VERSION, entitySet: [...BACKUP_ENTITIES] };
    }
    if (input.backupScopeVersion === 4) {
      return { scope: 4, entitySet: KNOWN_HISTORICAL_BACKUP_SCOPE_V4_ENTITY_SET };
    }
    // Older explicit versions (2/3) and anything newer fall through to exact
    // entity-set matching below; a future scope must not resolve as current.
    if (input.backupScopeVersion > BACKUP_SCOPE_VERSION) {
      return null;
    }
  }
  const keys = Object.keys(input.entityMetadata);
  if (sortedEquals(keys, [...BACKUP_ENTITIES])) {
    return { scope: BACKUP_SCOPE_VERSION, entitySet: [...BACKUP_ENTITIES] };
  }
  if (sortedEquals(keys, [...KNOWN_HISTORICAL_BACKUP_SCOPE_V4_ENTITY_SET])) {
    return { scope: 4, entitySet: KNOWN_HISTORICAL_BACKUP_SCOPE_V4_ENTITY_SET };
  }
  if (sortedEquals(keys, [...KNOWN_HISTORICAL_BACKUP_SCOPE_V3_ENTITY_SET])) {
    return { scope: 3, entitySet: KNOWN_HISTORICAL_BACKUP_SCOPE_V3_ENTITY_SET };
  }
  if (sortedEquals(keys, [...KNOWN_HISTORICAL_BACKUP_SCOPE_V2_ENTITY_SET])) {
    return { scope: 2, entitySet: KNOWN_HISTORICAL_BACKUP_SCOPE_V2_ENTITY_SET };
  }
  return null;
}

/**
 * Canonical columns to use when verifying a manifest/file of the given scope.
 * Each epoch verifies against the frozen column snapshot that produced its
 * stored checksums: scopes below 4 use the Portable V1 snapshot, scope 4 uses
 * the V4 snapshot, and only the current scope uses the live columns.
 */
export function backupEntityColumnsForScope(
  scope: number,
): Record<BackupEntity, readonly string[]> {
  if (scope >= BACKUP_SCOPE_VERSION) {
    return BACKUP_ENTITY_COLUMNS;
  }
  const historical: Record<BackupEntity, readonly string[]> = {
    ...BACKUP_ENTITY_COLUMNS,
  };
  const snapshot =
    scope === 4
      ? BACKUP_SCOPE_V4_ENTITY_COLUMNS
      : (PORTABLE_V1_ENTITY_COLUMNS as Partial<Record<BackupEntity, readonly string[]>>);
  for (const entity of Object.keys(historical) as BackupEntity[]) {
    const frozen = snapshot[entity];
    if (frozen) historical[entity] = frozen;
  }
  return historical;
}

/** Entities whose local rows carry a soft-delete tombstone column. */
export const BACKUP_SOFT_DELETE_ENTITIES: ReadonlySet<BackupEntity> = new Set([
  'todos',
  'habits',
  'calorie_entries',
  'workout_routines',
  'routine_exercises',
  'routine_exercise_sets',
  'linked_action_rules',
  'weekly_reviews',
  'projects',
  'goals',
  'daily_plans',
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

/**
 * Settings integrity certification: the deterministic SHA-256 of the
 * canonicalized allowlisted settings payload captured with the manifest
 * generation, plus the payload contract version.
 */
export type SettingsMetadata = {
  version: number;
  checksum: string;
};

/** Local snapshot captured at enqueue time; the remote row mirrors this. */
export type BackupManifest = {
  backupSchemaVersion: number;
  /**
   * Recoverable scope version (set of entities) this manifest certifies.
   * Persisted explicitly so a historical manifest (which predates scope
   * versioning) is unambiguously restorable under its own exact scope rules.
   */
  backupScopeVersion: number;
  generation: number;
  completedAt: string;
  entityMetadata: Partial<Record<BackupEntity, EntityIntegrityMetadata>>;
  settingsVersion: number;
  /**
   * Settings integrity certification (closure contract). The checkpoint
   * always writes it; a v2 manifest WITHOUT it cannot certify the settings
   * payload and is treated as incomplete by restore and the status UI.
   */
  settingsMetadata?: SettingsMetadata;
};

/** Remote row shape for `backup_manifest`. */
export type RemoteBackupManifestRow = {
  user_id: string;
  backup_schema_version: number;
  backup_scope_version: number | null;
  generation: number;
  completed_at: string;
  entity_metadata: Record<string, EntityIntegrityMetadata>;
  settings_version: number;
  settings_metadata: SettingsMetadata | null;
  updated_at: string;
};

/** Remote row shape for `user_backup_settings`. */
export type RemoteUserBackupSettingsRow = {
  user_id: string;
  settings_version: number;
  payload: RecoverableSettingsV2 | RecoverableSettingsV3;
  updated_at: string;
};

/**
 * Allowlisted recoverable settings contract (V2). Keys are runtime-validated
 * and bounded; auth/sync/system/device state never appears here.
 */
export type RecoverableSettingsV2 = {
  calorieGoal: CalorieGoal | null;
  pomodoroSettings: PomodoroSettings | null;
  theme: {
    mode: string | null;
    slots: Record<string, string> | null;
  };
};

/**
 * Allowlisted recoverable settings contract (V3, hardening wave v2). Extends
 * V2 with SQLite-backed user preferences that must survive restore; new keys
 * are appended so the V2 canonical text stays byte-stable for historical
 * payloads. Absent keys normalize to null and unknown keys are dropped, so a
 * V2 payload normalizes cleanly into this shape.
 */
export type RecoverableSettingsV3 = RecoverableSettingsV2 & {
  /** Daily macro targets (protein/carbs/fats grams); falls back to calorieGoal at runtime. */
  macroTargets: CalorieGoal | null;
  /** Pomodoro timer presets plus the active preset id. */
  pomodoroPresets: {
    presets: PomodoroPreset[];
    activePresetId: string | null;
  } | null;
  /** Default rest between workout sets, in seconds (clamped 5–600). */
  workoutRestSeconds: number | null;
  /** Todo/daily-plan reminder preferences. */
  notificationPreferences: {
    todoRemindersEnabled: boolean;
    dailyPlanReminderTime: TimeOfDay;
  } | null;
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
