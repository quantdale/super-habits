import { describe, expect, it } from 'vitest';
import type { TestDatabase } from './helpers/db';
import { freshDatabase } from './helpers/db';
import { toDateKey } from '@/lib/time';

/**
 * Task 2.6 — SQL constraints the app's data layer depends on, asserted against
 * a REAL better-sqlite3 database (the unit suite mocks SQLite away, so these
 * facts are never executed there):
 *
 *   - `habit_completions.UNIQUE(habit_id, date_key)` drives the `ON CONFLICT
 *     DO UPDATE` increment path in `incrementHabit` (features/habits/habits.data.ts).
 *   - `saved_meals`'s `idx_saved_meals_food_name` unique index is
 *     `COLLATE NOCASE`, targeted by `upsertSavedMeal`'s `ON CONFLICT(food_name
 *     COLLATE NOCASE)` (features/calories/calories.data.ts).
 *   - The two linked-action execution unique indexes
 *     `(rule_id, source_event_id)` and `(chain_id, rule_id, effect_fingerprint)`
 *     (core/linked-actions/, migrations 10/11).
 *
 * Each test opens a fresh database through `freshDatabase()` and dynamically
 * imports the data layers afterwards (the module registry is reset per test).
 */

// Increments must land on an actionable date (today) for the write gate to
// let them through; this suite exercises the UNIQUE-constraint mechanics.
const DATE_KEY = toDateKey();

describe('habit_completions UNIQUE(habit_id, date_key)', () => {
  it('two rapid increments through the real data layer produce one row, not a constraint violation', async () => {
    const db = await freshDatabase();
    const habits = await import('@/features/habits/habits.data');

    const habitId = await habits.addHabit('Drink water', 3);

    // Two rapid taps — the exact race the atomic upsert was written for. The
    // ON CONFLICT DO UPDATE path must not throw UNIQUE and must not lose or
    // duplicate an increment.
    const first = await habits.incrementHabit(habitId, DATE_KEY);
    const second = await habits.incrementHabit(habitId, DATE_KEY);

    expect(first.count).toBe(1);
    expect(second.count).toBe(2);

    const rows = await db.getAllAsync<{
      id: string;
      habit_id: string;
      date_key: string;
      count: number;
    }>(
      'SELECT id, habit_id, date_key, count FROM habit_completions WHERE habit_id = ? AND date_key = ?',
      [habitId, DATE_KEY],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].count).toBe(2);

    // The conflict target is the table-level UNIQUE(habit_id, date_key) which
    // materialises the auto-index asserted in migrations.test.ts.
    const indexes = await db.getAllAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'habit_completions'",
    );
    expect(indexes.map((i) => i.name)).toContain('sqlite_autoindex_habit_completions_1');

    await db.closeAsync();
  });

  it('a bare INSERT violating UNIQUE(habit_id, date_key) is rejected by the engine', async () => {
    const db = await freshDatabase();
    const habits = await import('@/features/habits/habits.data');

    const habitId = await habits.addHabit('Stretch', 3);
    await habits.incrementHabit(habitId, DATE_KEY);

    // A second insert for the same (habit_id, date_key) WITHOUT the ON CONFLICT
    // clause must be rejected by the real UNIQUE constraint — this is the
    // pre-atomic-upsert failure the app no longer hits through the data layer.
    await expect(
      db.runAsync(
        `INSERT INTO habit_completions (id, habit_id, date_key, count, created_at, updated_at)
         VALUES ('hcmp_dup', ?, ?, 1, '2026-07-01T00:00:00.000Z', '2026-07-01T00:00:00.000Z')`,
        [habitId, DATE_KEY],
      ),
    ).rejects.toThrow(/UNIQUE constraint failed/);

    await db.closeAsync();
  });

  it('increment/decrement cycles keep a single row per (habit_id, date_key)', async () => {
    const db = await freshDatabase();
    const habits = await import('@/features/habits/habits.data');

    const habitId = await habits.addHabit('Meditate', 3);
    await habits.incrementHabit(habitId, DATE_KEY);
    await habits.incrementHabit(habitId, DATE_KEY);
    await habits.decrementHabit(habitId, DATE_KEY);

    const row = await db.getFirstAsync<{ count: number }>(
      'SELECT count FROM habit_completions WHERE habit_id = ? AND date_key = ?',
      [habitId, DATE_KEY],
    );
    expect(row?.count).toBe(1);

    await db.closeAsync();
  });
});

describe('saved_meals COLLATE NOCASE unique index', () => {
  it('meal names differing only by case collapse into one saved meal via the real add path', async () => {
    const db = await freshDatabase();
    const calories = await import('@/features/calories/calories.data');

    // Two meals with the same food name differing only in case. The second
    // upsert must hit the NOCASE unique index and UPDATE-in-place: one row,
    // use_count incremented, original casing kept.
    await calories.addCalorieEntry({
      foodName: 'Oatmeal',
      calories: 320,
      protein: 9,
      carbs: 55,
      fats: 6,
      mealType: 'breakfast',
      consumedOn: DATE_KEY,
    });
    await calories.addCalorieEntry({
      foodName: 'oatmeal',
      calories: 300,
      protein: 8,
      carbs: 50,
      fats: 5,
      mealType: 'breakfast',
      consumedOn: DATE_KEY,
    });

    const rows = await db.getAllAsync<{ food_name: string; use_count: number }>(
      'SELECT food_name, use_count FROM saved_meals',
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].food_name).toBe('Oatmeal'); // original casing preserved
    expect(rows[0].use_count).toBe(2);

    await db.closeAsync();
  });

  it('a bare INSERT differing only by case on the unique index is rejected by the engine', async () => {
    const db = await freshDatabase();
    const now = '2026-07-01T00:00:00.000Z';
    await db.runAsync(
      `INSERT INTO saved_meals
         (id, food_name, calories, protein, carbs, fats, fiber, meal_type, use_count, last_used_at, created_at)
       VALUES ('smeal_1', 'Apple', 80, 0, 20, 0, 0, 'snack', 1, ?, ?)`,
      [now, now],
    );

    // Same food name, different case, no ON CONFLICT clause → the NOCASE
    // unique index must reject it. This proves the index really is NOCASE at
    // the engine level, not just at the app layer.
    await expect(
      db.runAsync(
        `INSERT INTO saved_meals
           (id, food_name, calories, protein, carbs, fats, fiber, meal_type, use_count, last_used_at, created_at)
         VALUES ('smeal_2', 'apple', 80, 0, 20, 0, 0, 'snack', 1, ?, ?)`,
        [now, now],
      ),
    ).rejects.toThrow(/UNIQUE constraint failed/);

    await db.closeAsync();
  });
});

