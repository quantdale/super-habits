import { getDatabase } from '@/core/db/client';
import { resolveProjectGoalAssociation } from '@/features/shared/associations';
import {
  Habit,
  HabitCategory,
  HabitCompletion,
  HabitIcon,
  HabitLifecycleStatus,
} from '@/core/db/types';
import type {
  LinkedActionEffectAdapterResult,
  LinkedActionProcessResult,
  LinkedActionRuleDefinition,
  SaveLinkedActionRuleForSourceInput,
} from '@/core/linked-actions/linkedActions.types';
import { createId } from '@/lib/id';
import { assertHabitWrite } from '@/lib/validation';
import { nowIso, timestampToLocalDateKey, toDateKey } from '@/lib/time';
import { runBackupMutation, runSyncedMutation } from '@/core/sync/syncedMutation';
import {
  buildTransactionalSourceEvent,
  linkedActionsEngine,
} from '@/core/linked-actions/linkedActions.engine';
import {
  deleteLinkedActionRulesForTargetEntity,
  insertLinkedActionEventInTransaction,
  listLinkedActionRulesForSourceEntity,
  replaceLinkedActionRulesForSourceEntity,
  updateLinkedActionExecutionInTransaction,
} from '@/core/linked-actions/linkedActions.data';
import { DEFAULT_HABIT_COLOR, DEFAULT_HABIT_ICON } from '@/features/habits/habitPresets';
import { requestHabitReminderReconciliation } from '@/core/notifications/habitReminderSignals';
import { requestHabitDataRefresh } from '@/core/notifications/habitDataSignals';
import {
  claimNotificationActionInTransaction,
  setNotificationActionLinkedRequiredInTransaction,
} from '@/features/habits/notificationActions.data';
import {
  ALL_HABIT_WEEKDAYS,
  applyHabitLifecycleTransition,
  buildInitialHabitRule,
  createHabitRule,
  getHabitRuleForDate,
  getHabitTargetForDate,
  isHabitActionableOn,
  isHabitLifecycleMaskedOn,
  isHabitScheduledOn,
  parseHabitRuleHistory,
  serializeHabitLifecycleHistory,
  serializeHabitRuleHistory,
  upsertHabitRule,
  type HabitRule,
  type HabitWeekday,
} from '@/features/habits/habits.domain';
import {
  formatHabitReminderTime,
  parseHabitReminderTime,
} from '@/features/habits/habitReminders.domain';

const CATEGORY_ORDER =
  "CASE category WHEN 'anytime' THEN 0 WHEN 'morning' THEN 1 WHEN 'afternoon' THEN 2 WHEN 'evening' THEN 3 ELSE 4 END";

function safeTimestampToLocalDateKey(timestamp: string, fallback = toDateKey()): string {
  const parsed = new Date(timestamp);
  return Number.isNaN(parsed.getTime()) ? fallback : timestampToLocalDateKey(timestamp);
}

export type LinkedActionsDispatchResult = Pick<
  LinkedActionProcessResult,
  'matchedRuleCount' | 'notices'
>;

const EMPTY_LINKED_ACTIONS_RESULT: LinkedActionsDispatchResult = {
  matchedRuleCount: 0,
  notices: [],
};

export async function listHabits(): Promise<Habit[]> {
  const db = await getDatabase();
  return db.getAllAsync<Habit>(
    `SELECT * FROM habits WHERE deleted_at IS NULL ORDER BY ${CATEGORY_ORDER}, created_at DESC`,
  );
}

export async function addHabit(
  name: string,
  targetPerDay: number,
  category: HabitCategory = 'anytime',
  icon: HabitIcon = DEFAULT_HABIT_ICON,
  color: string = DEFAULT_HABIT_COLOR,
  weekdays: readonly HabitWeekday[] = ALL_HABIT_WEEKDAYS,
  reminderTime: string | null = null,
  projectId?: string | null,
  goalId?: string | null,
): Promise<string> {
  // Data-layer hard reject (same contract as the UI validateHabit path +
  // non-empty weekdays): non-UI writers must never land an invalid row.
  assertHabitWrite({ name, targetPerDay, weekdays });
  const parsedReminderTime = reminderTime === null ? null : parseHabitReminderTime(reminderTime);
  if (reminderTime !== null && !parsedReminderTime) {
    throw new Error('Reminder time must use HH:MM local time.');
  }
  const canonicalReminderTime = parsedReminderTime
    ? formatHabitReminderTime(parsedReminderTime)
    : null;
  const id = createId('habit');
  const now = nowIso();
  const ruleHistory = buildInitialHabitRule(timestampToLocalDateKey(now), targetPerDay, weekdays);
  const db = await getDatabase();
  await runSyncedMutation({
    db,
    record: { entity: 'habits', id, updatedAt: now, operation: 'create' },
    mutate: async (transactionDb, enqueue) => {
      // `AUD-SH12-A`: creation uses the SAME association contract as every other
      // path. Writing `projectId`/`goalId` verbatim accepted nonexistent parents
      // and persisted a Project-backed Goal with `project_id = null`.
      const resolution = await resolveHabitAssociation(transactionDb, { projectId, goalId });
      await transactionDb.runAsync(
        'INSERT INTO habits (id, name, target_per_day, reminder_time, category, icon, color, rule_history, project_id, goal_id, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)',
        [
          id,
          name,
          targetPerDay,
          canonicalReminderTime,
          category,
          icon,
          color,
          serializeHabitRuleHistory(ruleHistory),
          resolution.nextProjectId,
          resolution.nextGoalId,
          now,
          now,
        ],
      );
      return { changed: true, value: undefined };
    },
  });
  requestHabitReminderReconciliation();
  return id;
}

/**
 * Resolve a Habit's Project/Goal pair through the shared association contract
 * (`AUD-SH12-A`), inside the caller's transaction.
 *
 * @param transactionDb the open mutation transaction
 * @param association the requested pair
 */
