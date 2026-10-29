import { describe, expect, it } from 'vitest';
import { freshDatabase } from './helpers/db';
import { addGoal, getGoal, softDeleteGoal } from '@/features/goals/goals.data';

/**
 * Soft-delete read contract for Goals: `getGoal` must filter
 * `deleted_at IS NULL`, exactly like `listGoals`, `getGoalRollup`, and the
 * project-wide invariant ("every read path filters deleted_at IS NULL").
 *
 * The user-visible failure: a soft-deleted goal still loads in
 * GoalDetailView; the user edits it and taps Save; `updateGoal`'s
 * `WHERE deleted_at IS NULL` matches zero rows and throws nothing, so the
 * edit is silently discarded while the UI navigates back as if it saved.
 */
describe('goal soft-delete read contract', () => {
  it('getGoal returns null for a soft-deleted goal', async () => {
    await freshDatabase();
    const id = await addGoal({ title: 'Deleted later' });
    expect(await getGoal(id)).not.toBeNull();

    await softDeleteGoal(id);
    expect(await getGoal(id)).toBeNull();
  });
});
