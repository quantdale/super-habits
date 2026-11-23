import type { SQLiteDatabase } from 'expo-sqlite';
import { appMetaKeys, setAppMetaText } from '@/core/db/appMeta';
import {
  BACKUP_REWARD_COLUMNS,
  BACKUP_REWARD_ENTITIES,
  type BackupRewardEntity,
  type BackupRewardRows,
} from './backup.types';

// Three SQLite tables use a natural or composite primary key. The snapshot
// represents it as an id for the existing canonical ordering/integrity code.
const REWARD_ID_SQL: Record<BackupRewardEntity, string> = {
  gamification_events: 'id',
  gamification_streak_freezes: 'date_key',
  gamification_quests: "date_key || ':' || quest_id",
  gamification_badges: 'badge_id',
};

export async function readRewardBackupRows(db: SQLiteDatabase, entity: BackupRewardEntity) {
  const [, ...columns] = BACKUP_REWARD_COLUMNS[entity];
  return db.getAllAsync<Record<string, unknown>>(
    `SELECT ${REWARD_ID_SQL[entity]} AS id, ${columns.join(', ')} FROM ${entity} ORDER BY id ASC`,
  );
}

/** Caller validates the snapshot and owns the restore transaction. */
export async function applyRewardBackupRows(
  db: SQLiteDatabase,
  rows: BackupRewardRows,
  restoredAt: string,
): Promise<void> {
  // The empty-device guard covers rewards too. Legacy backups have no reward
  // rows, so a successful legacy restore leaves the ledger empty.
  for (const entity of BACKUP_REWARD_ENTITIES) {
    const columns = BACKUP_REWARD_COLUMNS[entity].filter(
      (column) => entity === 'gamification_events' || column !== 'id',
    );
    const insert = `INSERT INTO ${entity} (${columns.join(', ')})
      VALUES (${columns.map(() => '?').join(', ')})`;
    for (const row of rows[entity] ?? []) {
      await db.runAsync(
        insert,
        columns.map((column) => row[column] as string | number),
      );
    }
  }
  // Foreground reconciliation must not award XP for activity brought in by
  // restore. Direct awards and activity created on this device still qualify.
  await setAppMetaText(db, appMetaKeys.rewardRestoreAt, restoredAt);
}
