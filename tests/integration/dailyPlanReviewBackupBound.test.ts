import { afterEach, describe, expect, it } from 'vitest';
import { freshDatabase, type TestDatabase } from './helpers/db';

/**
 * REVIEW CANDIDATE (progress/activity slice): the backup validators bound
 * Daily Plan `notes` at 10 000 while the writer clamps at NOTES_MAX = 2 000 —
 * looser than the writer, which the restore contract forbids ("accept a row the
 * writer can never create"). It is NOT a user-visible defect today (a looser
 * bound cannot reject writer-valid data), so this is a regression pin rather
 * than a fix: the longest values the Daily Plan writer can persist must keep
 * validating for backup/restore, so a future tightening cannot silently start
 * rejecting this app's own rows.
 */
describe('Daily Plan backup bounds accept every writer-valid value', async () => {
  let db: TestDatabase;

  afterEach(async () => {
    await db?.closeAsync();
  });

  it('validates a plan persisted at every writer ceiling', async () => {
    db = await freshDatabase();
    const { NOTES_MAX, INTENTION_MAX, REFLECTION_MAX } =
      await import('@/features/daily-plan/dailyPlan.types');
    const plans = await import('@/features/daily-plan/dailyPlan.data');
    const { validateBackupRow, validateBackupGraph } =
      await import('@/core/backup/backupValidators');

    const plan = await plans.upsertDailyPlan('2026-01-05', {
      notes: 'n'.repeat(NOTES_MAX + 500),
      intention: 'i'.repeat(INTENTION_MAX + 500),
      reflection: 'r'.repeat(REFLECTION_MAX + 500),
      topTodoIds: [],
      focusTargetMinutes: 0,
    });

    // The writer clamps, so the persisted row sits exactly at each ceiling.
    expect(plan.notes).toHaveLength(NOTES_MAX);
    expect(plan.intention).toHaveLength(INTENTION_MAX);
    expect(plan.reflection).toHaveLength(REFLECTION_MAX);

    const row = { ...plan };
    expect(validateBackupRow('daily_plans', row).ok).toBe(true);
    expect(validateBackupGraph({ daily_plans: [row] })).toEqual([]);
  });
});
