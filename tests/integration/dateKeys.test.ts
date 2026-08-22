// NOTE ON TZ: this file exercises LOCAL-calendar date keys, so it forces a
// non-UTC timezone at the very top, before any import of `lib/time` (whose
// `toDateKey` reads the process's calendar via Date getters). Verified: Node
// re-reads `process.env.TZ` per Date operation, so setting it here is
// sufficient regardless of the CI job's TZ — no runner-level env needed. The
// first test below asserts the offset actually applied, so a future Node
// change that caches TZ at first use fails loudly instead of silently running
// in UTC.
import { afterAll, describe, expect, it } from 'vitest';
import { freshDatabase } from './helpers/db';

const ORIGINAL_TZ = process.env.TZ;
process.env.TZ = 'Asia/Manila'; // UTC+8, no DST

afterAll(() => {
  if (ORIGINAL_TZ === undefined) {
    delete process.env.TZ;
  } else {
    process.env.TZ = ORIGINAL_TZ;
  }
});

/** Manila UTC+8: local midnight = 16:00 UTC the previous day. */
const LOCAL_MIDNIGHT_UTC_BASE = '2026-06-30T16:00:00.000Z'; // = local 2026-07-01 00:00

describe('timezone enforcement', () => {
  it('the real toDateKey honours the Manila offset set at the top of this file', async () => {
    const { toDateKey } = await import('@/lib/time');

    // 20:00 UTC on June 30 is 04:00 local on July 1 — the local calendar day
    // differs from the UTC day, which is exactly why migration 5 moved to
    // local keys.
    expect(toDateKey(new Date('2026-06-30T20:00:00.000Z'))).toBe('2026-07-01');
    // 16:00 UTC on July 1 is exactly local midnight July 2.
    expect(toDateKey(new Date('2026-07-01T16:00:00.000Z'))).toBe('2026-07-02');
    // A millisecond before that is still July 1 locally.
    expect(toDateKey(new Date('2026-07-01T15:59:59.999Z'))).toBe('2026-07-01');
    // Just before local midnight June 30 → July 1 is still June 30.
    expect(toDateKey(new Date('2026-06-30T15:59:59.999Z'))).toBe('2026-06-30');
  });
});

describe('local date-key writes and reads', () => {
  it('a calorie entry written on a local key is only visible under that key', async () => {
    const db = await freshDatabase();
    const { toDateKey } = await import('@/lib/time');
    const calories = await import('@/features/calories/calories.data');

    // Land the entry on the LOCAL day that starts at 16:00 UTC the day before.
    const localKey = toDateKey(new Date('2026-06-30T20:00:00.000Z'));
    expect(localKey).toBe('2026-07-01');

    await calories.addCalorieEntry({
      foodName: 'Local-noon salad',
      calories: 305,
      protein: 10,
      carbs: 20,
      fats: 18,
      mealType: 'lunch',
      consumedOn: localKey,
    });

    expect((await calories.listCalorieEntries('2026-07-01')).map((e) => e.food_name)).toEqual([
      'Local-noon salad',
    ]);
    expect(await calories.listCalorieEntries('2026-06-30')).toHaveLength(0);

    const summary = await calories.getCalorieSummaryByRange('2026-07-01', '2026-07-01');
    expect(summary).toEqual([
      expect.objectContaining({ dateKey: '2026-07-01', totalCalories: 305 }),
    ]);
    await db.closeAsync();
  });

  it('habit completions keep an explicit local date key and read back by it', async () => {
    const db = await freshDatabase();
    const habits = await import('@/features/habits/habits.data');

    const habitId = await habits.addHabit('Stretch', 3);
    // The lifecycle write gate (migration 20 semantics) rejects check-ins
    // before the habit existed, so backdate the seed habit to before the
    // exercised dates; the increments below still run through incrementHabit.
    const { createHabitRule } = await import('@/features/habits/habits.domain');
    await db.runAsync('UPDATE habits SET created_at = ?, rule_history = ? WHERE id = ?', [
      '2026-06-01T00:00:00.000Z',
      JSON.stringify([createHabitRule('2026-07-01', [1, 2, 3, 4, 5, 6, 7], 3)]),
      habitId,
    ]);
    await habits.incrementHabit(habitId, '2026-07-01');
    await habits.incrementHabit(habitId, '2026-07-02');

    expect(await habits.getHabitCountByDate(habitId, '2026-07-01')).toBe(1);
    expect(await habits.getHabitCountByDate(habitId, '2026-07-02')).toBe(1);
    expect(await habits.getHabitCountByDate(habitId, '2026-07-03')).toBe(0);

    const rows = await habits.getAllHabitCompletionsForRange('2026-07-01', '2026-07-02');
    expect(rows.map((r) => r.date_key)).toEqual(['2026-07-01', '2026-07-02']);
    await db.closeAsync();
  });
});

