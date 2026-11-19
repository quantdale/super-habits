import { afterEach, describe, expect, it } from 'vitest';
import { freshDatabase, type TestDatabase } from './helpers/db';

/**
 * Saving timer durations must reach the recoverable-settings capture exactly as
 * the other allowlisted settings do: the `backup.dirty` marker (which is what
 * makes the next maintenance cycle notice the change at all), the captured
 * pending snapshot, and the `user_backup_settings` outbox row.
 *
 * The capture is the ONLY record of what was true when the backup generation
 * was certified, so a duration that never gets captured becomes a duration the
 * remote never learns about; and a capture that carries an OLDER duration while
 * the local row already changed makes the manifest certify a payload the device
 * no longer holds.
 *
 * This suite pins the same-file contract today: every `savePomodoroSettings`
 * call writes the value, marks the dataset dirty, captures the JUST-WRITTEN
 * durations and enqueues one (coalesced) settings record — including when the
 * preset-selection reconciliation runs in the same transaction.
 */
describe('pomodoro settings save -> recoverable-settings capture (real SQLite)', () => {
  let db: TestDatabase;

  afterEach(async () => {
    await db?.closeAsync();
  });

  async function loadOwnedDatabase() {
    const database = await freshDatabase();
    const { setLocalDatasetOwner } = await import('@/core/auth/account.data');
    await setLocalDatasetOwner(database as never, 'user_a');
    return database;
  }

  it('captures every duration write and enqueues exactly one settings record', async () => {
    db = await loadOwnedDatabase();
    const pomodoro = await import('@/features/pomodoro/pomodoro.data');

    await pomodoro.savePomodoroSettings({
      focusMinutes: 40,
      shortBreakMinutes: 6,
      longBreakMinutes: 20,
      sessionsBeforeLongBreak: 3,
    });
    const first = await db.getFirstAsync<{ value: string }>(
      "SELECT value FROM app_meta WHERE key = 'backup.pending_settings'",
    );
    expect(JSON.parse(first!.value).payload.pomodoroSettings).toEqual({
      focusMinutes: 40,
      shortBreakMinutes: 6,
      longBreakMinutes: 20,
      sessionsBeforeLongBreak: 3,
    });

    // A second save must re-capture: the certifying manifest compares the
    // snapshot against the settings the device holds now.
    await pomodoro.savePomodoroSettings({
      focusMinutes: 25,
      shortBreakMinutes: 5,
      longBreakMinutes: 15,
      sessionsBeforeLongBreak: 4,
    });
    const second = await db.getFirstAsync<{ value: string }>(
      "SELECT value FROM app_meta WHERE key = 'backup.pending_settings'",
    );
    expect(JSON.parse(second!.value).payload.pomodoroSettings).toEqual({
      focusMinutes: 25,
      shortBreakMinutes: 5,
      longBreakMinutes: 15,
      sessionsBeforeLongBreak: 4,
    });

    const dirty = await db.getFirstAsync<{ value: string }>(
      "SELECT value FROM app_meta WHERE key = 'backup.dirty'",
    );
    expect(dirty?.value).toBe('1');
    // The outbox coalesces the settings record: one row, not one per save.
    const outbox = await db.getFirstAsync<{ count: number }>(
      "SELECT COUNT(*) AS count FROM sync_outbox WHERE entity = 'user_backup_settings'",
    );
    expect(Number(outbox!.count)).toBe(1);
  });

  it('captures the preset selection change it makes while saving durations', async () => {
    db = await loadOwnedDatabase();
    const pomodoro = await import('@/features/pomodoro/pomodoro.data');
    const store = await import('@/features/pomodoro/pomodoro.presets.store');
    await store.setActivePresetId('deep');

    // Deep Work's durations are 50/10/30 every 2 sessions; anything else
    // detaches the selection, and BOTH facts must be in the capture.
    await pomodoro.savePomodoroSettings({
      focusMinutes: 30,
      shortBreakMinutes: 5,
      longBreakMinutes: 15,
      sessionsBeforeLongBreak: 4,
    });

    const pending = await db.getFirstAsync<{ value: string }>(
      "SELECT value FROM app_meta WHERE key = 'backup.pending_settings'",
    );
    const payload = JSON.parse(pending!.value).payload;
    expect(payload.pomodoroSettings.focusMinutes).toBe(30);
    expect(payload.pomodoroPresets.activePresetId).toBeNull();
  });
});
