import { beforeEach, describe, expect, it } from 'vitest';
import { freshDatabase, type TestDatabase } from './helpers/db';
import { buildPortableBackupFile } from '@/core/portable/portableFormat';

/**
 * Goal progress is a clamped writer invariant: `addGoal` (via
 * `normalizeGoalProgress`), `updateGoal`, and `setGoalProgress` all run
 * `clampProgressPercent` (0–100, whole number), and the spec
 * (`productivity-expansion` "Manual progress") requires exactly that range to
 * persist. Import therefore must not accept a Goal row that no writer path can
 * ever produce.
 *
 * The user-visible failure: `GOAL_RULES` validated `progress_percent` only as
 * an integer ≥ 0, so a hand-edited or corrupted portable file carrying
 * `progress_percent: 250` imported cleanly. The stored value then disagreed
 * with itself everywhere it is displayed: the Goal editor renders
 * "Progress: 250%" with a 250 % wide bar, Project rollups clamp it to 100 %,
 * and the Overview/Progress "average goal progress" reports 250 %, which no
 * stored entry can justify. A cloud manifest certifying the same row was
 * equally restorable.
 *
 * Pinned contract:
 *  1. `validateBackupRow('goals')` accepts the writer's range (0, 50, 100) and
 *     rejects anything outside it (including a negative row, which the old
 *     rule already refused).
 *  2. A portable file carrying out-of-range progress is rejected before any
 *     local write.
 *  3. Every writer-valid progress value round-trips export → import unchanged.
 */
const ISO = '2026-08-20T08:00:00.000Z';

const SETTINGS = {
  calorieGoal: { calories: 2000, protein: 120, carbs: 220, fats: 60 },
  pomodoroSettings: {
    focusMinutes: 25,
    shortBreakMinutes: 5,
    longBreakMinutes: 15,
    sessionsBeforeLongBreak: 4,
  },
  theme: { mode: 'light', slots: {} },
};

function goalRow(progressPercent: number) {
  return {
    id: 'goal_1',
    project_id: null,
    title: 'Learn Spanish',
    description: null,
    horizon: 'month',
    target_date: null,
    status: 'active',
    progress_percent: progressPercent,
    created_at: ISO,
    updated_at: ISO,
    deleted_at: null,
    completed_at: null,
  };
}

function portableFile(progressPercent: number) {
  return buildPortableBackupFile({
    exportedAt: ISO,
    appVersion: '1.0.0',
    platform: 'web',
    ownerFingerprint: null,
    rowsByEntity: { goals: [goalRow(progressPercent)] },
    settings: SETTINGS,
  });
}

async function importFile(db: TestDatabase, progressPercent: number) {
  const portable = await import('@/core/portable/portableImport');
  const prepared = await portable.preparePortableImport({
    fileName: 'goal-progress.json',
    text: JSON.stringify(portableFile(progressPercent)),
  });
  if (prepared.status !== 'ready') return { prepared };
  const imported = await portable.confirmPortableImport({ file: prepared.file });
  return { prepared, imported };
}

describe('goal progress is a writer-clamped range on import', () => {
  let db: TestDatabase;

  beforeEach(async () => {
    db = await freshDatabase();
  });

  it('validateBackupRow accepts the writer range and rejects outside it', async () => {
    const { validateBackupRow } = await import('@/core/backup/backupValidators');
    for (const value of [0, 50, 100]) {
      const result = validateBackupRow('goals', goalRow(value));
      expect(result.ok, `progress_percent ${value} must stay valid`).toBe(true);
    }
    for (const value of [-1, 101, 250, 1000]) {
      const result = validateBackupRow('goals', goalRow(value));
      expect(result.ok, `progress_percent ${value} must be rejected`).toBe(false);
      if (result.ok) continue;
      expect(result.errors.join(' ')).toContain('progress_percent');
    }
  });

  it('rejects a portable file whose goal progress no writer can produce, importing nothing', async () => {
    const outcome = await importFile(db, 250);
    expect(outcome.prepared.status).toBe('rejected');
    if (outcome.prepared.status !== 'rejected') return;
    expect(outcome.prepared.diagnostics.join(' ')).toContain('progress_percent');
    expect(
      await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM goals'),
    ).toEqual({ count: 0 });
    expect(
      await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM sync_outbox'),
    ).toEqual({ count: 0 });
  });

  it.each([0, 42, 100])('round-trips writer-valid progress %i unchanged', async (value) => {
    // Each value gets its own empty device: import only runs on an empty device.
    db = await freshDatabase();
    const outcome = await importFile(db, value);
    expect(outcome.imported?.status).toBe('restored');
    expect(
      await db.getFirstAsync<{ progress_percent: number }>('SELECT progress_percent FROM goals'),
    ).toEqual({ progress_percent: value });
  });
});
