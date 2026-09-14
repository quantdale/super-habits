import { beforeEach, describe, expect, it } from 'vitest';
import { freshDatabase } from './helpers/db';
import type { TestDatabase } from './helpers/db';

/**
 * Gamification persistence against a REAL database.
 *
 * The unit suite proves the reward math; this suite proves the parts only a
 * real engine can: the (kind, source key) idempotency contract, that rewards
 * stay local-only (no outbox rows), that a freeze actually bridges a gap, and
 * that reconciliation backfills actions the UI never reported.
 */

let db: TestDatabase;

beforeEach(async () => {
  db = await freshDatabase();
});

/**
 * Feature data layers must be imported AFTER `freshDatabase()` resets the
 * module registry — a static import would bind the previous test's database.
 * The imports are sequential on purpose: concurrent `import()` calls deadlock
 * Vitest's module runner when the graph is reset per test.
 */
async function loadModules() {
  const habits = await import('@/features/habits/habits.data');
  const todos = await import('@/features/todos/todos.data');
  const pomodoro = await import('@/features/pomodoro/pomodoro.data');
  const workout = await import('@/features/workout/workout.data');
  const calories = await import('@/features/calories/calories.data');
  const gamification = await import('@/features/gamification/gamification.data');
  const time = await import('@/lib/time');
  const domain = await import('@/features/gamification/gamification.domain');
  return { habits, todos, pomodoro, workout, calories, gamification, time, domain };
}

async function countOutbox(): Promise<number> {
  const row = await db.getFirstAsync<{ value: number }>(
    'SELECT COUNT(*) AS value FROM sync_outbox',
  );
  return row?.value ?? 0;
}

async function seedLedgerDays(dateKeys: readonly string[]): Promise<void> {
  for (const dateKey of dateKeys) {
    await db.runAsync(
      `INSERT INTO gamification_events (id, event_kind, source_key, date_key, xp, created_at)
       VALUES (?, 'habit', ?, ?, 10, ?)`,
      [`gxp_seed_${dateKey}`, `${dateKey}:habit_seed`, dateKey, `${dateKey}T12:00:00.000Z`],
    );
  }
}