async function resolveHabitAssociation(
  transactionDb: Awaited<ReturnType<typeof getDatabase>>,
  association: { projectId?: string | null; goalId?: string | null },
): Promise<{ nextProjectId: string | null; nextGoalId: string | null }> {
  return resolveProjectGoalAssociation({ project_id: null, goal_id: null }, association, {
    projectExists: async (id) => {
      const row = await transactionDb.getFirstAsync<{ id: string }>(
        `SELECT id FROM projects WHERE id = ? AND deleted_at IS NULL`,
        [id],
      );
      return row !== null && row !== undefined;
    },
    goalProjectId: async (id) => {
      const row = await transactionDb.getFirstAsync<{ project_id: string | null }>(
        `SELECT project_id FROM goals WHERE id = ? AND deleted_at IS NULL`,
        [id],
      );
      return row === null || row === undefined ? undefined : row.project_id;
    },
  });
}

export type IncrementHabitResult = {
  count: number;
  linkedActions: LinkedActionsDispatchResult;
};

export async function incrementHabit(
  habitId: string,
  dateKey = toDateKey(),
): Promise<IncrementHabitResult> {
  const db = await getDatabase();
  const now = nowIso();
  const habit = await db.getFirstAsync<{
    name: string;
    target_per_day: number;
    created_at: string;
    rule_history: string | null;
    status: string | null;
    lifecycle_history: string | null;
  }>(
    `SELECT name, target_per_day, created_at, rule_history, status, lifecycle_history
     FROM habits
     WHERE id = ?
       AND deleted_at IS NULL`,
    [habitId],
  );

  // Guard before writing: a missing/soft-deleted habit must not accrete
  // orphan completion rows.
  if (!habit) {
    return {
      count: 0,
      linkedActions: EMPTY_LINKED_ACTIONS_RESULT,
    };
  }

  const creationDateKey = safeTimestampToLocalDateKey(habit.created_at);
  // Lifecycle/schedule write gate (spec: historical edits obey lifecycle and
  // schedule history): a paused/archived habit, or a date that is unscheduled,
  // pre-creation/pre-effective, or inside a paused/archived interval, accepts
  // no completion writes.
  if (
    (habit.status ?? 'active') !== 'active' ||
    !isHabitActionableOn(
      habit.rule_history,
      dateKey,
      habit.target_per_day,
      creationDateKey,
      habit.lifecycle_history,
    )
  ) {
    return {
      count: 0,
      linkedActions: EMPTY_LINKED_ACTIONS_RESULT,
    };
  }

  const targetPerDay = getHabitTargetForDate(
    parseHabitRuleHistory(habit.rule_history),
    dateKey,
    habit.target_per_day,
    creationDateKey,
  );

  // Durable dispatch handoff (same contract as setTodoCompletion): the event
  // id is pre-minted so the source event row can be persisted inside the
  // completion's transaction when the threshold crossing happens.
  const linkedEventId = createId('levt');

  // Atomic upsert inside a transaction with a durable backup intent: two
  // rapid taps previously either raced the UNIQUE(habit_id, date_key)
  // constraint (crash) or lost an increment. The outbox record carries the
  // actual row id returned by the upsert (which may predate this tap).
  type IncrementOutcome = {
    completionId: string | null;
    count: number;
  };
  const outcome = await runBackupMutation<IncrementOutcome>({
    db,
    mutate: async (transactionDb, enqueue) => {
      const row = await transactionDb.getFirstAsync<{ id: string; count: number }>(
        `INSERT INTO habit_completions (id, habit_id, date_key, count, created_at, updated_at)
         VALUES (?, ?, ?, 1, ?, ?)
         ON CONFLICT(habit_id, date_key) DO UPDATE SET
           count = count + 1,
           updated_at = excluded.updated_at
         RETURNING id, count`,
        [createId('hcmp'), habitId, dateKey, now, now],
      );
      if (!row) {
        return { changed: false, value: { completionId: null, count: 0 } };
      }
      enqueue({
        entity: 'habit_completions',
        id: row.id,
        updatedAt: now,
        operation: 'create',
      });
      // Durable dispatch handoff: when this increment crosses the day's
      // target, persist the source event in the SAME transaction as the
      // completion write, then dispatch after commit with the same event id.
      // A crash between the two durable boundaries leaves the event row on
      // disk for the startup recovery sweep.
      if (row.count >= targetPerDay && row.count - 1 < targetPerDay) {
        await insertLinkedActionEventInTransaction(
          transactionDb,
          buildTransactionalSourceEvent({
            eventId: linkedEventId,
            occurredAt: now,
            feature: 'habits',
            entityType: 'habit',
            entityId: habitId,
            triggerType: 'habit.completed_for_day',
            label: habit.name,
            sourceDateKey: dateKey,
            sourceRecordId: row.id,
            origin: {
              originKind: 'user',
              originRuleId: null,
              originEventId: null,
            },
            payload: {
              previousCount: row.count - 1,
              currentCount: row.count,
              targetPerDay,
            },
          }),
          now,
        );
      }
      return { changed: true, value: { completionId: row.id, count: row.count } };
    },
  });
  requestHabitReminderReconciliation();

  const nextCount = outcome.value.count;
  const previousCount = nextCount - 1;
  const completionId = outcome.value.completionId;

  if (previousCount >= targetPerDay || nextCount < targetPerDay) {
    return {
      count: nextCount,
      linkedActions: EMPTY_LINKED_ACTIONS_RESULT,
    };
  }

  const processResult = await linkedActionsEngine.processSourceAction({
    eventId: linkedEventId,
    occurredAt: now,
    feature: 'habits',
    entityType: 'habit',
    entityId: habitId,
    triggerType: 'habit.completed_for_day',
    label: habit.name,
    sourceDateKey: dateKey,
    sourceRecordId: completionId,
    origin: {
      originKind: 'user',
      originRuleId: null,
      originEventId: null,
    },
    payload: {
      previousCount,
      currentCount: nextCount,
      targetPerDay,
    },
  });
  const linkedActions: LinkedActionsDispatchResult = {
    matchedRuleCount: processResult.matchedRuleCount,
    notices: processResult.notices,
  };

  return {
    count: nextCount,
    linkedActions,
  };
}

export type NotificationHabitCompletionResult = {
  status: 'applied' | 'duplicate' | 'noop';
  count: number;
  linkedActions: LinkedActionsDispatchResult;
};

