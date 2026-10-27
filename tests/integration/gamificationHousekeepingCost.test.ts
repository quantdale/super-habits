import { beforeEach, describe, expect, it } from 'vitest';
import { freshDatabase } from './helpers/db';
import type { TestDatabase } from './helpers/db';

/**
 * Audit C §2 issue #3 / Top-10 #10 — housekeeping cost.
 *
 * `runGamificationHousekeeping` used to re-read the whole ledger per award and
 * per aggregate (7 lookback days x up to 25 awards x 2 full scans + ~10
 * aggregate `COUNT(*)`s each). It now reads the ledger once per pass and
 * appends each award to that in-memory snapshot.
 *
 * These tests assert both halves of the contract:
 *  1. the observable outcome is IDENTICAL to the per-award read loop, and
 *  2. the number of whole-ledger scans no longer scales with the number of
 *     awards in the pass.
 *
 * Counting happens on the REAL adapter that `freshDatabase()` installed (the
 * same object `getDatabase()` returns), so this measures production SQL.
 */

let db: TestDatabase;

/**
 * Statements that read the reward ledger WHOLESALE — the expensive class the
 * audit measured. Per-candidate idempotency probes (`… WHERE source_key = ?`)
 * are deliberately excluded: exactly one per candidate is irreducible.
 */
const WHOLE_LEDGER_READ =
  /SELECT date_key, event_kind, source_key, xp FROM gamification_events|COALESCE\(SUM\(xp\), 0\) AS total_xp|SELECT DISTINCT date_key FROM gamification_events|SELECT COUNT\(\*\) AS value FROM gamification_events WHERE event_kind = \?[^A]/;

type Cost = { reads: number; writes: number; scans: number };

async function loadModules() {
  const habits = await import('@/features/habits/habits.data');
  const gamification = await import('@/features/gamification/gamification.data');
  const domain = await import('@/features/gamification/gamification.domain');
  const time = await import('@/lib/time');
  return { habits, gamification, domain, time };
}

/** Count ledger statements (and whole-ledger scans) made while running `task`. */
async function measure(task: () => Promise<void>): Promise<Cost> {
  type Statement = (sql: string, params?: readonly unknown[]) => Promise<unknown>;
  const target = db as unknown as {
    getAllAsync: Statement;
    getFirstAsync: Statement;
    runAsync: Statement;
  };
  const original = {
    getAllAsync: target.getAllAsync.bind(target),
    getFirstAsync: target.getFirstAsync.bind(target),
    runAsync: target.runAsync.bind(target),
  };
  const cost: Cost = { reads: 0, writes: 0, scans: 0 };
  target.getAllAsync = (sql, params) => {
    if (/gamification_|habit_completions|pomodoro_sessions|workout_logs/.test(sql)) cost.reads += 1;
    if (WHOLE_LEDGER_READ.test(sql)) cost.scans += 1;
    return original.getAllAsync(sql, params);
  };
  target.getFirstAsync = (sql, params) => {
    if (/gamification_|habit_completions|pomodoro_sessions|workout_logs/.test(sql)) cost.reads += 1;
    if (WHOLE_LEDGER_READ.test(sql)) cost.scans += 1;
    return original.getFirstAsync(sql, params);
  };
  target.runAsync = (sql, params) => {
    if (/gamification_/.test(sql)) cost.writes += 1;
    return original.runAsync(sql, params);
  };
  try {
    await task();
  } finally {
    target.getAllAsync = original.getAllAsync;
    target.getFirstAsync = original.getFirstAsync;
    target.runAsync = original.runAsync;
  }
  return cost;
}

async function seedScenario(habitCount: number, todayKey: string): Promise<void> {
  const { habits, domain } = await loadModules();
  const backdated = [1, 2, 3, 4, 5].map((offset) => domain.shiftDateKey(todayKey, -offset));
  for (let index = 0; index < habitCount; index += 1) {
    const habitId = await habits.addHabit(`Habit ${index}`, 1);
    await seedCompletions(habitId, backdated);
  }
}

