import { describe, expect, it, vi } from 'vitest';
import type { TestDatabase } from './helpers/db';
import { freshDatabase } from './helpers/db';

/**
 * A saved-meal catalog the WRITER can produce must always be restorable.
 *
 * The `saved_meals` uniqueness rule is SQLite's `COLLATE NOCASE` unique index,
 * which is ASCII-only: `'Éclair'` and `'éclair'` are DIFFERENT rows there, and
 * `upsertSavedMeal` really creates both (accented food names are ordinary
 * user data). The backup dependency-graph check, however, folded names with
 * `toLocaleLowerCase()` — locale- and Unicode-aware — so it declared those two
 * writer-legal rows a duplicate and rejected the file. The result was a device
 * whose own portable export (and, through the same shared validator, its cloud
 * Restore V2) refused to import: the user could not recover their own data.
 *
 * These oracles prove the writer/validator agreement end-to-end on real SQLite:
 * duplicates under the SQLite rule are rejected, and the NOCASE-distinct
 * accented pair survives export → validate → import unchanged.
 */
const ASCII_PAIR = ['Éclair', 'éclair'] as const;

async function writePairThroughWriter(db: TestDatabase): Promise<void> {
  const calories = await import('@/features/calories/calories.data');
  for (const foodName of ASCII_PAIR) {
    await calories.upsertSavedMeal({
      foodName,
      calories: 200,
      protein: 4,
      carbs: 20,
      fats: 10,
      fiber: 1,
      mealType: 'snack',
    });
  }
}

/** Controllable AsyncStorage double: export reads theme state only. */
const asyncStorageMock = vi.hoisted(() => {
  const state = new Map<string, string>();
  return {
    state,
    impl: {
      getItem: async (key: string) => state.get(key) ?? null,
      setItem: async (key: string, value: string) => {
        state.set(key, value);
      },
      removeItem: async (key: string) => {
        state.delete(key);
      },
    },
  };
});

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: asyncStorageMock.impl.getItem,
    setItem: asyncStorageMock.impl.setItem,
    removeItem: asyncStorageMock.impl.removeItem,
  },
}));

vi.mock('expo-constants', () => ({
  default: { expoConfig: { version: '1.0.0' } },
}));

describe('writer-valid saved meal catalog survives backup round-trip (real SQLite)', () => {
  it('creates, exports, validates and imports an ASCII-NOCASE-distinct accented pair', async () => {
    const sourceDb = await freshDatabase();
    await writePairThroughWriter(sourceDb);

    // The writer really produced two rows: SQLite NOCASE only folds ASCII.
    const written = await sourceDb.getAllAsync<{ food_name: string }>(
      'SELECT food_name FROM saved_meals ORDER BY food_name',
    );
    expect(written.map((row) => row.food_name)).toEqual([...ASCII_PAIR].sort());

    const { exportPortableBackup } = await import('@/core/portable/portableExport');
    const exported = await exportPortableBackup();
    expect(exported.ok).toBe(true);
    if (!exported.ok) throw new Error(exported.error);
    const parsed = JSON.parse(exported.json) as unknown;

    const { validatePortableBackupFile } = await import('@/core/portable/portableFormat');
    const validation = validatePortableBackupFile(parsed);
    expect(validation.ok ? [] : validation.errors).toEqual([]);
    if (!validation.ok) throw new Error('export rejected by its own validator');

    // Import onto a fresh empty device restores both catalog rows verbatim.
    const targetDb = await freshDatabase();
    const { preparePortableImport, confirmPortableImport } =
      await import('@/core/portable/portableImport');
    const outcome = await preparePortableImport({
      fileName: exported.fileName,
      text: exported.json,
    });
    expect(outcome.status).toBe('ready');
    if (outcome.status !== 'ready') return;
    expect(outcome.preview.counts.saved_meals).toBe(2);

    expect((await confirmPortableImport({ file: outcome.file })).status).toBe('restored');
    const imported = await targetDb.getAllAsync<{ food_name: string }>(
      'SELECT food_name FROM saved_meals ORDER BY food_name',
    );
    expect(imported.map((row) => row.food_name)).toEqual([...ASCII_PAIR].sort());
    await sourceDb.closeAsync();
    await targetDb.closeAsync();
  }, 60000);

  it('round-trips a name with outer whitespace through the calorie and saved-meal writers', async () => {
    const db = await freshDatabase();
    const { addCalorieEntry, upsertSavedMeal } = await import('@/features/calories/calories.data');
    const foodName = `${' '.repeat(300)}Oatmeal\u00a0`;
    const nutrition = { calories: 200, protein: 4, carbs: 20, fats: 10, fiber: 1 };
    await addCalorieEntry({ ...nutrition, foodName, mealType: 'breakfast' });
    await upsertSavedMeal({ ...nutrition, foodName: 'oatmeal', mealType: 'breakfast' });

    const { exportPortableBackup } = await import('@/core/portable/portableExport');
    const { validatePortableBackupFile } = await import('@/core/portable/portableFormat');
    const exported = await exportPortableBackup();
    if (!exported.ok) throw new Error(exported.error);
    const validated = validatePortableBackupFile(JSON.parse(exported.json));
    expect(validated.ok ? [] : validated.errors).toEqual([]);

    expect(await db.getAllAsync('SELECT food_name FROM calorie_entries')).toEqual([
      { food_name: 'Oatmeal' },
    ]);
    expect(await db.getAllAsync('SELECT food_name, use_count FROM saved_meals')).toEqual([
      { food_name: 'Oatmeal', use_count: 2 },
    ]);
    await db.closeAsync();
  });

  it('still rejects a saved-meal catalog SQLite itself considers duplicated', async () => {
    const { validateBackupGraph } = await import('@/core/backup/backupValidators');
    const base = {
      id: 'smeal_1',
      food_name: 'Oatmeal',
      calories: 250,
      protein: 8,
      carbs: 40,
      fats: 4,
      fiber: 5,
      meal_type: 'breakfast',
      use_count: 3,
      last_used_at: '2026-08-01T09:00:00.000Z',
      created_at: '2026-08-01T09:00:00.000Z',
    };

    // ASCII-only case differences are one row under NOCASE — still rejected.
    expect(
      validateBackupGraph({
        saved_meals: [base, { ...base, id: 'smeal_2', food_name: 'OATMEAL' }],
      }),
    ).toContain('saved_meals duplicate food_name: "Oatmeal" / "OATMEAL"');

    // The non-ASCII pair is NOT a database duplicate — accepted.
    expect(
      validateBackupGraph({
        saved_meals: [
          { ...base, food_name: 'Éclair' },
          { ...base, id: 'smeal_2', food_name: 'éclair' },
        ],
      }),
    ).toEqual([]);
  });
});
