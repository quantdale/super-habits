import { describe, expect, it, vi } from 'vitest';
import { freshDatabase } from './helpers/db';

/**
 * A2 — single-transaction settings writes.
 *
 * The old settings writers committed the app_meta value and then opened a
 * SEPARATE transaction for the `user_backup_settings` outbox row + pending
 * snapshot. A crash (or an error) between the two left a persisted setting
 * that no backup intent described, and the snapshot itself could be read
 * before the mutation landed (making the pending payload miss the value the
 * user just saved — the manifest-staleness check in the push adapter depends
 * on the payload matching the values written by that mutation).
 *
 * These tests pin the fixed contract against real SQLite:
 *   1. one mutation = app_meta value + outbox row + pending payload, all
 *      present together after the call returns;
 *   2. the pending payload reflects the value written by that call.
 */

vi.mock('@/lib/supabase', () => ({
  supabase: { from: vi.fn() },
  isRemoteEnabled: vi.fn(() => true),
  getSupabaseAuthUserId: vi.fn().mockResolvedValue('user_a'),
  getSupabaseSessionUserId: vi.fn().mockResolvedValue('user_a'),
  setRemoteMode: vi.fn(),
  ensureAnonymousSession: vi.fn().mockResolvedValue(undefined),
}));

async function loadOwnedDatabase() {
  const db = await freshDatabase();
  const { setLocalDatasetOwner } = await import('@/core/auth/account.data');
  await setLocalDatasetOwner(db as never, 'user_a');
  return db;
}

describe('recoverable settings writes are atomic with their backup intent', () => {
  it('setCalorieGoal commits the value, the outbox intent and the pending snapshot together', async () => {
    const db = await loadOwnedDatabase();
    const calories = await import('@/features/calories/calories.data');

    await calories.setCalorieGoal({ calories: 2300, protein: 180, carbs: 240, fats: 70 });

    const goalRow = await db.getFirstAsync<{ value: string }>(
      "SELECT value FROM app_meta WHERE key = 'calorie_goal'",
    );
    expect(JSON.parse(goalRow!.value).calories).toBe(2300);

    const outbox = await db.getFirstAsync<{ entity: string }>(
      "SELECT entity FROM sync_outbox WHERE entity = 'user_backup_settings'",
    );
    expect(outbox?.entity).toBe('user_backup_settings');

    // The pending payload must carry the JUST-WRITTEN value: the manifest
    // checksum comparison at push time certifies exactly this snapshot.
    const pending = await db.getFirstAsync<{ value: string }>(
      "SELECT value FROM app_meta WHERE key = 'backup.pending_settings'",
    );
    const payload = JSON.parse(pending!.value) as {
      payload: { calorieGoal: { calories: number } };
    };
    expect(payload.payload.calorieGoal.calories).toBe(2300);

    await db.closeAsync();
  });

  it('savePomodoroSettings captures the normalized value in the pending snapshot', async () => {
    const db = await loadOwnedDatabase();
    const pomodoro = await import('@/features/pomodoro/pomodoro.data');

    const current = await pomodoro.getPomodoroSettings();
    await pomodoro.savePomodoroSettings({ ...current, focusMinutes: 45 });

    const pending = await db.getFirstAsync<{ value: string }>(
      "SELECT value FROM app_meta WHERE key = 'backup.pending_settings'",
    );
    const payload = JSON.parse(pending!.value) as {
      payload: { pomodoroSettings: { focusMinutes: number } };
    };
    expect(payload.payload.pomodoroSettings.focusMinutes).toBe(45);

    const outboxCount = await db.getFirstAsync<{ count: number }>(
      "SELECT COUNT(*) AS count FROM sync_outbox WHERE entity = 'user_backup_settings'",
    );
    expect(Number(outboxCount!.count)).toBe(1);

    await db.closeAsync();
  });
});
