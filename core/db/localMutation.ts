import type * as SQLite from 'expo-sqlite';
import { withSQLiteTransaction } from '@/core/db/transactions';
import { claimOwnerBindingOnFirstContent } from '@/core/auth/account.data';

/**
 * Commit an authoritative local mutation WITHOUT enqueuing a remote backup
 * intent. Used by the Productivity Expansion Wave V1 planning entities
 * (projects, goals, daily_plans) which are intentionally local-only during this
 * wave: no Supabase table exists for them yet, so registering an outbox record
 * would be a dangling backup intent.
 *
 * The first meaningful local write still claims the provisional owner binding
 * so account replacement safety treats the device as populated immediately.
 */
export async function runLocalMutation<T>(
  db: SQLite.SQLiteDatabase,
  mutate: (transactionDb: SQLite.SQLiteDatabase) => Promise<T>,
): Promise<T> {
  return withSQLiteTransaction(db, async (transactionDb) => {
    const result = await mutate(transactionDb);
    await claimOwnerBindingOnFirstContent(transactionDb);
    return result;
  });
}
