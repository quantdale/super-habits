import type * as SQLite from 'expo-sqlite';
import { appMetaKeys, getAppMetaText, setAppMetaText } from '@/core/db/appMeta';
import { getDatabase } from '@/core/db/client';
import {
  ACCOUNT_USER_TABLES,
  type AccountUserTable,
  type LocalAccountDataState,
  type LocalTableCount,
} from '@/core/auth/account.types';

const TABLES_WITH_DELETED_AT = new Set<AccountUserTable>([
  'todos',
  'habits',
  'workout_routines',
  'routine_exercises',
  'routine_exercise_sets',
  'calorie_entries',
  'linked_action_rules',
]);

// The coordinator primes this cache after SQLite bootstrap. Keeping mutation
// code on the cache avoids adding an app_meta read to every feature write and
// keeps local feature transactions independent of auth/network availability.
let cachedLocalDatasetOwner: string | null | undefined;
// undefined = not primed; a missing binding-state key means permanent.
let cachedOwnerBindingProvisional: boolean | undefined;

async function countTable(
  db: SQLite.SQLiteDatabase,
  table: AccountUserTable,
): Promise<LocalTableCount> {
  if (TABLES_WITH_DELETED_AT.has(table)) {
    const row = await db.getFirstAsync<{ total: number; active: number; deleted: number }>(
      `SELECT COUNT(*) AS total,
              COALESCE(SUM(CASE WHEN deleted_at IS NULL THEN 1 ELSE 0 END), 0) AS active,
              COALESCE(SUM(CASE WHEN deleted_at IS NOT NULL THEN 1 ELSE 0 END), 0) AS deleted
       FROM ${table}`,
    );
    return {
      total: Number(row?.total ?? 0),
      active: Number(row?.active ?? 0),
      deleted: Number(row?.deleted ?? 0),
    };
  }

  const row = await db.getFirstAsync<{ total: number }>(`SELECT COUNT(*) AS total FROM ${table}`);
  const total = Number(row?.total ?? 0);
  return { total, active: total, deleted: 0 };
}

export async function getLocalDatasetOwner(db: SQLite.SQLiteDatabase): Promise<string | null> {
  const value = await getAppMetaText(db, appMetaKeys.accountOwnerUserId);
  cachedLocalDatasetOwner = typeof value === 'string' ? value : null;
  await primeOwnerBindingProvisionalCache(db);
  return cachedLocalDatasetOwner;
}

export function getCachedLocalDatasetOwner(): string | null | undefined {
  return cachedLocalDatasetOwner;
}

/** Reads the durable binding state; a missing key means permanent. */
export async function getLocalDatasetOwnerProvisional(db: SQLite.SQLiteDatabase): Promise<boolean> {
  const value = await getAppMetaText(db, appMetaKeys.accountOwnerBindingState);
  return value === 'provisional';
}

export function getCachedOwnerBindingProvisional(): boolean | undefined {
  return cachedOwnerBindingProvisional;
}

export function primeLocalDatasetOwner(owner: string | null, provisional = false): void {
  cachedLocalDatasetOwner = owner;
  cachedOwnerBindingProvisional = provisional;
}

async function primeOwnerBindingProvisionalCache(db: SQLite.SQLiteDatabase): Promise<void> {
  cachedOwnerBindingProvisional = await getLocalDatasetOwnerProvisional(db);
}

export async function setLocalDatasetOwner(
  db: SQLite.SQLiteDatabase,
  userId: string,
): Promise<void> {
  const current = await getLocalDatasetOwner(db);
  if (current && current !== userId) {
    throw new Error('LOCAL_DATASET_OWNER_CONFLICT');
  }
  await setAppMetaText(db, appMetaKeys.accountOwnerUserId, userId);
  await setAppMetaText(db, appMetaKeys.accountOwnerBindingState, 'permanent');
  primeLocalDatasetOwner(userId, false);
}

/**
 * Removes the local dataset-owner binding entirely (both the owner key and
 * the binding-state key) and resets the cache. Used by portable import on a
 * pristine device whose only binding is a replaceable PROVISIONAL anonymous
 * session: the device is unclaimed, and the imported dataset must not be
 * attached to a throwaway temporary account. Never called on a permanent
 * binding or a populated dataset.
 */
export async function clearLocalDatasetOwner(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.runAsync('DELETE FROM app_meta WHERE key = ? OR key = ?', [
    appMetaKeys.accountOwnerUserId.key,
    appMetaKeys.accountOwnerBindingState.key,
  ]);
  primeLocalDatasetOwner(null, false);
}

/**
 * Initializes owner IDs that were NULL before outbox ownership was added.
 * This is allowed only after the coordinator has established compatible legacy
 * ownership evidence; it never changes a non-NULL owner.
 */
