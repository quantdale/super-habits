import { appMetaKeys, getAppMetaJsonOrDefault, setAppMetaJson } from '@/core/db/appMeta';
import { getDatabase } from '@/core/db/client';
import { CalorieEntry, SavedMeal } from '@/core/db/types';
import type { LinkedActionEffectAdapterResult } from '@/core/linked-actions/linkedActions.types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createId } from '@/lib/id';
import { isValidDateKey, nowIso, toDateKey } from '@/lib/time';
import {
  runBackupMutation,
  runSyncedMutation,
  enqueueBackupSettingsRecord,
} from '@/core/sync/syncedMutation';

import {
  DEFAULT_CALORIE_GOAL,
  kcalFromMacros,
  normalizeCalorieGoal,
  normalizeMacroTargets,
} from '@/features/calories/calories.domain';
import { CALORIES_TARGETS_STORAGE_KEY } from '@/features/calories/caloriesTargets';
import type { MacroTargets } from '@/features/calories/calories.domain';
import type { CalorieGoal, DailySummary } from '@/features/calories/types';

export type { CalorieGoal, DailySummary } from '@/features/calories/types';

export async function getCalorieSummaryByRange(
  startDateKey: string,
  endDateKey: string,
): Promise<DailySummary[]> {
  const db = await getDatabase();
  return db.getAllAsync<DailySummary>(
    `SELECT
       consumed_on            AS dateKey,
       SUM(calories)          AS totalCalories,
       SUM(protein)           AS totalProtein,
       SUM(carbs)             AS totalCarbs,
       SUM(fats)              AS totalFats,
       SUM(fiber)             AS totalFiber
     FROM calorie_entries
     WHERE deleted_at IS NULL
       AND consumed_on >= ?
       AND consumed_on <= ?
     GROUP BY consumed_on
     ORDER BY consumed_on ASC`,
    [startDateKey, endDateKey],
  );
}

