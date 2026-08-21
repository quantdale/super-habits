import { getDatabase } from '@/core/db/client';
import type { TodoPriority } from '@/core/db/types';
import { claimOwnerBindingOnFirstContent } from '@/core/auth/account.data';
import { appMetaKeys, setAppMetaText } from '@/core/db/appMeta';
import { upsertSyncOutboxRecord } from '@/core/sync/syncPersistence';
import { syncEngine } from '@/core/sync/sync.engine';
import { linkedActionsEngine } from '@/core/linked-actions/linkedActions.engine';
import {
  claimNotificationActionInTransaction,
  setNotificationActionLinkedRequiredInTransaction,
} from '@/features/habits/notificationActions.data';
import { TODO_REMINDER_DATA_KIND } from '@/lib/notificationConstants';
import { toDateKey } from '@/lib/time';
import { createRecurringInstance, type TodoLinkedActionsDispatchResult } from './todos.data';
import { getTomorrowDateKey } from './todos.domain';

/**
 * Notification-side completion for todo due-date reminders. Mirrors
 * `completeHabitFromNotification`: the durable claim marker and the completion
 * share ONE SQLite transaction, Linked Actions run after commit with the
 * marker's stable event ID so a replay can safely finish a crash between the
 * two durable boundaries, and replays are exact duplicates (no double
 * mutation, no double dispatch).
 *
 * This is deliberately a separate file from `todos.data.ts`: the canonical
 * toggle/complete APIs stay untouched, and this variant is exclusively
 * desired-completion=1 (a notification tap must never reopen a todo).
 */

export type NotificationTodoCompletionResult = {
  status: 'applied' | 'duplicate' | 'noop';
  linkedActions: TodoLinkedActionsDispatchResult;
};

const EMPTY_LINKED_ACTIONS_RESULT: TodoLinkedActionsDispatchResult = {
  matchedRuleCount: 0,
  notices: [],
};

type SpawnRecurrencePlan = {
  title: string;
  notes: string | null;
  priority: TodoPriority;
  recurrenceId: string;
};

let notificationCompletionQueue: Promise<void> = Promise.resolve();

