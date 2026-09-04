import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { seedMature } from './fixtures';

/**
 * Historical realistic DB corpus manifest (Certification Infrastructure V2,
 * Wave 3). Deterministic synthetic-but-realistic fixtures standing in for
 * the real-user corpora that known-gaps #5/#6 keep explicitly open.
 *
 * | dimension            | MATURE (seedMature)                                  |
 * |----------------------|------------------------------------------------------|
 * | horizon              | 210 days ending 2026-07-01                           |
 * | todos                | 612 rows (600 + 12 daily-recurrence series; 609      |
 * |                      | active, 3 tombstones)                                |
 * | habits               | 20 (3 archived, 2 paused, all with history)          |
 * | habit_completions    | 3361 (20 x 210 x 0.8 pattern + 1 pre-cutover UTC key)|
 * | calorie_entries      | 630 (3/day) + 16 saved meals (10 catalog + 6 learned)|
 * | workout              | 8 routines + 70 logs + 1 interrupted draft           |
 * | pomodoro             | 105 sessions + 1 live intent + 1 pending retry log   |
 * | planning             | 4 projects (mixed statuses) + 12 goals               |
 * | sync_outbox          | 4933 pending intents (never drained: restart input)  |
 * | backup.scope_version | '6' (pre-cutover marker; current code writes '7')    |
 * | schema               | 24                                                   |
 *
 * Counts are exact on purpose: any product change that shifts them must
 * update this manifest consciously, like journey oracles. Determinism is
 * proven by seeding twice and comparing canonical hashes (generated IDs
 * embed wall-clock + random material, so the hasher normalizes
 * `{prefix}_{ms}_{rand}` tokens to first-seen ordinals first — row
 * wiring is preserved, noise is removed).
 */

type CorpusDb = Awaited<ReturnType<typeof seedMature>>;

async function count(db: CorpusDb, sql: string, params: readonly unknown[] = []): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>(sql, params);
  return row?.n ?? 0;
}

async function metaValue(db: CorpusDb, key: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM app_meta WHERE key = ?',
    [key],
  );
  return row?.value ?? null;
}

/** Tables the corpus seeders write, intersected with what actually exists. */
async function corpusTables(db: CorpusDb): Promise<string[]> {
  const rows = await db.getAllAsync<{ name: string }>(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name`,
  );
  const wanted = new Set([
    'todos',
    'habits',
    'habit_completions',
    'calorie_entries',
    'saved_meals',
    'workout_routines',
    'routine_exercises',
    'routine_exercise_sets',
    'workout_session_exercises',
    'workout_session_sets',
    'workout_logs',
    'pomodoro_sessions',
    'projects',
    'goals',
    'daily_plans',
    'linked_action_rules',
    'saved_meals',
    'sync_outbox',
    'app_meta',
  ]);
  return rows.map((row) => row.name).filter((name) => wanted.has(name));
}

async function canonicalCorpusHash(db: CorpusDb): Promise<{ hash: string; dump: string }> {
  const ordinals = new Map<string, number>();
  const normalize = (text: string): string =>
    text.replace(/\b[a-z]+_\d+_[0-9A-Za-z]{8}\b/g, (token) => {
      let ordinal = ordinals.get(token);
      if (ordinal === undefined) {
        ordinal = ordinals.size + 1;
        ordinals.set(token, ordinal);
      }
      return `#${ordinal}`;
    });
  const hash = createHash('sha256');
  let dump = '';
  for (const table of await corpusTables(db)) {
    // date_key_cutover is stamped with wall-clock time by migration 5 on
    // every fresh migrate: inherently unreproducible, covered instead by
    // the migration suites. Everything else must be seed-deterministic.
    const rows =
      table === 'app_meta'
        ? await db.getAllAsync(
            `SELECT * FROM "app_meta" WHERE key != 'date_key_cutover' ORDER BY rowid`,
          )
        : await db.getAllAsync(`SELECT * FROM "${table}" ORDER BY rowid`);
    const chunk = `[${table}]${normalize(JSON.stringify(rows))}`;
    hash.update(chunk);
    dump += chunk;
  }
  return { hash: hash.digest('hex'), dump };
}