/** One count-1 completion row per date, written straight to the feature table. */
async function seedCompletions(habitId: string, dateKeys: readonly string[]): Promise<void> {
  for (const dateKey of dateKeys) {
    await db.runAsync(
      `INSERT INTO habit_completions (id, habit_id, date_key, count, created_at, updated_at)
       VALUES (?, ?, ?, 1, ?, ?)`,
      [
        `hcmp_cost_${habitId}_${dateKey}`,
        habitId,
        dateKey,
        `${dateKey}T09:00:00.000Z`,
        `${dateKey}T09:00:00.000Z`,
      ],
    );
  }
}

async function snapshotLedger() {
  const events = await db.getAllAsync<{
    event_kind: string;
    source_key: string;
    date_key: string;
    xp: number;
  }>(
    `SELECT event_kind, source_key, date_key, xp FROM gamification_events
     ORDER BY date_key ASC, event_kind ASC, source_key ASC`,
  );
  const quests = await db.getAllAsync<{ date_key: string; quest_id: string }>(
    `SELECT date_key, quest_id FROM gamification_quests ORDER BY date_key ASC, quest_id ASC`,
  );
  const freezes = await db.getAllAsync<{ date_key: string }>(
    `SELECT date_key FROM gamification_streak_freezes ORDER BY date_key ASC`,
  );
  const badges = await db.getAllAsync<{ badge_id: string }>(
    `SELECT badge_id FROM gamification_badges ORDER BY badge_id ASC`,
  );
  return { events, quests, freezes, badges };
}

/**
 * The pre-fix shape, restated: walk the same 7-day window oldest-first and
 * award each candidate through the PUBLIC single-award path, which re-reads the
 * ledger for every award.
 */
async function runReferenceHousekeeping(todayKey: string): Promise<void> {
  const { gamification, domain } = await loadModules();
  for (let offset = 6; offset >= 0; offset -= 1) {
    const dateKey = domain.shiftDateKey(todayKey, -offset);
    const rows = await db.getAllAsync<{ id: string }>(
      `SELECT habit_id AS id FROM habit_completions
        WHERE date_key = ? AND count > 0 ORDER BY created_at ASC LIMIT 25`,
      [dateKey],
    );
    for (const row of rows) {
      await gamification.awardGamificationAction({
        kind: 'habit',
        entityId: row.id,
        todayKey: dateKey,
      });
    }
  }
  await gamification.ensureStreakFreeze({ todayKey });
}

beforeEach(async () => {
  db = await freshDatabase();
});

