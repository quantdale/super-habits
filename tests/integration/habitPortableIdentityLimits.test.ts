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
 * Habit rows the SHIPPED writers can create must survive a full portable
 * backup round trip.
 *
 * The writer contract is looser than the palette the Habit editor offers, and
 * the backup row validator used to enforce that palette plus the 300/50
 * character `name`/`color` ceilings:
 * - `addHabit` validates `name.trim()` only (it stores the raw string), so a
 *   padded name is writer-valid but exceeded the 300-character ceiling;
 * - `icon`/`color` are never checked at write time, so the Command Center's
 *   `create_habit` path (`executeCreateHabit`) persists the parser's arbitrary
 *   model strings (`realCommandParser.ts` only requires trimmed text), and any
 *   direct data-layer caller can persist a longer color.
 *
 * Such rows were exportable but un-importable: `exportPortableBackup()`
 * succeeded and `preparePortableImport()` then rejected the WHOLE file
 * ("habits: icon is invalid"), dropping every other entity in the same backup.
 * Same defect class as the workout text recovery (#241): a recovery path must
 * accept every value its own writers persist.
 */

type HabitDump = Record<string, unknown>[];

async function dumpHabits(db: TestDatabase): Promise<HabitDump> {
  return db.getAllAsync(`SELECT * FROM habits ORDER BY id`);
}

/** Actual writer → successful export → preview → confirm → exact SQLite rows. */
async function roundTrip(write: () => Promise<void>): Promise<void> {
  const source = await freshDatabase();
  let json: string;
  let fileName: string;
  let expected: HabitDump;
  try {
    await write();
    expected = await dumpHabits(source);
    expect(expected).toHaveLength(1);
    const { exportPortableBackup } = await import('@/core/portable/portableExport');
    const exported = await exportPortableBackup();
    expect(exported.ok).toBe(true);
    if (!exported.ok) throw new Error(exported.error);
    ({ json, fileName } = exported);
  } finally {
    await source.closeAsync();
  }

  const target = await freshDatabase();
  try {
    const { preparePortableImport, confirmPortableImport } =
      await import('@/core/portable/portableImport');
    const prepared = await preparePortableImport({ fileName, text: json });
    expect(
      prepared.status,
      prepared.status === 'ready' ? undefined : JSON.stringify(prepared),
    ).toBe('ready');
    if (prepared.status !== 'ready') throw new Error('Import was rejected');
    expect((await confirmPortableImport({ file: prepared.file })).status).toBe('restored');
    expect(await dumpHabits(target)).toEqual(expected);
  } finally {
    await target.closeAsync();
  }
}

describe('habit portable identity compatibility', () => {
  it('a raw writer-valid habit name survives a full import', async () => {
    // `addHabit` validates the TRIMMED name, so this is a row a writer can
    // land: 100 meaningful characters plus surrounding whitespace.
    await roundTrip(async () => {
      const habits = await import('@/features/habits/habits.data');
      await habits.addHabit(`${' '.repeat(301)}${'n'.repeat(100)}${' '.repeat(301)}`, 1);
    });
  });

  it('an out-of-palette icon/color from the data layer survives a full import', async () => {
    await roundTrip(async () => {
      const habits = await import('@/features/habits/habits.data');
      await habits.addHabit(
        'Read a book',
        1,
        'anytime',
        'book' as never,
        // Longer than the 50-character backup ceiling and not a hex color.
        'a very long, definitely not a palette color value',
      );
    });
  });

  it('a Command Center habit with a non-palette icon/color survives a full import', async () => {
    // The exact user path: Describe it → create a habit. The parser's
    // `icon`/`color` strings are unconstrained model text, and the executor
    // forwards them to `addHabit` verbatim.
    await roundTrip(async () => {
      const { executeDraftAction } = await import('@/features/command/command.executor');
      const result = await executeDraftAction(
        {
          kind: 'create_habit',
          rawText: 'add habit read a book',
          parserKind: 'model_proxy',
          parserVersion: 'v1',
          confidence: 0.9,
          status: 'ready',
          warnings: [],
          missingFields: [],
          fields: {
            name: 'Read a book',
            targetPerDay: 1,
            category: 'anytime',
            icon: 'book',
            color: 'teal 600',
          },
        } as never,
        { executionToken: 'habit-portable-identity' },
      );
      expect(result.outcome).toBe('success');
    });
  });
});
