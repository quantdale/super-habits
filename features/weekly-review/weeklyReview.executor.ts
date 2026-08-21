/**
 * Weekly Review execution engine.
 * Applies planned Todo mutations and persists the completed review record.
 *
 * Idempotency (best-effort receipt model): Todo creation is guarded per
 * commitment. Before creating, the executor resolves a previously created Todo
 * id from (a) the in-memory draft (`createdTodoId`, set by an earlier attempt
 * in this session) or (b) the prior review's persisted plan_payload for the
 * same week, and skips creation when that Todo still exists non-deleted. So a
 * retry after a partial failure — or re-confirming an already-saved week —
 * never duplicates commitments. Reschedule/carry-forward decisions are
 * naturally idempotent (re-setting the same due date is a no-op).
 *
 * Each Todo mutation still goes through canonical domain APIs (addTodo /
 * updateTodo) so that Linked Actions, recurrence, and sync semantics are
 * preserved. The review record itself is saved idempotently by week_key.
 */
import type { WeeklyReviewDraft, WeeklyReviewSummaryV1 } from './weeklyReview.types';
import { getWeeklyReviewByWeekKey, saveWeeklyReview } from './weeklyReview.data';
import { parsePlanPayload } from './weeklyReview.domain';
import { addTodo, updateTodo, listTodos } from '@/features/todos/todos.data';

export type CommitmentOutcomeStatus = 'created' | 'already_exists' | 'failed';

export type CommitmentOutcome = {
  commitmentId: string;
  title: string;
  status: CommitmentOutcomeStatus;
  /** Todo id created by this attempt or resolved from a prior attempt. */
  todoId?: string;
  error?: string;
};

export type ExecutionResult = {
  reviewId: string;
  createdTodoIds: string[];
  rescheduledTodoIds: string[];
  /** Per-commitment outcome record for the new-commitments loop. */
  commitmentOutcomes: CommitmentOutcome[];
};

/**
 * Execute a confirmed weekly review:
 * 1. Create new Todo commitments (idempotently — see module docstring)
 * 2. Reschedule/leave/carry-forward existing Todos
 * 3. Persist the completed review record (the durable receipt: its
 *    plan_payload records each commitment's createdTodoId for future retries)
 *
 * Item-level creation failures do not abort the run: remaining commitments are
 * still processed and the review is still saved so the receipts recorded in
 * plan_payload cover everything created so far. Check `commitmentOutcomes` for
 * per-item results.
 */
export async function executeWeeklyReview(input: {
  summary: WeeklyReviewSummaryV1;
  draft: WeeklyReviewDraft;
}): Promise<ExecutionResult> {
  const { summary, draft } = input;
  const createdTodoIds: string[] = [];
  const rescheduledTodoIds: string[] = [];
  const commitmentOutcomes: CommitmentOutcome[] = [];

  // Resolve receipt ids recorded by a prior execution of the same week.
  const priorReview = await getWeeklyReviewByWeekKey(summary.week.weekKey);
  const priorCommitments = priorReview
    ? (parsePlanPayload(priorReview.plan_payload)?.newCommitments ?? [])
    : [];

  // One bounded read for existence checks; listTodos excludes soft-deleted rows,
  // so a deleted receipt target is correctly re-created rather than skipped.
  const liveTodoIds = new Set((await listTodos()).map((t) => t.id));

  // 1. Create new Todo commitments through canonical API, skipping commitments
  // whose Todo already exists from an earlier attempt.
  for (const commitment of draft.newCommitments) {
    const resolvedId =
      commitment.createdTodoId ??
      priorCommitments.find((c) => c.id === commitment.id)?.createdTodoId;

    if (resolvedId && liveTodoIds.has(resolvedId)) {
      commitment.createdTodoId = resolvedId;
      commitmentOutcomes.push({
        commitmentId: commitment.id,
        title: commitment.title,
        status: 'already_exists',
        todoId: resolvedId,
      });
      continue;
    }

    try {
      const todoId = await addTodo({
        title: commitment.title,
        notes: commitment.notes,
        dueDate: commitment.dueDate ?? summary.week.nextWeekStartDateKey,
        priority: commitment.priority,
      });
      createdTodoIds.push(todoId);
      commitment.createdTodoId = todoId;
      commitmentOutcomes.push({
        commitmentId: commitment.id,
        title: commitment.title,
        status: 'created',
        todoId,
      });
    } catch (e) {
      commitmentOutcomes.push({
        commitmentId: commitment.id,
        title: commitment.title,
        status: 'failed',
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  // 2. Apply Todo decisions
  for (const decision of draft.todoDecisions) {
    switch (decision.action) {
      case 'leave':
        // No mutation
        break;
      case 'reschedule':
        await updateTodo(decision.todoId, {
          dueDate: decision.dueDate,
        });
        rescheduledTodoIds.push(decision.todoId);
        break;
      case 'carry_forward':
        // Carry forward = reschedule into next week start
        await updateTodo(decision.todoId, {
          dueDate: decision.dueDate ?? summary.week.nextWeekStartDateKey,
        });
        rescheduledTodoIds.push(decision.todoId);
        break;
    }
  }

  // 3. Persist the completed review record
  const planPayload = JSON.stringify({
    priorities: draft.priorities,
    todoDecisions: draft.todoDecisions,
    newCommitments: draft.newCommitments.map((c) => ({
      id: c.id,
      title: c.title,
      notes: c.notes,
      dueDate: c.dueDate,
      priority: c.priority,
      createdTodoId: c.createdTodoId,
    })),
  });

  const reviewId = await saveWeeklyReview({
    weekKey: summary.week.weekKey,
    weekStartDate: summary.week.startDateKey,
    weekEndDate: summary.week.endDateKey,
    nextWeekStartDate: summary.week.nextWeekStartDateKey,
    summaryPayload: JSON.stringify(summary),
    planPayload,
    reflection: draft.reflection,
  });

  return {
    reviewId,
    createdTodoIds,
    rescheduledTodoIds,
    commitmentOutcomes,
  };
}