describe('getUtcIsoRangeForLocalDateKeys boundaries (pomodoro_sessions / workout_logs)', () => {
  it('converts a local date-key range into the correct half-open UTC interval under Manila', async () => {
    const { getUtcIsoRangeForLocalDateKeys } = await import('@/lib/time');
    expect(getUtcIsoRangeForLocalDateKeys('2026-07-01', '2026-07-02')).toEqual({
      startUtcIso: '2026-06-30T16:00:00.000Z',
      endUtcExclusiveIso: '2026-07-02T16:00:00.000Z',
    });
  });

  it('pomodoro range queries include rows at the inclusive start and exclude the exclusive end', async () => {
    const db = await freshDatabase();
    const pomodoro = await import('@/features/pomodoro/pomodoro.data');

    // Started exactly at local midnight (inclusive) → included.
    await pomodoro.logPomodoroSession(
      LOCAL_MIDNIGHT_UTC_BASE,
      '2026-06-30T16:25:00.000Z',
      1500,
      'focus',
    );
    // Mid-day local → included.
    await pomodoro.logPomodoroSession(
      '2026-07-01T04:00:00.000Z',
      '2026-07-01T04:25:00.000Z',
      1500,
      'focus',
    );
    // One millisecond before the exclusive end (local 07-03 23:59:59) → included.
    await pomodoro.logPomodoroSession(
      '2026-07-02T15:59:59.999Z',
      '2026-07-02T16:24:59.999Z',
      1500,
      'focus',
    );
    // Exactly at the exclusive end (local 07-03 00:00:00) → excluded.
    await pomodoro.logPomodoroSession(
      '2026-07-02T16:00:00.000Z',
      '2026-07-02T16:25:00.000Z',
      1500,
      'focus',
    );

    const inRange = await pomodoro.listPomodoroSessionsForDateRange('2026-07-01', '2026-07-02');
    expect(inRange).toHaveLength(3);
    expect(inRange.map((s) => s.started_at).sort()).toEqual([
      '2026-06-30T16:00:00.000Z',
      '2026-07-01T04:00:00.000Z',
      '2026-07-02T15:59:59.999Z',
    ]);
    await db.closeAsync();
  });

  it('workout-log range queries respect the same half-open interval', async () => {
    const db = await freshDatabase();
    const workout = await import('@/features/workout/workout.data');
    await workout.addRoutine('Routine A', 'desc');
    const routine = (await workout.listRoutines())[0];

    // The workout data layer writes `completed_at = nowIso()` at call time and
    // exposes no timestamp parameter, so boundary rows for THIS query-edge test
    // are inserted directly; the queries under test are the point, not the
    // data layer's timestamp derivation.
    const boundaries = [
      '2026-06-30T16:00:00.000Z', // inclusive start →
      '2026-07-01T04:00:00.000Z', // mid local day
      '2026-07-02T15:59:59.999Z', // just before exclusive end
      '2026-07-02T16:00:00.000Z', // exactly at exclusive end →
    ];
    for (const [i, completedAt] of boundaries.entries()) {
      await db.runAsync(
        'INSERT INTO workout_logs (id, routine_id, notes, completed_at, created_at) VALUES (?, ?, NULL, ?, ?)',
        [`wrk_boundary_${i}`, routine.id, completedAt, completedAt],
      );
    }

    const inRange = await workout.listWorkoutLogsForRange('2026-07-01', '2026-07-02');
    expect(inRange.map((l) => l.completed_at).sort()).toEqual([
      '2026-06-30T16:00:00.000Z',
      '2026-07-01T04:00:00.000Z',
      '2026-07-02T15:59:59.999Z',
    ]);
    expect(await workout.listWorkoutLogs()).toHaveLength(4);
    await db.closeAsync();
  });
});