describe('housekeeping ledger cost', () => {
  it('pays exactly what the per-award read loop pays', async () => {
    const { gamification, time } = await loadModules();
    const todayKey = time.toDateKey();

    // Arm A — the batched pass.
    await seedScenario(3, todayKey);
    await gamification.runGamificationHousekeeping({ todayKey });
    const batched = await snapshotLedger();

    // Arm B — the per-award reference loop over an identically seeded database.
    db = await freshDatabase();
    await seedScenario(3, todayKey);
    await runReferenceHousekeeping(todayKey);
    const reference = await snapshotLedger();

    // 15 backdated real actions were paid in both arms; the fixture really
    // exercises the hot path.
    expect(batched.events.filter((event) => event.event_kind === 'habit')).toHaveLength(15);
    expect(batched.events.length).toBeGreaterThan(15);

    // Habit ids are minted per database, so the two arms are compared on a
    // projection that keeps the per-habit-per-day key shape.
    const normalize = (ledger: Awaited<ReturnType<typeof snapshotLedger>>) => ({
      ...ledger,
      events: ledger.events.map((event) => ({
        ...event,
        source_key: event.event_kind === 'habit' ? 'habit' : event.source_key,
      })),
    });
    expect(normalize(batched)).toEqual(normalize(reference));
  });

  it('whole-ledger scans stay flat while awards grow; the reference loop scales', async () => {
    const { gamification, time } = await loadModules();
    const todayKey = time.toDateKey();

    // Small pass: 3 habits x 5 backdated days = 15 awards.
    await seedScenario(3, todayKey);
    const small = await measure(() => gamification.runGamificationHousekeeping({ todayKey }));

    // Large pass: 6 habits x 5 backdated days = 30 awards (exactly double).
    db = await freshDatabase();
    await seedScenario(6, todayKey);
    const large = await measure(() => gamification.runGamificationHousekeeping({ todayKey }));

    // The ledger is scanned a constant number of times per pass, independent of
    // how many awards that pass makes. The pre-fix implementation scanned twice
    // per award (plus a snapshot), i.e. 30+ scans for the small fixture alone.
    expect(small.scans).toBeGreaterThan(0);
    expect(small.scans).toBeLessThan(10);
    expect(large.scans).toBeLessThan(10);
    expect(large.scans).toBeLessThanOrEqual(small.scans + 2);

    // And it stays far below the per-award reference loop on the same fixture.
    db = await freshDatabase();
    await seedScenario(6, todayKey);
    const referenceLarge = await measure(() => runReferenceHousekeeping(todayKey));
    expect(referenceLarge.scans).toBeGreaterThan(large.scans * 3);
  });

  it('a replayed pass is a no-op that writes nothing', async () => {
    const { gamification, time } = await loadModules();
    const todayKey = time.toDateKey();
    await seedScenario(3, todayKey);

    await gamification.runGamificationHousekeeping({ todayKey });
    const first = await snapshotLedger();

    const replay = await measure(() => gamification.runGamificationHousekeeping({ todayKey }));
    expect(await snapshotLedger()).toEqual(first);
    // Idempotency is the ledger's unique key: a replay inserts no events, no
    // quest payments and no freeze rows.
    expect(replay.writes).toBe(0);
    expect(replay.scans).toBeLessThan(10);
  });

  it('one reconcile pass agrees with a fresh snapshot read', async () => {
    const { habits, gamification, time, domain } = await loadModules();
    const todayKey = time.toDateKey();
    const yesterday = domain.shiftDateKey(todayKey, -1);

    const habitId = await habits.addHabit('Read', 1);
    for (const dateKey of [todayKey, yesterday]) {
      await db.runAsync(
        `INSERT INTO habit_completions (id, habit_id, date_key, count, created_at, updated_at)
         VALUES (?, ?, ?, 1, ?, ?)`,
        [
          `hcmp_${habitId}_${dateKey}`,
          habitId,
          dateKey,
          `${dateKey}T09:00:00.000Z`,
          `${dateKey}T09:00:00.000Z`,
        ],
      );
    }

    const reconciled = await gamification.reconcileGamificationActivity({ todayKey });
    expect(reconciled.awarded).toBe(1);
    expect(reconciled.snapshot).toEqual(await gamification.readGamificationSnapshot({ todayKey }));

    // The pass snapshot must not leak a stale total: today's action is still
    // detected as already paid through the authoritative ledger check.
    expect(
      await gamification.awardGamificationAction({
        kind: 'habit',
        entityId: habitId,
        todayKey,
      }),
    ).toBeNull();
  });

  it('pays each quest once per day across a multi-award pass', async () => {
    const { habits, gamification, time, domain } = await loadModules();
    const todayKey = time.toDateKey();
    const yesterday = domain.shiftDateKey(todayKey, -1);

    // Enough same-day habit check-ins to satisfy the habit-driven quests.
    for (let index = 0; index < 4; index += 1) {
      const habitId = await habits.addHabit(`Quest ${index}`, 1);
      for (const dateKey of [todayKey, yesterday]) {
        await db.runAsync(
          `INSERT INTO habit_completions (id, habit_id, date_key, count, created_at, updated_at)
           VALUES (?, ?, ?, 1, ?, ?)`,
          [
            `hcmp_quest_${habitId}_${dateKey}`,
            habitId,
            dateKey,
            `${dateKey}T09:00:00.000Z`,
            `${dateKey}T09:00:00.000Z`,
          ],
        );
      }
    }

    await gamification.runGamificationHousekeeping({ todayKey });

    const questRows = await db.getAllAsync<{ date_key: string; quest_id: string }>(
      `SELECT date_key, quest_id FROM gamification_quests ORDER BY date_key ASC, quest_id ASC`,
    );
    const keys = questRows.map((row) => `${row.date_key}:${row.quest_id}`);
    expect(new Set(keys).size).toBe(keys.length);

    // Every paid quest has exactly one quest event, and vice versa.
    const questEvents = await db.getAllAsync<{ source_key: string; date_key: string }>(
      `SELECT source_key, date_key FROM gamification_events WHERE event_kind = 'quest'`,
    );
    expect(questEvents).toHaveLength(questRows.length);

    const snapshot = await gamification.readGamificationSnapshot({ todayKey });
    expect(snapshot.streak.current).toBeGreaterThan(0);
    expect(snapshot.badges.length).toBeGreaterThan(0);
  });
});

