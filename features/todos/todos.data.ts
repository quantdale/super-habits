import type * as SQLite from 'expo-sqlite';
import { getDatabase } from '@/core/db/client';
import { resolveProjectGoalAssociation } from '@/features/shared/associations';
import type { Todo, TodoPriority, TodoRecurrence } from '@/core/db/types';
import type {
  LinkedActionEffectAdapterResult,
  LinkedActionProcessResult,
  LinkedActionRuleDefinition,
  SaveLinkedActionRuleForSourceInput,
} from '@/core/linked-actions/linkedActions.types';
import {
  deleteLinkedActionRulesForTargetEntity,
  insertLinkedActionEventInTransaction,
  listLinkedActionRulesForSourceEntity,
  replaceLinkedActionRulesForSourceEntity,
} from '@/core/linked-actions/linkedActions.data';
import { createId } from '@/lib/id';
import { assertTodoPartialUpdate, assertTodoWrite } from '@/lib/validation';
import { addLocalDays, nowIso, toDateKey } from '@/lib/time';
import { runBackupMutation, runSyncedMutation } from '@/core/sync/syncedMutation';
import type { SyncRecord } from '@/core/sync/sync.engine';
import {
  buildTransactionalSourceEvent,
  linkedActionsEngine,
} from '@/core/linked-actions/linkedActions.engine';
import {
  parseTopTodoIds,
  parseTopTodoTitles,
  serializeTopTodoIds,
} from '@/features/daily-plan/dailyPlan.domain';
import {
  cancelTodoReminderSafely,
  syncTodoDueReminder,
  type TodoReminderSnapshot,
} from '@/core/notifications/todoReminderScheduler';
import { getTomorrowDateKey } from './todos.domain';

/**
 * Due date for the next instance spawned when a daily series row completes.
 * A future-dated instance (e.g. tomorrow's copy completed early) rolls the
 * chain forward one day from its own date; today/overdue/null rows keep the
 * classic "spawn tomorrow" behaviour. Without this, completing a future copy
 * would look for an instance on the *same* future date, find itself, and stop
 * the series (boundary chain contract).
 *
 * `reference` defaults to now; a retraction passes the instant the occurrence
 * was originally completed, so it resolves the copy that completion spawned
 * instead of the one today's clock would ask for.
 */
function nextRecurringSpawnDueDate(
  completedDueDate: string | null,
  reference: Date = new Date(),
): string {
  const tomorrow = getTomorrowDateKey(reference);
  if (!completedDueDate || completedDueDate < tomorrow) return tomorrow;
  return addLocalDays(completedDueDate, 1);
}

/**
 * A spawned daily copy is "pristine" while nothing has written it since the
 * spawn. `createRecurringInstances` inserts with `created_at = updated_at`, and
 * every later write (instance edit, series-template rename, reorder,
 * completion) bumps `updated_at` — so this predicate is the exact
 * "untouched since it was spawned" oracle without adding a provenance column.
 */
const PRISTINE_SPAWN_SQL = 'completed = 0 AND deleted_at IS NULL AND updated_at = created_at';

/**
 * Undo the copy that completing `parent` spawned.
 *
 * Completing a daily copy spawns the next day's copy. Reopening (unchecking)
 * that same copy must retract the spawn, otherwise the user is left holding two
 * pending copies of one daily task: the reopened row plus the copy the reopen
 * was supposed to make unnecessary. Only a copy nothing has touched since the
 * spawn is retracted — an edited, renamed, reordered, or completed future copy
 * belongs to the user and stays. Re-completing the parent spawns a fresh copy
 * again, because the retraction is a soft delete and the spawn guard ignores
 * tombstones.
 */
async function removePristineSpawnedCopyWithinTransaction(
  transactionDb: SQLite.SQLiteDatabase,
  parent: Pick<
    Todo,
    | 'id'
    | 'title'
    | 'notes'
    | 'priority'
    | 'due_date'
    | 'completed_at'
    | 'recurrence'
    | 'recurrence_id'
  >,
  now: string,
  enqueue: (record: SyncRecord) => void,
): Promise<string | null> {
  // `parent` is the pre-update row, so `completed_at` is the ORIGINAL completion
  // instant: replaying the spawn from it finds the copy that completion created
  // even when the reopen happens days later. No provenance, nothing to retract.
  const spawnDueDate = parent.completed_at
    ? nextRecurringSpawnDueDate(parent.due_date, new Date(parent.completed_at))
    : null;
  if (parent.recurrence !== 'daily' || !parent.recurrence_id || !spawnDueDate) return null;
  const spawned = await transactionDb.getFirstAsync<{
    id: string;
    title: string;
    notes: string | null;
    priority: TodoPriority;
    due_date: string | null;
  }>(
    `SELECT id, title, notes, priority, due_date FROM todos
     WHERE recurrence_id = ?
       AND due_date = ?
       AND id != ?
       AND ${PRISTINE_SPAWN_SQL}`,
    [parent.recurrence_id, spawnDueDate, parent.id],
  );
  if (!spawned) return null;
  // The pristine timestamp is millisecond-granular, so an edit landing in the
  // same millisecond as the insert cannot be distinguished by time alone.
  // Every field the spawn copies must therefore still match the parent.
  if (
    spawned.title !== parent.title ||
    spawned.notes !== parent.notes ||
    spawned.priority !== parent.priority ||
    spawned.due_date !== spawnDueDate
  ) {
    return null;
  }

  const removed = await removeTodoWithinTransaction(transactionDb, spawned.id, now, enqueue);
  if (!removed) return null;
  // The tombstone must ride the durable outbox exactly like removeTodo's own
  // record; without it the remote copy (and any restore) keeps the duplicate.
  enqueue({ entity: 'todos', id: spawned.id, updatedAt: now, operation: 'delete' });
  return spawned.id;
}

export type TodoLinkedActionsDispatchResult = Pick<
  LinkedActionProcessResult,
  'matchedRuleCount' | 'notices'
>;

export type ToggleTodoResult = {
  completed: 0 | 1;
  linkedActions: TodoLinkedActionsDispatchResult;
  /**
   * True when the tap changed nothing because the row is gone (deleted
   * elsewhere / tombstoned) or a concurrent write won the race. Persisted
   * completions stay represented by completed: 1 with noop undefined, so UIs
   * can distinguish "legitimately already in that state" from "silent no-op".
   */
  noop?: boolean;
};

export type PendingTodoFilters = {
  due?: 'all' | 'today' | 'overdue';
  priority?: TodoPriority | 'all';
  todayDateKey?: string;
};

export type PendingTodoListOptions = PendingTodoFilters & {
  limit?: number;
};

const EMPTY_LINKED_ACTIONS_RESULT: TodoLinkedActionsDispatchResult = {
  matchedRuleCount: 0,
  notices: [],
};

/**
 * Device-local due-date reminder sync. Reminder failures must never break a
 * data write, so every call is best-effort; the scheduler itself is a no-op on
 * web and respects the notifications preference.
 */
async function syncReminderSafely(todo: TodoReminderSnapshot): Promise<void> {
  try {
    await syncTodoDueReminder(todo);
  } catch {
    // Ignore reminder scheduling failures.
  }
}

export async function listTodos(): Promise<Todo[]> {
  const db = await getDatabase();
  return db.getAllAsync<Todo>(
    `SELECT * FROM todos
     WHERE deleted_at IS NULL
     ORDER BY completed ASC, sort_order ASC, created_at DESC`,
  );
}

