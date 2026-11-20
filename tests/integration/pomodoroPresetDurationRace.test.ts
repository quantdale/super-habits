import { afterEach, describe, expect, it } from 'vitest';
import type { PomodoroPreset } from '@/features/pomodoro/pomodoro.domain';
import { freshDatabase, type TestDatabase } from './helpers/db';

/**
 * `app_meta.pomodoro_presets` (`{ presets, activePresetId }`) is a
 * read-modify-write record whose writers live on three independent surfaces:
 *
 *  - the preset manager replaces the list (`savePomodoroPresets`),
 *  - the preset picker sets the selection (`setActivePresetId`),
 *  - Settings' "Save timer defaults" / the Focus duration editor save only the
 *    DURATIONS, and detach a selection those durations no longer match
 *    (`savePomodoroSettings`, inside its settings transaction).
 *
 * `withSQLiteWriter` serializes the WRITE turns only. The preset store's read
 * of the state it merges from happened OUTSIDE that boundary, so this
 * interleaving was still reachable:
 *
 *   1. the list save reads `{ presets, activePresetId: 'deep' }`
 *   2. the duration save commits: durations 30/5/15 and `activePresetId: null`
 *      (Deep Work's 50/10/30 no longer applies)
 *   3. the list save writes the selection it read back, plus its new preset
 *
 * Every write is faithfully serialized and the OUTCOME is still wrong: the
 * picker highlights Deep Work beside a 30:00 timer and the next completion
 * follows Deep Work's `autoStartBreaks`, starting an unrequested break — the
 * exact state the duration/detach invariant exists to eliminate. Both writers
 * of this record must therefore share one serialization boundary around
 * read+write, not just around the write.
 */
const CUSTOM_PRESET = {
  id: 'ppre_custom_laptop',
  name: 'Laptop focus',
  focusMinutes: 45,
  shortBreakMinutes: 8,
  longBreakMinutes: 20,
  sessionsBeforeLongBreak: 3,
  autoStartBreaks: false,
  autoStartFocus: false,
};

/** Deep Work is 50/10/30 every 2 sessions; none of these match it. */
const INCOMPATIBLE_WITH_DEEP = {
  focusMinutes: 30,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  sessionsBeforeLongBreak: 4,
};

describe('preset list save racing a duration save detach (real SQLite)', () => {
  let db: TestDatabase;

  afterEach(async () => {
    await db?.closeAsync();
  });

  async function readStoredState(database: TestDatabase) {
    const row = await database.getFirstAsync<{ value: string }>(
      "SELECT value FROM app_meta WHERE key = 'pomodoro_presets'",
    );
    return row
      ? (JSON.parse(row.value) as { presets: PomodoroPreset[]; activePresetId: string | null })
      : null;
  }

  it('does not restore the selection the duration save just detached', async () => {
    db = await freshDatabase();
    const pomodoro = await import('@/features/pomodoro/pomodoro.data');
    const store = await import('@/features/pomodoro/pomodoro.presets.store');

    // Deep Work selected, and its 50/10/30 rhythm is what the timer runs.
    await store.setActivePresetId('deep');
    expect((await readStoredState(db))?.activePresetId).toBe('deep');
    // The list the manager would hand to the store (already in memory) — read
    // BEFORE the overlap so nothing below waits on a store read.
    const nextList = [...(await store.getPomodoroPresets()), CUSTOM_PRESET];

    // --- deterministic overlap ---------------------------------------------
    // The duration save's transaction is held open BEFORE it runs its writes,
    // so the overlap point is exact: the list save starts while the duration
    // save is uncommitted, and the duration save cannot commit until this test
    // releases it.
    const originalGetFirst = db.getFirstAsync.bind(db);
    const originalWithTransaction = db.withTransactionAsync.bind(db);

    let pauseNextTransaction = false;
    let paused = false;
    let released = false;
    let listReadWhileUncommitted = false;
    let signalTransactionOpen: () => void = () => {};
    const transactionOpen = new Promise<void>((resolve) => {
      signalTransactionOpen = resolve;
    });
    let releaseTransaction: () => void = () => {};
    const transactionReleased = new Promise<void>((resolve) => {
      releaseTransaction = resolve;
    });

    (
      db as unknown as { withTransactionAsync: typeof originalWithTransaction }
    ).withTransactionAsync = async (task) => {
      if (pauseNextTransaction && !paused) {
        paused = true;
        signalTransactionOpen();
        await transactionReleased;
        released = true;
      }
      await originalWithTransaction(task);
    };

    // Records whether the store read the preset record while the duration save
    // was still uncommitted — i.e. merged a pre-detach snapshot.
    (db as unknown as { getFirstAsync: typeof originalGetFirst }).getFirstAsync = async (
      sql,
      params,
    ) => {
      const isPresetRead = sql.includes('FROM app_meta') && String(params?.[0]);
      if (isPresetRead && paused && !released) listReadWhileUncommitted = true;
      return originalGetFirst(sql, params);
    };

    pauseNextTransaction = true;
    const settingsSave = pomodoro.savePomodoroSettings(INCOMPATIBLE_WITH_DEEP);
    await transactionOpen;

    const listSave = store.savePomodoroPresets(nextList);

    // Give the overlap a place to happen before releasing the commit. In the
    // hazard shape the list save has already read (and is queued on the writer
    // gate) by now; with one shared boundary it cannot start until the commit.
    await new Promise((resolve) => setTimeout(resolve, 50));

    releaseTransaction();
    await Promise.all([settingsSave, listSave]);

    // --- the invariant ------------------------------------------------------
    const stored = await readStoredState(db);
    // 30/5/15 matches no built-in, so the selection must stay detached even
    // though the list save started first and ran its write after the commit.
    expect(stored?.activePresetId).toBeNull();
    // …while the list save's own edit still lands (serialized, not dropped).
    expect(stored?.presets.map((preset) => preset.id)).toContain(CUSTOM_PRESET.id);

    // Durations really were saved, and nothing claims Deep Work's behaviour.
    const settings = await pomodoro.getPomodoroSettings();
    expect(settings).toEqual(INCOMPATIBLE_WITH_DEEP);
    const { resolveActivePreset } = await import('@/features/pomodoro/pomodoro.domain');
    const governing = resolveActivePreset(stored?.presets ?? [], stored?.activePresetId, settings);
    expect(governing.autoStartBreaks).toBe(false);
    expect(governing.autoStartFocus).toBe(false);

    // The recoverable-settings capture must agree with what is stored: a
    // snapshot that certifies a detached selection while the device keeps the
    // stale one is a restore that resurrects the contradiction.
    const pending = await db.getFirstAsync<{ value: string }>(
      "SELECT value FROM app_meta WHERE key = 'backup.pending_settings'",
    );
    const captured = JSON.parse(pending!.value).payload;
    expect(captured.pomodoroSettings).toEqual(INCOMPATIBLE_WITH_DEEP);
    expect(captured.pomodoroPresets?.activePresetId ?? null).toBe(stored?.activePresetId ?? null);

    // Prove the reproduction stayed honest: the list save must not have merged
    // a snapshot taken before the duration save committed.
    expect(listReadWhileUncommitted).toBe(false);
  });
});
