import { describe, expect, it, vi } from 'vitest';
import { freshDatabase, type TestDatabase } from './helpers/db';

vi.mock('expo-constants', () => ({ default: { expoConfig: { version: '1.0.0' } } }));
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async () => null),
    setItem: vi.fn(async () => undefined),
    removeItem: vi.fn(async () => undefined),
  },
}));

/**
 * `habits.rule_history` must only grow when the schedule or target actually
 * changes.
 *
 * Every `updateHabit` call (rename, category, colour, reminder, linked-action
 * rule save) upserts a rule effective on that local date. The rule it writes
 * reuses the weekdays currently in effect and the submitted target, so an edit
 * that leaves the schedule and target alone appends a byte-identical-content
 * entry for a new date — pure growth with no semantic change. Enough ordinary
 * edits then push `rule_history` past the 50,000-character recovery bound
 * (`parseHabitRuleHistoryJson`), at which point the habit cannot be imported:
 * `exportPortableBackup()` still succeeds (the export path does not run the
 * row validator), so the user is left holding a backup file that is rejected
 * in full when they try to restore it on a new device.
 */

const EDIT_COUNT = 700;

async function readRuleHistory(db: TestDatabase, habitId: string): Promise<string> {
  const row = await db.getFirstAsync<{ rule_history: string }>(
    'SELECT rule_history FROM habits WHERE id = ?',
    [habitId],
  );
  return row?.rule_history ?? '';
}

/**
 * Edits that change neither the schedule nor the target — one per local day
 * from the habit's creation day forward, exactly what `updateHabit` receives
 * when the user renames it, changes its colour/category/reminder, or saves its
 * linked-action rules over a long-lived habit.
 */
async function editWithoutScheduleChange(habitId: string, count = EDIT_COUNT): Promise<void> {
  const habits = await import('@/features/habits/habits.data');
  const { addLocalDays, toDateKey } = await import('@/lib/time');
  const createdOn = toDateKey();
  for (let index = 0; index < count; index += 1) {
    await habits.updateHabit(habitId, {
      name: `Renamed ${index}`,
      targetPerDay: 1,
      category: 'anytime',
      effectiveFromDate: addLocalDays(createdOn, index),
    });
  }
}

describe('habit rule history growth', () => {
  it('a schedule/target-preserving edit appends no history entry', async () => {
    const db = await freshDatabase();
    const habits = await import('@/features/habits/habits.data');
    const { parseHabitRuleHistory } = await import('@/features/habits/habits.domain');

    const habitId = await habits.addHabit('Read', 1);
    const initial = await readRuleHistory(db, habitId);

    await editWithoutScheduleChange(habitId, 40);

    expect(await readRuleHistory(db, habitId)).toBe(initial);
    expect(parseHabitRuleHistory(await readRuleHistory(db, habitId))).toHaveLength(1);
    // The other edited columns still land.
    const habit = (await habits.listHabits()).find((row) => row.id === habitId);
    expect(habit?.name).toBe('Renamed 39');
    await db.closeAsync();
  });

  it('repeated no-op edits keep the habit exportable and importable', async () => {
    const source = await freshDatabase();
    const habits = await import('@/features/habits/habits.data');
    const habitId = await habits.addHabit('Read', 1);
    await editWithoutScheduleChange(habitId);
    expect((await readRuleHistory(source, habitId)).length).toBeLessThanOrEqual(50_000);
    const expected = await source.getAllAsync('SELECT * FROM habits ORDER BY id');

    const { exportPortableBackup } = await import('@/core/portable/portableExport');
    const exported = await exportPortableBackup();
    expect(exported.ok).toBe(true);
    if (!exported.ok) throw new Error(exported.error);
    await source.closeAsync();

    const target = await freshDatabase();
    try {
      const { preparePortableImport, confirmPortableImport } =
        await import('@/core/portable/portableImport');
      const prepared = await preparePortableImport({
        fileName: exported.fileName,
        text: exported.json,
      });
      expect(
        prepared.status,
        prepared.status === 'ready' ? undefined : JSON.stringify(prepared),
      ).toBe('ready');
      if (prepared.status !== 'ready') throw new Error('Import was rejected');
      expect((await confirmPortableImport({ file: prepared.file })).status).toBe('restored');
      expect(await target.getAllAsync('SELECT * FROM habits ORDER BY id')).toEqual(expected);
    } finally {
      await target.closeAsync();
    }
  });
});