export async function listPendingTodos(input?: number | PendingTodoListOptions): Promise<Todo[]> {
  const db = await getDatabase();
  const options = typeof input === 'number' ? { limit: input } : (input ?? {});
  const hasFilters =
    options.due !== undefined ||
    options.priority !== undefined ||
    options.todayDateKey !== undefined;
  const query = `SELECT * FROM todos
     WHERE deleted_at IS NULL
       AND completed = 0
     ORDER BY sort_order ASC, created_at DESC`;
  if (!hasFilters && options.limit === undefined) {
    return db.getAllAsync<Todo>(query);
  }

  const clauses: string[] = ['deleted_at IS NULL', 'completed = 0'];
  const args: (string | number)[] = [];
  if (options.priority && options.priority !== 'all') {
    clauses.push('priority = ?');
    args.push(options.priority);
  }
  if (options.due === 'today') {
    clauses.push('due_date = ?');
    args.push(options.todayDateKey ?? toDateKey());
  } else if (options.due === 'overdue') {
    clauses.push('due_date IS NOT NULL', 'due_date < ?');
    args.push(options.todayDateKey ?? toDateKey());
  }
  const filteredQuery = `SELECT * FROM todos
     WHERE ${clauses.join('\n       AND ')}
     ORDER BY sort_order ASC, created_at DESC`;
  if (options.limit === undefined) {
    return db.getAllAsync<Todo>(filteredQuery, args);
  }
  return db.getAllAsync<Todo>(`${filteredQuery} LIMIT ?`, [...args, options.limit]);
}

export async function countPendingTodos(filters?: PendingTodoFilters): Promise<number> {
  const db = await getDatabase();
  if (!filters) {
    const row = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) AS count
       FROM todos
       WHERE deleted_at IS NULL
         AND completed = 0`,
    );
    return row?.count ?? 0;
  }

  const clauses: string[] = ['deleted_at IS NULL', 'completed = 0'];
  const args: string[] = [];
  if (filters.priority && filters.priority !== 'all') {
    clauses.push('priority = ?');
    args.push(filters.priority);
  }
  if (filters.due === 'today') {
    clauses.push('due_date = ?');
    args.push(filters.todayDateKey ?? toDateKey());
  } else if (filters.due === 'overdue') {
    clauses.push('due_date IS NOT NULL', 'due_date < ?');
    args.push(filters.todayDateKey ?? toDateKey());
  }
  const row = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) AS count
     FROM todos
     WHERE ${clauses.join('\n       AND ')}`,
    args,
  );
  return row?.count ?? 0;
}

