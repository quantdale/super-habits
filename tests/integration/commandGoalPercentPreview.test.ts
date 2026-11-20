import { describe, expect, it } from 'vitest';
import { freshDatabase, type TestDatabase } from './helpers/db';
import type { DraftUpdateGoalProgress } from '@/features/command/types';

/**
 * A reviewed goal-progress percent must survive to the write unchanged.
 *
 * The review preview is built from the DRAFT's value, while the executor
 * round-trips it through its own clamp before writing. Goal progress is integer-only in the product
 * (`clampProgressPercent` rounds; `parseGoalProgressText` accepts whole
 * numbers), but the Command Center's "Progress" field is a free text input
 * parsed with `Number()`, so a typed `40.5` was previewed as `… → 40.5%` and
 * stored as `41%`. A review that previews one number and commits another is a
 * preview/commit divergence even when the direction is benign.
 */

function goalDraft(percent: number): DraftUpdateGoalProgress {
  return {
    kind: 'update_goal_progress',
    rawText: `set goal Read more to ${percent}%`,
    parserKind: 'mock_rules',
    parserVersion: 'v2',
    confidence: 0.9,
    status: 'ready',
    warnings: [],
    missingFields: [],
    fields: { goalTitle: 'Read more', percent },
  };
}

async function close(db: TestDatabase): Promise<void> {
  await db.closeAsync();
}

describe('goal progress preview matches the committed value', () => {
  it('refuses a fractional percent at review instead of previewing it', async () => {
    const db = await freshDatabase();
    try {
      const review = await import('@/features/command/command.review');
      const goals = await import('@/features/goals/goals.data');
      await goals.addGoal({ title: 'Read more' });

      const prepared = await review.prepareCommandReview(goalDraft(40.5), { now: new Date() });
      expect(prepared.status).toBe('needs_input');
      expect(prepared.missingFields).toContainEqual(expect.objectContaining({ field: 'fields' }));
    } finally {
      await close(db);
    }
  });

  it('a whole-number percent still previews and commits the same value', async () => {
    const db = await freshDatabase();
    try {
      const review = await import('@/features/command/command.review');
      const executor = await import('@/features/command/command.executor');
      const goals = await import('@/features/goals/goals.data');
      const goalId = await goals.addGoal({ title: 'Read more' });

      const prepared = await review.prepareCommandReview(goalDraft(40), { now: new Date() });
      expect(prepared.status).toBe('ready');
      expect(prepared.preview.rows).toContainEqual({
        label: 'Progress',
        value: '0% → 40%',
      });

      const result = await executor.executeDraftAction(prepared.draft, {
        executionToken: prepared.executionToken,
        resolvedEntityId: prepared.resolvedEntityId,
      });
      expect(result).toMatchObject({ outcome: 'success', kind: 'update_goal_progress' });
      expect(await goals.getGoal(goalId)).toMatchObject({ progress_percent: 40 });
    } finally {
      await close(db);
    }
  });
});
