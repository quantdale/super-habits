import type * as SQLite from 'expo-sqlite';

export type AppMetaOwner =
  'system' | 'auth' | 'calories' | 'pomodoro' | 'sync' | 'workout' | 'notifications';

type AppMetaStorage = 'text' | 'json';

type AppMetaKeyDefinition<TStorage extends AppMetaStorage> = {
  key: string;
  owner: AppMetaOwner;
  storage: TStorage;
};

type AppMetaTextKey = AppMetaKeyDefinition<'text'>;
type AppMetaJsonKey = AppMetaKeyDefinition<'json'>;

function defineTextKey(key: string, owner: AppMetaOwner): AppMetaTextKey {
  return { key, owner, storage: 'text' };
}

function defineJsonKey(key: string, owner: AppMetaOwner): AppMetaJsonKey {
  return { key, owner, storage: 'json' };
}

// Central registry for all known app_meta keys in active runtime use.
export const appMetaKeys = {
  dbSchemaVersion: defineTextKey('db_schema_version', 'system'),
  dateKeyFormat: defineTextKey('date_key_format', 'system'),
  dateKeyCutover: defineTextKey('date_key_cutover', 'system'),
  guestProfile: defineJsonKey('guest_profile', 'auth'),
  accountOwnerUserId: defineTextKey('account.owner_user_id', 'auth'),
  accountOwnerBindingState: defineTextKey('account.owner_binding_state', 'auth'),
  accountProtectionPending: defineJsonKey('account.protection_pending', 'auth'),
  accountProtectionLastFailure: defineJsonKey('account.protection_last_failure', 'auth'),
  accountRecoveryPending: defineJsonKey('account.recovery_pending', 'auth'),
  restorePromptDismissedSignature: defineTextKey('restore_prompt_dismissed_signature', 'sync'),
  lastRestoreSignature: defineTextKey('last_restore_signature', 'sync'),
  lastRestoreAt: defineTextKey('last_restore_at', 'sync'),
  syncOutbox: defineJsonKey('sync_outbox', 'sync'),
  /** Durable per-record attempt ledger for the terminal outbox classification
   *  (harden-silent-failure-certification wave 2). Local operational state —
   *  never backed up, never synced: it records WHY a record cannot push, so a
   *  permanently blocked backup is distinguishable from one still uploading. */
  syncOutboxAttempts: defineJsonKey('sync.outbox_attempts', 'sync'),
  syncStatus: defineJsonKey('sync_status', 'sync'),
  calorieGoal: defineJsonKey('calorie_goal', 'calories'),
  /** Daily macro targets (hardening wave v2; recoverable-settings V3 source). */
  calorieTargets: defineJsonKey('calorie_targets', 'calories'),
  pomodoroSettings: defineJsonKey('pomodoro_settings', 'pomodoro'),
  /** Pomodoro presets + active preset id (recoverable-settings V3 source). */
  pomodoroPresets: defineJsonKey('pomodoro_presets', 'pomodoro'),
  /** Durable in-progress timer intent for crash/reload reconciliation
   *  (hardening wave v2). Local operational state — never backed up. */
  pomodoroActiveTimer: defineJsonKey('pomodoro.active_timer', 'pomodoro'),
  /** Durable retry queue for completed-focus logs whose insert failed
   *  (hardening wave v2). Local operational state — never backed up. */
  pomodoroPendingLogs: defineJsonKey('pomodoro.pending_logs', 'pomodoro'),
  /** Default workout rest seconds (recoverable-settings V3 source). */
  workoutRestSeconds: defineJsonKey('workout_rest_seconds', 'workout'),
  /** Gym V2 effort scale, body-weight goal, and workout-day reminder settings. */
  workoutPreferences: defineJsonKey('workout_preferences', 'workout'),
  /** Durable in-progress workout session draft for resume after restart.
   *  Local operational state — never backed up. */
  workoutActiveSessionDraft: defineJsonKey('workout.active_session_draft', 'workout'),
  /**
   * Durable pending-save recovery state (`AUD-SH04-A/B`).
   *
   * Reaching the workout summary used to CLEAR the active draft, so a failed or
   * interrupted save lost every entered value: the user had completed the
   * workout but the only copy of their numbers was React state. This key holds
   * the finished session's recovery payload — identity, every entered set,
   * dispositions, active elapsed time — until a committed log id exists or the
   * user explicitly discards.
   */
  workoutPendingSave: defineJsonKey('workout.pending_save', 'workout'),
  /** Todo/daily-plan/weekly-review reminder preferences (recoverable-settings source). */
  notificationPreferences: defineJsonKey('notification_preferences', 'notifications'),
  backupScopeVersion: defineTextKey('backup.scope_version', 'sync'),
  backupBackfillStatus: defineTextKey('backup.backfill_status', 'sync'),
  backupBackfillDoneEntities: defineJsonKey('backup.backfill_done_entities', 'sync'),
  backupDirty: defineTextKey('backup.dirty', 'sync'),
  backupPendingManifest: defineJsonKey('backup.pending_manifest', 'sync'),
  /**
   * Durable generation capture state (`AUD-SH02-A`/`B`).
   *
   * Immutable published recovery content lives in a separate namespace from the
   * mutable staging rows. This key holds the in-flight capture: its snapshot
   * identity, the captured manifest, the staged chunk ordinals and the upload
   * position, so a killed process resumes the SAME generation instead of minting
   * a second one or losing the coherent snapshot it already took.
   */
  backupGenerationCapture: defineJsonKey('backup.generation_capture', 'sync'),
  backupLegacyGenerationCapture: defineJsonKey('backup.legacy_generation_capture', 'sync'),
  /**
   * Highest generation sequence this device has published. Monotonic so a stale
   * retry can never regress a newer head.
   */
  backupGenerationSequence: defineTextKey('backup.generation_sequence', 'sync'),
  /**
   * The remote owner head this device last observed. A local capture records this
   * value, so a later upload can tell whether the remote has advanced since the
   * snapshot was taken (`AUD-SH02-A` stale-cutover reconciliation).
   */
  backupObservedGenerationHead: defineJsonKey('backup.observed_generation_head', 'sync'),
  /**
   * The remote head this device can prove its LOCAL data is based on.
   *
   * A remote head merely observed during a push is not provenance: another
   * device may have published it while this device was offline. This key is
   * written only after a successful publication, a verified restore, or an
   * explicit keep-local decision. Captures use it as their base, never the
   * observed value above (`AUD-F1`).
   */
  backupVerifiedGenerationBaseHead: defineJsonKey('backup.verified_generation_base_head', 'sync'),
  /** Owner-scoped content proof written only by a verified legacy V2 restore. */
  backupVerifiedLegacyRestore: defineJsonKey('backup.verified_legacy_restore', 'sync'),
  /**
   * A durable, explicit reconciliation state for a capture that conflicts with a
   * newer remote head. The capture is never discarded or republished until the
   * owner reviews it.
   */
  backupGenerationConflict: defineJsonKey('backup.generation_conflict', 'sync'),
  /** Durable in-progress marker for an explicit keep-local resolution. */
  backupGenerationResolutionInProgress: defineJsonKey(
    'backup.generation_resolution_in_progress',
    'sync',
  ),
  backupPendingSettings: defineJsonKey('backup.pending_settings', 'sync'),
  backupPendingThemeApply: defineJsonKey('backup.pending_theme_apply', 'sync'),
  backupLastCompleteGeneration: defineTextKey('backup.last_complete_generation', 'sync'),
  portableLastImportAt: defineTextKey('portable.last_import_at', 'sync'),
  portableLastImportFormatVersion: defineTextKey('portable.last_import_format_version', 'sync'),
  /** Stored as the fingerprint hex, or the literal string `null` when the
   *  imported file had no source owner. Read via `readPortableImportOriginFingerprint`. */
  portableLastImportOwnerFingerprint: defineTextKey(
    'portable.last_import_owner_fingerprint',
    'sync',
  ),
} as const;