/** Serialized so duplicate foreground/cold-start responses cannot interleave. */
export function completeTodoFromNotification(input: {
  todoId: string;
  actionKey: string;
  occurrenceId: string;
  now?: Date;
}): Promise<NotificationTodoCompletionResult> {
  const result = notificationCompletionQueue.then(() => runCompleteTodoFromNotification(input));
  notificationCompletionQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

async function runCompleteTodoFromNotification(input: {
  todoId: string;
  actionKey: string;
  occurrenceId: string;
  now?: Date;
}): Promise<NotificationTodoCompletionResult> {
  const db = await getDatabase();
  const now = input.now ?? new Date();
  const processedAt = now.toISOString();
  let claim: Awaited<ReturnType<typeof claimNotificationActionInTransaction>> = {
    claimed: false,
    linkedEventId: '',
    linkedActionRequired: false,
  };
  let todoTitle: string | null = null;
  let shouldDispatchLinkedActions = false;
  let mutationApplied = false;
  let spawnRecurrence: SpawnRecurrencePlan | null = null;

  await db.withTransactionAsync(async () => {
    claim = await claimNotificationActionInTransaction(db, {
      actionKey: input.actionKey,
      kind: TODO_REMINDER_DATA_KIND,
      actionName: 'mark_done',
      occurrenceId: input.occurrenceId,
      processedAt,
    });

    const todo = await db.getFirstAsync<{
      id: string;
      title: string;
      completed: 0 | 1;
      notes: string | null;
      priority: TodoPriority;
      recurrence: string | null;
      recurrence_id: string | null;
    }>(
      `SELECT id, title, completed, notes, priority, recurrence, recurrence_id
       FROM todos
       WHERE id = ?
         AND deleted_at IS NULL`,
      [input.todoId],
    );
    todoTitle = todo?.title ?? null;

    if (!claim.claimed) {
      // Replay/crash recovery: finish a pending Linked Action dispatch from
      // the marker without re-applying the completion.
      shouldDispatchLinkedActions = claim.linkedActionRequired && todo?.completed === 1;
      return;
    }

    // Missing/deleted/already-completed todos are a safe no-op; the claim is
    // still consumed so repeated taps cannot mutate later state changes.
    if (!todo || todo.completed === 1) {
      await setNotificationActionLinkedRequiredInTransaction(db, input.actionKey, false);
      return;
    }

    const result = await db.runAsync(
      `UPDATE todos
       SET completed = 1, completed_at = ?, updated_at = ?
       WHERE id = ?
         AND completed = 0
         AND deleted_at IS NULL`,
      [processedAt, processedAt, input.todoId],
    );
    if (result.changes !== 1) {
      await setNotificationActionLinkedRequiredInTransaction(db, input.actionKey, false);
      return;
    }

    // Processed completion actions are user-driven content as well.
    await claimOwnerBindingOnFirstContent(db);
    const prepared = syncEngine.prepare({
      entity: 'todos',
      id: input.todoId,
      updatedAt: processedAt,
      operation: 'update',
    });
    await upsertSyncOutboxRecord(db, prepared, prepared.revision);
    await setAppMetaText(db, appMetaKeys.backupDirty, '1');
    mutationApplied = true;

    // Daily recurring todos spawn their next instance instead of dispatching
    // Linked Actions — identical to the in-app completion contract.
    if (todo.recurrence === 'daily' && todo.recurrence_id) {
      spawnRecurrence = {
        title: todo.title,
        notes: todo.notes,
        priority: todo.priority,
        recurrenceId: todo.recurrence_id,
      };
    } else {
      shouldDispatchLinkedActions = true;
    }
    await setNotificationActionLinkedRequiredInTransaction(
      db,
      input.actionKey,
      shouldDispatchLinkedActions,
    );
  });

  const status: NotificationTodoCompletionResult['status'] = claim.claimed
    ? mutationApplied
      ? 'applied'
      : 'noop'
    : 'duplicate';

  if (spawnRecurrence) {
    // Explicit alias: the assignment happens inside the transaction closure,
    // so the post-transaction narrowing is not reliable here.
    const recurrence: SpawnRecurrencePlan = spawnRecurrence;
    const tomorrow = getTomorrowDateKey();
    const existing = await db.getFirstAsync<{ id: string }>(
      `SELECT id FROM todos
       WHERE recurrence_id = ?
         AND due_date = ?
         AND deleted_at IS NULL`,
      [recurrence.recurrenceId, tomorrow],
    );
    if (!existing) {
      await createRecurringInstance({
        title: recurrence.title,
        notes: recurrence.notes,
        priority: recurrence.priority,
        recurrenceId: recurrence.recurrenceId,
        dueDate: tomorrow,
      });
    }
  }

  if (!shouldDispatchLinkedActions || !todoTitle || !claim.linkedEventId) {
    return {
      status,
      linkedActions: EMPTY_LINKED_ACTIONS_RESULT,
    };
  }

  const processResult = await linkedActionsEngine.processSourceAction({
    eventId: claim.linkedEventId,
    occurredAt: processedAt,
    feature: 'todos',
    entityType: 'todo',
    entityId: input.todoId,
    triggerType: 'todo.completed',
    label: todoTitle,
    sourceDateKey: toDateKey(now),
    sourceRecordId: input.todoId,
    origin: {
      originKind: 'user',
      originRuleId: null,
      originEventId: null,
    },
    payload: {
      source: 'todo-reminder',
      actionKey: input.actionKey,
    },
  });

  return {
    status,
    linkedActions: {
      matchedRuleCount: processResult.matchedRuleCount,
      notices: processResult.notices,
    },
  };
}
