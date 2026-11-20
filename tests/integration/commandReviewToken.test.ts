import { describe, expect, it } from 'vitest';
import { freshDatabase, type TestDatabase } from './helpers/db';
import type { DraftCompleteTodo } from '@/features/command/types';

/**
 * Editing a REVIEWED draft must mint a new execution token.
 *
 * `prepareCommandReview` preserves the draft's `executionToken` so repeated
 * confirmation of the SAME review is refused by the process-memory guard. The
 * Command Center keeps that draft on screen after a successful save (the
 * editable fields stay interactive in `DraftPreview`), and editing one of them
 * clears the success state and re-renders "Confirm and save" — with the
 * ORIGINAL, already-claimed token. The next confirmation is therefore refused
 * as `duplicate: This command has already been submitted.`, the success card
 * (and its only "New command" escape) is gone, and the edited command can never
 * be saved from that draft.
 *
 * The guard's contract is per reviewed COMMAND, so an edited command is a new
 * one and must get a new token; the same unchanged draft must still be refused
 * a second time (the negative control below).
 */

function completeTodoDraft(todoTitle: string): DraftCompleteTodo {
  return {
    kind: 'complete_todo',
    rawText: `complete ${todoTitle}`,
    parserKind: 'mock_rules',
    parserVersion: 'v2',
    confidence: 0.9,
    status: 'ready',
    warnings: [],
    missingFields: [],
    fields: { todoTitle },
  };
}

async function close(db: TestDatabase): Promise<void> {
  await db.closeAsync();
}

describe('command review execution token across an edit', () => {
  it('a token-preserving re-review of the EDITED draft is refused as a duplicate', async () => {
    const db = await freshDatabase();
    try {
      const review = await import('@/features/command/command.review');
      const executor = await import('@/features/command/command.executor');
      const todos = await import('@/features/todos/todos.data');

      const first = await todos.addTodo({ title: 'Buy groceries' });
      const second = await todos.addTodo({ title: 'Pay rent' });

      const initial = await review.prepareCommandReview(completeTodoDraft('Buy groceries'), {
        now: new Date(),
      });
      expect(initial.resolvedEntityId).toBe(first);

      const saved = await executor.executeDraftAction(initial.draft, {
        executionToken: initial.executionToken,
        resolvedEntityId: initial.resolvedEntityId,
      });
      expect(saved).toMatchObject({ outcome: 'success', kind: 'complete_todo' });

      // The user edits the field after the save: same draft object, new value.
      const reviewedDraft = initial.draft as DraftCompleteTodo;
      const edited: DraftCompleteTodo = {
        ...reviewedDraft,
        fields: { todoTitle: 'Pay rent' },
      };
      const reReview = await review.prepareCommandReview(edited, { now: new Date() });
      expect(reReview.status).toBe('ready');
      expect(reReview.resolvedEntityId).toBe(second);
      expect(reReview.executionToken).toBe(initial.executionToken);

      const refused = await executor.executeDraftAction(reReview.draft, {
        executionToken: reReview.executionToken,
        resolvedEntityId: reReview.resolvedEntityId,
      });
      expect(refused).toMatchObject({ outcome: 'duplicate' });
      const row = await db.getFirstAsync<{ completed: number }>(
        'SELECT completed FROM todos WHERE id = ?',
        [second],
      );
      expect(row).toEqual({ completed: 0 });
    } finally {
      await close(db);
    }
  });

  it('a clear token makes the edited draft saveable (production edit path)', async () => {
    const db = await freshDatabase();
    try {
      const review = await import('@/features/command/command.review');
      const executor = await import('@/features/command/command.executor');
      const todos = await import('@/features/todos/todos.data');

      const first = await todos.addTodo({ title: 'Buy groceries' });
      const second = await todos.addTodo({ title: 'Pay rent' });

      const initial = await review.prepareCommandReview(completeTodoDraft('Buy groceries'), {
        now: new Date(),
      });
      const saved = await executor.executeDraftAction(initial.draft, {
        executionToken: initial.executionToken,
        resolvedEntityId: initial.resolvedEntityId,
      });
      expect(saved).toMatchObject({ outcome: 'success' });

      // The Command Center's edit path: drop the already-claimed token so the
      // review mints a new one for the new command.
      // The draft is narrowed so the spread keeps the complete_todo union.
      const reviewedDraft = initial.draft as DraftCompleteTodo;
      const edited = review.dropClaimedExecutionTokenOnEdit(
        { ...reviewedDraft, fields: { todoTitle: 'Pay rent' } },
        reviewedDraft,
      );
      const reReview = await review.prepareCommandReview(edited, { now: new Date() });
      expect(reReview.status).toBe('ready');
      expect(reReview.resolvedEntityId).toBe(second);
      expect(reReview.executionToken).not.toBe(initial.executionToken);

      const applied = await executor.executeDraftAction(reReview.draft, {
        executionToken: reReview.executionToken,
        resolvedEntityId: reReview.resolvedEntityId,
      });
      expect(applied).toMatchObject({ outcome: 'success', kind: 'complete_todo' });

      const rows = await db.getAllAsync<{ id: string; completed: number }>(
        'SELECT id, completed FROM todos ORDER BY title',
      );
      expect(rows).toEqual([
        { id: first, completed: 1 },
        { id: second, completed: 1 },
      ]);
    } finally {
      await close(db);
    }
  });

  it('an UNEDITED draft keeps its token so the double-submit guard still holds', async () => {
    const db = await freshDatabase();
    try {
      const review = await import('@/features/command/command.review');
      const todos = await import('@/features/todos/todos.data');
      const todoId = await todos.addTodo({ title: 'Buy groceries' });

      const initial = await review.prepareCommandReview(completeTodoDraft('Buy groceries'), {
        now: new Date(),
      });
      const revalidated = await review.prepareCommandReview(initial.draft, { now: new Date() });
      // Re-validating the unchanged draft (what Confirm does before executing)
      // must NOT mint a new token — otherwise two confirmations of one review
      // would both be accepted.
      expect(revalidated.executionToken).toBe(initial.executionToken);
      expect(revalidated.resolvedEntityId).toBe(todoId);
    } finally {
      await close(db);
    }
  });

  it('a same-field re-review keeps its token, so a double confirm is still refused', async () => {
    const db = await freshDatabase();
    try {
      const review = await import('@/features/command/command.review');
      await (await import('@/features/todos/todos.data')).addTodo({ title: 'Buy groceries' });
      const reviewed = await review.prepareCommandReview(completeTodoDraft('Buy groceries'), {
        now: new Date(),
      });
      const reviewedDraft = reviewed.draft as DraftCompleteTodo;
      const unchanged = review.dropClaimedExecutionTokenOnEdit({ ...reviewedDraft }, reviewedDraft);
      expect(unchanged.executionToken).toBe(reviewed.executionToken);

      // No previous draft (first review) is passed through untouched.
      const fresh = completeTodoDraft('Pay rent');
      expect(review.dropClaimedExecutionTokenOnEdit(fresh, null).executionToken).toBeUndefined();
    } finally {
      await close(db);
    }
  });
});