/**
 * Apply one notification completion with a durable claim and the same
 * threshold/Linked Actions semantics as a normal user increment. The marker
 * and completion row share one SQLite transaction; Linked Actions run after
 * commit with the marker's stable event ID so a replay can safely finish a
 * crash between the two durable boundaries.
 */
let notificationCompletionQueue: Promise<void> = Promise.resolve();

export function completeHabitFromNotification(input: {
  habitId: string;
  dateKey: string;
  actionKey: string;
  occurrenceId: string;
  now?: Date;
}): Promise<NotificationHabitCompletionResult> {
  const result = notificationCompletionQueue.then(() => runCompleteHabitFromNotification(input));
  notificationCompletionQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

async function runCompleteHabitFromNotification(input: {
  habitId: string;
  dateKey: string;
  actionKey: string;
  occurrenceId: string;
  now?: Date;
}): Promise<NotificationHabitCompletionResult> {
  const db = await getDatabase();
  const now = input.now ?? new Date();
  const processedAt = now.toISOString();
  let claim: Awaited<ReturnType<typeof claimNotificationActionInTransaction>> = {
    claimed: false,
    linkedEventId: '',
    linkedActionRequired: false,
  };
  let habitName: string | null = null;
  let completionId: string | null = null;
  let shouldDispatchLinkedActions = false;
  let mutationApplied = false;
  let nextCount = 0;

  await runBackupMutation({
    db,
    mutate: async (transactionDb, enqueue) => {
      claim = await claimNotificationActionInTransaction(transactionDb, {
        actionKey: input.actionKey,
        kind: 'habit-reminder',
        actionName: 'mark_complete',
        occurrenceId: input.occurrenceId,
        processedAt,
      });

      const habit = await transactionDb.getFirstAsync<{
        id: string;
        name: string;
        target_per_day: number;
        created_at: string;
        rule_history: string | null;
        status: string | null;
      }>(
        `SELECT id, name, target_per_day, created_at, rule_history, status
         FROM habits
         WHERE id = ?
           AND deleted_at IS NULL`,
        [input.habitId],
      );
      habitName = habit?.name ?? null;

      const existingCompletion = await transactionDb.getFirstAsync<{ id: string; count: number }>(
        `SELECT id, count
         FROM habit_completions
         WHERE habit_id = ?
           AND date_key = ?`,
        [input.habitId, input.dateKey],
      );
      nextCount = existingCompletion?.count ?? 0;
      completionId = existingCompletion?.id ?? null;

      if (!claim.claimed) {
        shouldDispatchLinkedActions = claim.linkedActionRequired && habit !== null;
        return { changed: false, value: undefined };
      }

      const todayKey = toDateKey(now);
      // A paused/archived habit must not be completed from a stale reminder:
      // consume the claim as a no-op and clear the linked-action requirement.
      if (!habit || input.dateKey !== todayKey || (habit.status ?? 'active') !== 'active') {
        await setNotificationActionLinkedRequiredInTransaction(
          transactionDb,
          input.actionKey,
          false,
        );
        return { changed: false, value: undefined };
      }

      const creationDateKey = safeTimestampToLocalDateKey(habit.created_at);
      const history = parseHabitRuleHistory(habit.rule_history);
      const targetPerDay = getHabitTargetForDate(
        history,
        input.dateKey,
        habit.target_per_day,
        creationDateKey,
      );
      if (
        !isHabitScheduledOn(history, input.dateKey, habit.target_per_day, creationDateKey) ||
        nextCount >= targetPerDay
      ) {
        await setNotificationActionLinkedRequiredInTransaction(
          transactionDb,
          input.actionKey,
          false,
        );
        return { changed: false, value: undefined };
      }

      const updatedAt = processedAt;
      const updatedCompletion = await transactionDb.getFirstAsync<{ id: string; count: number }>(
        `INSERT INTO habit_completions (id, habit_id, date_key, count, created_at, updated_at)
         VALUES (?, ?, ?, 1, ?, ?)
         ON CONFLICT(habit_id, date_key) DO UPDATE SET
           count = count + 1,
           updated_at = excluded.updated_at
         RETURNING id, count`,
        [createId('hcmp'), input.habitId, input.dateKey, updatedAt, updatedAt],
      );
      if (updatedCompletion) {
        // Owner-stamped durable intent in the same transaction as the row it
        // describes; the in-memory flush queue is updated after commit.
        enqueue({
          entity: 'habit_completions',
          id: updatedCompletion.id,
          updatedAt,
          operation: 'create',
        });
      }
      nextCount = updatedCompletion?.count ?? nextCount + 1;
      completionId = updatedCompletion?.id ?? completionId;
      mutationApplied = true;
      shouldDispatchLinkedActions = nextCount >= targetPerDay;
      if (shouldDispatchLinkedActions) {
        // Durable dispatch handoff: persist the source event in this same
        // transaction (marker + completion + event commit atomically), so a
        // crash after this boundary is recoverable by the startup
        // event-ledger sweep even if the notification never gets re-tapped.
        await insertLinkedActionEventInTransaction(
          transactionDb,
          buildTransactionalSourceEvent({
            eventId: claim.linkedEventId,
            occurredAt: processedAt,
            feature: 'habits',
            entityType: 'habit',
            entityId: input.habitId,
            triggerType: 'habit.completed_for_day',
            label: habit.name,
            sourceDateKey: input.dateKey,
            sourceRecordId: completionId,
            origin: {
              originKind: 'user',
              originRuleId: null,
              originEventId: null,
            },
            payload: {
              source: 'habit-reminder',
              actionKey: input.actionKey,
              currentCount: nextCount,
            },
          }),
          processedAt,
        );
      }
      await setNotificationActionLinkedRequiredInTransaction(
        transactionDb,
        input.actionKey,
        shouldDispatchLinkedActions,
      );
      return { changed: true, value: undefined };
    },
  });

  const status: NotificationHabitCompletionResult['status'] = claim.claimed
    ? mutationApplied
      ? 'applied'
      : 'noop'
    : 'duplicate';
  if (claim.claimed) requestHabitDataRefresh();
  if (claim.claimed && habitName) requestHabitReminderReconciliation();

  if (!shouldDispatchLinkedActions || !habitName || !claim.linkedEventId) {
    return {
      status,
      count: nextCount,
      linkedActions: EMPTY_LINKED_ACTIONS_RESULT,
    };
  }

  const processResult = await linkedActionsEngine.processSourceAction({
    eventId: claim.linkedEventId,
    occurredAt: processedAt,
    feature: 'habits',
    entityType: 'habit',
    entityId: input.habitId,
    triggerType: 'habit.completed_for_day',
    label: habitName,
    sourceDateKey: input.dateKey,
    sourceRecordId: completionId,
    origin: {
      originKind: 'user',
      originRuleId: null,
      originEventId: null,
    },
    payload: {
      source: 'habit-reminder',
      actionKey: input.actionKey,
      currentCount: nextCount,
    },
  });

  return {
    status,
    count: nextCount,
    linkedActions: {
      matchedRuleCount: processResult.matchedRuleCount,
      notices: processResult.notices,
    },
  };
}

export async function decrementHabit(habitId: string, dateKey = toDateKey()): Promise<void> {
  const db = await getDatabase();
  const now = nowIso();
  // Atomic decrement inside a transaction with a durable backup intent:
  // two rapid taps previously either SELECTed the same count and both wrote
  // count-1, losing a decrement (the same race incrementHabit was fixed
  // for). The row is hard-deleted locally when the count reaches 0 (the
  // documented hard-delete exception), and the durable outbox intent follows
  // the actual row state (update vs remote delete).
  await runBackupMutation({
    db,
    mutate: async (transactionDb, enqueue) => {
      const existing = await transactionDb.getFirstAsync<{ id: string }>(
        `SELECT id FROM habit_completions WHERE habit_id = ? AND date_key = ?`,
        [habitId, dateKey],
      );
      if (!existing) {
        return { changed: false, value: undefined };
      }
      await transactionDb.runAsync(
        'UPDATE habit_completions SET count = count - 1, updated_at = ? WHERE habit_id = ? AND date_key = ? AND count > 0',
        [now, habitId, dateKey],
      );
      const remaining = await transactionDb.getFirstAsync<{ count: number }>(
        `SELECT count FROM habit_completions WHERE habit_id = ? AND date_key = ?`,
        [habitId, dateKey],
      );
      if ((remaining?.count ?? 0) === 0) {
        await transactionDb.runAsync(
          'DELETE FROM habit_completions WHERE habit_id = ? AND date_key = ? AND count = 0',
          [habitId, dateKey],
        );
        enqueue({
          entity: 'habit_completions',
          id: existing.id,
          updatedAt: now,
          operation: 'delete',
        });
      } else {
        enqueue({
          entity: 'habit_completions',
          id: existing.id,
          updatedAt: now,
          operation: 'update',
        });
      }
      return { changed: true, value: undefined };
    },
  });
  requestHabitReminderReconciliation();
}

export async function getHabitCountByDate(habitId: string, dateKey = toDateKey()): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ count: number }>(
    'SELECT count FROM habit_completions WHERE habit_id = ? AND date_key = ?',
    [habitId, dateKey],
  );
  return row?.count ?? 0;
}

