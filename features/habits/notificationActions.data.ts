import type * as SQLite from 'expo-sqlite';
import { getDatabase } from '@/core/db/client';
import { createId } from '@/lib/id';

export const PROCESSED_NOTIFICATION_ACTION_RETENTION_MS = 35 * 24 * 60 * 60 * 1000;

export type NotificationActionClaim = {
  claimed: boolean;
  linkedEventId: string;
  linkedActionRequired: boolean;
};

export type ClaimNotificationActionInput = {
  actionKey: string;
  kind: string;
  actionName: string;
  occurrenceId: string;
  processedAt: string;
};

/**
 * Claim an action inside the caller's transaction. The marker is deliberately
 * local operational state: it is not a synced entity and has no restore path.
 */
export async function claimNotificationActionInTransaction(
  db: SQLite.SQLiteDatabase,
  input: ClaimNotificationActionInput,
): Promise<NotificationActionClaim> {
  const processedAtMs = new Date(input.processedAt).getTime();
  const cutoff = new Date(
    (Number.isNaN(processedAtMs) ? Date.now() : processedAtMs) -
      PROCESSED_NOTIFICATION_ACTION_RETENTION_MS,
  ).toISOString();
  await db.runAsync('DELETE FROM processed_notification_actions WHERE processed_at < ?', [cutoff]);

  const linkedEventId = createId('levt');
  const result = await db.runAsync(
    `INSERT OR IGNORE INTO processed_notification_actions (
       action_key,
       kind,
       action_name,
       occurrence_id,
       linked_event_id,
       linked_action_required,
       processed_at
     ) VALUES (?, ?, ?, ?, ?, 0, ?)`,
    [
      input.actionKey,
      input.kind,
      input.actionName,
      input.occurrenceId,
      linkedEventId,
      input.processedAt,
    ],
  );
  const row = await db.getFirstAsync<{
    linked_event_id: string;
    linked_action_required: number;
  }>(
    `SELECT linked_event_id, linked_action_required
     FROM processed_notification_actions
     WHERE action_key = ?`,
    [input.actionKey],
  );

  return {
    claimed: result.changes === 1,
    linkedEventId: row?.linked_event_id ?? linkedEventId,
    linkedActionRequired: row?.linked_action_required === 1,
  };
}

export async function setNotificationActionLinkedRequiredInTransaction(
  db: SQLite.SQLiteDatabase,
  actionKey: string,
  required: boolean,
): Promise<void> {
  await db.runAsync(
    `UPDATE processed_notification_actions
     SET linked_action_required = ?
     WHERE action_key = ?`,
    [required ? 1 : 0, actionKey],
  );
}

export async function claimNotificationAction(
  input: ClaimNotificationActionInput,
): Promise<NotificationActionClaim> {
  const db = await getDatabase();
  let claim: NotificationActionClaim | null = null;
  await db.withTransactionAsync(async () => {
    claim = await claimNotificationActionInTransaction(db, input);
  });
  return claim ?? { claimed: false, linkedEventId: '', linkedActionRequired: false };
}
