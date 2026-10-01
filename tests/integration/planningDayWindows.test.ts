// NOTE ON TZ: this file exercises LOCAL-calendar day windows at a daylight-saving
// boundary, so it forces America/New_York at the very top, before any import of
// `lib/time`. Node re-reads `process.env.TZ` per Date operation (verified by
// `tests/integration/dateKeys.test.ts`), so this works regardless of the CI
// job's TZ — and the first test below asserts the DST offsets really applied,
// so a future Node change that caches TZ fails loudly instead of silently
// running in a non-DST zone where these guards would pass vacuously.
//
// NOTE ON THE CLOCK: the reference instant is pinned with fake timers rather
// than a `lib/time` module mock, so every read path below observes the same
// instant no matter how many times `freshDatabase()` resets the module
// registry (a static `vi.mock` factory keeps serving the clock instance it
// captured on its first invocation — the trap `fixtures/seeders.ts` documents
// and re-binds around on every seed).
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { freshDatabase, type TestDatabase } from './helpers/db';

const ORIGINAL_TZ = process.env.TZ;
process.env.TZ = 'America/New_York';

afterAll(() => {
  if (ORIGINAL_TZ === undefined) delete process.env.TZ;
  else process.env.TZ = ORIGINAL_TZ;
});

/**
 * US spring-forward 2026 is 2026-03-08 02:00 EST -> 03:00 EDT (a 23-hour local
 * day) and fall-back is 2026-11-01 02:00 EDT -> 01:00 EST (a 25-hour local day).
 *
 * The bug class under test: `now - (N-1) * 86_400_000` traverses those short and
 * long days, so the computed start lands on the wrong CALENDAR day whenever the
 * reference instant sits near local midnight — 2026-03-09 00:30 for
 * spring-forward (one day too early, so an inclusive window spans N+1 days) and
 * 2026-11-02 23:30 for fall-back (one day too late, so it spans N-1 days).
 */
const SPRING_FORWARD_MORNING = new Date('2026-03-09T04:30:00Z'); // 00:30 EDT
const FALL_BACK_EVENING = new Date('2026-11-02T23:30:00-05:00'); // 23:30 EST
const ORDINARY_AFTERNOON = new Date('2026-06-15T13:00:00Z'); // 09:00 EDT, no boundary inside

/** The inclusive start each N-day window must have under calendar arithmetic. */
const EXPECTED_START = {
  '30@spring': '2026-02-08',
  '30@fallback': '2026-10-04',
  '14@spring': '2026-02-24',
  '30@ordinary': '2026-05-17',
} as const;