export async function adoptUnownedOutboxRows(
  db: SQLite.SQLiteDatabase,
  userId: string,
): Promise<void> {
  const conflicting = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) AS count
     FROM sync_outbox
     WHERE owner_user_id IS NOT NULL AND owner_user_id <> ?`,
    [userId],
  );
  if (Number(conflicting?.count ?? 0) > 0) {
    throw new Error('SYNC_OUTBOX_OWNER_CONFLICT');
  }
  await db.runAsync('UPDATE sync_outbox SET owner_user_id = ? WHERE owner_user_id IS NULL', [
    userId,
  ]);
}

export async function bindLocalDatasetOwner(
  db: SQLite.SQLiteDatabase,
  userId: string,
  options: { adoptUnownedOutbox?: boolean } = {},
): Promise<void> {
  try {
    await db.withTransactionAsync(async () => {
      await setLocalDatasetOwner(db, userId);
      if (options.adoptUnownedOutbox) {
        await adoptUnownedOutboxRows(db, userId);
      }
    });
  } catch (error) {
    // Web SQLite WASM: withTransactionAsync may throw "cannot rollback - no
    // transaction is active" AFTER a successful commit. The error is cosmetic
    // — the writes are durable. Distinguish it from genuine failures.
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes('no transaction is active')) {
      throw error;
    }
  }
  primeLocalDatasetOwner(userId, false);
}

/**
 * Binds a pristine empty dataset to a temporary anonymous session. The binding
 * stays replaceable (provisional) until the first meaningful local content
 * promotes it, so Recover Existing on a fresh device keeps working.
 */
export async function bindProvisionalLocalDatasetOwner(
  db: SQLite.SQLiteDatabase,
  userId: string,
): Promise<void> {
  const current = await getLocalDatasetOwner(db);
  if (current && current !== userId) {
    throw new Error('LOCAL_DATASET_OWNER_CONFLICT');
  }
  await setAppMetaText(db, appMetaKeys.accountOwnerUserId, userId);
  await setAppMetaText(db, appMetaKeys.accountOwnerBindingState, 'provisional');
  primeLocalDatasetOwner(userId, true);
}

/**
 * Promotes a provisional binding to permanent. Safe to call on every
 * meaningful first write: no-op unless the binding is currently provisional.
 */
export async function promoteLocalDatasetOwnerIfProvisional(
  db: SQLite.SQLiteDatabase,
): Promise<void> {
  if (cachedOwnerBindingProvisional !== true) {
    return;
  }
  const owner = await getLocalDatasetOwner(db);
  if (!owner) {
    return;
  }
  if ((await getLocalDatasetOwnerProvisional(db)) === true) {
    await setAppMetaText(db, appMetaKeys.accountOwnerBindingState, 'permanent');
  }
  primeLocalDatasetOwner(owner, false);
}

/**
 * Fast-path hook for local-only first writes (pomodoro sessions, workout
 * history, habit completions, saved meals, linked-action rules). It performs
 * one durable state update only when the cached binding is provisional.
 */
export async function claimOwnerBindingOnFirstContent(db: SQLite.SQLiteDatabase): Promise<void> {
  if (cachedOwnerBindingProvisional === true) {
    await promoteLocalDatasetOwnerIfProvisional(db);
  }
}

/**
 * Replaces a PROVISIONAL owner binding with another account. Never applies to
 * permanent bindings or populated datasets — callers must have already
 * verified the device is pristine. By default the replacement is permanent
 * (verified recovered account); pass `keepProvisional` when a fresh temporary
 * anonymous session takes over a pristine device.
 */
export async function replaceProvisionalLocalDatasetOwner(
  db: SQLite.SQLiteDatabase,
  userId: string,
  options: { keepProvisional?: boolean } = {},
): Promise<void> {
  const current = await getLocalDatasetOwner(db);
  if (current && current !== userId) {
    const provisional = await getLocalDatasetOwnerProvisional(db);
    if (!provisional) {
      throw new Error('LOCAL_DATASET_OWNER_CONFLICT');
    }
  }
  await setAppMetaText(db, appMetaKeys.accountOwnerUserId, userId);
  await setAppMetaText(
    db,
    appMetaKeys.accountOwnerBindingState,
    options.keepProvisional ? 'provisional' : 'permanent',
  );
  primeLocalDatasetOwner(userId, options.keepProvisional === true);
}

export async function inspectLocalAccountDataState(
  providedDb?: SQLite.SQLiteDatabase,
): Promise<LocalAccountDataState> {
  const db = providedDb ?? (await getDatabase());
  const counts = Object.fromEntries(
    await Promise.all(
      ACCOUNT_USER_TABLES.map(async (table) => [table, await countTable(db, table)] as const),
    ),
  ) as Record<AccountUserTable, LocalTableCount>;

  const activeUserDataCount = ACCOUNT_USER_TABLES.reduce(
    (sum, table) => sum + counts[table].active,
    0,
  );
  const deletedUserDataCount = ACCOUNT_USER_TABLES.reduce(
    (sum, table) => sum + counts[table].deleted,
    0,
  );
  const pending = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) AS count FROM sync_outbox',
  );
  const unowned = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) AS count
     FROM sync_outbox
     WHERE owner_user_id IS NULL OR owner_user_id = ''`,
  );
  const ownerRows = await db.getAllAsync<{ owner_user_id: string }>(
    `SELECT DISTINCT owner_user_id
     FROM sync_outbox
     WHERE owner_user_id IS NOT NULL AND owner_user_id <> ''
     ORDER BY owner_user_id`,
  );

  const ownerBinding = await getLocalDatasetOwner(db);
  return {
    counts,
    activeUserDataCount,
    deletedUserDataCount,
    hasUserData: activeUserDataCount + deletedUserDataCount > 0,
    pendingOutboxCount: Number(pending?.count ?? 0),
    unownedOutboxCount: Number(unowned?.count ?? 0),
    outboxOwnerIds: ownerRows.map((row) => row.owner_user_id),
    ownerBinding,
    ownerBindingProvisional: await getLocalDatasetOwnerProvisional(db),
  };
}

export function isEmptyForAccountReplacement(local: LocalAccountDataState): boolean {
  return (
    !local.hasUserData &&
    local.pendingOutboxCount === 0 &&
    local.unownedOutboxCount === 0 &&
    local.outboxOwnerIds.length === 0 &&
    (local.ownerBinding === null || local.ownerBindingProvisional)
  );
}
