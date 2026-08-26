import { appMetaKeys, setAppMetaJson, setAppMetaText } from '@/core/db/appMeta';
import { getDatabase } from '@/core/db/client';
import {
  getLocalDatasetOwner,
  setLocalDatasetOwner,
  inspectLocalAccountDataState,
} from '@/core/auth/account.data';
import { withSQLiteTransaction } from '@/core/db/transactions';
import { requestHabitReminderReconciliation } from '@/core/notifications/habitReminderSignals';
import { requestWorkoutReminderReconciliation } from '@/core/notifications/workoutReminderSignals';
import { getSupabaseAuthUserId, isRemoteEnabled, supabase } from '@/lib/supabase';
import { nowIso } from '@/lib/time';
import { checksumRows } from '@/lib/checksum';
import {
  BACKUP_ENTITIES,
  BACKUP_SCHEMA_VERSION,
  BACKUP_SETTINGS_VERSION,
  BACKUP_SCOPE_VERSION,
  backupEntityColumnsForScope,
  resolveBackupScope,
  type BackupEntity,
  type BackupManifest,
  type RemoteBackupManifestRow,
  type RemoteUserBackupSettingsRow,
} from '@/core/backup/backup.types';
import { validateBackupGraph, validateBackupRow } from '@/core/backup/backupValidators';
import {
  applyRecoverableSettingsToSqlite,
  applyPendingThemeApplication,
  canonicalizeSettingsPayload,
  isValidRecoverableSettings,
  normalizeRecoverableSettings,
  stagePendingThemeApplication,
} from '@/core/backup/backupSettings';
import type {
  CalorieEntry,
  BodyWeightEntry,
  CustomExercise,
  DailyPlan,
  Goal,
  Habit,
  HabitCompletion,
  PomodoroSession,
  Project,
  RoutineExercise,
  RoutineExerciseSet,
  SavedMeal,
  Todo,
  WorkoutLog,
  WorkoutRoutine,
  WorkoutSessionExercise,
  WorkoutSessionSet,
  WorkoutScheduleOverride,
  WorkoutWeeklyPlanEntry,
} from '@/core/db/types';
import type { LinkedActionRuleRow } from '@/core/linked-actions/linkedActions.types';
import type { WeeklyReview } from '@/features/weekly-review/weeklyReview.types';
import { applyRemoteTodos } from '@/features/todos/todos.data';
import { applyRemoteHabits, applyRemoteHabitCompletions } from '@/features/habits/habits.data';
import {
  applyRemoteCalorieEntries,
  applyRemoteSavedMeals,
} from '@/features/calories/calories.data';
import { applyRemotePomodoroSessions } from '@/features/pomodoro/pomodoro.data';
import { applyRemoteProjects } from '@/features/projects/projects.data';
import { applyRemoteGoals } from '@/features/goals/goals.data';
import { applyRemoteDailyPlans } from '@/features/daily-plan/dailyPlan.data';
import {
  applyRemoteRoutineExercises,
  applyRemoteRoutineExerciseSets,
  applyRemoteWorkoutLogs,
  applyRemoteWorkoutRoutines,
  applyRemoteWorkoutSessionExercises,
  applyRemoteWorkoutSessionSets,
  applyRemoteBodyWeightEntries,
  applyRemoteCustomExercises,
  applyRemoteWorkoutScheduleOverrides,
  applyRemoteWorkoutWeeklyPlan,
} from '@/features/workout/workout.data';
import { applyRemoteLinkedActionRules } from '@/core/linked-actions/linkedActions.data';
import { applyRemoteWeeklyReviews } from '@/features/weekly-review/weeklyReview.data';

/**
 * The complete V2 import sequence, keyed by entity in dependency order
 * (parents before children; settings are staged separately below). The table
 * is the single source of import coverage: a new BACKUP_ENTITIES member
 * cannot silently skip its importer because the exported key list is asserted
 * to equal BACKUP_ENTITIES exactly by the inventory coherence test.
 */
