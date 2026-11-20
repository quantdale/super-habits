import { afterEach, describe, expect, it } from 'vitest';
import { freshDatabase, type TestDatabase } from './helpers/db';

/**
 * The stored preset selection drives timer BEHAVIOUR (`autoStartBreaks` /
 * `autoStartFocus` through `resolveActivePreset`), while `pomodoro_settings`
 * drives the DURATIONS. Two different surfaces write them:
 *
 *  - the Focus preset picker writes both (durations + selection),
 *  - Settings' "Save timer defaults" and the Focus duration editor write only
 *    the durations.
 *
 * Saving new durations while a preset whose rhythm no longer applies stays
 * selected leaves the two facts contradicting each other: the picker keeps
 * highlighting the old preset beside the new timer, and the next completion
 * still follows that preset's auto-start flags (an unrequested break starts
 * on its own). Changing the durations therefore has to detach a selection
 * whose durations no longer match, in the same durable write.
 */
describe('saving timer durations detaches a stale preset selection (real SQLite)', () => {
  let db: TestDatabase;

  afterEach(async () => {
    await db?.closeAsync();
  });

  it('clears a selection whose durations the saved settings no longer match', async () => {
    db = await freshDatabase();
    const pomodoro = await import('@/features/pomodoro/pomodoro.data');
    const store = await import('@/features/pomodoro/pomodoro.presets.store');
    await store.setActivePresetId('deep');
    expect((await store.getPomodoroPresetsState()).activePresetId).toBe('deep');

    // Exactly what Settings' "Save timer defaults" does today: durations only.
    await pomodoro.savePomodoroSettings({
      focusMinutes: 30,
      shortBreakMinutes: 5,
      longBreakMinutes: 15,
      sessionsBeforeLongBreak: 4,
    });

    expect((await store.getPomodoroPresetsState()).activePresetId).toBeNull();

    // Behavioural consequence: nothing claims Deep Work's auto-start.
    const { resolveActivePreset } = await import('@/features/pomodoro/pomodoro.domain');
    const resolved = resolveActivePreset((await store.getPomodoroPresetsState()).presets, null, {
      focusMinutes: 30,
      shortBreakMinutes: 5,
      longBreakMinutes: 15,
      sessionsBeforeLongBreak: 4,
    });
    expect(resolved.autoStartBreaks).toBe(false);
    expect(resolved.autoStartFocus).toBe(false);
  });

  it('keeps a selection that still matches the saved durations', async () => {
    db = await freshDatabase();
    const pomodoro = await import('@/features/pomodoro/pomodoro.data');
    const store = await import('@/features/pomodoro/pomodoro.presets.store');
    // Deep Work is 50 focus / 10 short / 30 long, long break every 2 sessions.
    await store.setActivePresetId('deep');

    await pomodoro.savePomodoroSettings({
      focusMinutes: 50,
      shortBreakMinutes: 10,
      longBreakMinutes: 30,
      sessionsBeforeLongBreak: 2,
    });

    expect((await store.getPomodoroPresetsState()).activePresetId).toBe('deep');
  });
});