export type HabitCompletionRow = {
  habit_id: string;
  date_key: string;
  count: number;
};

export async function getAllHabitCompletionsForRange(
  startDateKey: string,
  endDateKey: string,
): Promise<HabitCompletionRow[]> {
  const db = await getDatabase();
  return db.getAllAsync<HabitCompletionRow>(
    `SELECT habit_id, date_key, count
     FROM habit_completions
     WHERE date_key >= ?
       AND date_key <= ?
     ORDER BY date_key ASC`,
    [startDateKey, endDateKey],
  );
}

/** Read all completion rows for active habits in one ordered query. */
export async function getAllHabitCompletions(): Promise<HabitCompletionRow[]> {
  const db = await getDatabase();
  return db.getAllAsync<HabitCompletionRow>(
    `SELECT completions.habit_id, completions.date_key, completions.count
     FROM habit_completions AS completions
     INNER JOIN habits ON habits.id = completions.habit_id
     WHERE habits.deleted_at IS NULL
     ORDER BY completions.habit_id ASC, completions.date_key ASC`,
  );
}

export async function getCompletionHistory(
  habitId: string,
  days?: number,
): Promise<HabitCompletion[]> {
  const db = await getDatabase();

  if (days === undefined) {
    return db.getAllAsync<HabitCompletion>(
      `SELECT * FROM habit_completions
       WHERE habit_id = ?
       ORDER BY date_key ASC`,
      [habitId],
    );
  }

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - (days - 1));
  const startKey = toDateKey(startDate);
  const endKey = toDateKey(new Date());

  return db.getAllAsync<HabitCompletion>(
    `SELECT * FROM habit_completions
     WHERE habit_id = ?
       AND date_key >= ?
       AND date_key <= ?
     ORDER BY date_key ASC`,
    [habitId, startKey, endKey],
  );
}

export async function updateHabit(
  habitId: string,
  updates: {
    name: string;
    targetPerDay: number;
    category: HabitCategory;
    icon?: HabitIcon;
    color?: string;
    weekdays?: readonly HabitWeekday[];
    effectiveFromDate?: string;
    reminderTime?: string | null;
  },
): Promise<void> {
  // Data-layer hard reject on the full edited shape (same messages as UI).
  assertHabitWrite({
    name: updates.name,
    targetPerDay: updates.targetPerDay,
    weekdays: updates.weekdays,
  });
  const now = nowIso();
  const db = await getDatabase();
  const result = await runSyncedMutation({
    db,
    record: { entity: 'habits', id: habitId, updatedAt: now, operation: 'update' },
    mutate: async (transactionDb) => {
      const changed = await applyHabitUpdateWithinTransaction(transactionDb, habitId, updates, now);
      return { changed, value: undefined };
    },
  });
  if (result.changed) requestHabitReminderReconciliation();
}

