import { describe, expect, it } from 'vitest';
import { seedHeavy, seedSmall, seedTypical } from './fixtures';

/**
 * Smoke verification for the fixture seeders (task 2.11). Each seeder must
 * produce a real, version-11 database whose rows were created through the real
 * data layers (not hand-written INSERTs) and whose timestamps/date keys come
 * from the injected clock. Row counts are asserted as ranges, not exact
 * numbers, because the corpus is a fixed but not trivially-predictable shape.
 */

async function count(db: Awaited<ReturnType<typeof seedSmall>>, sql: string): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>(sql);
  return row?.n ?? 0;
}

describe('tests/integration/fixtures', () => {
  it('SMALL seeds a realistic single day through the real data layers', async () => {
    const db = await seedSmall();
    // Re-import the clock AFTER seeding: the seeder runs its own module reset,
    // so the static import above would hold the pre-reset clock instance.
    const { clock } = await import('./fixtures/clock');
    expect(clock.toDateKey()).toBe('2026-07-01'); // clock ends on the base day

    expect(
      await count(db, 'SELECT COUNT(*) AS n FROM todos WHERE deleted_at IS NULL'),
    ).toBeGreaterThanOrEqual(3);
    expect(await count(db, 'SELECT COUNT(*) AS n FROM habits WHERE deleted_at IS NULL')).toBe(2);
    expect(await count(db, 'SELECT COUNT(*) AS n FROM habit_completions')).toBeGreaterThan(0);
    expect(
      await count(db, 'SELECT COUNT(*) AS n FROM calorie_entries WHERE deleted_at IS NULL'),
    ).toBeGreaterThanOrEqual(3);
    expect(await count(db, 'SELECT COUNT(*) AS n FROM workout_logs')).toBeGreaterThan(0);
    expect(await count(db, 'SELECT COUNT(*) AS n FROM pomodoro_sessions')).toBeGreaterThan(0);

    const version = await db.getFirstAsync<{ value: string }>(
      'SELECT value FROM app_meta WHERE key = ?',
      ['db_schema_version'],
    );
    expect(version?.value).toBe('16');
    await db.closeAsync();
  });

  it('TYPICAL spans thirty days of consistent use', async () => {
    const db = await seedTypical();
    expect(await count(db, 'SELECT COUNT(*) AS n FROM habit_completions')).toBeGreaterThanOrEqual(
      30,
    );
    expect(
      await count(db, 'SELECT COUNT(*) AS n FROM calorie_entries WHERE deleted_at IS NULL'),
    ).toBeGreaterThanOrEqual(60);
    expect(await count(db, 'SELECT COUNT(*) AS n FROM workout_logs')).toBeGreaterThanOrEqual(5);
    expect(await count(db, 'SELECT COUNT(*) AS n FROM pomodoro_sessions')).toBeGreaterThanOrEqual(
      10,
    );
    await db.closeAsync();
  });

  // Backup Completeness V2 made every seeded mutation durably enqueue a
  // backup intent (outbox + dirty flag) in its transaction, so the HEAVY
  // volume seed legitimately does more per write than before.
  it('HEAVY spans three months at volume', async () => {
    const db = await seedHeavy();
    expect(
      await count(db, 'SELECT COUNT(*) AS n FROM todos WHERE deleted_at IS NULL'),
    ).toBeGreaterThanOrEqual(150);
    expect(await count(db, 'SELECT COUNT(*) AS n FROM habit_completions')).toBeGreaterThanOrEqual(
      1000,
    );
    expect(
      await count(db, 'SELECT COUNT(*) AS n FROM calorie_entries WHERE deleted_at IS NULL'),
    ).toBeGreaterThanOrEqual(300);
    expect(await count(db, 'SELECT COUNT(*) AS n FROM workout_logs')).toBeGreaterThanOrEqual(60);
    expect(await count(db, 'SELECT COUNT(*) AS n FROM pomodoro_sessions')).toBeGreaterThanOrEqual(
      60,
    );
    await db.closeAsync();
  }, 30_000);

  it('date keys are local-calendar and consistent with the injected clock', async () => {
    const db = await seedSmall();
    // A calorie entry written through the real data layer must land on the
    // clock's local date key, not the wall clock.
    const row = await db.getFirstAsync<{ consumed_on: string }>(
      'SELECT consumed_on FROM calorie_entries WHERE deleted_at IS NULL LIMIT 1',
    );
    expect(row?.consumed_on).toBe('2026-07-01');
    await db.closeAsync();
  });
});