/** Local-calendar key shift (positive = later). */
function shiftKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${mm}-${dd}`;
}

/** Writes habit_completions rows directly, with exact local date keys. */
async function writeCompletions(
  db: TestDatabase,
  habitId: string,
  dateKeys: readonly string[],
): Promise<void> {
  for (const dateKey of dateKeys) {
    await db.runAsync(
      `INSERT INTO habit_completions (id, habit_id, date_key, count, created_at, updated_at)
       VALUES (?, ?, ?, 1, ?, ?)`,
      [
        `hcmp_${habitId}_${dateKey}`,
        habitId,
        dateKey,
        `${dateKey}T12:00:00.000Z`,
        `${dateKey}T12:00:00.000Z`,
      ],
    );
  }
}

describe('day-window reads at a DST boundary (forced America/New_York)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('the forced zone is really DST-observing on this Node', () => {
    // 2026-03-08 noon UTC is already EDT (UTC-4); 2026-11-01 noon UTC is EST.
    expect(new Date('2026-03-08T12:00:00Z').getTimezoneOffset()).toBe(240);
    expect(new Date('2026-11-01T12:00:00Z').getTimezoneOffset()).toBe(300);
  });

  it('goal rollup window starts on the correct calendar day across spring-forward', async () => {
    vi.setSystemTime(SPRING_FORWARD_MORNING);
    const db = await freshDatabase();
    const goals = await import('@/features/goals/goals.data');
    const habits = await import('@/features/habits/habits.data');

    const goalId = await goals.addGoal({ title: 'Month goal', horizon: 'month' });
    const habitId = await habits.addHabit('Window probe', 1);
    await habits.setHabitProjectGoal(habitId, { goalId });
    await writeCompletions(db, habitId, [
      EXPECTED_START['30@spring'], // inside the window
      shiftKey(EXPECTED_START['30@spring'], -1), // one day before it — must not count
    ]);

    const rollup = await goals.getGoalRollup(goalId);
    expect(rollup.habits.windowDays).toBe(30);
    expect(rollup.habits.completionsInWindow).toBe(1);
  });

  it('goal rollup window starts on the correct calendar day across fall-back', async () => {
    vi.setSystemTime(FALL_BACK_EVENING);
    const db = await freshDatabase();
    const goals = await import('@/features/goals/goals.data');
    const habits = await import('@/features/habits/habits.data');

    const goalId = await goals.addGoal({ title: 'Month goal', horizon: 'month' });
    const habitId = await habits.addHabit('Window probe', 1);
    await habits.setHabitProjectGoal(habitId, { goalId });
    await writeCompletions(db, habitId, [
      EXPECTED_START['30@fallback'],
      shiftKey(EXPECTED_START['30@fallback'], -1),
    ]);

    const rollup = await goals.getGoalRollup(goalId);
    expect(rollup.habits.windowDays).toBe(30);
    expect(rollup.habits.completionsInWindow).toBe(1);
  });

  it('daily-plan listing window starts on the correct calendar day across spring-forward', async () => {
    vi.setSystemTime(SPRING_FORWARD_MORNING);
    await freshDatabase();
    const plans = await import('@/features/daily-plan/dailyPlan.data');

    const inside = EXPECTED_START['14@spring'];
    await plans.upsertDailyPlan(inside, { intention: 'inside the window' });
    await plans.upsertDailyPlan(shiftKey(inside, -1), { intention: 'before the window' });

    const recent = await plans.listRecentDailyPlans();
    expect(recent.map((plan) => plan.date_key)).toEqual([inside]);
  });

  it('both project habit windows start on the correct calendar day across spring-forward', async () => {
    vi.setSystemTime(SPRING_FORWARD_MORNING);
    const db = await freshDatabase();
    const projects = await import('@/features/projects/projects.data');
    const habits = await import('@/features/habits/habits.data');

    const projectId = await projects.addProject({ name: 'Window probe' });
    const habitId = await habits.addHabit('Window probe', 1);
    await habits.setHabitProjectGoal(habitId, { projectId });
    await writeCompletions(db, habitId, [
      EXPECTED_START['30@spring'],
      shiftKey(EXPECTED_START['30@spring'], -1),
    ]);

    const single = await projects.getProjectRollup(projectId);
    expect(single.habits.windowDays).toBe(30);
    expect(single.habits.recentCompletions).toBe(1);

    const all = await projects.listProjectRollups();
    expect(all[projectId].habits.recentCompletions).toBe(1);
  });

  it('an inclusive N-day window spans exactly N local days across spring-forward', async () => {
    vi.setSystemTime(SPRING_FORWARD_MORNING);
    const db = await freshDatabase();
    const projects = await import('@/features/projects/projects.data');
    const habits = await import('@/features/habits/habits.data');

    const projectId = await projects.addProject({ name: 'Span probe' });
    const habitId = await habits.addHabit('Span probe', 1);
    await habits.setHabitProjectGoal(habitId, { projectId });

    const start = EXPECTED_START['30@spring'];
    const span: string[] = [];
    for (let offset = 0; offset < 30; offset += 1) span.push(shiftKey(start, offset));
    // The 23-hour day itself must be inside the window, and the window must end
    // on the reference day rather than on the 30th preceding day.
    expect(span).toContain('2026-03-08');
    expect(span[29]).toBe('2026-03-09');
    await writeCompletions(db, habitId, [...span, shiftKey(start, -1)]);

    const rollup = await projects.getProjectRollup(projectId);
    expect(rollup.habits.recentCompletions).toBe(30);
  });

  it('an ordinary-length day produces exactly the previous arithmetic', async () => {
    vi.setSystemTime(ORDINARY_AFTERNOON);
    const db = await freshDatabase();
    const projects = await import('@/features/projects/projects.data');
    const habits = await import('@/features/habits/habits.data');

    const projectId = await projects.addProject({ name: 'Ordinary probe' });
    const habitId = await habits.addHabit('Ordinary probe', 1);
    await habits.setHabitProjectGoal(habitId, { projectId });

    const start = EXPECTED_START['30@ordinary'];
    await writeCompletions(db, habitId, [start, shiftKey(start, -1)]);

    const rollup = await projects.getProjectRollup(projectId);
    // Calendar arithmetic agrees with fixed-millisecond arithmetic here, so the
    // fix is provably boundary-only: the only counted row is the shared start day.
    expect(rollup.habits.recentCompletions).toBe(1);
  });
});
