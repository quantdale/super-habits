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
  /** Durable in-progress workout session draft for resume after restart.
   *  Local operational state — never backed up. */
  workoutActiveSessionDraft: defineJsonKey('workout.active_session_draft', 'workout'),
  /** Todo/daily-plan reminder preferences (recoverable-settings V3 source). */
  notificationPreferences: defineJsonKey('notification_preferences', 'notifications'),
  backupScopeVersion: defineTextKey('backup.scope_version', 'sync'),
  backupBackfillStatus: defineTextKey('backup.backfill_status', 'sync'),
  backupBackfillDoneEntities: defineJsonKey('backup.backfill_done_entities', 'sync'),
  backupDirty: defineTextKey('backup.dirty', 'sync'),
  backupPendingManifest: defineJsonKey('backup.pending_manifest', 'sync'),
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