export async function countCalorieEntriesByRange(
  startDateKey: string,
  endDateKey: string,
): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) AS count
     FROM calorie_entries
     WHERE deleted_at IS NULL
       AND consumed_on >= ?
       AND consumed_on <= ?`,
    [startDateKey, endDateKey],
  );
  return row?.count ?? 0;
}

export const DEFAULT_GOAL: CalorieGoal = DEFAULT_CALORIE_GOAL;

export async function getCalorieGoal(): Promise<CalorieGoal> {
  const db = await getDatabase();
  return getAppMetaJsonOrDefault<CalorieGoal>(
    db,
    appMetaKeys.calorieGoal,
    DEFAULT_GOAL,
    normalizeCalorieGoal,
  );
}

export async function setCalorieGoal(goal: CalorieGoal): Promise<void> {
  const db = await getDatabase();
  await setAppMetaJson(db, appMetaKeys.calorieGoal, normalizeCalorieGoal(goal));
  await enqueueBackupSettingsRecord(db);
}

export async function listCalorieEntries(dateKey = toDateKey()): Promise<CalorieEntry[]> {
  const db = await getDatabase();
  return db.getAllAsync<CalorieEntry>(
    'SELECT * FROM calorie_entries WHERE deleted_at IS NULL AND consumed_on = ? ORDER BY created_at DESC',
    [dateKey],
  );
}

export async function hasAnyCalorieEntries(): Promise<boolean> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ id: string }>(
    `SELECT id
     FROM calorie_entries
     WHERE deleted_at IS NULL
     LIMIT 1`,
  );
  return Boolean(row);
}

export async function addCalorieEntry(input: {
  foodName: string;
  calories: number;
  protein?: number;
  carbs?: number;
  fats?: number;
  fiber?: number;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  consumedOn?: string;
}): Promise<void> {
  const id = createId('cal');
  const now = nowIso();
  const consumedOn = input.consumedOn ?? toDateKey();
  const db = await getDatabase();
  await runSyncedMutation({
    db,
    record: { entity: 'calorie_entries', id, updatedAt: now, operation: 'create' },
    mutate: async (transactionDb) => {
      await transactionDb.runAsync(
        'INSERT INTO calorie_entries (id, food_name, calories, protein, carbs, fats, fiber, meal_type, consumed_on, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)',
        [
          id,
          input.foodName,
          input.calories,
          input.protein ?? 0,
          input.carbs ?? 0,
          input.fats ?? 0,
          input.fiber ?? 0,
          input.mealType,
          consumedOn,
          now,
          now,
        ],
      );
      return { changed: true, value: undefined };
    },
  });
  try {
    await upsertSavedMeal({
      foodName: input.foodName,
      calories: input.calories,
      protein: input.protein ?? 0,
      carbs: input.carbs ?? 0,
      fats: input.fats ?? 0,
      fiber: input.fiber ?? 0,
      mealType: input.mealType,
    });
  } catch (error) {
    // The calorie ledger is authoritative. Saved meals are a local convenience
    // index; a cache failure must not turn a committed ledger write into a
    // reported failure that encourages a duplicate retry.
    console.error('[calories] saved-meal maintenance failed after add', error);
  }
}

export async function updateCalorieEntry(
  id: string,
  updates: {
    foodName: string;
    protein: number;
    carbs: number;
    fats: number;
    fiber: number;
    mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  },
): Promise<'updated' | 'not_found'> {
  const db = await getDatabase();
  const now = nowIso();
  const calories = kcalFromMacros(updates.protein, updates.carbs, updates.fats, updates.fiber);
  const result = await runSyncedMutation<'updated' | 'not_found'>({
    db,
    record: { entity: 'calorie_entries', id, updatedAt: now, operation: 'update' },
    mutate: async (transactionDb) => {
      const update = await transactionDb.runAsync(
        `UPDATE calorie_entries SET
       food_name = ?,
       calories = ?,
       protein = ?,
       carbs = ?,
       fats = ?,
       fiber = ?,
       meal_type = ?,
       updated_at = ?
     WHERE id = ?
       AND deleted_at IS NULL`,
        [
          updates.foodName,
          calories,
          updates.protein,
          updates.carbs,
          updates.fats,
          updates.fiber,
          updates.mealType,
          now,
          id,
        ],
      );
      return {
        changed: update.changes === 1,
        value: update.changes === 1 ? 'updated' : 'not_found',
      };
    },
  });
  if (!result.changed) return result.value;
  try {
    await upsertSavedMeal({
      foodName: updates.foodName,
      calories,
      protein: updates.protein,
      carbs: updates.carbs,
      fats: updates.fats,
      fiber: updates.fiber,
      mealType: updates.mealType,
    });
  } catch (error) {
    console.error('[calories] saved-meal maintenance failed after update', error);
  }
  return result.value;
}

export async function upsertSavedMeal(input: {
  foodName: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  fiber: number;
  mealType: string;
}): Promise<void> {
  if (!input.foodName?.trim()) return;

  const db = await getDatabase();
  const now = nowIso();

  // Atomic upsert keyed on the case-insensitive unique index
  // (idx_saved_meals_food_name); the previous read-then-insert raced it and
  // threw on concurrent duplicates. On conflict the original id, created_at,
  // and food_name casing are kept, matching the old UPDATE branch. The backup
  // intent is created in the same transaction with the actual row id.
  await runBackupMutation({
    db,
    mutate: async (transactionDb, enqueue) => {
      const saved = await transactionDb.getFirstAsync<{ id: string }>(
        `INSERT INTO saved_meals
           (id, food_name, calories, protein, carbs, fats, fiber,
            meal_type, use_count, last_used_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
         ON CONFLICT(food_name COLLATE NOCASE) DO UPDATE SET
           calories     = excluded.calories,
           protein      = excluded.protein,
           carbs        = excluded.carbs,
           fats         = excluded.fats,
           fiber        = excluded.fiber,
           meal_type    = excluded.meal_type,
           use_count    = use_count + 1,
           last_used_at = excluded.last_used_at
         RETURNING id`,
        [
          createId('smeal'),
          input.foodName,
          input.calories,
          input.protein,
          input.carbs,
          input.fats,
          input.fiber,
          input.mealType,
          now,
          now,
        ],
      );
      if (!saved) return { changed: false, value: undefined };
      enqueue({
        entity: 'saved_meals',
        id: saved.id,
        updatedAt: now,
        operation: 'create',
      });
      return { changed: true, value: undefined };
    },
  });
  // A saved meal is meaningful user content: it durably claims the dataset
  // for the current anonymous owner (handled by runBackupMutation).
}

export async function listRecentSavedMeals(limit: number = 5): Promise<SavedMeal[]> {
  const db = await getDatabase();
  return db.getAllAsync<SavedMeal>(
    `SELECT * FROM saved_meals
     ORDER BY last_used_at DESC
     LIMIT ?`,
    [limit],
  );
}

/** Escape `\`, `%`, `_` for SQLite `LIKE ... ESCAPE '\\'`. */
function escapeSqliteLikePattern(fragment: string): string {
  return fragment.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

/** Cap for the unfiltered saved-meal catalog load (`searchSavedMeals('')`). */
const SAVED_MEAL_CATALOG_LIMIT = 500;

export async function searchSavedMeals(query: string): Promise<SavedMeal[]> {
  const db = await getDatabase();
  if (!query.trim()) {
    // Unfiltered catalog load: capped so years of saved meals cannot grow the
    // per-refresh payload without bound. Specific searches stay uncapped.
    return db.getAllAsync<SavedMeal>(
      `SELECT * FROM saved_meals
       ORDER BY use_count DESC, last_used_at DESC
       LIMIT ?`,
      [SAVED_MEAL_CATALOG_LIMIT],
    );
  }
  const trimmed = query.trim();
  const escaped = escapeSqliteLikePattern(trimmed);
  return db.getAllAsync<SavedMeal>(
    `SELECT * FROM saved_meals
     WHERE food_name LIKE ? ESCAPE '\\' COLLATE NOCASE
     ORDER BY use_count DESC, last_used_at DESC`,
    [`%${escaped}%`],
  );
}

export async function deleteSavedMeal(id: string): Promise<void> {
  const db = await getDatabase();
  const now = nowIso();
  // Saved meals hard-delete locally (documented exception), so the backup
  // intent is an owner-scoped remote DELETE carried by the same outbox.
  await runBackupMutation({
    db,
    mutate: async (transactionDb, enqueue) => {
      const result = await transactionDb.runAsync('DELETE FROM saved_meals WHERE id = ?', [id]);
      if (result.changes !== 1) return { changed: false, value: undefined };
      enqueue({ entity: 'saved_meals', id, updatedAt: now, operation: 'delete' });
      return { changed: true, value: undefined };
    },
  });
}

/**
 * Structured copy-day outcome. `invalid-range` carries the reason so callers
 * can give precise feedback: a malformed date key, copying a day onto itself,
 * or a source day later than the target day.
 */
export type CopyDayResult =
  | { status: 'copied'; copiedCount: number }
  | { status: 'source-empty' }
  | { status: 'invalid-range'; reason: 'malformed-date-key' | 'same-day' | 'source-after-target' };

/**
 * Copy-day: duplicate every entry logged on `sourceDateKey` into
 * `targetDateKey` (default today). Each copy gets a fresh id and its own
 * synced create record. Saved-meal maintenance is deliberately skipped so
 * copying does not inflate use_count.
 *
 * The whole batch is ONE transaction (`runBackupMutation`): the source read,
 * every insert, and every outbox intent happen inside the same SQLite
 * transaction, so a mid-batch failure rolls back all copies and their backup
 * intents — never a silent partial copy. The result is returned only on
 * commit.
 */
export async function copyCalorieEntriesFromDay(
  sourceDateKey: string,
  targetDateKey: string = toDateKey(),
): Promise<CopyDayResult> {
  if (!isValidDateKey(sourceDateKey) || !isValidDateKey(targetDateKey)) {
    return { status: 'invalid-range', reason: 'malformed-date-key' };
  }
  if (sourceDateKey === targetDateKey) {
    return { status: 'invalid-range', reason: 'same-day' };
  }
  if (sourceDateKey > targetDateKey) {
    return { status: 'invalid-range', reason: 'source-after-target' };
  }

  const db = await getDatabase();
  const now = nowIso();
  const outcome = await runBackupMutation<CopyDayResult>({
    db,
    mutate: async (transactionDb, enqueue) => {
      // Read the source inside the transaction so the batch is a consistent
      // read-modify-write against concurrent edits.
      const sourceEntries = await transactionDb.getAllAsync<CalorieEntry>(
        `SELECT * FROM calorie_entries
         WHERE deleted_at IS NULL AND consumed_on = ?
         ORDER BY created_at ASC`,
        [sourceDateKey],
      );
      if (sourceEntries.length === 0) {
        return { changed: false, value: { status: 'source-empty' } };
      }

      let copiedCount = 0;
      for (const entry of sourceEntries) {
        const id = createId('cal');
        await transactionDb.runAsync(
          'INSERT INTO calorie_entries (id, food_name, calories, protein, carbs, fats, fiber, meal_type, consumed_on, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)',
          [
            id,
            entry.food_name,
            entry.calories,
            entry.protein,
            entry.carbs,
            entry.fats,
            entry.fiber,
            entry.meal_type,
            targetDateKey,
            now,
            now,
          ],
        );
        enqueue({ entity: 'calorie_entries', id, updatedAt: now, operation: 'create' });
        copiedCount += 1;
      }
      return { changed: true, value: { status: 'copied', copiedCount } };
    },
  });
  return outcome.value;
}

export async function deleteCalorieEntry(id: string): Promise<'deleted' | 'not_found'> {
  const now = nowIso();
  const db = await getDatabase();
  const result = await runSyncedMutation<'deleted' | 'not_found'>({
    db,
    record: { entity: 'calorie_entries', id, updatedAt: now, operation: 'delete' },
    mutate: async (transactionDb) => {
      const deleted = await transactionDb.runAsync(
        'UPDATE calorie_entries SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL',
        [now, now, id],
      );
      return {
        changed: deleted.changes === 1,
        value: deleted.changes === 1 ? 'deleted' : 'not_found',
      };
    },
  });
  return result.value;
}

export async function addCalorieEntryFromLinkedAction(input: {
  id: string;
  foodName: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  fiber: number;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  consumedOn: string;
}): Promise<LinkedActionEffectAdapterResult> {
  const db = await getDatabase();
  const existing = await db.getFirstAsync<Pick<CalorieEntry, 'id' | 'food_name'>>(
    `SELECT id, food_name FROM calorie_entries WHERE id = ? AND deleted_at IS NULL`,
    [input.id],
  );
  if (existing) {
    return {
      status: 'applied',
      targetLabel: existing.food_name,
      producedEntityType: 'calorie_log',
      producedEntityId: existing.id,
    };
  }

  const now = nowIso();
  const outcome = await runSyncedMutation({
    db,
    record: { entity: 'calorie_entries', id: input.id, updatedAt: now, operation: 'create' },
    mutate: async (transactionDb) => {
      const concurrent = await transactionDb.getFirstAsync<Pick<CalorieEntry, 'id' | 'food_name'>>(
        `SELECT id, food_name FROM calorie_entries WHERE id = ? AND deleted_at IS NULL`,
        [input.id],
      );
      if (concurrent) return { changed: false, value: concurrent };
      await transactionDb.runAsync(
        `INSERT INTO calorie_entries (
       id,
       food_name,
       calories,
       protein,
       carbs,
       fats,
       fiber,
       meal_type,
       consumed_on,
       created_at,
       updated_at,
       deleted_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
        [
          input.id,
          input.foodName,
          input.calories,
          input.protein,
          input.carbs,
          input.fats,
          input.fiber,
          input.mealType,
          input.consumedOn,
          now,
          now,
        ],
      );
      return { changed: true, value: { id: input.id, food_name: input.foodName } };
    },
  });
  if (!outcome.changed) {
    return {
      status: 'applied',
      targetLabel: outcome.value.food_name,
      producedEntityType: 'calorie_log',
      producedEntityId: outcome.value.id,
    };
  }
  try {
    await upsertSavedMeal({
      foodName: input.foodName,
      calories: input.calories,
      protein: input.protein,
      carbs: input.carbs,
      fats: input.fats,
      fiber: input.fiber,
      mealType: input.mealType,
    });
  } catch (error) {
    console.error('[calories] saved-meal maintenance failed after linked add', error);
  }

  return {
    status: 'applied',
    targetLabel: input.foodName,
    producedEntityType: 'calorie_log',
    producedEntityId: input.id,
  };
}