/**
 * Associate (or clear, with null) a Habit with a Project and/or Goal.
 *
 * H9 association invariants:
 * - A non-null projectId/goalId MUST reference an existing, non-deleted parent;
 *   otherwise the setter throws a clear error (no dangling references).
 * - Assigning a Goal auto-aligns project_id to that Goal's project_id when the
 *   Goal belongs to a Project. If the Goal has no Project, an explicitly
 *   provided projectId is respected and otherwise the current project_id is
 *   preserved.
 * - The whole change runs inside the synced-mutation transaction so it is atomic
 *   and the outbox intent stays coherent with the final row.
 */
export async function setHabitProjectGoal(
  habitId: string,
  association: { projectId?: string | null; goalId?: string | null },
): Promise<void> {
  if (association.projectId === undefined && association.goalId === undefined) return;
  const db = await getDatabase();
  const now = nowIso();
  await runSyncedMutation({
    db,
    record: { entity: 'habits', id: habitId, updatedAt: now, operation: 'update' },
    mutate: async (transactionDb) => {
      const current = await transactionDb.getFirstAsync<Pick<Habit, 'project_id' | 'goal_id'>>(
        `SELECT project_id, goal_id FROM habits WHERE id = ? AND deleted_at IS NULL`,
        [habitId],
      );
      if (!current) {
        return { changed: false, value: undefined };
      }

      // `AUD-SH12-B`: the SAME shared contract the Todo path uses. The previous
      // hand-rolled version never cleared a Project-backed Goal when the Project
      // was cleared or moved, so a Habit could keep a Goal that pinned a
      // different Project.
      const resolution = await resolveProjectGoalAssociation(
        { project_id: current.project_id, goal_id: current.goal_id },
        association,
        {
          projectExists: async (id) => {
            const row = await transactionDb.getFirstAsync<{ id: string }>(
              `SELECT id FROM projects WHERE id = ? AND deleted_at IS NULL`,
              [id],
            );
            return row !== null && row !== undefined;
          },
          goalProjectId: async (id) => {
            const row = await transactionDb.getFirstAsync<{ project_id: string | null }>(
              `SELECT project_id FROM goals WHERE id = ? AND deleted_at IS NULL`,
              [id],
            );
            return row === null || row === undefined ? undefined : row.project_id;
          },
        },
      );

      const result = await transactionDb.runAsync(
        `UPDATE habits SET project_id = ?, goal_id = ?, updated_at = ?
         WHERE id = ? AND deleted_at IS NULL`,
        [resolution.nextProjectId, resolution.nextGoalId, now, habitId],
      );
      return { changed: result.changes === 1, value: undefined };
    },
  });
}

// ---------------------------------------------------------------------------
// Durable lifecycle transitions (migration 20: habits.status + lifecycle_history)
// ---------------------------------------------------------------------------

/**
 * Shared write path for pause/resume/archive/unarchive. The status column is
 * authoritative; every transition also appends/closes intervals in the
 * lifecycle_history JSON so historical paused/archived dates can be masked in
 * streak/consistency math. The row update and its backup outbox intent land in
 * one transaction via runBackupMutation.
 */
async function setHabitLifecycleStatus(
  habitId: string,
  nextStatus: HabitLifecycleStatus,
  dateKey: string,
): Promise<boolean> {
  const db = await getDatabase();
  const now = nowIso();
  const result = await runBackupMutation<boolean>({
    db,
    mutate: async (transactionDb, enqueue) => {
      const current = await transactionDb.getFirstAsync<{
        status: string | null;
        lifecycle_history: string | null;
      }>('SELECT status, lifecycle_history FROM habits WHERE id = ? AND deleted_at IS NULL', [
        habitId,
      ]);
      if (!current) return { changed: false, value: false };

      const currentStatus = (current.status ?? 'active') as HabitLifecycleStatus;
      if (currentStatus === nextStatus) return { changed: false, value: false };

      const nextHistory = applyHabitLifecycleTransition(
        current.lifecycle_history,
        nextStatus,
        dateKey,
      );
      const mutation = await transactionDb.runAsync(
        'UPDATE habits SET status = ?, lifecycle_history = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL',
        [nextStatus, serializeHabitLifecycleHistory(nextHistory), now, habitId],
      );
      if (mutation.changes !== 1) return { changed: false, value: false };
      enqueue({ entity: 'habits', id: habitId, updatedAt: now, operation: 'update' });
      return { changed: true, value: true };
    },
  });
  if (result.value) requestHabitReminderReconciliation();
  return result.value;
}

/** Pause from today (inclusive): the habit owes nothing until resumed. */
export async function pauseHabit(habitId: string, dateKey = toDateKey()): Promise<boolean> {
  return setHabitLifecycleStatus(habitId, 'paused', dateKey);
}

/** Resume a paused habit from today (inclusive); closes the open pause interval. */
export async function resumeHabit(habitId: string, dateKey = toDateKey()): Promise<boolean> {
  return setHabitLifecycleStatus(habitId, 'active', dateKey);
}

/**
 * Archive from today (inclusive). Any open pause interval is closed first so
 * paused/archived states stay exclusive.
 */
export async function archiveHabit(habitId: string, dateKey = toDateKey()): Promise<boolean> {
  return setHabitLifecycleStatus(habitId, 'archived', dateKey);
}

/** Restore an archived habit to active; closes the open archive interval. */
export async function unarchiveHabit(habitId: string, dateKey = toDateKey()): Promise<boolean> {
  return setHabitLifecycleStatus(habitId, 'active', dateKey);
}

export async function listHabitLinkedActionRules(
  habitId: string,
): Promise<LinkedActionRuleDefinition[]> {
  return listLinkedActionRulesForSourceEntity({
    feature: 'habits',
    entityType: 'habit',
    entityId: habitId,
  });
}

export async function saveHabitLinkedActionRules(
  habitId: string,
  rules: SaveLinkedActionRuleForSourceInput[],
): Promise<void> {
  await replaceLinkedActionRulesForSourceEntity({
    feature: 'habits',
    entityType: 'habit',
    entityId: habitId,
    rules,
  });
}