export const RESTORE_IMPORTERS: readonly [
  BackupEntity,
  (db: Parameters<typeof applyRemoteProjects>[0], rows: unknown[]) => Promise<void>,
][] = [
  ['projects', (db, rows) => applyRemoteProjects(db, rows as Project[])],
  ['goals', (db, rows) => applyRemoteGoals(db, rows as Goal[])],
  ['todos', (db, rows) => applyRemoteTodos(db, rows as Todo[])],
  ['habits', (db, rows) => applyRemoteHabits(db, rows as Habit[])],
  ['daily_plans', (db, rows) => applyRemoteDailyPlans(db, rows as DailyPlan[])],
  ['habit_completions', (db, rows) => applyRemoteHabitCompletions(db, rows as HabitCompletion[])],
  ['calorie_entries', (db, rows) => applyRemoteCalorieEntries(db, rows as CalorieEntry[])],
  ['saved_meals', (db, rows) => applyRemoteSavedMeals(db, rows as SavedMeal[])],
  ['custom_exercises', (db, rows) => applyRemoteCustomExercises(db, rows as CustomExercise[])],
  ['workout_routines', (db, rows) => applyRemoteWorkoutRoutines(db, rows as WorkoutRoutine[])],
  ['routine_exercises', (db, rows) => applyRemoteRoutineExercises(db, rows as RoutineExercise[])],
  [
    'routine_exercise_sets',
    (db, rows) => applyRemoteRoutineExerciseSets(db, rows as RoutineExerciseSet[]),
  ],
  ['workout_logs', (db, rows) => applyRemoteWorkoutLogs(db, rows as WorkoutLog[])],
  [
    'workout_session_exercises',
    (db, rows) => applyRemoteWorkoutSessionExercises(db, rows as WorkoutSessionExercise[]),
  ],
  [
    'workout_session_sets',
    (db, rows) => applyRemoteWorkoutSessionSets(db, rows as WorkoutSessionSet[]),
  ],
  [
    'workout_weekly_plan',
    (db, rows) => applyRemoteWorkoutWeeklyPlan(db, rows as WorkoutWeeklyPlanEntry[]),
  ],
  [
    'workout_schedule_overrides',
    (db, rows) => applyRemoteWorkoutScheduleOverrides(db, rows as WorkoutScheduleOverride[]),
  ],
  [
    'body_weight_entries',
    (db, rows) => applyRemoteBodyWeightEntries(db, rows as BodyWeightEntry[]),
  ],
  ['pomodoro_sessions', (db, rows) => applyRemotePomodoroSessions(db, rows as PomodoroSession[])],
  [
    'linked_action_rules',
    (db, rows) => applyRemoteLinkedActionRules(db, rows as LinkedActionRuleRow[]),
  ],
  ['weekly_reviews', (db, rows) => applyRemoteWeeklyReviews(db, rows as WeeklyReview[])],
];

export type RestoreV2Result =
  | {
      status: 'restored';
      restoredAt: string;
      generation: number;
      importedCounts: Record<BackupEntity, number>;
    }
  | {
      /** No manifest exists for this owner — the legacy V1 path handles it. */
      status: 'legacy';
    }
  | {
      status: 'blocked';
      reason: 'remote_disabled' | 'owner_mismatch' | 'local_data_present' | 'remote_unavailable';
      message: string;
    }
  | {
      status: 'invalid';
      reason:
        | 'manifest_missing'
        | 'manifest_malformed'
        | 'unsupported_version'
        | 'incomplete_manifest'
        | 'integrity_mismatch'
        | 'validation_failed'
        | 'dependency_failed'
        | 'fetch_failed'
        | 'auth_changed';
      message: string;
      diagnostics: string[];
    };

export type BackupStateSummary = {
  state: 'v2_complete' | 'v1_legacy' | 'in_progress' | 'invalid' | 'unavailable';
  lastCompleteAt: string | null;
  lastCompleteGeneration: number | null;
  pendingChangeCount: number;
  backfillInProgress: boolean;
  missingEntities: BackupEntity[];
};

const PAGE_SIZE = 1_000;