export async function applyRemoteCalorieEntries(
  db: Awaited<ReturnType<typeof getDatabase>>,
  rows: CalorieEntry[],
): Promise<void> {
  for (const row of rows) {
    await db.runAsync(
      `INSERT OR REPLACE INTO calorie_entries (
         id,
         food_name,
         calories,
         protein,
         carbs,
         fats,
         fiber,
         meal_type,
         consumed_on,
         created_at,
         updated_at,
         deleted_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        row.id,
        row.food_name,
        row.calories,
        row.protein,
        row.carbs,
        row.fats,
        row.fiber,
        row.meal_type,
        row.consumed_on,
        row.created_at,
        row.updated_at,
        row.deleted_at,
      ],
    );
  }
}

/**
 * Restore-only import for saved meals. Plain INSERT OR REPLACE preserving
 * use_count and last_used_at — importing must never look like usage.
 */
export async function applyRemoteSavedMeals(
  db: Awaited<ReturnType<typeof getDatabase>>,
  rows: SavedMeal[],
): Promise<void> {
  for (const row of rows) {
    await db.runAsync(
      `INSERT OR REPLACE INTO saved_meals (
         id,
         food_name,
         calories,
         protein,
         carbs,
         fats,
         fiber,
         meal_type,
         use_count,
         last_used_at,
         created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        row.id,
        row.food_name,
        row.calories,
        row.protein,
        row.carbs,
        row.fats,
        row.fiber,
        row.meal_type,
        row.use_count,
        row.last_used_at,
        row.created_at,
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Macro targets (recoverable Settings V3 source: app_meta `calorie_targets`).
// Lives in the data layer because it touches SQLite directly; the thin
// re-export in caloriesTargets.ts keeps consumer import sites stable.
// ---------------------------------------------------------------------------

/**
 * Load the stored macro targets, or null when unset/malformed (the UI then
 * falls back to the calorie goal). Same normalize-on-read contract as the
 * other app_meta-backed preference stores.
 */
export async function loadMacroTargetsData(): Promise<MacroTargets | null> {
  const db = await getDatabase();
  const stored = await getAppMetaJsonOrDefault<MacroTargets | null>(
    db,
    appMetaKeys.calorieTargets,
    null,
    normalizeMacroTargets,
  );
  if (stored) return stored;
  return importLegacyAsyncStorageTargets(db);
}

/**
 * One-time idempotent legacy import: devices that saved targets under the old
 * AsyncStorage key keep them. Runs only while app_meta has no value; app_meta
 * is written BEFORE the legacy key is removed, so a failed removal at worst
 * re-imports the same value on the next load.
 */
async function importLegacyAsyncStorageTargets(
  db: Awaited<ReturnType<typeof getDatabase>>,
): Promise<MacroTargets | null> {
  let raw: string | null = null;
  try {
    raw = await AsyncStorage.getItem(CALORIES_TARGETS_STORAGE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  let parsed: unknown = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = null;
  }
  const normalized = normalizeMacroTargets(parsed);
  if (!normalized) {
    // Malformed legacy value: drop the key so we stop re-parsing it each load.
    try {
      await AsyncStorage.removeItem(CALORIES_TARGETS_STORAGE_KEY);
    } catch {
      // Best-effort cleanup.
    }
    return null;
  }

  try {
    await setAppMetaJson(db, appMetaKeys.calorieTargets, normalized);
  } catch {
    // Keep the legacy key: the value is not durably imported yet.
    return null;
  }
  // Best-effort cleanup; app_meta already wins on every later load.
  try {
    await AsyncStorage.removeItem(CALORIES_TARGETS_STORAGE_KEY);
  } catch {
    // Ignore removal failures.
  }
  return normalized;
}

/**
 * Persist normalized targets to app_meta `calorie_targets` and re-capture the
 * recoverable-settings snapshot so the new value rides the backup outbox.
 */
export async function saveMacroTargetsData(targets: MacroTargets): Promise<void> {
  const normalized = normalizeMacroTargets(targets);
  if (!normalized) {
    throw new Error('Invalid macro targets payload.');
  }
  const db = await getDatabase();
  await setAppMetaJson(db, appMetaKeys.calorieTargets, normalized);
  await enqueueBackupSettingsRecord(db);
}