/**
 * Create a Habit AND its linked-action rules in ONE transaction
 * (`AUD-SH14-A`).
 *
 * Same audited defect as the Todo editor: `addHabit` committed, then a separate
 * rule save could throw, so a retry created a duplicate habit while the first
 * attempt's identity was discarded.
 *
 * @param input the editor's full submit payload
 * @returns the committed Habit id
 */
export async function addHabitWithLinkedActionRules(input: {
  name: string;
  targetPerDay: number;
  category?: HabitCategory;
  icon?: HabitIcon;
  color?: string;
  weekdays?: readonly HabitWeekday[];
  reminderTime?: string | null;
  projectId?: string | null;
  goalId?: string | null;
  rules: SaveLinkedActionRuleForSourceInput[];
}): Promise<string> {
  // Prevalidate the row before any write exists (same contract as addHabit).
  assertHabitWrite({
    name: input.name,
    targetPerDay: input.targetPerDay,
    weekdays: input.weekdays,
  });
  const parsedReminderTime =
    input.reminderTime == null ? null : parseHabitReminderTime(input.reminderTime);
  if (input.reminderTime != null && !parsedReminderTime) {
    throw new Error('Reminder time must use HH:MM local time.');
  }
  const canonicalReminderTime = parsedReminderTime
    ? formatHabitReminderTime(parsedReminderTime)
    : null;
  const weekdays = input.weekdays ?? ALL_HABIT_WEEKDAYS;
  const id = createId('habit');
  const now = nowIso();
  const ruleHistory = buildInitialHabitRule(
    timestampToLocalDateKey(now),
    input.targetPerDay,
    weekdays,
  );
  const db = await getDatabase();
  await runSyncedMutation({
    db,
    record: { entity: 'habits', id, updatedAt: now, operation: 'create' },
    mutate: async (transactionDb, enqueue) => {
      // `AUD-SH12-A`: the composed creation path uses the same resolver.
      const resolution = await resolveHabitAssociation(transactionDb, {
        projectId: input.projectId,
        goalId: input.goalId,
      });
      await transactionDb.runAsync(
        'INSERT INTO habits (id, name, target_per_day, reminder_time, category, icon, color, rule_history, project_id, goal_id, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)',
        [
          id,
          input.name,
          input.targetPerDay,
          canonicalReminderTime,
          input.category ?? 'anytime',
          input.icon ?? DEFAULT_HABIT_ICON,
          input.color ?? DEFAULT_HABIT_COLOR,
          serializeHabitRuleHistory(ruleHistory),
          resolution.nextProjectId,
          resolution.nextGoalId,
          now,
          now,
        ],
      );
      await replaceLinkedActionRulesForSourceEntity({
        feature: 'habits',
        entityType: 'habit',
        entityId: id,
        rules: input.rules,
        db: transactionDb,
        enqueue,
      });
      return { changed: true, value: undefined };
    },
  });
  requestHabitReminderReconciliation();
  return id;
}

/**
 * Update a Habit AND replace its linked-action rules atomically
 * (`AUD-SH14-B`): either both commit or neither does.
 *
 * @param habitId the existing habit
 * @param updates the row changes (same shape `updateHabit` accepts)
 * @param rules the complete replacement rule set
 */
export async function updateHabitWithLinkedActionRules(
  habitId: string,
  updates: Parameters<typeof updateHabit>[1],
  rules: SaveLinkedActionRuleForSourceInput[],
): Promise<void> {
  const db = await getDatabase();
  const now = nowIso();
  let changed = false;
  await runSyncedMutation({
    db,
    record: { entity: 'habits', id: habitId, updatedAt: now, operation: 'update' },
    mutate: async (transactionDb, enqueue) => {
      // The row update and the rule replacement share this transaction. Any
      // failure (an invalid rule, a soft-deleted parent) rolls both back.
      const applied = await applyHabitUpdateWithinTransaction(transactionDb, habitId, updates, now);
      if (!applied) return { changed: false, value: undefined };
      changed = true;
      await replaceLinkedActionRulesForSourceEntity({
        feature: 'habits',
        entityType: 'habit',
        entityId: habitId,
        rules,
        db: transactionDb,
        enqueue,
      });
      return { changed: true, value: undefined };
    },
  });
  if (changed) requestHabitReminderReconciliation();
}

/**
 * Transaction-aware body of `updateHabit`.
 *
 * Extracted so a composed save can run the row edit and the rule replacement in
 * ONE transaction without nesting `runSyncedMutation` (which would open a second
 * transaction on the single SQLite connection).
 *
 * @returns whether a row actually changed
 */
async function applyHabitUpdateWithinTransaction(
  transactionDb: Awaited<ReturnType<typeof getDatabase>>,
  habitId: string,
  updates: {
    name: string;
    targetPerDay: number;
    category: HabitCategory;
    icon?: HabitIcon;
    color?: string;
    weekdays?: readonly HabitWeekday[];
    effectiveFromDate?: string;
    reminderTime?: string | null;
  },
  now: string,
): Promise<boolean> {
  assertHabitWrite({
    name: updates.name,
    targetPerDay: updates.targetPerDay,
    weekdays: updates.weekdays,
  });
  const existing = await transactionDb.getFirstAsync<{
    target_per_day: number;
    reminder_time: string | null;
    created_at: string;
    rule_history: string | null;
  }>(
    `SELECT target_per_day, reminder_time, created_at, rule_history
     FROM habits
     WHERE id = ?
       AND deleted_at IS NULL`,
    [habitId],
  );
  if (!existing) return false;

  const effectiveFromDate = updates.effectiveFromDate ?? timestampToLocalDateKey(now);
  const fallbackCreationDate = safeTimestampToLocalDateKey(existing.created_at);
  const history = parseHabitRuleHistory(existing.rule_history);
  const normalizedHistory =
    history.length > 0
      ? history
      : buildInitialHabitRule(fallbackCreationDate, existing.target_per_day);
  const currentRule = getHabitRuleForDate(
    normalizedHistory,
    effectiveFromDate,
    existing.target_per_day,
    fallbackCreationDate,
  );
  const nextRule: HabitRule = createHabitRule(
    effectiveFromDate,
    updates.weekdays ?? currentRule?.weekdays ?? ALL_HABIT_WEEKDAYS,
    updates.targetPerDay,
  );
  const nextHistory = upsertHabitRule(normalizedHistory, nextRule);
  const nextReminderTime =
    updates.reminderTime === undefined ? existing.reminder_time : updates.reminderTime;
  const parsedReminderTime =
    nextReminderTime === null ? null : parseHabitReminderTime(nextReminderTime);
  if (nextReminderTime !== null && !parsedReminderTime) {
    throw new Error('Reminder time must use HH:MM local time.');
  }
  const canonicalReminderTime = parsedReminderTime
    ? formatHabitReminderTime(parsedReminderTime)
    : null;

  const mutation = await transactionDb.runAsync(
    'UPDATE habits SET name = ?, target_per_day = ?, reminder_time = ?, category = ?, icon = ?, color = ?, rule_history = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL',
    [
      updates.name,
      updates.targetPerDay,
      canonicalReminderTime,
      updates.category,
      updates.icon ?? DEFAULT_HABIT_ICON,
      updates.color ?? DEFAULT_HABIT_COLOR,
      serializeHabitRuleHistory(nextHistory),
      now,
      habitId,
    ],
  );
  return mutation.changes === 1;
}