describe('linked action execution unique indexes', () => {
  /**
   * Creates a real rule + source event + applied execution through the data
   * layer and engine (task 2.9 covers the full cycle; here we only need a
   * genuine row to exercise the indexes against).
   */
  async function seedAppliedExecution(db: TestDatabase): Promise<{
    ruleId: string;
    sourceEventId: string;
    chainId: string;
    effectFingerprint: string;
  }> {
    const habits = await import('@/features/habits/habits.data');
    const linked = await import('@/core/linked-actions/linkedActions.data');
    const engine = await import('@/core/linked-actions/linkedActions.engine');

    const habitId = await habits.addHabit('Source habit', 1);
    const targetHabitId = await habits.addHabit('Target habit', 3);

    await linked.createLinkedActionRule({
      source: {
        feature: 'habits',
        entityType: 'habit',
        entityId: habitId,
        triggerType: 'habit.completed_for_day',
      },
      target: {
        feature: 'habits',
        entityType: 'habit',
        entityId: targetHabitId,
        effect: {
          kind: 'progress',
          type: 'habit.increment',
          amount: 1,
          dateStrategy: 'source_date',
        },
      },
    });

    const result = await engine.linkedActionsEngine.processSourceAction({
      eventId: 'levt_0001',
      feature: 'habits',
      entityType: 'habit',
      entityId: habitId,
      triggerType: 'habit.completed_for_day',
      label: 'Source habit',
      sourceDateKey: DATE_KEY,
      chain: { chainId: 'lchain_0001' },
    });

    expect(result.effects[0].status).toBe('applied');

    const execution = await db.getFirstAsync<{
      rule_id: string;
      source_event_id: string;
      chain_id: string;
      effect_fingerprint: string;
    }>(
      'SELECT rule_id, source_event_id, chain_id, effect_fingerprint FROM linked_action_executions',
    );
    expect(execution).not.toBeNull();
    return {
      ruleId: execution!.rule_id,
      sourceEventId: execution!.source_event_id,
      chainId: execution!.chain_id,
      effectFingerprint: execution!.effect_fingerprint,
    };
  }

  it('(rule_id, source_event_id) rejects a second execution for the same source event', async () => {
    const db = await freshDatabase();
    const { ruleId, sourceEventId, chainId, effectFingerprint } = await seedAppliedExecution(db);

    // The app-level `getLinkedActionExecutionByRuleAndSourceEvent` guard already
    // prevents this; the UNIQUE index is the backstop that must also hold.
    await expect(
      db.runAsync(
        `INSERT INTO linked_action_executions (
           id, rule_id, source_event_id, chain_id, root_event_id, origin_rule_id,
           effect_type, effect_fingerprint, status, target_feature, target_entity_type,
           target_entity_id, produced_entity_type, produced_entity_id, notice_payload,
           error_message, created_at, updated_at
         ) VALUES ('lexec_dup_source', ?, ?, ?, ?, NULL, 'habit.increment', ?, 'applied',
           'habits', 'habit', 'habit_target', NULL, NULL, NULL, NULL,
           '2026-07-01T00:00:00.000Z', '2026-07-01T00:00:00.000Z')`,
        [ruleId, sourceEventId, chainId, sourceEventId, effectFingerprint],
      ),
    ).rejects.toThrow(/UNIQUE constraint failed/);

    await db.closeAsync();
  });

  it('(chain_id, rule_id, effect_fingerprint) rejects a duplicate-chain execution', async () => {
    const db = await freshDatabase();
    const { ruleId, chainId, effectFingerprint } = await seedAppliedExecution(db);

    // Same chain + rule + fingerprint but a DIFFERENT source event. The chain
    // guard index must reject it — this is what stops a rapid double-fire of
    // the same logical action from applying twice.
    await expect(
      db.runAsync(
        `INSERT INTO linked_action_executions (
           id, rule_id, source_event_id, chain_id, root_event_id, origin_rule_id,
           effect_type, effect_fingerprint, status, target_feature, target_entity_type,
           target_entity_id, produced_entity_type, produced_entity_id, notice_payload,
           error_message, created_at, updated_at
         ) VALUES ('lexec_dup_chain', ?, 'levt_0002', ?, 'levt_0002', NULL,
           'habit.increment', ?, 'applied', 'habits', 'habit', 'habit_target',
           NULL, NULL, NULL, NULL, '2026-07-01T00:00:00.000Z', '2026-07-01T00:00:00.000Z')`,
        [ruleId, chainId, effectFingerprint],
      ),
    ).rejects.toThrow(/UNIQUE constraint failed/);

    await db.closeAsync();
  });
});
