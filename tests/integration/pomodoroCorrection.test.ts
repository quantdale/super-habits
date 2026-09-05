import { afterEach, describe, expect, it } from 'vitest';
import { freshDatabase, type TestDatabase } from './helpers/db';

/**
 * Pomodoro correction paths against real SQLite: post-hoc note and
 * todo-link edits ride the existing `setPomodoroSessionMeta` contract with a
 * single durable update intent, and preset authoring persists through the
 * app_meta recoverable-settings path with its backup settings intent.
 */
describe('pomodoro correction (real SQLite)', () => {
  let db: TestDatabase;

  afterEach(async () => {
    await db?.closeAsync();
  });

  it('corrects a logged session note and link in place with one live intent', async () => {
    db = await freshDatabase();
    const pomodoro = await import('@/features/pomodoro/pomodoro.data');

    await pomodoro.recordCompletedPomodoroSession({
      id: 'pom_corr_1',
      startedAtIso: '2026-09-05T01:00:00.000Z',
      endedAtIso: '2026-09-05T01:25:00.000Z',
      durationSeconds: 1500,
      type: 'focus',
    });

    expect(
      await pomodoro.setPomodoroSessionMeta({ sessionId: 'pom_corr_1', note: 'Drafted the spec' }),
    ).toBe(true);

    let row = await db.getFirstAsync<{ note: string | null; linked_todo_id: string | null }>(
      'SELECT note, linked_todo_id FROM pomodoro_sessions WHERE id = ?',
      ['pom_corr_1'],
    );
    expect(row?.note).toBe('Drafted the spec');

    // Relink, then correct the note again; the durable outbox coalesces to
    // one row holding the latest operation for this session id.
    expect(
      await pomodoro.setPomodoroSessionMeta({
        sessionId: 'pom_corr_1',
        note: 'Drafted the spec, v2',
        linkedTodoId: 'todo_corr_1',
        linkedTodoTitle: 'Write spec',
      }),
    ).toBe(true);
    row = await db.getFirstAsync<{ note: string | null; linked_todo_id: string | null }>(
      'SELECT note, linked_todo_id FROM pomodoro_sessions WHERE id = ?',
      ['pom_corr_1'],
    );
    expect(row?.note).toBe('Drafted the spec, v2');
    expect(row?.linked_todo_id).toBe('todo_corr_1');

    const intents = await db.getAllAsync<{ operation: string }>(
      `SELECT operation FROM sync_outbox WHERE entity = 'pomodoro_sessions' AND id = 'pom_corr_1'`,
    );
    expect(intents.map((intent) => intent.operation)).toEqual(['update']);

    // Unlink + clear the note: explicit null/empty clears (undefined keeps).
    expect(
      await pomodoro.setPomodoroSessionMeta({
        sessionId: 'pom_corr_1',
        note: '',
        linkedTodoId: null,
        linkedTodoTitle: null,
      }),
    ).toBe(true);
    row = await db.getFirstAsync<{ note: string | null; linked_todo_id: string | null }>(
      'SELECT note, linked_todo_id FROM pomodoro_sessions WHERE id = ?',
      ['pom_corr_1'],
    );
    expect(row?.note).toBeNull();
    expect(row?.linked_todo_id).toBeNull();
  });

  it('is a no-op for unknown sessions and empty edits', async () => {
    db = await freshDatabase();
    const pomodoro = await import('@/features/pomodoro/pomodoro.data');

    expect(await pomodoro.setPomodoroSessionMeta({ sessionId: 'pom_missing', note: 'x' })).toBe(
      false,
    );

    await pomodoro.recordCompletedPomodoroSession({
      id: 'pom_corr_2',
      startedAtIso: '2026-09-05T02:00:00.000Z',
      endedAtIso: '2026-09-05T02:15:00.000Z',
      durationSeconds: 900,
      type: 'focus',
    });
    expect(await pomodoro.setPomodoroSessionMeta({ sessionId: 'pom_corr_2' })).toBe(false);

    const intents = await db.getFirstAsync<{ n: number }>(
      `SELECT COUNT(*) AS n FROM sync_outbox WHERE entity = 'pomodoro_sessions' AND id = 'pom_corr_2'`,
    );
    // Only the original create intent exists — the empty edit wrote nothing.
    expect(intents).toEqual({ n: 1 });
  });

  it('persists preset authoring through app_meta with a backup settings intent', async () => {
    db = await freshDatabase();
    const presetsStore = await import('@/features/pomodoro/pomodoro.presets.store');

    const state = await presetsStore.getPomodoroPresetsState();
    expect(state.presets.map((preset) => preset.id)).toEqual(['classic', 'deep', 'sprint']);

    const custom = {
      id: 'ppre_custom_1',
      name: 'Laptop focus',
      focusMinutes: 45,
      shortBreakMinutes: 8,
      longBreakMinutes: 20,
      sessionsBeforeLongBreak: 3,
      autoStartBreaks: true,
      autoStartFocus: false,
    };
    await presetsStore.savePomodoroPresets([...state.presets, custom]);

    const reloaded = await presetsStore.getPomodoroPresets();
    const saved = reloaded.find((preset) => preset.id === 'ppre_custom_1');
    expect(saved?.name).toBe('Laptop focus');
    expect(saved?.focusMinutes).toBe(45);

    const meta = await db.getFirstAsync<{ value: string }>(
      `SELECT value FROM app_meta WHERE key = 'pomodoro_presets'`,
    );
    expect(meta?.value).toContain('Laptop focus');

    const settingsIntents = await db.getFirstAsync<{ n: number }>(
      `SELECT COUNT(*) AS n FROM sync_outbox WHERE entity = 'user_backup_settings'`,
    );
    expect(Number(settingsIntents?.n)).toBeGreaterThan(0);

    // Deleting the custom preset keeps built-ins and drops only the custom row.
    await presetsStore.savePomodoroPresets(reloaded.filter((p) => p.id !== 'ppre_custom_1'));
    const afterDelete = await presetsStore.getPomodoroPresets();
    expect(afterDelete.map((preset) => preset.id)).toEqual(['classic', 'deep', 'sprint']);
  });
});
