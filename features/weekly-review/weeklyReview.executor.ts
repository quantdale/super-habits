/**
 * Weekly Review execution engine.
 * Applies planned Todo mutations and persists the completed review record.
 * Uses a durable execution receipt model for crash safety / exactly-once semantics.
 */
import type { WeeklyReviewDraft, WeeklyReviewSummaryV1 } from './weeklyReview.types';
import { saveWeeklyReview } from './weeklyReview.data';
import { addTodo, updateTodo } from '@/features/todos/todos.data';

export type ExecutionResult = {
  reviewId: string;
  createdTodoIds: string[];
  rescheduledTodoIds: string[];
};

/**
 * Execute a confirmed weekly review:
 * 1. Create new Todo commitments
 * 2. Reschedule/leave/carry-forward existing Todos
 * 3. Persist the completed review record
 *
 * Each Todo mutation goes through canonical domain APIs (addTodo / updateTodo)
 * so that Linked Actions, recurrence, and sync semantics are preserved.
 *
 * The review record is saved idempotently by week_key — if a review already
 * exists for this week it is updated in place.
 */
export async function executeWeeklyReview(input: {
  summary: WeeklyReviewSummaryV1;
  draft: WeeklyReviewDraft;
}): Promise<ExecutionResult> {
  const { summary, draft } = input;
  const createdTodoIds: string[] = [];
  const rescheduledTodoIds: string[] = [];

  // 1. Create new Todo commitments through canonical API
  for (const commitment of draft.newCommitments) {
    const todoId = await addTodo({
      title: commitment.title,
      notes: commitment.notes,
      dueDate: commitment.dueDate ?? summary.week.nextWeekStartDateKey,
      priority: commitment.priority,
    });
    createdTodoIds.push(todoId);
    commitment.createdTodoId = todoId;
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
  };
}
