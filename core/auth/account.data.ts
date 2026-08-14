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
  return cachedLocalDatasetOwner;
}

export function getCachedLocalDatasetOwner(): string | null | undefined {
  return cachedLocalDatasetOwner;
}

export function primeLocalDatasetOwner(owner: string | null): void {
  cachedLocalDatasetOwner = owner;
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
  await db.withTransactionAsync(async () => {
    await setLocalDatasetOwner(db, userId);
    if (options.adoptUnownedOutbox) {
      await adoptUnownedOutboxRows(db, userId);
    }
  });
  primeLocalDatasetOwner(userId);
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

  return {
    counts,
    activeUserDataCount,
    deletedUserDataCount,
    hasUserData: activeUserDataCount + deletedUserDataCount > 0,
    pendingOutboxCount: Number(pending?.count ?? 0),
    unownedOutboxCount: Number(unowned?.count ?? 0),
    outboxOwnerIds: ownerRows.map((row) => row.owner_user_id),
    ownerBinding: await getLocalDatasetOwner(db),
  };
}

export function isEmptyForAccountReplacement(local: LocalAccountDataState): boolean {
  return (
    !local.hasUserData &&
    local.pendingOutboxCount === 0 &&
    local.ownerBinding === null &&
    local.outboxOwnerIds.length === 0
  );
}