export function parseManifestRow(row: unknown): BackupManifest | null {
  if (!row || typeof row !== 'object') return null;
  const candidate = row as Record<string, unknown>;
  if (
    typeof candidate.backup_schema_version !== 'number' ||
    typeof candidate.generation !== 'number' ||
    typeof candidate.completed_at !== 'string' ||
    typeof candidate.entity_metadata !== 'object' ||
    candidate.entity_metadata === null ||
    typeof candidate.settings_version !== 'number'
  ) {
    return null;
  }
  const entityMetadata = candidate.entity_metadata as Record<string, unknown>;
  const metadata: BackupManifest['entityMetadata'] = {};
  for (const [entity, value] of Object.entries(entityMetadata)) {
    if (!value || typeof value !== 'object') return null;
    const meta = value as Record<string, unknown>;
    if (typeof meta.count !== 'number' || !Number.isInteger(meta.count) || meta.count < 0) {
      return null;
    }
    if (typeof meta.checksum !== 'string' || !/^[0-9a-f]{64}$/.test(meta.checksum)) {
      return null;
    }
    // Unknown/future entity keys are not cast into the BackupEntity type:
    // they are excluded here so scope resolution downstream still classifies
    // the manifest honestly (unknown scopes fail closed) instead of this
    // parser inventing entity names it does not understand.
    if (!(BACKUP_ENTITIES as readonly string[]).includes(entity)) continue;
    metadata[entity as BackupEntity] = { count: meta.count, checksum: meta.checksum };
  }
  // Settings integrity metadata (closure contract). A v2 manifest without it
  // cannot certify the settings payload — the caller treats it as incomplete.
  let settingsMetadata: BackupManifest['settingsMetadata'];
  const rawSettingsMetadata = candidate.settings_metadata;
  if (rawSettingsMetadata !== null && rawSettingsMetadata !== undefined) {
    if (typeof rawSettingsMetadata !== 'object') return null;
    const meta = rawSettingsMetadata as Record<string, unknown>;
    if (typeof meta.version !== 'number' || typeof meta.checksum !== 'string') return null;
    if (!/^[0-9a-f]{64}$/.test(meta.checksum)) return null;
    settingsMetadata = { version: meta.version, checksum: meta.checksum };
  }
  return {
    backupSchemaVersion: candidate.backup_schema_version,
    backupScopeVersion:
      typeof candidate.backup_scope_version === 'number' ? candidate.backup_scope_version : -1,
    generation: candidate.generation,
    completedAt: candidate.completed_at,
    entityMetadata: metadata,
    settingsVersion: candidate.settings_version,
    settingsMetadata,
  };
}

async function fetchManifestRow(ownerUserId: string): Promise<RemoteBackupManifestRow | null> {
  if (!supabase) return null;
  const result = await supabase
    .from('backup_manifest')
    .select('*')
    .eq('user_id', ownerUserId)
    .limit(1);
  if (result.error) {
    throw new Error(`[restore] Failed to fetch backup manifest: ${result.error.message}`);
  }
  const row = (result.data?.[0] ?? null) as RemoteBackupManifestRow | null;
  return row;
}

/**
 * Fetch exactly one owner-scoped recoverable-settings row BEFORE any local
 * write. Every Supabase `{ error }` — including `{ data: null, error: {...} }`
 * — is a restore failure, never a silent "settings absent" skip: the manifest
 * declares a settings snapshot, so its row must exist and verify.
 */
async function fetchRemoteRecoverableSettings(
  ownerUserId: string,
): Promise<RemoteUserBackupSettingsRow | null> {
  if (!supabase) {
    throw new Error('[restore] Remote backup is not configured.');
  }
  const result = await supabase
    .from('user_backup_settings')
    .select('*')
    .eq('user_id', ownerUserId)
    .limit(1);
  if (result.error) {
    throw new Error(`[restore] Failed to fetch user_backup_settings: ${result.error.message}`);
  }
  return (result.data?.[0] ?? null) as RemoteUserBackupSettingsRow | null;
}

/**
 * True when the manifest fetch failed because the remote does not have the V2
 * tables yet (pre-migration server or a non-Supabase stub). In that case the
 * backup can only be legacy V1 — restore must fall back instead of failing.
 */
export function isMissingV2RemoteTableError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    /PGRST205/i.test(message) ||
    /relation .*backup_manifest.* does not exist/i.test(message) ||
    /does not exist/i.test(message) ||
    /404/i.test(message) ||
    /not found/i.test(message) ||
    // Some stubs/proxies surface the PostgREST body with an empty message;
    // an empty error is far more likely a missing resource than a network
    // outage (those carry real messages), so fall back to legacy.
    /backup manifest: undefined/i.test(message)
  );
}

