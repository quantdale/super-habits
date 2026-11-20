import { afterEach, describe, expect, it } from 'vitest';
import { freshDatabase, type TestDatabase } from './helpers/db';

/**
 * Preset state (`app_meta.pomodoro_presets` = `{ presets, activePresetId }`) has
 * two writers on the SAME key:
 *
 *  - `savePomodoroPresets` replaces the list (preset manager: create/edit/delete),
 *  - `setActivePresetId` / `clearActivePresetId` only change the selection
 *    (preset picker, and the duration editor detaching the selection).
 *
 * Each is a read-modify-write. When the picker's selection write and the
 * manager's list write overlap, the late selection write used to restore the
 * preset list it had read BEFORE the list write landed — silently deleting the
 * preset the user had just created (and, in the other order, silently dropping
 * the selection). Both are durable user state carried by the recoverable
 * settings backup, so a lost write is a lost preference.
 */
describe('pomodoro preset state writes (real SQLite)', () => {
  let db: TestDatabase;

  afterEach(async () => {
    await db?.closeAsync();
  });

  async function readStoredState(database: TestDatabase) {
    const row = await database.getFirstAsync<{ value: string }>(
      "SELECT value FROM app_meta WHERE key = 'pomodoro_presets'",
    );
    return row
      ? (JSON.parse(row.value) as { presets: { id: string }[]; activePresetId: string | null })
      : null;
  }

  it('keeps a preset created while a selection write is in flight', async () => {
    db = await freshDatabase();
    const store = await import('@/features/pomodoro/pomodoro.presets.store');
    const { BUILT_IN_PRESETS } = await import('@/features/pomodoro/pomodoro.domain');
    const custom = {
      id: 'ppre_custom_laptop',
      name: 'Laptop focus',
      focusMinutes: 45,
      shortBreakMinutes: 8,
      longBreakMinutes: 20,
      sessionsBeforeLongBreak: 3,
      autoStartBreaks: false,
      autoStartFocus: false,
    };

    // The manager saves the new preset list; the picker's selection write
    // overlaps it (both read the same stored state first).
    await Promise.all([
      store.savePomodoroPresets([...BUILT_IN_PRESETS, custom]),
      store.setActivePresetId('deep'),
    ]);

    const stored = await readStoredState(db);
    expect(stored?.presets.map((preset) => preset.id)).toContain(custom.id);
    expect(stored?.activePresetId).toBe('deep');
  });

  it('keeps the selection set while another list save is in flight', async () => {
    db = await freshDatabase();
    const store = await import('@/features/pomodoro/pomodoro.presets.store');
    const { BUILT_IN_PRESETS } = await import('@/features/pomodoro/pomodoro.domain');
    const custom = {
      id: 'ppre_custom_laptop',
      name: 'Laptop focus',
      focusMinutes: 45,
      shortBreakMinutes: 8,
      longBreakMinutes: 20,
      sessionsBeforeLongBreak: 3,
      autoStartBreaks: false,
      autoStartFocus: false,
    };

    await Promise.all([
      store.setActivePresetId('deep'),
      store.savePomodoroPresets([...BUILT_IN_PRESETS, custom]),
    ]);

    const stored = await readStoredState(db);
    expect(stored?.activePresetId).toBe('deep');
    expect(stored?.presets.map((preset) => preset.id)).toContain(custom.id);
  });

  it('clearing a selection does not resurrect a replaced preset list', async () => {
    db = await freshDatabase();
    const store = await import('@/features/pomodoro/pomodoro.presets.store');
    const { BUILT_IN_PRESETS } = await import('@/features/pomodoro/pomodoro.domain');
    const custom = {
      id: 'ppre_custom_laptop',
      name: 'Laptop focus',
      focusMinutes: 45,
      shortBreakMinutes: 8,
      longBreakMinutes: 20,
      sessionsBeforeLongBreak: 3,
      autoStartBreaks: false,
      autoStartFocus: false,
    };
    await store.setActivePresetId('deep');

    // The duration editor detaches the selection while the manager replaces the
    // list (the deleted preset must stay deleted).
    await Promise.all([
      store.clearActivePresetId(),
      store.savePomodoroPresets([...BUILT_IN_PRESETS, custom]),
    ]);

    const stored = await readStoredState(db);
    expect(stored?.activePresetId).toBeNull();
    expect(stored?.presets.map((preset) => preset.id)).toContain(custom.id);
  });
});
