import { appMetaKeys, setAppMetaJson, setAppMetaText } from '@/core/db/appMeta';
import { getDatabase } from '@/core/db/client';
import {
  getLocalDatasetOwner,
  setLocalDatasetOwner,
  inspectLocalAccountDataState,
} from '@/core/auth/account.data';
import { withSQLiteTransaction } from '@/core/db/transactions';
import { requestHabitReminderReconciliation } from '@/core/notifications/habitReminderSignals';
import { getSupabaseAuthUserId, isRemoteEnabled, supabase } from '@/lib/supabase';
import { nowIso } from '@/lib/time';
import { checksumRows } from '@/lib/checksum';
import {
  BACKUP_ENTITY_COLUMNS,
  BACKUP_ENTITIES,
  BACKUP_SCHEMA_VERSION,
  BACKUP_SCOPE_VERSION,
  type BackupEntity,
  type BackupManifest,
  type RemoteBackupManifestRow,
} from '@/core/backup/backup.types';
import { validateBackupGraph, validateBackupRow } from '@/core/backup/backupValidators';
import { applyRecoverableSettings } from '@/core/backup/backupSettings';
import type {
  CalorieEntry,
  Habit,
  HabitCompletion,
  PomodoroSession,
  RoutineExercise,
  RoutineExerciseSet,
  SavedMeal,
  Todo,
  WorkoutLog,
  WorkoutRoutine,
  WorkoutSessionExercise,
} from '@/core/db/types';
import type { LinkedActionRuleRow } from '@/core/linked-actions/linkedActions.types';
import { applyRemoteTodos } from '@/features/todos/todos.data';
import { applyRemoteHabits, applyRemoteHabitCompletions } from '@/features/habits/habits.data';
import {
  applyRemoteCalorieEntries,
  applyRemoteSavedMeals,
} from '@/features/calories/calories.data';
import { applyRemotePomodoroSessions } from '@/features/pomodoro/pomodoro.data';
import {
  applyRemoteRoutineExercises,
  applyRemoteRoutineExerciseSets,
  applyRemoteWorkoutLogs,
  applyRemoteWorkoutRoutines,
  applyRemoteWorkoutSessionExercises,
} from '@/features/workout/workout.data';
import { applyRemoteLinkedActionRules } from '@/core/linked-actions/linkedActions.data';

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

function parseManifestRow(row: unknown): BackupManifest | null {
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
    metadata[entity as BackupEntity] = { count: meta.count, checksum: meta.checksum };
  }
  return {
    backupSchemaVersion: candidate.backup_schema_version,
    generation: candidate.generation,
    completedAt: candidate.completed_at,
    entityMetadata: metadata,
    settingsVersion: candidate.settings_version,
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
  const missingEntities = BACKUP_ENTITIES.filter((entity) => !manifest.entityMetadata[entity]);
  if (missingEntities.length > 0) {
    return {
      status: 'invalid',
      reason: 'incomplete_manifest',
      message: 'The remote backup manifest does not cover the complete backup scope.',
      diagnostics: missingEntities.map((entity) => `missing entity: ${entity}`),
    };
  }

  // Prefetch ALL rows before any local write; validate and verify everything.
  const rowsByEntity: Partial<Record<BackupEntity, Record<string, unknown>[]>> = {};
  try {
    for (const entity of BACKUP_ENTITIES) {
      rowsByEntity[entity] = await fetchRemoteRows(entity, ownerUserId);
    }
  } catch (error) {
    return {
      status: 'invalid',
      reason: 'fetch_failed',
      message: error instanceof Error ? error.message : String(error),
      diagnostics: [],
    };
  }

  const diagnostics: string[] = [];
  for (const entity of BACKUP_ENTITIES) {
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

  for (const entity of BACKUP_ENTITIES) {
    const rows = rowsByEntity[entity] ?? [];
    const expected = manifest.entityMetadata[entity];
    const actual = checksumRows(rows, BACKUP_ENTITY_COLUMNS[entity]);
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

    // Dependency order: parents before children; settings staged and applied
    // after full validation (already done above). Rows were runtime-validated
    // and integrity-verified above; the casts apply the validated shapes.
    const typed = <T>(entity: BackupEntity): T => (rowsByEntity[entity] ?? []) as unknown as T;
    await applyRemoteTodos(transactionDb, typed<Todo[]>('todos'));
    await applyRemoteHabits(transactionDb, typed<Habit[]>('habits'));
    await applyRemoteHabitCompletions(transactionDb, typed<HabitCompletion[]>('habit_completions'));
    await applyRemoteCalorieEntries(transactionDb, typed<CalorieEntry[]>('calorie_entries'));
    await applyRemoteSavedMeals(transactionDb, typed<SavedMeal[]>('saved_meals'));
    await applyRemoteWorkoutRoutines(transactionDb, typed<WorkoutRoutine[]>('workout_routines'));
    await applyRemoteRoutineExercises(transactionDb, typed<RoutineExercise[]>('routine_exercises'));
    await applyRemoteRoutineExerciseSets(
      transactionDb,
      typed<RoutineExerciseSet[]>('routine_exercise_sets'),
    );
    await applyRemoteWorkoutLogs(transactionDb, typed<WorkoutLog[]>('workout_logs'));
    await applyRemoteWorkoutSessionExercises(
      transactionDb,
      typed<WorkoutSessionExercise[]>('workout_session_exercises'),
    );
    await applyRemotePomodoroSessions(transactionDb, typed<PomodoroSession[]>('pomodoro_sessions'));
    await applyRemoteLinkedActionRules(
      transactionDb,
      typed<LinkedActionRuleRow[]>('linked_action_rules'),
    );

    // The settings payload was validated structurally during parsing; apply
    // through the allowlist normalizer so no excluded key can leak through.
    const settingsRow = manifest.settingsVersion >= 0 ? manifestRow : null;
    if (settingsRow) {
      const settingsResult = await supabase
        ?.from('user_backup_settings')
        .select('payload')
        .eq('user_id', ownerUserId)
        .limit(1);
      const firstRow = settingsResult?.data?.[0] as { payload?: unknown } | undefined;
      const payload = firstRow?.payload ?? null;
      if (payload !== undefined && payload !== null) {
        await applyRecoverableSettings(transactionDb, payload);
      }
    }

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

  // Post-restore reconciliation: ONLY current/future reminder scheduling.
  requestHabitReminderReconciliation();

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
  const outboxCount = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) AS count FROM sync_outbox',
  );
  const backfill = await getBackfillStatusForSummary(db);
  const dirty = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM app_meta WHERE key = ?',
    [appMetaKeys.backupDirty.key],
  );

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
  if (!manifest || manifest.backupSchemaVersion !== BACKUP_SCHEMA_VERSION) {
    return {
      state: 'invalid',
      lastCompleteAt: null,
      lastCompleteGeneration: manifestRow ? null : null,
      pendingChangeCount,
      backfillInProgress: false,
      missingEntities: [],
    };
  }
  const missingEntities = BACKUP_ENTITIES.filter((entity) => !manifest.entityMetadata[entity]);

  return {
    state: missingEntities.length === 0 ? 'v2_complete' : 'invalid',
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
  if (scope && scope.value !== null && parseInt(scope.value, 10) >= BACKUP_SCHEMA_VERSION) {
    return 'complete';
  }
  return 'idle';
}
