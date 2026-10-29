import { beforeEach, describe, expect, it } from 'vitest';
import { MAX_BANKED_FREEZES } from '@/features/gamification/gamification.types';
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

  // A todo id outlives one completion. Re-opening a task and completing it
  // again on a LATER local day is a second real action: it must pay XP again
  // and make that day active (streak/week pip), while a same-day 0→1→0→1
  // toggle still pays exactly once (asserted in the first test above).
  it('pays a todo again when it is reopened and completed on a later day', async () => {
    const { todos, gamification, time, domain } = await loadModules();
    const today = time.toDateKey();
    const yesterday = domain.shiftDateKey(today, -1);

    await todos.addTodo({ title: 'Water the plants' });
    const [todo] = await todos.listTodos();

    // Day 1: complete it and let that day's pass pay for it.
    await todos.toggleTodo(todo);
    await db.runAsync(`UPDATE todos SET completed_at = ? WHERE id = ?`, [
      new Date(`${yesterday}T10:00:00`).toISOString(),
      todo.id,
    ]);
    expect(
      (await gamification.reconcileGamificationActivity({ todayKey: yesterday })).awarded,
    ).toBe(1);

    // Day 2: reopen and complete it again.
    await db.runAsync(`UPDATE todos SET completed = 0, completed_at = NULL WHERE id = ?`, [
      todo.id,
    ]);
    const reopened = await db.getFirstAsync<{ completed: 0 | 1; completed_at: string | null }>(
      `SELECT completed, completed_at FROM todos WHERE id = ?`,
      [todo.id],
    );
    expect(reopened?.completed).toBe(0);
    const { listTodos } = todos;
    const [pending] = await listTodos();
    await todos.toggleTodo({ ...todo, ...pending });

    const todayPass = await gamification.reconcileGamificationActivity({ todayKey: today });
    expect(todayPass.awarded).toBe(1);
    // Today is now an active reward day: the streak reads 2 (both days paid).
    expect(todayPass.snapshot.streak).toMatchObject({ current: 2, activeToday: true });
    expect(todayPass.snapshot.week.at(-1)).toMatchObject({ dateKey: today, active: true });

    // Repeated passes never re-pay either day.
    expect((await gamification.reconcileGamificationActivity({ todayKey: today })).awarded).toBe(0);
    const dates = await db.getAllAsync<{ date_key: string }>(
      `SELECT date_key FROM gamification_events WHERE event_kind = 'todo' ORDER BY date_key ASC`,
    );
    expect(dates.map((row) => row.date_key)).toEqual([yesterday, today]);
  });

  /**
   * Upgrade compatibility. Before todos were keyed per day, a todo award was
   * stored under the bare todo id; those rows survive an app update. The first
   * reconcile after upgrading must recognize that row as already covering the
   * completion day, or every previously-rewarded task would be paid a second
   * time on the one day the user upgrades.
   */
  it('an old bare-id ledger row suppresses the same-day award under the new key', async () => {
    const { todos, gamification, time } = await loadModules();
    const today = time.toDateKey();

    await todos.addTodo({ title: 'Water the plants' });
    const [todo] = await todos.listTodos();
    await todos.toggleTodo(todo);
    // An earlier build's row: bare id, the day it paid for.
    await db.runAsync(
      `INSERT INTO gamification_events (id, event_kind, source_key, date_key, xp, created_at)
       VALUES ('gxp_legacy_todo', 'todo', ?, ?, 5, ?)`,
      [todo.id, today, `${today}T10:00:00.000Z`],
    );

    // Both the fast path and the reconcile backfill must see it as paid.
    expect(
      await gamification.awardGamificationAction({ kind: 'todo', entityId: todo.id }),
    ).toBeNull();
    const reconciled = await gamification.reconcileGamificationActivity({ todayKey: today });
    expect(reconciled.awarded).toBe(0);

    const rows = await db.getAllAsync<{ source_key: string; date_key: string; xp: number }>(
      `SELECT source_key, date_key, xp FROM gamification_events WHERE event_kind = 'todo'`,
    );
    // The legacy row is left untouched — no migration, no key rewrite — and no
    // second row was minted for the same day.
    expect(rows).toEqual([{ source_key: todo.id, date_key: today, xp: 5 }]);
    // The day still counts as active (the legacy row carries xp > 0).
    expect(reconciled.snapshot.streak).toMatchObject({ current: 1, activeToday: true });
  });

  it('a legacy bare-id row only covers its own day, so a later re-completion still pays', async () => {
    const { todos, gamification, time, domain } = await loadModules();
    const today = time.toDateKey();
    const yesterday = domain.shiftDateKey(today, -1);

    await todos.addTodo({ title: 'Water the plants' });
    const [todo] = await todos.listTodos();
    await todos.toggleTodo(todo);
    await db.runAsync(`UPDATE todos SET completed_at = ? WHERE id = ?`, [
      new Date(`${yesterday}T10:00:00`).toISOString(),
      todo.id,
    ]);
    // Yesterday was paid by the OLD build under the bare id.
    await db.runAsync(
      `INSERT INTO gamification_events (id, event_kind, source_key, date_key, xp, created_at)
       VALUES ('gxp_legacy_todo', 'todo', ?, ?, 5, ?)`,
      [todo.id, yesterday, `${yesterday}T10:00:00.000Z`],
    );

    // Reopened and completed again today: a genuinely new action.
    await db.runAsync(`UPDATE todos SET completed = 0, completed_at = NULL WHERE id = ?`, [
      todo.id,
    ]);
    const [pending] = await todos.listTodos();
    await todos.toggleTodo({ ...todo, ...pending });

    const todayPass = await gamification.reconcileGamificationActivity({ todayKey: today });
    expect(todayPass.awarded).toBe(1);
    expect(todayPass.snapshot.streak).toMatchObject({ current: 2, activeToday: true });

    const keys = await db.getAllAsync<{ source_key: string; date_key: string }>(
      `SELECT source_key, date_key FROM gamification_events WHERE event_kind = 'todo'
        ORDER BY date_key ASC`,
    );
    expect(keys).toEqual([
      { source_key: todo.id, date_key: yesterday },
      { source_key: `${today}:${todo.id}`, date_key: today },
    ]);
    // Replays of either day stay free.
    expect((await gamification.reconcileGamificationActivity({ todayKey: today })).awarded).toBe(0);
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

  it('rolls the award and its badge unlock back together when the unlock write fails', async () => {
    const { habits, gamification, time } = await loadModules();
    const today = time.toDateKey();
    const firstHabit = await habits.addHabit('Read', 1);
    const secondHabit = await habits.addHabit('Walk', 1);
    await habits.incrementHabit(firstHabit, today);
    await gamification.awardGamificationAction({ kind: 'habit', entityId: firstHabit });

    // Fail ONLY the badge write, i.e. after the award's ledger + quest inserts.
    // Pre-fix the unlock ran post-commit, so the events survived a lost badge
    // row (audit C §3.2); now both land in one transaction or neither does.
    await db.execAsync(`
      CREATE TRIGGER fail_badge_unlock
      BEFORE INSERT ON gamification_badges
      BEGIN
        SELECT RAISE(ABORT, 'simulated badge write failure');
      END;
    `);

    await habits.incrementHabit(secondHabit, today);
    await expect(
      gamification.awardGamificationAction({ kind: 'habit', entityId: secondHabit }),
    ).rejects.toThrow('simulated badge write failure');

    // Neither half of the award survives, so re-running it can still celebrate.
    expect(
      await db.getFirstAsync<{ n: number }>(
        `SELECT COUNT(*) AS n FROM gamification_events WHERE event_kind = 'habit'`,
      ),
    ).toEqual({ n: 1 });
    expect(
      await db.getFirstAsync<{ n: number }>(`SELECT COUNT(*) AS n FROM gamification_badges`),
    ).toEqual({ n: 0 });

    // With the failure gone the same award pays once and unlocks the badge once.
    await db.execAsync('DROP TRIGGER fail_badge_unlock');
    const retried = await gamification.awardGamificationAction({
      kind: 'habit',
      entityId: secondHabit,
    });
    expect(retried?.newBadges.map((badge) => badge.id)).toContain('perfect_days:1');
    expect(retried?.celebration).toMatchObject({ tier: 'badge' });
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
    expect(saved).toEqual({ savedDateKeys: [yesterday] });

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

  it('housekeeping pays backdated check-ins across the bounded lookback window', async () => {
    const { habits, gamification, time, domain } = await loadModules();
    const today = time.toDateKey();
    const day3 = domain.shiftDateKey(today, -3);
    const day6 = domain.shiftDateKey(today, -6);
    const day8 = domain.shiftDateKey(today, -8);

    // Seed completion rows directly: incrementHabit() refuses pre-creation
    // dates, but reconcile consumes durable rows (the real offline/backfill
    // shape).
    const habitId = await habits.addHabit('Read', 1);
    const seedCompletion = async (dateKey: string, suffix: string) => {
      await db.runAsync(
        `INSERT INTO habit_completions (id, habit_id, date_key, count, created_at, updated_at)
         VALUES (?, ?, ?, 1, ?, ?)`,
        [
          `hcmp_bd_${suffix}`,
          habitId,
          dateKey,
          `${dateKey}T09:00:00.000Z`,
          `${dateKey}T09:00:00.000Z`,
        ],
      );
    };
    await seedCompletion(day3, 'three');
    await seedCompletion(day6, 'six');
    await seedCompletion(day8, 'eight');

    await gamification.runGamificationHousekeeping({ todayKey: today });

    const events = await db.getAllAsync<{ date_key: string; xp: number }>(
      `SELECT date_key, xp FROM gamification_events WHERE event_kind = 'habit'
       ORDER BY date_key ASC`,
    );
    // Inside the 7-day window both days pay; a day older than the bound stays
    // unpaid (the window is deliberately small so ancient history is safe).
    expect(events.map((event) => event.date_key).sort()).toEqual([day3, day6].sort());
    expect(events.every((event) => event.xp > 0)).toBe(true);

    // The ledger's unique source key keeps repeated passes free.
    await gamification.runGamificationHousekeeping({ todayKey: today });
    const afterReplay = await db.getAllAsync<{ id: string }>(
      `SELECT id FROM gamification_events WHERE event_kind = 'habit'`,
    );
    expect(afterReplay).toHaveLength(2);
  });

  it('applies the award cap per day instead of once across the lookback', async () => {
    const { habits, gamification, time, domain } = await loadModules();
    const today = time.toDateKey();
    const cappedDay = domain.shiftDateKey(today, -2);
    const otherDay = domain.shiftDateKey(today, -4);

    // 30 completions on one backdated day (more than the 25-award cap) plus one
    // on a later day: the cap must not consume the window's budget.
    for (let index = 0; index < 30; index += 1) {
      const habitId = await habits.addHabit(`Burst ${index}`, 1);
      await db.runAsync(
        `INSERT INTO habit_completions (id, habit_id, date_key, count, created_at, updated_at)
         VALUES (?, ?, ?, 1, ?, ?)`,
        [
          `hcmp_burst_${index}`,
          habitId,
          cappedDay,
          `${cappedDay}T09:00:00.000Z`,
          `${cappedDay}T09:00:00.000Z`,
        ],
      );
    }
    const otherHabit = await habits.addHabit('Single', 1);
    await db.runAsync(
      `INSERT INTO habit_completions (id, habit_id, date_key, count, created_at, updated_at)
       VALUES (?, ?, ?, 1, ?, ?)`,
      [
        'hcmp_single',
        otherHabit,
        otherDay,
        `${otherDay}T09:00:00.000Z`,
        `${otherDay}T09:00:00.000Z`,
      ],
    );

    await gamification.runGamificationHousekeeping({ todayKey: today });

    const perDay = await db.getAllAsync<{ date_key: string; count: number }>(
      `SELECT date_key, COUNT(*) AS count FROM gamification_events
       WHERE event_kind = 'habit' GROUP BY date_key ORDER BY date_key ASC`,
    );
    expect(perDay).toEqual([
      { date_key: otherDay, count: 1 },
      { date_key: cappedDay, count: 25 },
    ]);
  });
});

describe('streak freeze accounting (audit C #2)', () => {
  /** Seven consecutive active ledger days ending the day before yesterday. */
  async function seedRunEndingYesterday(
    todayKey: string,
    domain: Awaited<ReturnType<typeof loadModules>>['domain'],
  ) {
    const run = [2, 3, 4, 5, 6, 7, 8].map((offset) => domain.shiftDateKey(todayKey, -offset));
    await seedLedgerDays(run);
    return run;
  }

  /** Real milestone grants, so `recordedFreezeMilestones` suppresses re-grants. */
  async function grantFreeze(milestones: readonly number[], dateKey: string) {
    for (const milestone of milestones) {
      await db.runAsync(
        `INSERT OR IGNORE INTO gamification_events (id, event_kind, source_key, date_key, xp, created_at)
         VALUES (?, 'freeze_grant', ?, ?, 0, ?)`,
        [`gxp_grant_${milestone}`, `freeze:${milestone}`, dateKey, `${dateKey}T12:00:00.000Z`],
      );
    }
  }

  async function freezeRows(): Promise<string[]> {
    const rows = await db.getAllAsync<{ date_key: string }>(
      `SELECT date_key FROM gamification_streak_freezes ORDER BY date_key ASC`,
    );
    return rows.map((row) => row.date_key);
  }

  it('earns a freeze at the milestone, spends it on the miss, and stops at MAX_BANKED_FREEZES', async () => {
    const { gamification, time, domain } = await loadModules();
    const today = time.toDateKey();
    await seedRunEndingYesterday(today, domain);
    const yesterday = domain.shiftDateKey(today, -1);
    await grantFreeze([7], domain.shiftDateKey(today, -2));

    const earned = await gamification.readGamificationSnapshot({ todayKey: today });
    expect(earned.freezes).toMatchObject({ earned: 1, used: 0, banked: 1 });

    expect(await gamification.ensureStreakFreeze({ todayKey: today })).toEqual({
      savedDateKeys: [yesterday],
    });
    const spent = await gamification.readGamificationSnapshot({ todayKey: today });
    expect(spent.freezes).toMatchObject({ earned: 1, used: 1, banked: 0 });
    expect(spent.streak.current).toBe(7);

    // The cap is on the BANK, not on lifetime grants: four earned grants bank
    // at most MAX_BANKED_FREEZES even though `earned` keeps counting.
    await db.runAsync(`DELETE FROM gamification_streak_freezes`);
    await grantFreeze([30, 100, 365], domain.shiftDateKey(today, -2));
    const capped = await gamification.readGamificationSnapshot({ todayKey: today });
    expect(capped.freezes.earned).toBe(4);
    expect(capped.freezes.used).toBe(0);
    expect(capped.freezes.banked).toBe(3);
    expect(capped.freezes.banked).toBe(MAX_BANKED_FREEZES);
  });

  it('releases a freeze when its day is later backfilled as active, restoring the bank', async () => {
    const { gamification, habits, time, domain } = await loadModules();
    const today = time.toDateKey();
    const run = await seedRunEndingYesterday(today, domain);
    const yesterday = domain.shiftDateKey(today, -1);
    const lastRunDay = run[run.length - 1];
    await grantFreeze([7], lastRunDay);

    expect(await gamification.ensureStreakFreeze({ todayKey: today })).toEqual({
      savedDateKeys: [yesterday],
    });
    expect(await freezeRows()).toEqual([yesterday]);
    expect((await gamification.readGamificationSnapshot({ todayKey: today })).freezes.banked).toBe(
      0,
    );

    // Real activity lands on the frozen day afterwards: a backdated day-strip
    // check-in (the same shape a restore / linked-action / overnight reminder
    // write produces). The freeze is no longer needed.
    const habitId = await habits.addHabit('Backfilled read', 1);
    await db.runAsync(
      `INSERT INTO habit_completions (id, habit_id, date_key, count, created_at, updated_at)
       VALUES ('hcmp_backfill', ?, ?, 1, ?, ?)`,
      [habitId, yesterday, `${yesterday}T23:30:00.000Z`, `${yesterday}T23:30:00.000Z`],
    );
    await gamification.awardGamificationAction({
      kind: 'habit',
      entityId: habitId,
      todayKey: yesterday,
    });

    expect(await freezeRows()).toEqual([]);
    const after = await gamification.readGamificationSnapshot({ todayKey: today });
    expect(after.freezes).toMatchObject({ earned: 1, used: 0, banked: 1 });
    // The day is genuinely active now, so the run is longer without the freeze.
    expect(after.streak.current).toBe(8);
    expect(after.week.find((day) => day.dateKey === yesterday)).toMatchObject({
      active: true,
      frozen: false,
    });
  });

  it('housekeeping releases a stale freeze before planning a new one', async () => {
    const { gamification, time, domain } = await loadModules();
    const today = time.toDateKey();
    const run = await seedRunEndingYesterday(today, domain);
    const yesterday = domain.shiftDateKey(today, -1);
    await grantFreeze([7], run[run.length - 1]);

    // A freeze was already written for yesterday, then yesterday's activity was
    // awarded directly against its own date key (the reconcile path).
    await db.runAsync(
      `INSERT INTO gamification_streak_freezes (date_key, saved_at) VALUES (?, ?)`,
      [yesterday, `${yesterday}T22:00:00.000Z`],
    );
    await db.runAsync(
      `INSERT INTO gamification_events (id, event_kind, source_key, date_key, xp, created_at)
       VALUES ('gxp_yesterday_late', 'habit', ?, ?, 10, ?)`,
      [`${yesterday}:habit_late`, yesterday, `${yesterday}T23:00:00.000Z`],
    );

    await gamification.runGamificationHousekeeping({ todayKey: today });

    expect(await freezeRows()).toEqual([]);
    const after = await gamification.readGamificationSnapshot({ todayKey: today });
    expect(after.freezes).toMatchObject({ earned: 1, used: 0, banked: 1 });
    expect(after.streak.current).toBe(8);
  });

  /**
   * Audit C §4.7 #5 / §3.3 — the 3-day-absence outcome through the SHIPPED path.
   *
   * The user banks three freezes at 7/30/100, then disappears for three days.
   * `runGamificationHousekeeping` is the only real caller of freeze planning, so
   * the assertion is made against it rather than against `planAutoFreeze`.
   *
   * Before the fix, planning bridged exactly one day (yesterday) and required
   * the day before it to be alive. After a 3-day absence that precondition never
   * held again: the run was already broken, the bank was never spent, and the
   * three freezes the user had earned were permanently unspendable.
   */
  it('bridges a three-day absence with three banked freezes through housekeeping', async () => {
    const { gamification, time, domain } = await loadModules();
    const today = time.toDateKey();
    // Six active days ending four days ago: the run is alive behind a
    // three-day gap (three missed days, three banked freezes).
    const run = [4, 5, 6, 7, 8, 9].map((offset) => domain.shiftDateKey(today, -offset));
    await seedLedgerDays(run);
    await grantFreeze([7, 30, 100], run[run.length - 1]);

    const gap = [1, 2, 3].map((offset) => domain.shiftDateKey(today, -offset));

    const before = await gamification.readGamificationSnapshot({ todayKey: today });
    expect(before.freezes).toMatchObject({ earned: 3, used: 0, banked: 3 });
    // The absence really did break the run — that is what the freezes are for.
    expect(before.streak.current).toBe(0);
    expect(before.streak.longest).toBe(6);

    await gamification.runGamificationHousekeeping({ todayKey: today });

    // Every missed day in the gap is bridged, and nothing older is touched.
    expect(await freezeRows()).toEqual([...gap].sort());
    const after = await gamification.readGamificationSnapshot({ todayKey: today });
    expect(after.freezes).toMatchObject({ earned: 3, used: 3, banked: 0 });
    expect(after.streak.current).toBe(6);
    for (const dateKey of gap) {
      expect(after.week.find((day) => day.dateKey === dateKey)?.frozen).toBe(true);
    }

    // The bank is empty, so a repeat pass spends nothing and changes nothing.
    await gamification.runGamificationHousekeeping({ todayKey: today });
    const replayed = await gamification.readGamificationSnapshot({ todayKey: today });
    expect(replayed.freezes).toEqual(after.freezes);
    expect(await freezeRows()).toEqual([...gap].sort());
  });

  it('does not resurrect a run the bank cannot reach', async () => {
    const { gamification, time, domain } = await loadModules();
    const today = time.toDateKey();
    // Five missed days but only three banked freezes: spending them would burn
    // the grant and leave the streak broken anyway, so nothing is spent.
    const run = [5, 6, 7, 8, 9, 10].map((offset) => domain.shiftDateKey(today, -offset));
    await seedLedgerDays(run);
    await grantFreeze([7, 30, 100], run[run.length - 1]);

    await gamification.runGamificationHousekeeping({ todayKey: today });

    expect(await freezeRows()).toEqual([]);
    const after = await gamification.readGamificationSnapshot({ todayKey: today });
    expect(after.freezes).toMatchObject({ earned: 3, used: 0, banked: 3 });
    expect(after.streak.current).toBe(0);
  });

  it('keeps the released freeze banked across repeated housekeeping passes', async () => {
    const { gamification, time, domain } = await loadModules();
    const today = time.toDateKey();
    const run = await seedRunEndingYesterday(today, domain);
    await grantFreeze([7], run[run.length - 1]);
    const yesterday = domain.shiftDateKey(today, -1);
    await gamification.ensureStreakFreeze({ todayKey: today });
    await db.runAsync(
      `INSERT INTO gamification_events (id, event_kind, source_key, date_key, xp, created_at)
       VALUES ('gxp_idem_yesterday', 'habit', 'yesterday:habit_idem', ?, 10, ?)`,
      [yesterday, `${yesterday}T23:00:00.000Z`],
    );

    await gamification.runGamificationHousekeeping({ todayKey: today });
    const first = await gamification.readGamificationSnapshot({ todayKey: today });
    await gamification.runGamificationHousekeeping({ todayKey: today });
    const second = await gamification.readGamificationSnapshot({ todayKey: today });

    expect(second.freezes).toEqual(first.freezes);
    expect(await freezeRows()).toEqual([]);
  });
});