// CG-9: MATURE seeds ~9k rows through the real data layers; under full
// parallel load that can cross the 15s project bound. Corpus shape is not
// a timing contract — 120s keeps load sensitivity out.
describe('tests/integration/corpus', { timeout: 120_000 }, () => {
  it('MATURE inventory matches the manifest exactly', async () => {
    const db = await seedMature();
    const { clock } = await import('./fixtures/clock');
    expect(clock.toDateKey()).toBe('2026-07-01');

    expect(await count(db, 'SELECT COUNT(*) AS n FROM todos')).toBe(612);
    expect(await count(db, 'SELECT COUNT(*) AS n FROM todos WHERE deleted_at IS NULL')).toBe(609);
    expect(await count(db, 'SELECT COUNT(*) AS n FROM todos WHERE deleted_at IS NOT NULL')).toBe(3);
    expect(
      await count(
        db,
        `SELECT COUNT(*) AS n FROM todos WHERE recurrence = 'daily' AND deleted_at IS NULL`,
      ),
    ).toBe(12);
    expect(await count(db, 'SELECT COUNT(*) AS n FROM habits WHERE deleted_at IS NULL')).toBe(20);
    expect(
      await count(
        db,
        `SELECT COUNT(*) AS n FROM habits WHERE status = 'archived' AND deleted_at IS NULL`,
      ),
    ).toBe(3);
    expect(
      await count(
        db,
        `SELECT COUNT(*) AS n FROM habits WHERE status = 'paused' AND deleted_at IS NULL`,
      ),
    ).toBe(2);
    expect(await count(db, 'SELECT COUNT(*) AS n FROM habit_completions')).toBe(3361);
    expect(
      await count(db, 'SELECT COUNT(*) AS n FROM habit_completions WHERE date_key LIKE ?', [
        '%T%Z',
      ]),
    ).toBe(1);
    expect(
      await count(db, 'SELECT COUNT(*) AS n FROM calorie_entries WHERE deleted_at IS NULL'),
    ).toBe(630);
    expect(await count(db, 'SELECT COUNT(*) AS n FROM saved_meals')).toBe(16);
    expect(
      await count(db, 'SELECT COUNT(*) AS n FROM workout_routines WHERE deleted_at IS NULL'),
    ).toBe(8);
    expect(await count(db, 'SELECT COUNT(*) AS n FROM workout_logs')).toBe(70);
    expect(await count(db, 'SELECT COUNT(*) AS n FROM pomodoro_sessions')).toBe(105);
    expect(await count(db, 'SELECT COUNT(*) AS n FROM projects WHERE deleted_at IS NULL')).toBe(4);
    expect(await count(db, 'SELECT COUNT(*) AS n FROM goals WHERE deleted_at IS NULL')).toBe(12);
    expect(await count(db, 'SELECT COUNT(*) AS n FROM sync_outbox')).toBe(4933);

    // Edge-state stage.
    expect(await metaValue(db, 'backup.scope_version')).toBe('6');
    expect(await metaValue(db, 'pomodoro.active_timer')).not.toBeNull();
    expect(await metaValue(db, 'workout.active_session_draft')).not.toBeNull();
    const pendingLogs = await metaValue(db, 'pomodoro.pending_logs');
    expect(pendingLogs).not.toBeNull();
    expect(JSON.parse(pendingLogs ?? '[]')).toHaveLength(1);

    const version = await metaValue(db, 'db_schema_version');
    expect(version).toBe('24');
    await db.closeAsync();
  });

  it('MATURE is byte-reproducible across independent seeds', async () => {
    const first = await seedMature();
    const firstResult = await canonicalCorpusHash(first);
    await first.closeAsync();
    const second = await seedMature();
    const secondResult = await canonicalCorpusHash(second);
    await second.closeAsync();
    expect(secondResult.hash).toBe(firstResult.hash);
    // Tripwire: no wall-clock date may leak into the reproducible dump
    // (it would pass today and fail tomorrow). The migration-stamped
    // cutover is excluded from the hash above by design.
    const wallDate = new Date().toISOString().slice(0, 10);
    expect(secondResult.dump.includes(wallDate)).toBe(false);
  });
});