describe('mixed corpus containing pre-cutover UTC date keys', () => {
  it('rows written before the migration-5 cutover keep their UTC-era keys, unbackfilled', async () => {
    const db = await freshDatabase();
    const habits = await import('@/features/habits/habits.data');
    const calories = await import('@/features/calories/calories.data');

    // Migration 5 records the cutover and deliberately does not backfill:
    // pre-cutover rows keep UTC-format keys. For a local 2026-06-30 morning
    // the UTC era key would have been '2026-06-29'; local-era rows use the
    // local key. The corpus therefore mixes both flavours.
    const cutover = await db.getFirstAsync<{ value: string }>(
      'SELECT value FROM app_meta WHERE key = ?',
      ['date_key_cutover'],
    );
    const format = await db.getFirstAsync<{ value: string }>(
      'SELECT value FROM app_meta WHERE key = ?',
      ['date_key_format'],
    );
    expect(cutover?.value).toBeDefined();
    expect(format?.value).toBe('local');

    const habitId = await habits.addHabit('Old habit', 5);
    // Backdate the seed habit so the lifecycle gate accepts the pre-cutover
    // and cutover-era completions this test writes through incrementHabit.
    const { createHabitRule } = await import('@/features/habits/habits.domain');
    await db.runAsync('UPDATE habits SET created_at = ?, rule_history = ? WHERE id = ?', [
      '2026-06-01T00:00:00.000Z',
      JSON.stringify([createHabitRule('2026-06-01', [1, 2, 3, 4, 5, 6, 7], 5)]),
      habitId,
    ]);
    await habits.incrementHabit(habitId, '2026-06-29'); // UTC-era key
    await habits.incrementHabit(habitId, '2026-07-01'); // local-era key

    await calories.addCalorieEntry({
      foodName: 'Pre-cutover oats',
      calories: 220,
      protein: 8,
      carbs: 34,
      fats: 5,
      mealType: 'breakfast',
      consumedOn: '2026-06-29',
    });
    await calories.addCalorieEntry({
      foodName: 'Local-era oatmeal',
      calories: 250,
      protein: 9,
      carbs: 40,
      fats: 6,
      mealType: 'breakfast',
      consumedOn: '2026-07-01',
    });

    // Habit completion history spanning the cutover returns both flavours in
    // string order — the app reads pre-cutover rows as-is.
    const history = await habits.getCompletionHistory(habitId, 60);
    expect(history.map((h) => h.date_key)).toEqual(['2026-06-29', '2026-07-01']);

    // A summary spanning both eras shows both groups under their STORED keys;
    // a summary scoped to the local era sees only the local-era row. The app
    // treats date keys opaquely, so the mix never breaks a range query.
    const spanning = await calories.getCalorieSummaryByRange('2026-06-29', '2026-07-01');
    expect(spanning.map((s) => s.dateKey)).toEqual(['2026-06-29', '2026-07-01']);
    expect(spanning[0].totalCalories).toBe(220);
    expect(spanning[1].totalCalories).toBe(250);

    const localOnly = await calories.getCalorieSummaryByRange('2026-07-01', '2026-07-01');
    expect(localOnly.map((s) => s.dateKey)).toEqual(['2026-07-01']);

    await db.closeAsync();
  });

  it('a pre-cutover pomodoro session is found by its local day because started_at is a true UTC timestamp', async () => {
    const db = await freshDatabase();
    const pomodoro = await import('@/features/pomodoro/pomodoro.data');

    // Written "before the cutover": started_at is a plain UTC ISO instant
    // (20:00 UTC on 06-20 = 04:00 local on 06-21).
    await pomodoro.logPomodoroSession(
      '2026-06-20T20:00:00.000Z',
      '2026-06-20T20:25:00.000Z',
      1500,
      'focus',
    );

    // The UTC-timestamp queries are timezone-independent: the session must be
    // found under its LOCAL day regardless of how the key was derived.
    expect(
      await pomodoro.listPomodoroSessionsForDateRange('2026-06-21', '2026-06-21'),
    ).toHaveLength(1);
    expect(
      await pomodoro.listPomodoroSessionsForDateRange('2026-06-20', '2026-06-20'),
    ).toHaveLength(0);
    await db.closeAsync();
  });
});