/**
 * The pass snapshot may only advance state the award ITSELF creates.
 *
 * `habitCheckins`, `focusSessions`, `workouts` and `nutritionDays` are counted
 * from the FEATURE tables (`habit_completions`, `pomodoro_sessions`,
 * `workout_logs`, `calorie_entries`), which an award never writes. Advancing
 * them from award events invents activity the user never logged and can write a
 * badge row past a threshold they have not reached.
 *
 * This is only observable at PASS TIME: a fresh read afterwards recounts from
 * the feature tables and hides the flaw. So the assertion is on the badge rows
 * the pass itself wrote — the durable side effect of the inflated counter.
 */
describe('housekeeping badge counters stay feature-derived', () => {
  /** Threshholds of the `habits` family: [50, 250, 1000, 3000]. */
  const FIRST_HABITS_TIER = 50;

  /**
   * Seed `habitCount` habits each checked in on every day of the 7-day window.
   * A pass over this awards (habits × 7) action events, so an event-counting
   * counter reaches ~7x the true feature row count.
   */
  async function seedWindow(habitCount: number, todayKey: string): Promise<number> {
    const { habits, domain } = await loadModules();
    const window = [];
    for (let offset = 0; offset < 7; offset += 1) {
      window.push(domain.shiftDateKey(todayKey, -offset));
    }
    for (let index = 0; index < habitCount; index += 1) {
      const habitId = await habits.addHabit(`Habit ${index}`, 1);
      await seedCompletions(habitId, window);
    }
    return habitCount * window.length;
  }

  it('does not unlock a habits badge the feature tables have not reached', async () => {
    const { gamification, time } = await loadModules();
    const todayKey = time.toDateKey();

    // 2 habits × 7 days = 14 real check-in rows: below the first tier (50).
    // The pass awards 14 action events plus milestone/quest events, so an
    // event-counting counter would still not reach 50 here — but the point of
    // this case is the durable invariant, checked below the threshold.
    const trueRows = await seedWindow(2, todayKey);
    expect(trueRows).toBeLessThan(FIRST_HABITS_TIER);

    await gamification.runGamificationHousekeeping({ todayKey });

    const unlocked = await db.getAllAsync<{ badge_id: string; family: string }>(
      `SELECT badge_id, family FROM gamification_badges WHERE family = 'habits'`,
    );
    // The user logged 14 check-ins; no habits badge may exist.
    expect(unlocked).toEqual([]);

    const snapshot = await gamification.readGamificationSnapshot({ todayKey });
    const progress = snapshot.badges.find((badge) => badge.id === 'habits:1')?.progress;
    expect(progress).toBe(trueRows);
  });

  it('never writes a habits badge row from inflated pass counters', async () => {
    const { gamification, time } = await loadModules();
    const todayKey = time.toDateKey();

    // 20 habits x 7 days = 140 real check-in rows: past tier 1 (50) but well
    // short of tier 2 (250). A pass awards ONE habit event per row, so an
    // event-counting counter lands at ~280 — past tier 2 — which is exactly the
    // wrong unlock this test pins.
    const trueRows = await seedWindow(20, todayKey);
    expect(trueRows).toBeGreaterThanOrEqual(FIRST_HABITS_TIER);
    expect(trueRows).toBeLessThan(250);

    await gamification.runGamificationHousekeeping({ todayKey });

    const unlocked = await db.getAllAsync<{ badge_id: string }>(
      `SELECT badge_id FROM gamification_badges WHERE family = 'habits' ORDER BY badge_id ASC`,
    );
    // Exactly tier 1 — never a tier the feature rows do not support.
    expect(unlocked.map((row) => row.badge_id)).toEqual(['habits:1']);

    const snapshot = await gamification.readGamificationSnapshot({ todayKey });
    expect(snapshot.badges.find((badge) => badge.id === 'habits:1')?.progress).toBe(trueRows);
    expect(snapshot.badges.find((badge) => badge.id === 'habits:2')?.unlocked).toBe(false);
  });
});