export async function getAppMetaText(
  db: SQLite.SQLiteDatabase,
  metaKey: AppMetaTextKey | AppMetaJsonKey,
): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM app_meta WHERE key = ?',
    [metaKey.key],
  );
  return row?.value ?? null;
}

export async function setAppMetaText(
  db: SQLite.SQLiteDatabase,
  metaKey: AppMetaTextKey | AppMetaJsonKey,
  value: string,
): Promise<void> {
  await db.runAsync('INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)', [
    metaKey.key,
    value,
  ]);
}

export async function getAppMetaJson<T>(
  db: SQLite.SQLiteDatabase,
  metaKey: AppMetaJsonKey,
): Promise<T | null> {
  const value = await getAppMetaText(db, metaKey);
  if (value === null) return null;
  return JSON.parse(value) as T;
}

export async function getAppMetaJsonOrDefault<T>(
  db: SQLite.SQLiteDatabase,
  metaKey: AppMetaJsonKey,
  fallback: T,
  normalize?: (value: unknown) => T | null,
): Promise<T> {
  try {
    const value = await getAppMetaJson<unknown>(db, metaKey);
    if (value === null) return fallback;
    if (!normalize) return value as T;
    return normalize(value) ?? fallback;
  } catch {
    return fallback;
  }
}

export async function setAppMetaJson<T>(
  db: SQLite.SQLiteDatabase,
  metaKey: AppMetaJsonKey,
  value: T,
): Promise<void> {
  await setAppMetaText(db, metaKey, JSON.stringify(value));
}

export async function deleteAppMetaKey(
  db: SQLite.SQLiteDatabase,
  metaKey: AppMetaTextKey | AppMetaJsonKey,
): Promise<void> {
  await db.runAsync('DELETE FROM app_meta WHERE key = ?', [metaKey.key]);
}