describe('gamification ledger', () => {
  it('awards XP for a habit check-in once, even after an undo and re-check', async () => {
    const { habits, gamification, time } = await loadModules();
    const today = time.toDateKey();

    const habitId = await habits.addHabit('Read', 1);
    await habits.incrementHabit(habitId, today);

    const first = await gamification.awardGamificationAction({ kind: 'habit', entityId: habitId });
    expect(first?.result.events[0]).toMatchObject({
      kind: 'habit',
      sourceKey: `${today}:${habitId}`,
    });
    expect(first?.snapshot.xpToday).toBe(first?.result.xpAwarded);
    expect(first?.snapshot.streak).toMatchObject({ current: 1, activeToday: true });

    // Undo, then check in again: the same day-habit pair can never pay twice.
    await habits.decrementHabit(habitId, today);
    await habits.incrementHabit(habitId, today);
    expect(
      await gamification.awardGamificationAction({ kind: 'habit', entityId: habitId }),
    ).toBeNull();

    const snapshot = await gamification.readGamificationSnapshot();
    expect(snapshot.xpToday).toBe(first?.result.xpAwarded);
    expect(snapshot.todayFacts.habitCheckins).toBe(1);
  });

  it('keeps rewards local-only: the reward tables exist and never enter the outbox', async () => {
    const { habits, gamification } = await loadModules();

    const habitId = await habits.addHabit('Stretch', 1);
    await habits.incrementHabit(habitId);
    await gamification.awardGamificationAction({ kind: 'habit', entityId: habitId });

    const gamificationRows = await db.getAllAsync<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'gamification%'`,
    );
    expect(gamificationRows.map((row) => row.name).sort()).toEqual([
      'gamification_badges',
      'gamification_events',
      'gamification_quests',
      'gamification_streak_freezes',
    ]);
    // Habits DO enqueue (they are user-owned content); the reward itself must not.
    const outbox = await db.getAllAsync<{ entity: string }>('SELECT entity FROM sync_outbox');
    expect(outbox.every((row) => row.entity !== 'gamification_events')).toBe(true);
    expect(await countOutbox()).toBeGreaterThan(0);
  });

  it('completes the day when the last habit lands, and unlocks the badge once', async () => {
    const { habits, gamification, time } = await loadModules();
    const today = time.toDateKey();

    const firstHabit = await habits.addHabit('Read', 1);
    const secondHabit = await habits.addHabit('Walk', 1);
    await habits.incrementHabit(firstHabit, today);

    const first = await gamification.awardGamificationAction({
      kind: 'habit',
      entityId: firstHabit,
    });
    expect(first?.result.dayComplete).toBe(false);
    expect(first?.snapshot.dayComplete).toBe(false);

    await habits.incrementHabit(secondHabit, today);
    const second = await gamification.awardGamificationAction({
      kind: 'habit',
      entityId: secondHabit,
    });
    expect(second?.result.perfectDay).toBe(true);
    expect(second?.newBadges.map((badge) => badge.id)).toContain('perfect_days:1');
    // A badge outranks the day celebration, so the overlay shows the badge.
    expect(second?.celebration).toMatchObject({ tier: 'badge', icon: 'emoji-events' });
    expect(second?.celebration?.title).toContain('Bronze Complete days');
    expect(second?.snapshot.dayComplete).toBe(true);

    const after = await gamification.readGamificationSnapshot();
    expect(after.dayComplete).toBe(true);
    expect(after.badges.find((badge) => badge.id === 'perfect_days:1')?.unlocked).toBe(true);
    expect(
      await gamification.awardGamificationAction({ kind: 'habit', entityId: secondHabit }),
    ).toBeNull();
  });

  it('backfills actions that never reported themselves, then stays quiet', async () => {
    const { todos, gamification } = await loadModules();

    await todos.addTodo({ title: 'Ship the release notes' });
    const [todo] = await todos.listTodos();
    await todos.toggleTodo(todo);

    const reconciled = await gamification.reconcileGamificationActivity();
    expect(reconciled.awarded).toBe(1);
    expect(reconciled.snapshot.xpToday).toBeGreaterThan(0);
    expect(reconciled.snapshot.todayFacts.todosCompleted).toBe(1);

    const second = await gamification.reconcileGamificationActivity();
    expect(second.awarded).toBe(0);
    expect(second.snapshot.xpToday).toBe(reconciled.snapshot.xpToday);
  });

  it('rewards a same-day unreported todo exactly once without growing the outbox', async () => {
    const { todos, gamification } = await loadModules();

    await todos.addTodo({ title: 'Take the bins out' });
    const [todo] = await todos.listTodos();
    await todos.toggleTodo(todo);

    const outboxBefore = await countOutbox();
    const first = await gamification.reconcileGamificationActivity();
    expect(first.awarded).toBe(1);
    const second = await gamification.reconcileGamificationActivity();
    expect(second.awarded).toBe(0);
    // Reward rows are local-only derived data: reconcile must never enqueue.
    expect(await countOutbox()).toBe(outboxBefore);
  });

  it("spends a banked freeze on yesterday's miss and keeps the streak alive", async () => {
    const { gamification, time, domain } = await loadModules();
    const today = time.toDateKey();
    // Seven consecutive active days ending the day before yesterday: the run is
    // alive, yesterday is the miss, and the 7-day milestone banked one freeze.
    const run = [2, 3, 4, 5, 6, 7, 8].map((offset) => domain.shiftDateKey(today, -offset));
    await seedLedgerDays(run);
    const yesterday = domain.shiftDateKey(today, -1);
    const lastRunDay = run[run.length - 1];
    await db.runAsync(
      `INSERT INTO gamification_events (id, event_kind, source_key, date_key, xp, created_at)
       VALUES ('gxp_freeze_grant', 'freeze_grant', 'freeze:7', ?, 0, ?)`,
      [lastRunDay, `${lastRunDay}T12:00:00.000Z`],
    );

    const before = await gamification.readGamificationSnapshot({ todayKey: today });
    // The miss really did break the run — that is what the freeze is for.
    expect(before.streak.current).toBe(0);
    expect(before.streak.longest).toBe(7);
    expect(before.freezes.banked).toBe(1);
    expect(before.week.find((day) => day.dateKey === yesterday)?.active).toBe(false);

    const saved = await gamification.ensureStreakFreeze({ todayKey: today });
    expect(saved).toEqual({ savedDateKey: yesterday });

    const after = await gamification.readGamificationSnapshot({ todayKey: today });
    expect(after.streak.current).toBe(7);
    expect(after.freezes).toMatchObject({ earned: 1, used: 1, banked: 0 });
    expect(after.week.find((day) => day.dateKey === yesterday)?.frozen).toBe(true);

    // The bank is empty now, so a second pass cannot spend anything.
    expect(await gamification.ensureStreakFreeze({ todayKey: today })).toBeNull();
  });

  it('housekeeping awards an overnight reminder completion before freeze planning', async () => {
    const { habits, gamification, time, domain } = await loadModules();
    const today = time.toDateKey();
    // Seven days of ledger run ending the day before yesterday, plus a banked
    // freeze: without the fix, yesterday looks like a miss and burns it.
    const run = [2, 3, 4, 5, 6, 7, 8].map((offset) => domain.shiftDateKey(today, -offset));
    await seedLedgerDays(run);
    const lastRunDay = run[run.length - 1];
    await db.runAsync(
      `INSERT INTO gamification_events (id, event_kind, source_key, date_key, xp, created_at)
       VALUES ('gxp_housekeeping_grant', 'freeze_grant', 'freeze:7', ?, 0, ?)`,
      [lastRunDay, `${lastRunDay}T12:00:00.000Z`],
    );

    // A reminder Mark complete wrote yesterday's completion after the ledger
    // already closed: real activity with no reward row.
    const yesterday = domain.shiftDateKey(today, -1);
    const habitId = await habits.addHabit('Overnight read', 1);
    await db.runAsync(
      `INSERT INTO habit_completions (id, habit_id, date_key, count, created_at, updated_at)
       VALUES ('hcmp_overnight', ?, ?, 1, ?, ?)`,
      [habitId, yesterday, `${yesterday}T23:00:00.000Z`, `${yesterday}T23:00:00.000Z`],
    );

    await gamification.runGamificationHousekeeping({ todayKey: today });

    const award = await db.getFirstAsync<{ n: number }>(
      `SELECT COUNT(*) AS n FROM gamification_events
       WHERE date_key = ? AND event_kind = 'habit'`,
      [yesterday],
    );
    expect(award?.n).toBe(1);
    const freeze = await db.getFirstAsync<{ n: number }>(
      `SELECT COUNT(*) AS n FROM gamification_streak_freezes WHERE date_key = ?`,
      [yesterday],
    );
    expect(freeze?.n).toBe(0);

    const after = await gamification.readGamificationSnapshot({ todayKey: today });
    expect(after.streak.current).toBe(8);
    expect(after.week.find((day) => day.dateKey === yesterday)?.active).toBe(true);
    expect(after.freezes).toMatchObject({ earned: 1, used: 0, banked: 1 });
  });

  it('housekeeping still spends a freeze on a genuine missed day', async () => {
    const { gamification, time, domain } = await loadModules();
    const today = time.toDateKey();
    const run = [2, 3, 4, 5, 6, 7, 8].map((offset) => domain.shiftDateKey(today, -offset));
    await seedLedgerDays(run);
    const lastRunDay = run[run.length - 1];
    await db.runAsync(
      `INSERT INTO gamification_events (id, event_kind, source_key, date_key, xp, created_at)
       VALUES ('gxp_housekeeping_miss_grant', 'freeze_grant', 'freeze:7', ?, 0, ?)`,
      [lastRunDay, `${lastRunDay}T12:00:00.000Z`],
    );

    await gamification.runGamificationHousekeeping({ todayKey: today });

    const yesterday = domain.shiftDateKey(today, -1);
    const freeze = await db.getFirstAsync<{ n: number }>(
      `SELECT COUNT(*) AS n FROM gamification_streak_freezes WHERE date_key = ?`,
      [yesterday],
    );
    expect(freeze?.n).toBe(1);

    const after = await gamification.readGamificationSnapshot({ todayKey: today });
    expect(after.streak.current).toBe(7);
    expect(after.week.find((day) => day.dateKey === yesterday)?.frozen).toBe(true);
  });

  it('awards focus, workout, and nutrition actions straight from their own tables', async () => {
    const { pomodoro, workout, calories, gamification, time } = await loadModules();
    const today = time.toDateKey();

    await workout.addRoutine('Push', '');
    const [routine] = await workout.listRoutines();
    await workout.completeRoutine(routine.id);
    await calories.addCalorieEntry({
      foodName: 'Oats',
      calories: 380,
      protein: 12,
      carbs: 60,
      fats: 7,
      mealType: 'breakfast',
      consumedOn: today,
    });
    await pomodoro.logPomodoroSession(
      new Date(`${today}T09:00:00`).toISOString(),
      new Date(`${today}T09:25:00`).toISOString(),
      1500,
      'focus',
    );

    const reconciled = await gamification.reconcileGamificationActivity({ todayKey: today });
    expect(reconciled.awarded).toBe(3);
    expect(reconciled.snapshot.todayFacts).toMatchObject({
      focusSessions: 1,
      focusMinutes: 25,
      workouts: 1,
      mealsLogged: 1,
    });
    expect(reconciled.snapshot.totalXp).toBeGreaterThan(0);
    expect(reconciled.snapshot.quests.length).toBe(3);
  });
});
