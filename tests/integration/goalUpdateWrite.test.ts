import { beforeEach, describe, expect, it } from 'vitest';
import { freshDatabase } from './helpers/db';

/**
 * Goal write contract for `updateGoal`: a missing or soft-deleted goal must
 * reject, not silently succeed.
 *
 * The user-visible failure: a stale GoalDetailView (goal soft-deleted from
 * another surface while the editor is open, or any programmatic caller with a
 * dead id) taps Save; `updateGoal`'s `UPDATE ... WHERE id = ? AND
 * deleted_at IS NULL` matches zero rows and throws nothing, so the edit is
 * silently discarded while the UI reports success.
 */
describe('goal update write contract', () => {
  beforeEach(async () => {
    await freshDatabase();
  });

  it('updateGoal rejects a missing goal instead of silently no-op', async () => {
    const { updateGoal } = await import('@/features/goals/goals.data');
    await expect(updateGoal('goal_missing', { title: 'nowhere' })).rejects.toThrow(
      'Goal not found.',
    );
  });

  it('updateGoal rejects a soft-deleted goal and cannot resurrect it', async () => {
    const { addGoal, getGoal, listGoals, softDeleteGoal, updateGoal } =
      await import('@/features/goals/goals.data');
    const id = await addGoal({ title: 'Deleted later' });
    await softDeleteGoal(id);

    await expect(updateGoal(id, { title: 'zombie' })).rejects.toThrow('Goal not found.');
    // Resurrection guard: the rejected write must leave the tombstone and the
    // original row untouched.
    expect(await getGoal(id)).toBeNull();
    const row = (await listGoals(true)).find((g) => g.id === id);
    expect(row?.deleted_at).toBeTruthy();
    expect(row?.title).toBe('Deleted later');
  });

  it('updateGoal still writes a live goal', async () => {
    const { addGoal, getGoal, updateGoal } = await import('@/features/goals/goals.data');
    const id = await addGoal({ title: 'before' });
    await updateGoal(id, { title: 'after' });
    expect((await getGoal(id))?.title).toBe('after');
  });
});