async function fetchRemoteRows(
  entity: BackupEntity,
  ownerUserId: string,
): Promise<Record<string, unknown>[]> {
  if (!supabase) {
    throw new Error('[restore] Remote backup is not configured.');
  }
  const rows: Record<string, unknown>[] = [];
  let from = 0;
  while (true) {
    const to = from + PAGE_SIZE - 1;
    const result = await supabase
      .from(entity)
      .select('*')
      .eq('user_id', ownerUserId)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .range(from, to);
    if (result.error) {
      throw new Error(`[restore] Failed to fetch ${entity}: ${result.error.message}`);
    }
    const batch = (result.data ?? []) as Record<string, unknown>[];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return rows;
}

/**
 * Single definition of "the device is empty for a destructive restore":
 * no user data (active or deleted) in ANY user-owned table, and no pending
 * or unowned outbox work. Both the V1 and V2 restore paths use this.
 */
export function isDeviceEmptyForRestore(
  local: Awaited<ReturnType<typeof inspectLocalAccountDataState>>,
): boolean {
  return (
    !local.hasUserData &&
    local.pendingOutboxCount === 0 &&
    local.unownedOutboxCount === 0 &&
    local.outboxOwnerIds.length === 0
  );
}

/**
 * Restore V2: fetch manifest → prefetch + validate EVERYTHING → verify
 * integrity + dependency graph → complete emptiness guard → ONE SQLite
 * transaction import with no historical side effects. Any failure leaves the
 * local database untouched.
 */
export async function restoreFromRemoteBackupV2(): Promise<RestoreV2Result> {
  if (!isRemoteEnabled()) {
    return {
      status: 'blocked',
      reason: 'remote_disabled',
      message: 'Remote backup is disabled in local-only mode.',
    };
  }
  const ownerUserId = await getSupabaseAuthUserId();
  if (!ownerUserId) {
    return {
      status: 'blocked',
      reason: 'remote_unavailable',
      message: 'Remote backup authentication is unavailable for the current account.',
    };
  }

  const db = await getDatabase();
  const localOwner = await getLocalDatasetOwner(db);
  if (localOwner && localOwner !== ownerUserId) {
    return {
      status: 'blocked',
      reason: 'owner_mismatch',
      message: 'Restore is paused because this device is signed into a different backup account.',
    };
  }

  // Complete emptiness guard (all user tables + outbox), matching Recoverable
  // Account V1's inventory. A device with only pomodoro history is NOT empty.
  const localState = await inspectLocalAccountDataState(db);
  if (!isDeviceEmptyForRestore(localState)) {
    return {
      status: 'blocked',
      reason: 'local_data_present',
      message: 'Restore is only available on an empty device; existing local data blocks import.',
    };
  }

  let manifestRow: RemoteBackupManifestRow | null;
  try {
    manifestRow = await fetchManifestRow(ownerUserId);
  } catch (error) {
    // A server without the V2 tables yet (pre-migration) has no manifest
    // endpoint: treat that as a legacy-only backup instead of failing the
    // whole restore. Genuine network errors stay invalid.
    if (isMissingV2RemoteTableError(error)) {
      return { status: 'legacy' };
    }
    return {
      status: 'invalid',
      reason: 'fetch_failed',
      message: error instanceof Error ? error.message : String(error),
      diagnostics: [],
    };
  }
  if (!manifestRow) {
    // Legacy V1 backup (or no backup): the V1 coordinator path handles it.
    return { status: 'legacy' };
  }

  const manifest = parseManifestRow(manifestRow);
  if (!manifest) {
    return {
      status: 'invalid',
      reason: 'manifest_malformed',
      message: 'The remote backup manifest is malformed.',
      diagnostics: ['manifest row failed structural validation'],
    };
  }
  if (manifest.backupSchemaVersion > BACKUP_SCHEMA_VERSION) {
    return {
      status: 'invalid',
      reason: 'unsupported_version',
      message: `This backup uses schema version ${manifest.backupSchemaVersion}, which this app cannot restore.`,
      diagnostics: [`backup_schema_version=${manifest.backupSchemaVersion}`],
    };
  }
  if (manifest.backupSchemaVersion < BACKUP_SCHEMA_VERSION) {
    return {
      status: 'invalid',
      reason: 'unsupported_version',
      message: `This backup uses legacy schema version ${manifest.backupSchemaVersion}; restore it through the legacy path.`,
      diagnostics: [`backup_schema_version=${manifest.backupSchemaVersion}`],
    };
  }
  // Resolve the exact recoverable scope this manifest certifies. Historical
  // manifests (no explicit scope version) are matched by their EXACT entity
  // set; an unknown/partial set is rejected rather than permissively treated
  // as a subset. A resolved scope guarantees the manifest's entityMetadata
  // covers precisely that scope's entity set.
  const scope = resolveBackupScope({
    backupScopeVersion: manifest.backupScopeVersion,
    entityMetadata: manifest.entityMetadata,
  });
  if (!scope) {
    return {
      status: 'invalid',
      reason: 'unsupported_version',
      message: 'The remote backup uses an unrecognized or partial recoverable scope.',
      diagnostics: ['recoverable scope does not match any known epoch'],
    };
  }

  // Prefetch ONLY the scope's entities before any local write; validate and
  // verify everything. Limiting to the resolved scope also keeps historical
  // restores from querying planning tables that did not exist when the backup
  // was taken. Entities are independent remote reads for the same owner and
  // the device is guaranteed empty, so they fetch concurrently instead of
  // paying ~21 sequential round-trip chains (each paginated).
  const rowsByEntity: Partial<Record<BackupEntity, Record<string, unknown>[]>> = {};
  try {
    const fetched = await Promise.all(
      scope.entitySet.map((entity) => fetchRemoteRows(entity, ownerUserId)),
    );
    scope.entitySet.forEach((entity, index) => {
      rowsByEntity[entity] = fetched[index];
    });
  } catch (error) {
    return {
      status: 'invalid',
      reason: 'fetch_failed',
      message: error instanceof Error ? error.message : String(error),
      diagnostics: [],
    };
  }

  const diagnostics: string[] = [];
  for (const entity of scope.entitySet) {
    for (const row of rowsByEntity[entity] ?? []) {
      const validation = validateBackupRow(entity, row);
      if (!validation.ok) {
        diagnostics.push(`${entity}: ${validation.errors.join('; ')}`);
      }
    }
  }
  if (diagnostics.length > 0) {
    return {
      status: 'invalid',
      reason: 'validation_failed',
      message: 'The remote backup contains malformed rows and was not imported.',
      diagnostics: diagnostics.slice(0, 50),
    };
  }

  const scopeColumns = backupEntityColumnsForScope(scope.scope);
  for (const entity of scope.entitySet) {
    const rows = rowsByEntity[entity] ?? [];
    const expected = manifest.entityMetadata[entity];
    const actual = checksumRows(rows, scopeColumns[entity]);
    if (!expected || expected.count !== actual.count || expected.checksum !== actual.checksum) {
      return {
        status: 'invalid',
        reason: 'integrity_mismatch',
        message: `The remote backup failed integrity verification for ${entity}.`,
        diagnostics: [
          `${entity}: expected count=${expected?.count ?? '?'} checksum=${expected?.checksum ?? '?'}; ` +
            `actual count=${actual.count} checksum=${actual.checksum}`,
        ],
      };
    }
  }

  const graphErrors = validateBackupGraph(rowsByEntity);
  if (graphErrors.length > 0) {
    return {
      status: 'invalid',
      reason: 'dependency_failed',
      message: 'The remote backup has broken relationships and was not imported.',
      diagnostics: graphErrors.slice(0, 50),
    };
  }

  // Settings are part of the coherent recovery point. The manifest certifies
  // a settings snapshot (closure contract): the row must exist, carry the
  // supported contract version, survive runtime normalization, and hash to
  // the certified checksum — ALL before any local write. Every Supabase
  // `{ error }` here is a restore failure.
  if (!manifest.settingsMetadata) {
    return {
      status: 'invalid',
      reason: 'incomplete_manifest',
      message: 'The remote backup manifest does not certify settings integrity.',
      diagnostics: ['missing settings_metadata (settings integrity) in backup_manifest'],
    };
  }
  let settingsRow: RemoteUserBackupSettingsRow | null;
  try {
    settingsRow = await fetchRemoteRecoverableSettings(ownerUserId);
  } catch (error) {
    return {
      status: 'invalid',
      reason: 'fetch_failed',
      message: error instanceof Error ? error.message : String(error),
      diagnostics: [],
    };
  }
  if (!settingsRow) {
    return {
      status: 'invalid',
      reason: 'incomplete_manifest',
      message: 'The remote backup declares a settings snapshot but has no settings row.',
      diagnostics: ['missing user_backup_settings row for the declared settings snapshot'],
    };
  }
  if (settingsRow.user_id !== ownerUserId) {
    return {
      status: 'invalid',
      reason: 'validation_failed',
      message: 'The remote backup settings row does not belong to the verified owner.',
      diagnostics: ['user_backup_settings.user_id does not match the restore owner'],
    };
  }
  // Settings version gate (epoch-aware): the row, the manifest, and the
  // manifest's settings metadata must agree on ONE supported contract version.
  // The current version canonicalizes with the live field set; a historical V2
  // payload verifies against the frozen V2 canonical text, a historical V3
  // payload against the frozen V3 text. Anything else fails closed as
  // unsupported_version.
  const settingsVersion = settingsRow.settings_version;
  const isCurrentSettingsVersion = settingsVersion === BACKUP_SETTINGS_VERSION;
  const isHistoricalSettingsV2 = settingsVersion === 2;
  const isHistoricalSettingsV3 = settingsVersion === 3;
  const isHistoricalSettingsV4 = settingsVersion === 4;
  if (
    (!isCurrentSettingsVersion &&
      !isHistoricalSettingsV2 &&
      !isHistoricalSettingsV3 &&
      !isHistoricalSettingsV4) ||
    settingsRow.settings_version !== manifest.settingsVersion ||
    settingsRow.settings_version !== manifest.settingsMetadata.version
  ) {
    return {
      status: 'invalid',
      reason: 'unsupported_version',
      message: `The remote backup carries an unsupported settings version ${settingsRow.settings_version}.`,
      diagnostics: [
        `user_backup_settings.settings_version=${settingsRow.settings_version}; ` +
          `manifest settings_version=${manifest.settingsVersion}; ` +
          `settings_metadata.version=${manifest.settingsMetadata.version}`,
      ],
    };
  }
  if (!isValidRecoverableSettings(settingsRow.payload)) {
    return {
      status: 'invalid',
      reason: 'validation_failed',
      message: 'The remote backup settings payload is malformed and was not imported.',
      diagnostics: ['user_backup_settings payload failed runtime validation'],
    };
  }
  const normalizedSettings = normalizeRecoverableSettings(settingsRow.payload);
  const historicalSettingsVersion = isHistoricalSettingsV2
    ? 2
    : isHistoricalSettingsV3
      ? 3
      : isHistoricalSettingsV4
        ? 4
        : undefined;
  const settingsChecksum = canonicalizeSettingsPayload(normalizedSettings, {
    settingsVersion: historicalSettingsVersion ?? BACKUP_SETTINGS_VERSION,
  });
  if (settingsChecksum !== manifest.settingsMetadata.checksum) {
    return {
      status: 'invalid',
      reason: 'integrity_mismatch',
      message: 'The remote backup settings failed integrity verification.',
      diagnostics: [
        `settings: expected checksum=${manifest.settingsMetadata.checksum}; actual=${settingsChecksum}`,
      ],
    };
  }

  // Re-verify identity immediately before the import transaction.
  const refreshedOwnerUserId = await getSupabaseAuthUserId();
  if (!refreshedOwnerUserId || refreshedOwnerUserId !== ownerUserId) {
    return {
      status: 'invalid',
      reason: 'auth_changed',
      message: 'The authenticated owner changed during restore; restore aborted.',
      diagnostics: [],
    };
  }

  const restoredAt = nowIso();
  let localRowsAppeared = false;
  let ownerChanged = false;
  await withSQLiteTransaction(db, async (transactionDb) => {
    // Re-verify complete emptiness and owner INSIDE the transaction: local
    // rows written between the preview and this point must abort the import.
    const transactionState = await inspectLocalAccountDataState(transactionDb);
    if (!isDeviceEmptyForRestore(transactionState)) {
      localRowsAppeared = true;
      return;
    }
    const transactionOwner = await getLocalDatasetOwner(transactionDb);
    if (transactionOwner && transactionOwner !== ownerUserId) {
      ownerChanged = true;
      return;
    }

    // Dependency order: parents before children (Projects → Goals →
    // Todos/Habits → Daily Plans; workout_session_sets after its session
    // exercises); settings staged and applied after full validation (already
    // done above). Rows were runtime-validated and integrity-verified above;
    // the ordered importer table applies every scope entity exactly once.
    for (const [entity, apply] of RESTORE_IMPORTERS) {
      await apply(transactionDb, rowsByEntity[entity] ?? []);
    }

    // Settings: the payload was fetched and integrity-verified ABOVE, before
    // this transaction began. SQLite-backed settings join the transaction
    // directly; theme (AsyncStorage) is staged durably here and applied after
    // commit with restart reconciliation. NO network call happens inside this
    // transaction.
    await applyRecoverableSettingsToSqlite(transactionDb, normalizedSettings);
    await stagePendingThemeApplication(transactionDb, normalizedSettings, restoredAt);

    await setAppMetaText(
      transactionDb,
      appMetaKeys.lastRestoreSignature,
      String(manifest.generation),
    );
    await setAppMetaText(transactionDb, appMetaKeys.lastRestoreAt, restoredAt);
    // The restored dataset came FROM the remote backup: the local backup
    // scope is already complete for it. Mark the V2 backfill done so a
    // subsequent bootstrap never re-enqueues restored rows as if they were
    // unbacked-up existing data.
    await setAppMetaText(
      transactionDb,
      appMetaKeys.backupScopeVersion,
      String(BACKUP_SCOPE_VERSION),
    );
    await setAppMetaText(transactionDb, appMetaKeys.backupBackfillStatus, 'complete');
    await setAppMetaJson(transactionDb, appMetaKeys.backupBackfillDoneEntities, [
      ...BACKUP_ENTITIES,
    ]);
    if (!transactionOwner) {
      await setLocalDatasetOwner(transactionDb, ownerUserId);
    }
  });

  if (localRowsAppeared) {
    return {
      status: 'blocked',
      reason: 'local_data_present',
      message:
        'Local data appeared while restoring; the import was aborted and local data is unchanged.',
    };
  }
  if (ownerChanged) {
    return {
      status: 'invalid',
      reason: 'auth_changed',
      message: 'The local dataset owner changed during restore; the import was aborted.',
      diagnostics: [],
    };
  }

  // Post-restore reconciliation: apply the staged theme settings to
  // AsyncStorage (durable marker; retried on bootstrap until it succeeds),
  // then ONLY current/future reminder scheduling.
  await applyPendingThemeApplication();
  requestHabitReminderReconciliation();
  requestWorkoutReminderReconciliation();

  const importedCounts = Object.fromEntries(
    BACKUP_ENTITIES.map((entity) => [entity, (rowsByEntity[entity] ?? []).length]),
  ) as Record<BackupEntity, number>;

  return { status: 'restored', restoredAt, generation: manifest.generation, importedCounts };
}

/**
 * UI-facing backup completeness state. Reads the owner's manifest (if any)
 * and local backfill/queue signals. Precedence: valid complete manifest →
 * `v2_complete` (with pending change count); manifest present but broken →
 * `invalid`; no manifest with V1 data or backfill in progress →
 * `in_progress`/`v1_legacy`; no remote → `unavailable`.
 */
export async function getBackupStateSummary(
  ownerUserId: string | null,
): Promise<BackupStateSummary> {
  const db = await getDatabase();
  const [outboxCount, backfill, dirty] = await Promise.all([
    db.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM sync_outbox'),
    getBackfillStatusForSummary(db),
    db.getFirstAsync<{ value: string }>('SELECT value FROM app_meta WHERE key = ?', [
      appMetaKeys.backupDirty.key,
    ]),
  ]);

  const pendingChangeCount = (outboxCount?.count ?? 0) + (dirty?.value === '1' ? 1 : 0);

  if (!ownerUserId || !supabase || !isRemoteEnabled()) {
    return {
      state: 'unavailable',
      lastCompleteAt: null,
      lastCompleteGeneration: null,
      pendingChangeCount,
      backfillInProgress: backfill === 'running',
      missingEntities: [...BACKUP_ENTITIES],
    };
  }

  let manifestRow: RemoteBackupManifestRow | null = null;
  let manifestError = false;
  try {
    manifestRow = await fetchManifestRow(ownerUserId);
  } catch {
    manifestError = true;
  }

  if (manifestError) {
    // Missing V2 tables on the server are a legacy-only backup situation,
    // not a corrupt manifest.
    return {
      state: 'v1_legacy',
      lastCompleteAt: null,
      lastCompleteGeneration: null,
      pendingChangeCount,
      backfillInProgress: backfill === 'running',
      missingEntities: [...BACKUP_ENTITIES],
    };
  }

  if (!manifestRow) {
    if (backfill === 'running' || pendingChangeCount > 0) {
      return {
        state: 'in_progress',
        lastCompleteAt: null,
        lastCompleteGeneration: null,
        pendingChangeCount,
        backfillInProgress: backfill === 'running',
        missingEntities: [...BACKUP_ENTITIES],
      };
    }
    return {
      state: 'v1_legacy',
      lastCompleteAt: null,
      lastCompleteGeneration: null,
      pendingChangeCount,
      backfillInProgress: false,
      missingEntities: [...BACKUP_ENTITIES],
    };
  }

  const manifest = parseManifestRow(manifestRow);
  if (
    !manifest ||
    manifest.backupSchemaVersion !== BACKUP_SCHEMA_VERSION ||
    // The v2 contract certifies settings integrity (closure): a manifest
    // without settings metadata cannot be called a known-good recovery point.
    !manifest.settingsMetadata
  ) {
    return {
      state: 'invalid',
      lastCompleteAt: null,
      lastCompleteGeneration: null,
      pendingChangeCount,
      backfillInProgress: false,
      missingEntities: [],
    };
  }
  // Recognize both the current hardened scope and known historical scope
  // epochs (e.g. a pre-planning scope-3 backup). A manifest whose entity set
  // exactly matches a known scope is a complete V2 backup for that scope; it is
  // not invalid merely because the current recoverable scope has since grown.
  const resolvedScope = resolveBackupScope({
    backupScopeVersion: manifest.backupScopeVersion,
    entityMetadata: manifest.entityMetadata,
  });
  if (!resolvedScope) {
    return {
      state: 'invalid',
      lastCompleteAt: null,
      lastCompleteGeneration: null,
      pendingChangeCount,
      backfillInProgress: false,
      missingEntities: [...BACKUP_ENTITIES],
    };
  }
  const missingInScope = resolvedScope.entitySet.filter(
    (entity) => !manifest.entityMetadata[entity],
  );
  if (missingInScope.length > 0) {
    return {
      state: 'invalid',
      lastCompleteAt: null,
      lastCompleteGeneration: null,
      pendingChangeCount,
      backfillInProgress: false,
      missingEntities: [...BACKUP_ENTITIES],
    };
  }

  // `missingEntities` reports only what the certified scope omits relative to
  // the *current* recoverable set, so the UI can disclose the gap without
  // flipping a complete historical backup to "invalid".
  const missingEntities = BACKUP_ENTITIES.filter((entity) => !manifest.entityMetadata[entity]);

  return {
    state: 'v2_complete',
    lastCompleteAt: manifest.completedAt,
    lastCompleteGeneration: manifest.generation,
    pendingChangeCount,
    backfillInProgress: backfill === 'running',
    missingEntities,
  };
}

async function getBackfillStatusForSummary(
  db: Awaited<ReturnType<typeof getDatabase>>,
): Promise<'idle' | 'running' | 'complete'> {
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM app_meta WHERE key = ?',
    [appMetaKeys.backupBackfillStatus.key],
  );
  const value = row?.value ?? null;
  if (value === 'complete') return 'complete';
  if (value === 'running') return 'running';
  const scope = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM app_meta WHERE key = ?',
    [appMetaKeys.backupScopeVersion.key],
  );
  // The marker stores the recoverable SCOPE version (the writer gates on
  // BACKUP_SCOPE_VERSION), so compare against that — comparing against the
  // schema version would report "complete" from a stale low scope value after
  // any scope bump.
  if (scope && scope.value !== null && parseInt(scope.value, 10) >= BACKUP_SCOPE_VERSION) {
    return 'complete';
  }
  return 'idle';
}