export async function deleteHabit(habitId: string): Promise<void> {
  const now = nowIso();
  const db = await getDatabase();
  // A repeated delete is an idempotent no-op. Avoid rewriting the tombstone,
  // enqueueing another backup mutation, or re-running linked-action cleanup.
  const result = await runSyncedMutation({
    db,
    record: { entity: 'habits', id: habitId, updatedAt: now, operation: 'delete' },
    mutate: async (transactionDb, enqueue) => {
      const result = await transactionDb.runAsync(
        'UPDATE habits SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL',
        [now, now, habitId],
      );
      if (result.changes === 0) return { changed: false, value: undefined };

      await replaceLinkedActionRulesForSourceEntity({
        feature: 'habits',
        entityType: 'habit',
        entityId: habitId,
        rules: [],
        db: transactionDb,
        enqueue,
      });
      await deleteLinkedActionRulesForTargetEntity({
        feature: 'habits',
        entityType: 'habit',
        entityId: habitId,
        deletedAt: now,
        db: transactionDb,
        enqueue,
      });
      return { changed: true, value: undefined };
    },
  });
  if (result.changed) requestHabitReminderReconciliation();
}

export async function incrementHabitFromLinkedAction(input: {
  habitId: string;
  amount: number;
  dateKey: string;
  executionId?: string;
}): Promise<LinkedActionEffectAdapterResult> {
  const db = await getDatabase();
  const outcome = await runBackupMutation<LinkedActionEffectAdapterResult>({
    db,
    mutate: async (transactionDb, enqueue) => {
      const habit = await transactionDb.getFirstAsync<
        Pick<Habit, 'id' | 'name' | 'deleted_at' | 'status' | 'lifecycle_history'>
      >(
        `SELECT id, name, deleted_at, status, lifecycle_history
         FROM habits
         WHERE id = ?`,
        [input.habitId],
      );

      if (!habit || habit.deleted_at !== null) {
        if (input.executionId) {
          await updateLinkedActionExecutionInTransaction(transactionDb, input.executionId, {
            status: 'skipped',
            errorMessage: 'target_missing',
          });
        }
        return {
          changed: false,
          value: {
            status: 'skipped' as const,
            reason: 'target_missing' as const,
            ...(input.executionId ? { executionFinalized: true } : {}),
          },
        };
      }

      // A paused/archived habit (or a date inside a paused/archived interval)
      // accepts no completion writes, even from linked actions.
      if (
        (habit.status ?? 'active') !== 'active' ||
        isHabitLifecycleMaskedOn(habit.lifecycle_history, input.dateKey)
      ) {
        if (input.executionId) {
          await updateLinkedActionExecutionInTransaction(transactionDb, input.executionId, {
            status: 'skipped',
            errorMessage: 'target_inactive',
          });
        }
        return {
          changed: false,
          value: {
            status: 'skipped' as const,
            reason: 'target_inactive' as const,
            targetLabel: habit.name,
            ...(input.executionId ? { executionFinalized: true } : {}),
          },
        };
      }

      if (input.amount <= 0) {
        if (input.executionId) {
          await updateLinkedActionExecutionInTransaction(transactionDb, input.executionId, {
            status: 'skipped',
            errorMessage: 'invalid_amount',
          });
        }
        return {
          changed: false,
          value: {
            status: 'skipped' as const,
            reason: 'invalid_amount' as const,
            targetLabel: habit.name,
            ...(input.executionId ? { executionFinalized: true } : {}),
          },
        };
      }

      const updatedAt = nowIso();
      const updatedCompletion = await transactionDb.getFirstAsync<{ id: string; count: number }>(
        `INSERT INTO habit_completions (id, habit_id, date_key, count, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(habit_id, date_key) DO UPDATE SET
           count = habit_completions.count + excluded.count,
           updated_at = excluded.updated_at
         RETURNING id, count`,
        [createId('hcmp'), input.habitId, input.dateKey, input.amount, updatedAt, updatedAt],
      );

      if (updatedCompletion) {
        // Owner-stamped durable intent in the same transaction as the row it
        // describes; the in-memory flush queue is updated after commit.
        enqueue({
          entity: 'habit_completions',
          id: updatedCompletion.id,
          updatedAt,
          operation: 'create',
        });
      }

      if (input.executionId) {
        await updateLinkedActionExecutionInTransaction(transactionDb, input.executionId, {
          status: 'applied',
          errorMessage: null,
        });
      }
      return {
        changed: true,
        value: {
          status: 'applied' as const,
          targetLabel: habit.name,
          ...(input.executionId ? { executionFinalized: true } : {}),
        },
      };
    },
  });

  if (outcome.changed) requestHabitReminderReconciliation();
  return outcome.value;
}