export async function addTodo(input: {
  title: string;
  notes?: string;
  dueDate?: string | null;
  priority?: TodoPriority;
  recurrence?: TodoRecurrence;
  projectId?: string | null;
  goalId?: string | null;
}): Promise<string> {
  const db = await getDatabase();
  const id = createId('todo');
  const now = nowIso();

  const recurrenceId = input.recurrence === 'daily' ? createId('rec') : null;

  const dueDate =
    input.dueDate !== undefined ? input.dueDate : input.recurrence === 'daily' ? toDateKey() : null;

  // Data-layer hard reject (same contract as the UI validateTodo path):
  // non-UI writers must never land an empty/overlong/invalid row.
  assertTodoWrite({ title: input.title, notes: input.notes, dueDate });

  await runSyncedMutation({
    db,
    record: { entity: 'todos', id, updatedAt: now, operation: 'create' },
    mutate: async (transactionDb) => {
      // `AUD-SH12-A`: creation goes through the SAME association resolver as
      // edits, so a dangling parent is refused instead of persisted and a
      // Project-backed Goal aligns its Project. Previously this INSERT wrote
      // `input.projectId`/`input.goalId` verbatim: `addTodo({goalId: 'missing'})`
      // was accepted, and assigning a Project-backed Goal left `project_id` NULL.
      const resolution = await resolveTodoProjectGoalAssociation(
        transactionDb,
        { project_id: null, goal_id: null },
        { projectId: input.projectId, goalId: input.goalId },
      );
      // Allocate sort_order INSIDE the mutation transaction so two concurrent
      // adds can never read the same MAX(sort_order) and tie (F9).
      const maxRow = await transactionDb.getFirstAsync<{ maxOrder: number }>(
        `SELECT COALESCE(MAX(sort_order), 0) AS maxOrder
         FROM todos WHERE deleted_at IS NULL AND completed = 0`,
      );
      const sortOrder = (maxRow?.maxOrder ?? 0) + 1;
      await transactionDb.runAsync(
        `INSERT INTO todos
           (id, title, notes, completed, completed_at, due_date, priority,
            sort_order, recurrence, recurrence_id,
            project_id, goal_id,
            created_at, updated_at, deleted_at)
         VALUES (?, ?, ?, 0, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
        [
          id,
          input.title,
          input.notes ?? null,
          dueDate,
          input.priority ?? 'normal',
          sortOrder,
          input.recurrence ?? null,
          recurrenceId,
          resolution.nextProjectId,
          resolution.nextGoalId,
          now,
          now,
        ],
      );
      return { changed: true, value: undefined };
    },
  });

  if (dueDate) {
    await syncReminderSafely({ id, title: input.title, dueDate, completedAt: null });
  }

  return id;
}

type RecurringInstanceInput = {
  title: string;
  notes: string | null;
  priority: TodoPriority;
  recurrenceId: string;
  dueDate: string;
};

export async function createRecurringInstance(input: RecurringInstanceInput): Promise<void> {
  await createRecurringInstances([input]);
}

export async function createRecurringInstances(inputs: RecurringInstanceInput[]): Promise<void> {
  if (inputs.length === 0) return;

  // Direct INSERT path bypassing addTodo: uphold the same write contract so a
  // corrupted template can never propagate invalid rows into the series.
  for (const input of inputs) {
    assertTodoWrite({ title: input.title, notes: input.notes, dueDate: input.dueDate });
  }

  const db = await getDatabase();

  // Copies inserted here are ordinary pending todos with a due date, so they
  // schedule their own device reminder below (F2), exactly like `addTodo`.
  const spawned: TodoReminderSnapshot[] = [];

  // One transaction for the whole batch: the MAX(sort_order) baseline is read
  // inside it and each insert takes the next slot, so a concurrent manual add
  // or a parallel batch can never interleave between reads and inserts (F9).
  await runBackupMutation<number>({
    db,
    mutate: async (transactionDb, enqueue) => {
      const maxRow = await transactionDb.getFirstAsync<{ maxOrder: number }>(
        `SELECT COALESCE(MAX(sort_order), 0) AS maxOrder
         FROM todos WHERE deleted_at IS NULL AND completed = 0`,
      );
      const firstSortOrder = (maxRow?.maxOrder ?? 0) + 1;
      let inserted = 0;
      for (const [index, input] of inputs.entries()) {
        const id = createId('todo');
        const now = nowIso();
        const result = await transactionDb.runAsync(
          `INSERT INTO todos
             (id, title, notes, completed, completed_at, due_date, priority,
              sort_order, recurrence, recurrence_id,
              created_at, updated_at, deleted_at)
           SELECT ?, ?, ?, 0, NULL, ?, ?, ?, 'daily', ?, ?, ?, NULL
           WHERE NOT EXISTS (
             SELECT 1
             FROM todos
             WHERE recurrence_id = ?
               AND due_date = ?
               AND deleted_at IS NULL
           )`,
          [
            id,
            input.title,
            input.notes,
            input.dueDate,
            input.priority,
            firstSortOrder + index,
            input.recurrenceId,
            now,
            now,
            input.recurrenceId,
            input.dueDate,
          ],
        );
        if (result.changes === 1) {
          inserted += 1;
          spawned.push({ id, title: input.title, dueDate: input.dueDate, completedAt: null });
          enqueue({ entity: 'todos', id, updatedAt: now, operation: 'create' });
        }
      }
      return { changed: inserted > 0, value: inserted };
    },
  });

  // F2: the spawn used to skip the reminder sync, so the next day's copy had no
  // device reminder until the next bootstrap/foreground reconcile. Best-effort:
  // a scheduler failure must never fail the spawn (the row and outbox intent are
  // already committed).
  for (const copy of spawned) {
    await syncReminderSafely(copy);
  }
}

export async function getRecurringTodosByIds(recurrenceIds: string[]): Promise<Todo[]> {
  if (recurrenceIds.length === 0) return [];
  const db = await getDatabase();

  // Single query instead of one SELECT per id; newest todo per series wins.
  const placeholders = recurrenceIds.map(() => '?').join(', ');
  const rows = await db.getAllAsync<Todo>(
    `SELECT *
     FROM todos
     WHERE recurrence_id IN (${placeholders})
       AND deleted_at IS NULL
     ORDER BY created_at DESC`,
    recurrenceIds,
  );

  const newestBySeries = new Map<string, Todo>();
  for (const row of rows) {
    if (row.recurrence_id && !newestBySeries.has(row.recurrence_id)) {
      newestBySeries.set(row.recurrence_id, row);
    }
  }
  return [...newestBySeries.values()];
}

export async function listAllActiveTodosForRecurrence(): Promise<
  Pick<Todo, 'recurrence_id' | 'recurrence' | 'due_date' | 'completed' | 'deleted_at'>[]
> {
  const db = await getDatabase();
  return db.getAllAsync(
    `SELECT recurrence_id, recurrence, due_date, completed, deleted_at
     FROM todos
     WHERE deleted_at IS NULL`,
  );
}

export async function updateTodoOrder(orderedIds: string[]): Promise<void> {
  if (orderedIds.length === 0) return;
  const db = await getDatabase();
  const now = nowIso();
  // One transaction per drag: absolute sort_order values keep retries safe,
  // and batching avoids N separate transactions/outbox records per reorder,
  // which is measurably cheaper on web OPFS (F10).
  await runBackupMutation<number>({
    db,
    mutate: async (transactionDb, enqueue) => {
      let changed = 0;
      for (let i = 0; i < orderedIds.length; i++) {
        const result = await transactionDb.runAsync(
          `UPDATE todos SET sort_order = ?, updated_at = ?
           WHERE id = ?
             AND deleted_at IS NULL`,
          [i + 1, now, orderedIds[i]],
        );
        if (result.changes === 1) {
          changed += 1;
          enqueue({ entity: 'todos', id: orderedIds[i], updatedAt: now, operation: 'update' });
        }
      }
      return { changed: changed > 0, value: changed };
    },
  });
}

type TodoAssociationInput = { projectId?: string | null; goalId?: string | null };

type TodoAssociationResolution = {
  nextProjectId: string | null;
  nextGoalId: string | null;
};

/**
 * Resolve the next project_id/goal_id pair for a Todo against the H9
 * association invariants. Shared by single edits and bulk assignment so both
 * inherit identical rules:
 * - A non-null projectId/goalId MUST reference an existing, non-deleted
 *   parent; otherwise the resolver throws a clear error (no dangling refs).
 * - Assigning a Goal auto-aligns project_id to that Goal's project_id when
 *   the Goal belongs to a Project; an explicit projectId is overridden by the
 *   goal here.
 * - F12: explicitly clearing the project also clears a remaining Goal that
 *   itself belongs to a Project — such a Goal pins the Todo to its Project,
 *   so keeping it would leave `project_id = NULL` while violating the
 *   alignment invariant. A Goal without a Project imposes no alignment and is
 *   kept.
 */
async function resolveTodoProjectGoalAssociation(
  transactionDb: SQLite.SQLiteDatabase,
  current: Pick<Todo, 'project_id' | 'goal_id'>,
  association: TodoAssociationInput,
): Promise<TodoAssociationResolution> {
  // `AUD-SH12-A/B`: one shared contract for every entrypoint. The parent lookups
  // run INSIDE the caller's transaction, so validation and the write share one
  // unit of work and a refusal leaves nothing behind.
  return resolveProjectGoalAssociation(
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
}

/**
 * Reconcile the device-local due-date reminder after a committed Todo edit
 * (`AUD-SH14-B`).
 *
 * `updateTodo` scheduled or cancelled the reminder from its post-commit row read.
 * When the row edit moved into the composed path (`updateTodoWithLinkedActionRules`)
 * that side effect was dropped, so a changed due date committed without ever
 * scheduling — or cancelling — the reminder. This runs the identical
 * reconciliation for BOTH write paths, so the composed save cannot lose it.
 *
 * @param todoId the edited todo
 */
async function reconcileTodoReminder(todoId: string): Promise<void> {
  const db = await getDatabase();
  // Re-read the row so the reminder reflects the final title/due/completed state.
  const updated = await db.getFirstAsync<{
    title: string;
    due_date: string | null;
    completed: 0 | 1;
  }>(`SELECT title, due_date, completed FROM todos WHERE id = ? AND deleted_at IS NULL`, [todoId]);
  if (!updated) return;
  if (updated.completed === 1) {
    await cancelTodoReminderSafely(todoId);
  } else if (updated.due_date) {
    await syncReminderSafely({ id: todoId, title: updated.title, dueDate: updated.due_date });
  } else {
    await cancelTodoReminderSafely(todoId);
  }
}

/**
 * The transaction-aware body of `updateTodo` (extracted for `AUD-SH14-B`).
 *
 * A composed save (parent edit + rule replacement) must run BOTH writes inside
 * ONE transaction. Extracting the row-edit logic here — rather than nesting a
 * top-level `runSyncedMutation` inside another — is what makes that possible
 * without a nested-transaction deadlock on the single SQLite connection.
 *
 * @param transactionDb the caller's open transaction
 * @param id the Todo to edit
 * @param updates the same shape `updateTodo` accepts
 * @param now the mutation timestamp
 */
async function updateTodoWithinTransaction(
  transactionDb: Awaited<ReturnType<typeof getDatabase>>,
  id: string,
  updates: {
    title?: string;
    notes?: string;
    dueDate?: string | null;
    priority?: TodoPriority;
    projectId?: string | null;
    goalId?: string | null;
    recurrence?: TodoRecurrence;
  },
  now: string,
): Promise<{ changed: boolean; value: undefined }> {
  const fields: string[] = ['updated_at = ?'];
  const values: (string | null)[] = [now];

  if (updates.title !== undefined) {
    fields.push('title = ?');
    values.push(updates.title);
  }
  if (updates.notes !== undefined) {
    fields.push('notes = ?');
    values.push(updates.notes);
  }
  if (updates.dueDate !== undefined) {
    fields.push('due_date = ?');
    values.push(updates.dueDate);
  }
  if (updates.priority !== undefined) {
    fields.push('priority = ?');
    values.push(updates.priority);
  }

  const current = await transactionDb.getFirstAsync<
    Pick<Todo, 'project_id' | 'goal_id' | 'recurrence' | 'recurrence_id' | 'due_date'>
  >(
    `SELECT project_id, goal_id, recurrence, recurrence_id, due_date
     FROM todos WHERE id = ? AND deleted_at IS NULL`,
    [id],
  );
  if (!current) {
    return { changed: false, value: undefined };
  }

  // Restart: starting recurrence on a non-recurring task begins a NEW series
  // chain (fresh recurrence id); stopped chains stay ended.
  if (updates.recurrence === 'daily' && current.recurrence !== 'daily') {
    fields.push('recurrence = ?', 'recurrence_id = ?');
    values.push('daily', createId('rec'));
    if (updates.dueDate === undefined && current.due_date === null) {
      fields.push('due_date = ?');
      values.push(toDateKey());
    }
  }

  // H9: validate and reconcile project/goal associations via the shared
  // resolver (includes the F12 clear-project/goal-alignment rule).
  const resolution = await resolveTodoProjectGoalAssociation(transactionDb, current, updates);

  if (updates.projectId !== undefined || resolution.nextProjectId !== current.project_id) {
    fields.push('project_id = ?');
    values.push(resolution.nextProjectId);
  }
  if (updates.goalId !== undefined || resolution.nextGoalId !== current.goal_id) {
    fields.push('goal_id = ?');
    values.push(resolution.nextGoalId);
  }

  const result = await transactionDb.runAsync(
    `UPDATE todos SET ${fields.join(', ')}
     WHERE id = ?
       AND deleted_at IS NULL`,
    [...values, id],
  );
  return { changed: result.changes === 1, value: undefined };
}

export async function updateTodo(
  id: string,
  updates: {
    title?: string;
    notes?: string;
    dueDate?: string | null;
    priority?: TodoPriority;
    projectId?: string | null;
    goalId?: string | null;
    /**
     * Only STARTS a daily series (fresh recurrence id — a restart never
     * reattaches to a stopped chain). Clearing recurrence is deliberately
     * NOT supported here: ending a series is `stopRecurringSeries` so the
     * whole series transitions atomically instead of leaving one stray
     * 'daily' row that rollover would respawn.
     */
    recurrence?: TodoRecurrence;
  },
): Promise<void> {
  // Data-layer hard reject on the fields being changed (same messages as UI).
  assertTodoPartialUpdate({
    title: updates.title,
    notes: updates.notes,
    dueDate: updates.dueDate,
  });
  const db = await getDatabase();
  const now = nowIso();

  await runSyncedMutation({
    db,
    record: { entity: 'todos', id, updatedAt: now, operation: 'update' },
    mutate: async (transactionDb) => updateTodoWithinTransaction(transactionDb, id, updates, now),
  });

  // Re-read the row so the reminder reflects the final title/due/completed state.
  await reconcileTodoReminder(id);
}

/**
 * Applies a template edit to the remaining life of a daily series: every live
 * (non-deleted, non-completed) instance sharing the recurrence id receives the
 * field changes, so subsequently spawned copies (which are copied from the
 * active instance) inherit them too. Completed history rows are NEVER
 * rewritten. One durable update intent is enqueued per touched row.
 */
export async function updateRecurringSeriesTemplate(
  recurrenceId: string,
  updates: { title?: string; notes?: string | null; priority?: TodoPriority },
): Promise<void> {
  // Series-template edits fan out to every live instance: uphold the same
  // write contract (null notes = explicit clear, always valid).
  assertTodoPartialUpdate({ title: updates.title, notes: updates.notes ?? undefined });
  const db = await getDatabase();
  const now = nowIso();

  const fields: string[] = ['updated_at = ?'];
  const values: (string | null)[] = [now];
  if (updates.title !== undefined) {
    fields.push('title = ?');
    values.push(updates.title);
  }
  if (updates.notes !== undefined) {
    fields.push('notes = ?');
    values.push(updates.notes);
  }
  if (updates.priority !== undefined) {
    fields.push('priority = ?');
    values.push(updates.priority);
  }

  const outcome = await runBackupMutation<void>({
    db,
    mutate: async (transactionDb, enqueue) => {
      const targets = await transactionDb.getAllAsync<{ id: string }>(
        `SELECT id FROM todos
         WHERE recurrence_id = ? AND completed = 0 AND deleted_at IS NULL`,
        [recurrenceId],
      );
      if (targets.length === 0) {
        return { changed: false, value: undefined };
      }
      for (const target of targets) {
        await transactionDb.runAsync(`UPDATE todos SET ${fields.join(', ')} WHERE id = ?`, [
          ...values,
          target.id,
        ]);
        enqueue({ entity: 'todos', id: target.id, updatedAt: now, operation: 'update' });
      }
      return { changed: true, value: undefined };
    },
  });

  if (outcome.changed) {
    const refreshed = await db.getAllAsync<{ id: string; title: string; due_date: string }>(
      `SELECT id, title, due_date FROM todos
       WHERE recurrence_id = ? AND completed = 0 AND deleted_at IS NULL AND due_date IS NOT NULL`,
      [recurrenceId],
    );
    for (const row of refreshed) {
      await syncReminderSafely({ id: row.id, title: row.title, dueDate: row.due_date });
    }
  }
}

/**
 * Ends a daily series permanently:
 * - clears the recurrence marker on EVERY row of the series (pending,
 *   completed, and already soft-deleted). The day-rollover scan keys on any
 *   'daily' row of a recurrence id regardless of completion or deletion, so
 *   a surviving marker anywhere would resurrect the series.
 * - soft-deletes pending copies due after today (completed history and
 *   today's copy stay visible).
 * Durable intents mirror `removeTodo` ('delete' for freshly soft-deleted
 * future copies, 'update' for other rows whose state changed locally).
 */
export async function stopRecurringSeries(recurrenceId: string): Promise<void> {
  const db = await getDatabase();
  const now = nowIso();
  const todayKey = toDateKey();

  const outcome = await runBackupMutation<void>({
    db,
    mutate: async (transactionDb, enqueue) => {
      const members = await transactionDb.getAllAsync<{
        id: string;
        completed: 0 | 1;
        deleted_at: string | null;
        due_date: string | null;
      }>(`SELECT id, completed, deleted_at, due_date FROM todos WHERE recurrence_id = ?`, [
        recurrenceId,
      ]);
      if (members.length === 0) {
        return { changed: false, value: undefined };
      }
      for (const member of members) {
        if (member.deleted_at !== null) {
          // Already deleted locally and remotely; the recurrence marker is a
          // canonical backup column, so clearing it MUST bump updated_at and
          // re-push — otherwise the next manifest certifies a tombstone the
          // remote can never match (V2 restore fails integrity_mismatch).
          await transactionDb.runAsync(
            `UPDATE todos SET recurrence = NULL, updated_at = ? WHERE id = ?`,
            [now, member.id],
          );
          enqueue({ entity: 'todos', id: member.id, updatedAt: now, operation: 'update' });
          continue;
        }
        const endsFuture =
          member.completed === 0 && member.due_date !== null && member.due_date > todayKey;
        if (endsFuture) {
          // F2: the tombstone must run through the shared dependent cleanup
          // (daily-plan top-priority prune + linked-action rules in both
          // directions) exactly like removeTodo — a direct UPDATE leaves ghost
          // plan priorities and live rules bound to the dead copy. The
          // recurrence marker is cleared in the same pass.
          await transactionDb.runAsync(`UPDATE todos SET recurrence = NULL WHERE id = ?`, [
            member.id,
          ]);
          const removed = await removeTodoWithinTransaction(transactionDb, member.id, now, enqueue);
          if (removed) {
            enqueue({ entity: 'todos', id: member.id, updatedAt: now, operation: 'delete' });
          }
        } else {
          await transactionDb.runAsync(
            `UPDATE todos SET recurrence = NULL, updated_at = ? WHERE id = ?`,
            [now, member.id],
          );
          enqueue({ entity: 'todos', id: member.id, updatedAt: now, operation: 'update' });
        }
      }
      return { changed: true, value: undefined };
    },
  });

  if (outcome.changed) {
    const cancelled = await db.getAllAsync<{ id: string }>(
      `SELECT id FROM todos
       WHERE recurrence_id = ? AND deleted_at IS NOT NULL AND deleted_at = ?`,
      [recurrenceId, now],
    );
    for (const row of cancelled) {
      await cancelTodoReminderSafely(row.id);
    }
  }
}

export async function listTodoLinkedActionRules(
  todoId: string,
): Promise<LinkedActionRuleDefinition[]> {
  return listLinkedActionRulesForSourceEntity({
    feature: 'todos',
    entityType: 'todo',
    entityId: todoId,
  });
}

/**
 * Associate (or clear, with null) a Todo with a Project and/or Goal.
 *
 * H9 association invariants (see `resolveTodoProjectGoalAssociation`):
 * - A non-null projectId/goalId MUST reference an existing, non-deleted parent;
 *   otherwise the setter throws a clear error (no dangling references).
 * - Assigning a Goal auto-aligns project_id to that Goal's project_id when the
 *   Goal belongs to a Project. If the Goal has no Project, an explicitly
 *   provided projectId is respected and otherwise the current project_id is
 *   preserved (the stricter "clear project on goal-without-project" rule is not
 *   applied for Todos).
 * - Clearing the project also clears a remaining Goal that belongs to a
 *   Project (F12), so bulk "No project" inherits the same rule.
 * - The whole change runs inside the synced-mutation transaction so it is atomic
 *   and the outbox intent stays coherent with the final row.
 */
export async function setTodoProjectGoal(
  todoId: string,
  association: TodoAssociationInput,
): Promise<void> {
  if (association.projectId === undefined && association.goalId === undefined) return;
  const db = await getDatabase();
  const now = nowIso();
  await runSyncedMutation({
    db,
    record: { entity: 'todos', id: todoId, updatedAt: now, operation: 'update' },
    mutate: async (transactionDb) => {
      const current = await transactionDb.getFirstAsync<Pick<Todo, 'project_id' | 'goal_id'>>(
        `SELECT project_id, goal_id FROM todos WHERE id = ? AND deleted_at IS NULL`,
        [todoId],
      );
      if (!current) {
        return { changed: false, value: undefined };
      }

      const resolution = await resolveTodoProjectGoalAssociation(
        transactionDb,
        current,
        association,
      );

      const result = await transactionDb.runAsync(
        `UPDATE todos SET project_id = ?, goal_id = ?, updated_at = ?
         WHERE id = ? AND deleted_at IS NULL`,
        [resolution.nextProjectId, resolution.nextGoalId, now, todoId],
      );
      return { changed: result.changes === 1, value: undefined };
    },
  });
}

/**
 * Create a Todo AND its linked-action rules in ONE transaction
 * (`AUD-SH14-A`/`B`).
 *
 * The audited defect: the editor called `addTodo` and then
 * `saveTodoLinkedActionRules` as two independent writes. A failure in the second
 * left a committed parent with no rules, and retrying the save created a SECOND
 * parent with the same title (the new identity from the first attempt was
 * discarded). An inline error alone never established idempotency.
 *
 * The composed operation validates the entire proposed rule set BEFORE any write,
 * then commits the parent row, its sort order, the association resolution and
 * every rule replacement in one transaction with their durable intents. Any
 * failure rolls all of it back, so a retry starts from an unchanged state.
 *
 * @param input everything the editor knows at submit time
 * @returns the committed Todo id (stable across a retry of a failed save)
 */
export async function addTodoWithLinkedActionRules(input: {
  title: string;
  notes?: string;
  dueDate?: string | null;
  priority?: TodoPriority;
  recurrence?: TodoRecurrence;
  projectId?: string | null;
  goalId?: string | null;
  rules: SaveLinkedActionRuleForSourceInput[];
}): Promise<string> {
  if (input.recurrence === 'daily' && input.rules.length > 0) {
    throw new Error('Recurring todos cannot be linked-action sources yet.');
  }
  const dueDate =
    input.dueDate !== undefined ? input.dueDate : input.recurrence === 'daily' ? toDateKey() : null;
  // Prevalidate the row exactly like `addTodo`, before any write exists.
  assertTodoWrite({ title: input.title, notes: input.notes, dueDate });

  const db = await getDatabase();
  const id = createId('todo');
  const now = nowIso();
  const recurrenceId = input.recurrence === 'daily' ? createId('rec') : null;

  return runSyncedMutation({
    db,
    record: { entity: 'todos', id, updatedAt: now, operation: 'create' },
    mutate: async (transactionDb, enqueue) => {
      // `AUD-SH12-A`: the composed create uses the shared association resolver
      // too, so every creation entrypoint enforces the same contract.
      const resolution = await resolveTodoProjectGoalAssociation(
        transactionDb,
        { project_id: null, goal_id: null },
        { projectId: input.projectId, goalId: input.goalId },
      );
      const maxRow = await transactionDb.getFirstAsync<{ maxOrder: number }>(
        `SELECT COALESCE(MAX(sort_order), 0) AS maxOrder
         FROM todos WHERE deleted_at IS NULL AND completed = 0`,
      );
      const sortOrder = (maxRow?.maxOrder ?? 0) + 1;
      await transactionDb.runAsync(
        `INSERT INTO todos
           (id, title, notes, completed, completed_at, due_date, priority,
            sort_order, recurrence, recurrence_id,
            project_id, goal_id,
            created_at, updated_at, deleted_at)
         VALUES (?, ?, ?, 0, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
        [
          id,
          input.title,
          input.notes ?? null,
          dueDate,
          input.priority ?? 'normal',
          sortOrder,
          input.recurrence ?? null,
          recurrenceId,
          resolution.nextProjectId,
          resolution.nextGoalId,
          now,
          now,
        ],
      );
      // The rules commit inside the SAME transaction: they receive the parent's
      // already-allocated id, so a failure anywhere rolls the parent back too.
      await replaceLinkedActionRulesForSourceEntity({
        feature: 'todos',
        entityType: 'todo',
        entityId: id,
        rules: input.rules,
        db: transactionDb,
        enqueue,
      });
      return { changed: true, value: id };
    },
  }).then(async (outcome) => {
    if (dueDate) {
      await syncReminderSafely({ id, title: input.title, dueDate, completedAt: null });
    }
    return outcome.value ?? id;
  });
}

/**
 * Update an existing Todo AND replace its linked-action rules atomically
 * (`AUD-SH14-B`). The whole-save contract: either the row edit and the complete
 * new rule set are both committed, or neither is.
 *
 * @param todoId the existing parent
 * @param updates the row changes (same shape `updateTodo` accepts)
 * @param rules the complete replacement rule set
 */
export async function updateTodoWithLinkedActionRules(
  todoId: string,
  updates: Parameters<typeof updateTodo>[1],
  rules: SaveLinkedActionRuleForSourceInput[],
): Promise<void> {
  const db = await getDatabase();
  const todo = await db.getFirstAsync<Pick<Todo, 'id' | 'recurrence' | 'deleted_at'>>(
    `SELECT id, recurrence, deleted_at FROM todos WHERE id = ?`,
    [todoId],
  );
  if (!todo) throw new Error('Todo not found.');
  if (todo.recurrence === 'daily' && rules.length > 0) {
    throw new Error('Recurring todos cannot be linked-action sources yet.');
  }
  const now = nowIso();
  await runSyncedMutation({
    db,
    record: { entity: 'todos', id: todoId, updatedAt: now, operation: 'update' },
    mutate: async (transactionDb, enqueue) => {
      const applied = await updateTodoWithinTransaction(transactionDb, todoId, updates, now);
      if (!applied.changed) return { changed: false, value: undefined };
      await replaceLinkedActionRulesForSourceEntity({
        feature: 'todos',
        entityType: 'todo',
        entityId: todoId,
        rules,
        db: transactionDb,
        enqueue,
      });
      return { changed: true, value: undefined };
    },
  });

  // AUD-SH14-B: the composed write must carry the SAME post-commit reminder
  // reconciliation as the plain `updateTodo`, or a due-date change commits
  // without ever scheduling — or cancelling — the device reminder.
  await reconcileTodoReminder(todoId);
}

export async function saveTodoLinkedActionRules(
  todoId: string,
  rules: SaveLinkedActionRuleForSourceInput[],
): Promise<void> {
  const db = await getDatabase();
  const todo = await db.getFirstAsync<Pick<Todo, 'id' | 'recurrence' | 'deleted_at'>>(
    `SELECT id, recurrence, deleted_at
     FROM todos
     WHERE id = ?`,
    [todoId],
  );

  if (!todo) {
    throw new Error('Todo not found.');
  }

  if (todo.recurrence === 'daily' && rules.length > 0) {
    throw new Error('Recurring todos cannot be linked-action sources yet.');
  }

  await replaceLinkedActionRulesForSourceEntity({
    feature: 'todos',
    entityType: 'todo',
    entityId: todoId,
    rules,
  });
}

async function setTodoCompletion(
  todoId: string,
  desiredCompletion: 0 | 1 | 'toggle',
): Promise<ToggleTodoResult> {
  const db = await getDatabase();
  const now = nowIso();
  // Durable dispatch handoff: the source event is pre-minted and persisted in
  // the SAME transaction as the completion write, then dispatched after
  // commit. A crash between the two durable boundaries leaves the event row
  // on disk for the startup recovery sweep; the engine resumes from the
  // persisted event id, so the effect is applied exactly once.
  const linkedEventId = createId('levt');
  const linkedSourceDateKey = toDateKey();
  type ToggleMutation = {
    current: Todo | null;
    previous: 0 | 1;
    next: 0 | 1;
    /** Copy retracted by this reopen (reminder cancelled after commit). */
    removedSpawnId: string | null;
  };
  const outcome = await runSyncedMutation<ToggleMutation>({
    db,
    record: { entity: 'todos', id: todoId, updatedAt: now, operation: 'update' },
    mutate: async (transactionDb, enqueue) => {
      const current = await transactionDb.getFirstAsync<Todo>(
        `SELECT *
         FROM todos
         WHERE id = ?
           AND deleted_at IS NULL`,
        [todoId],
      );
      if (!current) {
        return {
          changed: false,
          value: { current: null, previous: 0, next: 0, removedSpawnId: null },
        };
      }
      const previous = current.completed;
      const next: 0 | 1 =
        desiredCompletion === 'toggle' ? (previous === 1 ? 0 : 1) : desiredCompletion;
      if (next === previous) {
        return { changed: false, value: { current, previous, next, removedSpawnId: null } };
      }
      const completedAtValue = next === 1 ? now : null;
      const result = await transactionDb.runAsync(
        `UPDATE todos SET completed = ?, completed_at = ?, updated_at = ?
         WHERE id = ? AND completed = ? AND deleted_at IS NULL`,
        [next, completedAtValue, now, current.id, previous],
      );
      if (result.changes !== 1) {
        return {
          changed: false,
          value: { current: null, previous: 0, next: 0, removedSpawnId: null },
        };
      }
      // Reopening retracts the copy the completion spawned, in the SAME
      // transaction as the reopen (see removePristineSpawnedCopyWithinTransaction).
      const removedSpawnId =
        previous === 1 && next === 0
          ? await removePristineSpawnedCopyWithinTransaction(transactionDb, current, now, enqueue)
          : null;
      // Linked actions fire only on a genuine non-recurring 0->1 completion;
      // persist the dispatch intent atomically with the completion itself
      // (same condition as the post-commit dispatch below).
      if (previous === 0 && next === 1 && current.recurrence !== 'daily') {
        await insertLinkedActionEventInTransaction(
          transactionDb,
          buildTransactionalSourceEvent({
            eventId: linkedEventId,
            occurredAt: now,
            feature: 'todos',
            entityType: 'todo',
            entityId: current.id,
            triggerType: 'todo.completed',
            label: current.title,
            sourceDateKey: linkedSourceDateKey,
            sourceRecordId: current.id,
            origin: {
              originKind: 'user',
              originRuleId: null,
              originEventId: null,
            },
            payload: {
              previousCompleted: previous,
              currentCompleted: next,
              recurrence: current.recurrence,
            },
          }),
          now,
        );
      }
      return { changed: true, value: { current, previous, next, removedSpawnId } };
    },
  });

  if (!outcome.value.current) {
    return {
      completed: 0,
      linkedActions: EMPTY_LINKED_ACTIONS_RESULT,
      noop: true,
    };
  }

  const { current, previous, next, removedSpawnId } = outcome.value;

  // The retracted copy is gone from the database already; drop its pending
  // device reminder so a notification cannot resurrect a completed-looking row.
  if (removedSpawnId) {
    await cancelTodoReminderSafely(removedSpawnId);
  }

  // Idempotent completion is intentionally a safe no-op. This branch is used
  // by Command Center; it must never toggle a completed Todo back to pending.
  if (!outcome.changed && desiredCompletion === 1 && previous === 1) {
    return {
      completed: 1,
      linkedActions: EMPTY_LINKED_ACTIONS_RESULT,
    };
  }

  // Keep the device-local due-date reminder in sync with completion state.
  if (next === 1) {
    await cancelTodoReminderSafely(current.id);
  } else if (previous === 1 && current.due_date) {
    await syncReminderSafely({ id: current.id, title: current.title, dueDate: current.due_date });
  }

  if (next === 1 && current.recurrence === 'daily' && current.recurrence_id) {
    const spawnDueDate = nextRecurringSpawnDueDate(current.due_date);
    const existing = await db.getFirstAsync<{ id: string }>(
      `SELECT id FROM todos
       WHERE recurrence_id = ?
         AND due_date = ?
         AND deleted_at IS NULL`,
      [current.recurrence_id, spawnDueDate],
    );
    if (!existing) {
      await createRecurringInstance({
        title: current.title,
        notes: current.notes,
        priority: current.priority,
        recurrenceId: current.recurrence_id,
        dueDate: spawnDueDate,
      });
    }
  }

  if (previous !== 0 || next !== 1 || current.recurrence === 'daily') {
    return {
      completed: next,
      linkedActions: EMPTY_LINKED_ACTIONS_RESULT,
    };
  }

  const processResult = await linkedActionsEngine.processSourceAction({
    eventId: linkedEventId,
    occurredAt: now,
    feature: 'todos',
    entityType: 'todo',
    entityId: current.id,
    triggerType: 'todo.completed',
    label: current.title,
    sourceDateKey: linkedSourceDateKey,
    sourceRecordId: current.id,
    origin: {
      originKind: 'user',
      originRuleId: null,
      originEventId: null,
    },
    payload: {
      previousCompleted: previous,
      currentCompleted: next,
      recurrence: current.recurrence,
    },
  });

  return {
    completed: next,
    linkedActions: {
      matchedRuleCount: processResult.matchedRuleCount,
      notices: processResult.notices,
    },
  };
}

export async function toggleTodo(todo: Todo): Promise<ToggleTodoResult> {
  return setTodoCompletion(todo.id, 'toggle');
}

/** Complete a Todo without toggling an already-completed row back to pending. */
export async function completeTodo(todoId: string): Promise<ToggleTodoResult> {
  return setTodoCompletion(todoId, 1);
}

/** Explicitly complete or reopen a Todo (used by bulk operations). */
export async function setTodoCompletionState(
  todoId: string,
  completed: 0 | 1,
): Promise<ToggleTodoResult> {
  return setTodoCompletion(todoId, completed);
}

export type BulkTodoOutcome = {
  /** Ids whose row actually changed (and got a backup intent). */
  changed: number;
  /** Ids skipped: missing/tombstoned, or already in the desired state. */
  skipped: number;
};

type BulkCompletionRow = Pick<
  Todo,
  | 'id'
  | 'title'
  | 'notes'
  | 'priority'
  | 'completed'
  | 'due_date'
  | 'completed_at'
  | 'recurrence'
  | 'recurrence_id'
>;

/**
 * Bulk operations apply the same per-id invariants as their single-item
 * counterparts (soft delete, sync enqueue, linked-action dispatch), but commit
 * all row writes in ONE transaction so a mid-batch failure can never leave a
 * half-applied edit behind. Per-row backup intents are enqueued inside that
 * same transaction; post-commit side effects (reminders, recurring follow-ups,
 * linked-action dispatch) then run per changed item exactly like the
 * single-item path, preserving idempotent retry semantics.
 */
export async function bulkSetTodoCompletion(
  ids: string[],
  completed: 0 | 1,
): Promise<BulkTodoOutcome> {
  if (ids.length === 0) return { changed: 0, skipped: 0 };
  const db = await getDatabase();
  const now = nowIso();
  const linkedSourceDateKey = toDateKey();

  type AppliedCompletion = {
    row: BulkCompletionRow;
    previous: 0 | 1;
    linkedEventId: string;
    /** Copy retracted by this reopen (reminder cancelled after commit). */
    removedSpawnId: string | null;
  };
  const outcome = await runBackupMutation<AppliedCompletion[]>({
    db,
    mutate: async (transactionDb, enqueue) => {
      const applied: AppliedCompletion[] = [];
      for (const id of ids) {
        const current = await transactionDb.getFirstAsync<BulkCompletionRow>(
          `SELECT id, title, notes, priority, completed, due_date, completed_at, recurrence, recurrence_id
           FROM todos
           WHERE id = ?
             AND deleted_at IS NULL`,
          [id],
        );
        if (!current) continue;
        const previous = current.completed;
        // Idempotent per-item semantics: applying the desired state twice is a
        // safe no-op for that row.
        if (previous === completed) continue;
        const result = await transactionDb.runAsync(
          `UPDATE todos SET completed = ?, completed_at = ?, updated_at = ?
           WHERE id = ? AND completed = ? AND deleted_at IS NULL`,
          [completed, completed === 1 ? now : null, now, current.id, previous],
        );
        if (result.changes !== 1) continue;
        enqueue({ entity: 'todos', id: current.id, updatedAt: now, operation: 'update' });
        // Bulk reopen retracts the copy the completion spawned, exactly like the
        // single-item path (a pristine future copy is not the user's yet).
        const removedSpawnId =
          previous === 1 && completed === 0
            ? await removePristineSpawnedCopyWithinTransaction(transactionDb, current, now, enqueue)
            : null;
        // Durable dispatch handoff (same contract as setTodoCompletion): a
        // genuine non-recurring 0->1 completion persists its source event in
        // this transaction, so a post-commit crash is recoverable.
        let linkedEventId: string | null = null;
        if (previous === 0 && completed === 1 && current.recurrence !== 'daily') {
          linkedEventId = createId('levt');
          await insertLinkedActionEventInTransaction(
            transactionDb,
            buildTransactionalSourceEvent({
              eventId: linkedEventId,
              occurredAt: now,
              feature: 'todos',
              entityType: 'todo',
              entityId: current.id,
              triggerType: 'todo.completed',
              label: current.title,
              sourceDateKey: linkedSourceDateKey,
              sourceRecordId: current.id,
              origin: {
                originKind: 'user',
                originRuleId: null,
                originEventId: null,
              },
              payload: {
                previousCompleted: previous,
                currentCompleted: completed,
                recurrence: current.recurrence,
              },
            }),
            now,
          );
        }
        applied.push({
          row: current,
          previous,
          linkedEventId: linkedEventId ?? '',
          removedSpawnId,
        });
      }
      return { changed: applied.length > 0, value: applied };
    },
  });

  // Post-commit side effects, identical to setTodoCompletion's per-item path.
  for (const { row, previous, linkedEventId, removedSpawnId } of outcome.value) {
    const next = completed;
    if (removedSpawnId) {
      await cancelTodoReminderSafely(removedSpawnId);
    }
    if (next === 1) {
      await cancelTodoReminderSafely(row.id);
    } else if (previous === 1 && row.due_date) {
      await syncReminderSafely({ id: row.id, title: row.title, dueDate: row.due_date });
    }

    if (next === 1 && row.recurrence === 'daily' && row.recurrence_id) {
      const spawnDueDate = nextRecurringSpawnDueDate(row.due_date);
      const existing = await db.getFirstAsync<{ id: string }>(
        `SELECT id FROM todos
         WHERE recurrence_id = ?
           AND due_date = ?
           AND deleted_at IS NULL`,
        [row.recurrence_id, spawnDueDate],
      );
      if (!existing) {
        await createRecurringInstance({
          title: row.title,
          notes: row.notes,
          priority: row.priority,
          recurrenceId: row.recurrence_id,
          dueDate: spawnDueDate,
        });
      }
    }

    // Linked actions fire only on a genuine non-recurring 0->1 completion,
    // exactly like setTodoCompletion; the per-item event id was persisted in
    // the source transaction.
    if (!(previous === 0 && next === 1 && row.recurrence !== 'daily')) continue;
    if (!linkedEventId) continue;

    await linkedActionsEngine.processSourceAction({
      eventId: linkedEventId,
      occurredAt: now,
      feature: 'todos',
      entityType: 'todo',
      entityId: row.id,
      triggerType: 'todo.completed',
      label: row.title,
      sourceDateKey: linkedSourceDateKey,
      sourceRecordId: row.id,
      origin: {
        originKind: 'user',
        originRuleId: null,
        originEventId: null,
      },
      payload: {
        previousCompleted: previous,
        currentCompleted: next,
        recurrence: row.recurrence,
      },
    });
  }

  return {
    changed: outcome.value.length,
    skipped: ids.length - outcome.value.length,
  };
}

export async function bulkUpdateTodoPriority(
  ids: string[],
  priority: TodoPriority,
): Promise<BulkTodoOutcome> {
  if (ids.length === 0) return { changed: 0, skipped: 0 };
  const db = await getDatabase();
  const now = nowIso();
  const outcome = await runBackupMutation<number>({
    db,
    mutate: async (transactionDb, enqueue) => {
      let changed = 0;
      for (const id of ids) {
        // Rows already at the target priority are skipped without rewriting
        // updated_at or re-enqueueing a redundant backup intent.
        const result = await transactionDb.runAsync(
          `UPDATE todos SET priority = ?, updated_at = ?
           WHERE id = ? AND priority != ? AND deleted_at IS NULL`,
          [priority, now, id, priority],
        );
        if (result.changes !== 1) continue;
        enqueue({ entity: 'todos', id, updatedAt: now, operation: 'update' });
        changed += 1;
      }
      return { changed: changed > 0, value: changed };
    },
  });
  return { changed: outcome.value, skipped: ids.length - outcome.value };
}

export async function bulkAssignTodosProject(
  ids: string[],
  projectId: string | null,
): Promise<BulkTodoOutcome> {
  if (ids.length === 0) return { changed: 0, skipped: 0 };
  const db = await getDatabase();
  const now = nowIso();
  const outcome = await runBackupMutation<number>({
    db,
    mutate: async (transactionDb, enqueue) => {
      let changed = 0;
      for (const id of ids) {
        const current = await transactionDb.getFirstAsync<Pick<Todo, 'project_id' | 'goal_id'>>(
          `SELECT project_id, goal_id FROM todos WHERE id = ? AND deleted_at IS NULL`,
          [id],
        );
        if (!current) continue;
        // Shared resolver so bulk inherits the exact single-edit rules,
        // including the F12 clear-project/goal-alignment behavior.
        const resolution = await resolveTodoProjectGoalAssociation(transactionDb, current, {
          projectId,
        });
        if (
          resolution.nextProjectId === current.project_id &&
          resolution.nextGoalId === current.goal_id
        ) {
          continue;
        }
        const result = await transactionDb.runAsync(
          `UPDATE todos SET project_id = ?, goal_id = ?, updated_at = ?
           WHERE id = ? AND deleted_at IS NULL`,
          [resolution.nextProjectId, resolution.nextGoalId, now, id],
        );
        if (result.changes !== 1) continue;
        enqueue({ entity: 'todos', id, updatedAt: now, operation: 'update' });
        changed += 1;
      }
      return { changed: changed > 0, value: changed };
    },
  });
  return { changed: outcome.value, skipped: ids.length - outcome.value };
}

/**
 * Tombstone one todo plus its dependents inside an open transaction. Returns
 * whether the row existed and was tombstoned by this call.
 */
async function removeTodoWithinTransaction(
  transactionDb: SQLite.SQLiteDatabase,
  id: string,
  now: string,
  enqueue: (record: SyncRecord) => void,
): Promise<boolean> {
  const tombstone = await transactionDb.runAsync(
    'UPDATE todos SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL',
    [now, now, id],
  );
  if (tombstone.changes === 0) return false;

  await replaceLinkedActionRulesForSourceEntity({
    feature: 'todos',
    entityType: 'todo',
    entityId: id,
    rules: [],
    db: transactionDb,
    enqueue,
  });
  await deleteLinkedActionRulesForTargetEntity({
    feature: 'todos',
    entityType: 'todo',
    entityId: id,
    deletedAt: now,
    db: transactionDb,
    enqueue,
  });

  // F11: prune the removed id from any daily plan's top_todo_ids inside the
  // same transaction. daily_plans is a synced entity, so each touched plan
  // gets its own update intent; plans without the id are left untouched.
  const plans = await transactionDb.getAllAsync<{
    id: string;
    top_todo_ids: string;
    top_todo_titles: string | null;
  }>(
    `SELECT id, top_todo_ids, top_todo_titles FROM daily_plans
     WHERE deleted_at IS NULL AND top_todo_ids LIKE ?`,
    [`%"${id}"%`],
  );
  for (const plan of plans) {
    const topTodoIds = parseTopTodoIds(plan.top_todo_ids);
    if (!topTodoIds.includes(id)) continue;
    // The ids and titles arrays are index-aligned (parseTopTodoTitles
    // contract): removing the id must remove its title slot too, or every
    // later priority renders the previous item's title. A missing slot
    // snapshots as '' (the documented "no snapshot" marker).
    const topTodoTitles = parseTopTodoTitles(plan.top_todo_titles);
    const kept = topTodoIds
      .map((todoId, index) => ({ todoId, title: topTodoTitles[index] ?? '' }))
      .filter((entry) => entry.todoId !== id);
    await transactionDb.runAsync(
      `UPDATE daily_plans SET top_todo_ids = ?, top_todo_titles = ?, updated_at = ? WHERE id = ?`,
      [
        serializeTopTodoIds(kept.map((entry) => entry.todoId)),
        JSON.stringify(kept.map((entry) => entry.title)),
        now,
        plan.id,
      ],
    );
    enqueue({ entity: 'daily_plans', id: plan.id, updatedAt: now, operation: 'update' });
  }

  return true;
}

export async function bulkRemoveTodos(ids: string[]): Promise<BulkTodoOutcome> {
  if (ids.length === 0) return { changed: 0, skipped: 0 };
  const db = await getDatabase();
  const now = nowIso();
  const outcome = await runBackupMutation<string[]>({
    db,
    mutate: async (transactionDb, enqueue) => {
      const removedIds: string[] = [];
      for (const id of ids) {
        const removed = await removeTodoWithinTransaction(transactionDb, id, now, enqueue);
        if (!removed) continue;
        // The tombstone itself must ride the durable outbox exactly like
        // removeTodo's runSyncedMutation record: without it the remote copy
        // (and any restore) resurrects a bulk-deleted todo.
        enqueue({ entity: 'todos', id, updatedAt: now, operation: 'delete' });
        removedIds.push(id);
      }
      return { changed: removedIds.length > 0, value: removedIds };
    },
  });
  for (const id of outcome.value) {
    await cancelTodoReminderSafely(id);
  }
  return { changed: outcome.value.length, skipped: ids.length - outcome.value.length };
}

export async function removeTodo(id: string): Promise<void> {
  const db = await getDatabase();
  const now = nowIso();
  const result = await runSyncedMutation({
    db,
    record: { entity: 'todos', id, updatedAt: now, operation: 'delete' },
    mutate: async (transactionDb, enqueue) => {
      const removed = await removeTodoWithinTransaction(transactionDb, id, now, enqueue);
      return { changed: removed, value: undefined };
    },
  });
  if (!result.changed) return;

  await cancelTodoReminderSafely(id);
}

export async function completeTodoFromLinkedAction(
  todoId: string,
): Promise<LinkedActionEffectAdapterResult> {
  const db = await getDatabase();
  const todo = await db.getFirstAsync<Pick<Todo, 'id' | 'title' | 'completed' | 'deleted_at'>>(
    `SELECT id, title, completed, deleted_at
     FROM todos
     WHERE id = ?`,
    [todoId],
  );

  if (!todo || todo.deleted_at !== null) {
    return { status: 'skipped', reason: 'target_missing' };
  }

  if (todo.completed === 1) {
    return {
      status: 'skipped',
      reason: 'already_completed',
      targetLabel: todo.title,
    };
  }

  const now = nowIso();
  const outcome = await runSyncedMutation({
    db,
    record: { entity: 'todos', id: todoId, updatedAt: now, operation: 'update' },
    mutate: async (transactionDb) => {
      const result = await transactionDb.runAsync(
        `UPDATE todos
         SET completed = 1, completed_at = ?, updated_at = ?
         WHERE id = ?
           AND completed = 0
           AND deleted_at IS NULL`,
        [now, now, todoId],
      );
      return { changed: result.changes === 1, value: undefined };
    },
  });

  if (!outcome.changed) {
    return {
      status: 'skipped',
      reason: 'already_completed',
      targetLabel: todo.title,
    };
  }

  return {
    status: 'applied',
    targetLabel: todo.title,
  };
}

export async function applyRemoteTodos(
  db: Awaited<ReturnType<typeof getDatabase>>,
  rows: Todo[],
): Promise<void> {
  for (const row of rows) {
    // SAFETY: backup payloads are version-tagged and may predate later-scope
    // columns; reading the optional fields is the documented restore contract
    // (a missing key restores as null), and `row` is the declared Todo shape.
    const legacy = row as unknown as {
      completed_at?: string | null;
      project_id?: string | null;
      goal_id?: string | null;
    };
    await db.runAsync(
      `INSERT OR REPLACE INTO todos (
         id,
         title,
         notes,
         completed,
         completed_at,
         due_date,
         priority,
         sort_order,
         recurrence,
         recurrence_id,
         created_at,
         updated_at,
         deleted_at,
         project_id,
         goal_id
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        row.id,
        row.title,
        row.notes,
        row.completed,
        legacy.completed_at ?? null,
        row.due_date,
        row.priority,
        row.sort_order,
        row.recurrence,
        row.recurrence_id,
        row.created_at,
        row.updated_at,
        row.deleted_at,
        // Planning links joined the recoverable scope in V4; legacy rows omit
        // them and restore as unassigned.
        legacy.project_id ?? null,
        legacy.goal_id ?? null,
      ],
    );
  }
}