export async function ensureHabitDailyTargetFromLinkedAction(input: {
  habitId: string;
  minimumCount: number | 'target_per_day';
  dateKey: string;
  executionId?: string;
}): Promise<LinkedActionEffectAdapterResult> {
  const db = await getDatabase();
  const outcome = await runBackupMutation<LinkedActionEffectAdapterResult>({
    db,
    mutate: async (transactionDb, enqueue) => {
      const habit = await transactionDb.getFirstAsync<
        Pick<
          Habit,
          | 'id'
          | 'name'
          | 'target_per_day'
          | 'created_at'
          | 'rule_history'
          | 'deleted_at'
          | 'status'
          | 'lifecycle_history'
        >
      >(
        `SELECT id, name, target_per_day, created_at, rule_history, deleted_at, status, lifecycle_history
         FROM habits
         WHERE id = ?`,
        [input.habitId],
      );
      if (!habit || habit.deleted_at !== null) {
        if (input.executionId) {
          await updateLinkedActionExecutionInTransaction(transactionDb, input.executionId, {
            status: 'skipped',
            errorMessage: 'target_missing',
          });
        }
        return {
          changed: false,
          value: {
            status: 'skipped' as const,
            reason: 'target_missing' as const,
            ...(input.executionId ? { executionFinalized: true } : {}),
          },
        };
      }

      // A paused/archived habit (or a date inside a paused/archived interval)
      // accepts no completion writes, even from linked actions.
      if (
        (habit.status ?? 'active') !== 'active' ||
        isHabitLifecycleMaskedOn(habit.lifecycle_history, input.dateKey)
      ) {
        if (input.executionId) {
          await updateLinkedActionExecutionInTransaction(transactionDb, input.executionId, {
            status: 'skipped',
            errorMessage: 'target_inactive',
          });
        }
        return {
          changed: false,
          value: {
            status: 'skipped' as const,
            reason: 'target_inactive' as const,
            targetLabel: habit.name,
            ...(input.executionId ? { executionFinalized: true } : {}),
          },
        };
      }

      const targetPerDay = getHabitTargetForDate(
        parseHabitRuleHistory(habit.rule_history),
        input.dateKey,
        habit.target_per_day,
        safeTimestampToLocalDateKey(habit.created_at),
      );
      const desiredCount = Math.max(
        0,
        input.minimumCount === 'target_per_day' ? targetPerDay : input.minimumCount,
      );
      const existing = await transactionDb.getFirstAsync<{ count: number }>(
        `SELECT count FROM habit_completions WHERE habit_id = ? AND date_key = ?`,
        [input.habitId, input.dateKey],
      );
      if (desiredCount === 0 || (existing && existing.count >= desiredCount)) {
        if (input.executionId) {
          await updateLinkedActionExecutionInTransaction(transactionDb, input.executionId, {
            status: 'skipped',
            errorMessage: 'already_satisfied',
          });
        }
        return {
          changed: false,
          value: {
            status: 'skipped' as const,
            reason: 'already_satisfied' as const,
            targetLabel: habit.name,
            ...(input.executionId ? { executionFinalized: true } : {}),
          },
        };
      }

      const updatedAt = nowIso();
      const updatedCompletion = await transactionDb.getFirstAsync<{ id: string; count: number }>(
        `INSERT INTO habit_completions (id, habit_id, date_key, count, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(habit_id, date_key) DO UPDATE SET
           count = MAX(habit_completions.count, excluded.count),
           updated_at = excluded.updated_at
         RETURNING id, count`,
        [createId('hcmp'), input.habitId, input.dateKey, desiredCount, updatedAt, updatedAt],
      );
      if (updatedCompletion) {
        // Owner-stamped durable intent in the same transaction as the row it
        // describes; the in-memory flush queue is updated after commit.
        enqueue({
          entity: 'habit_completions',
          id: updatedCompletion.id,
          updatedAt,
          operation: 'create',
        });
      }
      if (input.executionId) {
        await updateLinkedActionExecutionInTransaction(transactionDb, input.executionId, {
          status: 'applied',
          errorMessage: null,
        });
      }
      return {
        changed: true,
        value: {
          status: 'applied' as const,
          targetLabel: habit.name,
          ...(input.executionId ? { executionFinalized: true } : {}),
        },
      };
    },
  });

  if (outcome.changed) requestHabitReminderReconciliation();
  return outcome.value;
}

export async function applyRemoteHabits(
  db: Awaited<ReturnType<typeof getDatabase>>,
  rows: Habit[],
): Promise<void> {
  for (const row of rows) {
    const fallbackCreationDate = safeTimestampToLocalDateKey(row.created_at);
    const history = parseHabitRuleHistory(row.rule_history);
    const ruleHistory =
      history.length > 0
        ? history
        : buildInitialHabitRule(fallbackCreationDate, row.target_per_day);
    await db.runAsync(
      `INSERT OR REPLACE INTO habits (
         id,
         name,
         target_per_day,
         reminder_time,
         category,
         icon,
         color,
         rule_history,
         created_at,
         updated_at,
         deleted_at,
         project_id,
         goal_id,
         status,
         lifecycle_history
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        row.id,
        row.name,
        row.target_per_day,
        row.reminder_time,
        row.category,
        row.icon,
        row.color,
        serializeHabitRuleHistory(ruleHistory),
        row.created_at,
        row.updated_at,
        row.deleted_at,
        row.project_id,
        row.goal_id,
        // Legacy rows predate the lifecycle columns; absent status = 'active'.
        row.status ?? 'active',
        row.lifecycle_history ?? null,
      ],
    );
  }
}

/**
 * Restore-only import for habit completion history. Plain INSERT OR REPLACE
 * preserving ids, date keys, counts, and timestamps — this is data
 * reconstruction, not a mutation: no threshold events, no linked actions, no
 * reminder actions, no use-count semantics.
 */
export async function applyRemoteHabitCompletions(
  db: Awaited<ReturnType<typeof getDatabase>>,
  rows: HabitCompletion[],
): Promise<void> {
  for (const row of rows) {
    await db.runAsync(
      `INSERT OR REPLACE INTO habit_completions (
         id,
         habit_id,
         date_key,
         count,
         created_at,
         updated_at
       ) VALUES (?, ?, ?, ?, ?, ?)`,
      [row.id, row.habit_id, row.date_key, row.count, row.created_at, row.updated_at],
    );
  }
}
