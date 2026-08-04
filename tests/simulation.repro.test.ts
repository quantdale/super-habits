/**
 * Unit tests for the repro bundle layer (`add-user-simulation-platform`
 * tasks 5.1 / 5.3). Pure functions only — metadata serializers, the DB restore
 * SQL, the action log, the HAR builder, and the step-divergence logic. No
 * browser, no fs I/O on live artifacts.
 */

import { describe, expect, it } from 'vitest';
import {
  BUNDLE_SCHEMA_VERSION,
  buildHar,
  buildNarrativeTemplate,
  buildRestoreSql,
  parseActionsJsonl,
  parseBundleMetadata,
  parseSqliteDump,
  serializeActionsJsonl,
  serializeSqliteDump,
  sqlLiteral,
  validateBundleMetadata,
  type BundleMetadata,
  type SqliteDump,
} from '../simulation/repro/bundle';
import { computeDivergence, sameFailureAtSameStep } from '../simulation/repro/replay';
import type { RunReport, RunStepEntry } from '../simulation/observe/report';

/* ------------------------------------------------------------------ */
/* bundle.json metadata                                               */
/* ------------------------------------------------------------------ */

function validMetadata(): BundleMetadata {
  return {
    schemaVersion: BUNDLE_SCHEMA_VERSION,
    bundleId: 'bundle_abc123',
    runId: 'run_xyz',
    createdAt: '2026-08-04T08:00:00.000Z',
    commit: 'cd7a3e3',
    scenario: { id: 'smoke', goal: 'g' },
    persona: { id: 'p', name: 'P' },
    seed: 'deterministic',
    mode: 'deterministic',
    lane: 'scenario',
    timezone: 'Asia/Manila',
    environment: {
      browser: 'chromium',
      platform: 'web',
      baseUrl: 'http://localhost:8081',
    },
    outcome: 'failed',
    stepCount: 2,
    files: {
      db: 'db.sqlite.json',
      storage: 'storage.json',
      actions: 'actions.jsonl',
      report: 'report.json',
      network: 'network.har',
      narrative: 'narrative.md',
    },
  };
}

describe('bundle metadata (5.1)', () => {
  it('validates a well-formed bundle.json', () => {
    expect(validateBundleMetadata(validMetadata())).toEqual([]);
  });

  it('round-trips through JSON', () => {
    const parsed = parseBundleMetadata(JSON.stringify(validMetadata()));
    expect(parsed.bundleId).toBe('bundle_abc123');
    expect(parsed.commit).toBe('cd7a3e3');
    expect(parsed.timezone).toBe('Asia/Manila');
  });

  it('rejects a wrong schema version / bad mode / missing files', () => {
    const meta = {
      ...validMetadata(),
      schemaVersion: 2,
      mode: 'chaos',
      files: { ...validMetadata().files, db: '' },
    };
    const issues = validateBundleMetadata(meta);
    expect(issues.some((i) => i.path === 'schemaVersion')).toBe(true);
    expect(issues.some((i) => i.path === 'mode')).toBe(true);
    expect(issues.some((i) => i.path === 'files.db')).toBe(true);
  });

  it('throws on malformed JSON', () => {
    expect(() => parseBundleMetadata('{ nope')).toThrow(/not valid JSON/);
  });
});

/* ------------------------------------------------------------------ */
/* actions.jsonl                                                       */
/* ------------------------------------------------------------------ */

describe('actions.jsonl (5.1)', () => {
  it('round-trips semantic steps (one JSON object per line)', () => {
    const steps = [
      { kind: 'switchSection', tab: 'todos' },
      {
        kind: 'createTodo',
        title: 'Pay rent',
        priority: 'urgent',
        oracles: [
          {
            kind: 'rows',
            sql: "SELECT 1 WHERE title='Pay rent'",
            expected: [{ title: 'Pay rent' }],
          },
        ],
      },
    ] as never;
    const json = serializeActionsJsonl(steps);
    expect(json.split('\n').filter((l) => l.trim() !== '')).toHaveLength(2);
    const parsed = parseActionsJsonl(json);
    expect(parsed).toHaveLength(2);
    expect(parsed[1].kind).toBe('createTodo');
  });
});

/* ------------------------------------------------------------------ */
/* SQLite dump / restore SQL                                          */
/* ------------------------------------------------------------------ */

describe('db.sqlite.json serializer + restore SQL (5.1)', () => {
  it('round-trips a dump through JSON', () => {
    const dump: SqliteDump = {
      tables: { todos: [{ id: 'todo_1', title: 'A', deleted_at: null }] },
    };
    const parsed = parseSqliteDump(serializeSqliteDump(dump));
    expect(parsed.tables.todos[0].title).toBe('A');
  });

  it('escapes literals (quotes, nulls, numbers, booleans)', () => {
    expect(sqlLiteral("O'Reilly")).toBe("'O''Reilly'");
    expect(sqlLiteral(null)).toBe('NULL');
    expect(sqlLiteral(undefined)).toBe('NULL');
    expect(sqlLiteral(42)).toBe('42');
    expect(sqlLiteral(true)).toBe('1');
    expect(sqlLiteral(false)).toBe('0');
    expect(sqlLiteral(Number.NaN)).toBe('NULL');
  });

  it('builds DELETE + INSERT in dependency-safe order (parents before children)', () => {
    const dump: SqliteDump = {
      tables: {
        habit_completions: [
          { id: 'hcmp_1', habit_id: 'habit_1', date_key: '2026-08-04', count: 1 },
        ],
        habits: [{ id: 'habit_1', name: 'Drink water' }],
      },
    };
    const sql = buildRestoreSql(dump);
    const habitsIdx = sql.indexOf('INSERT INTO "habits"');
    const completionsIdx = sql.indexOf('INSERT INTO "habit_completions"');
    expect(habitsIdx).toBeGreaterThan(-1);
    expect(completionsIdx).toBeGreaterThan(habitsIdx);
    expect(sql).toContain('DELETE FROM "habits";');
    expect(sql).toContain('DELETE FROM "habit_completions";');
  });

  it('appends unknown tables alphabetically after known ones', () => {
    const dump: SqliteDump = {
      tables: {
        zeta: [{ id: 1 }],
        alpha: [{ id: 2 }],
        todos: [{ id: 'todo_1', title: 'T' }],
      },
    };
    const sql = buildRestoreSql(dump);
    expect(sql.indexOf('"todos"')).toBeLessThan(sql.indexOf('"alpha"'));
    expect(sql.indexOf('"alpha"')).toBeLessThan(sql.indexOf('"zeta"'));
  });

  it('omits empty tables', () => {
    const dump: SqliteDump = { tables: { todos: [] } };
    expect(buildRestoreSql(dump)).toBe('');
  });
});

/* ------------------------------------------------------------------ */
/* network.har                                                        */
/* ------------------------------------------------------------------ */

describe('network.har builder (5.1)', () => {
  it('produces a HAR log with one entry per event', () => {
    const har = JSON.parse(
      buildHar(
        [
          { url: 'http://localhost:8081/', status: 200, failed: false },
          { url: 'http://localhost:8081/api', status: 0, failed: true, error: 'net::ERR_FAILED' },
        ],
        '2026-08-04T08:00:00.000Z',
      ),
    ) as { log: { entries: { response: { status: number }; _failed: boolean }[] } };
    expect(har.log.entries).toHaveLength(2);
    expect(har.log.entries[0].response.status).toBe(200);
    expect(har.log.entries[1].response.status).toBe(0);
    expect(har.log.entries[1]._failed).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/* narrative.md template                                              */
/* ------------------------------------------------------------------ */

describe('narrative.md template (5.1)', () => {
  it('contains the expected/replay sections and metadata', () => {
    const md = buildNarrativeTemplate({
      bundleId: 'bundle_1',
      runId: 'run_1',
      commit: 'abc123',
      scenario: { id: 'smoke', goal: 'g' },
      seed: 'deterministic',
    });
    expect(md).toContain('What the user was doing');
    expect(md).toContain('Expected');
    expect(md).toContain('Observed');
    expect(md).toContain('npm run sim:repro:replay');
    expect(md).toContain('bundle_1');
    expect(md).toContain('abc123');
  });
});

/* ------------------------------------------------------------------ */
/* Divergence logic (5.3)                                             */
/* ------------------------------------------------------------------ */

function step(
  index: number,
  kind: RunStepEntry['kind'],
  status: RunStepEntry['status'],
): RunStepEntry {
  return {
    index,
    kind,
    startedAt: '2026-08-04T08:00:00.000Z',
    finishedAt: '2026-08-04T08:00:01.000Z',
    durationMs: 1000,
    status,
    error: status === 'failed' ? `step ${index} failed` : undefined,
  };
}

function reportWith(steps: RunStepEntry[], failedIndex?: number): RunReport {
  return {
    schemaVersion: 1,
    runId: 'run_r',
    lane: 'repro',
    mode: 'deterministic',
    seed: null,
    environment: { browser: 'chromium', platform: 'web', baseUrl: 'http://localhost:8081' },
    persona: null,
    scenario: null,
    startedAt: '2026-08-04T08:00:00.000Z',
    finishedAt: '2026-08-04T08:00:02.000Z',
    durationMs: 2000,
    outcome: failedIndex === undefined ? 'passed' : 'failed',
    actionLog: [],
    steps,
    artifacts: {
      root: 'simulation-output/r',
      report: 'simulation-output/r/run-report.json',
      screenshots: [],
    },
    failure:
      failedIndex === undefined
        ? undefined
        : { stepIndex: failedIndex, stepKind: steps[failedIndex].kind, error: 'boom' },
  };
}

describe('computeDivergence (5.3)', () => {
  it('marks matching passes as same', () => {
    const orig = [step(0, 'switchSection', 'passed'), step(1, 'expectOracle', 'passed')];
    const rep = [step(0, 'switchSection', 'passed'), step(1, 'expectOracle', 'passed')];
    const d = computeDivergence(orig, rep);
    expect(d.every((x) => x.note === 'same')).toBe(true);
  });

  it('marks a reproduced failure', () => {
    const orig = [step(0, 'switchSection', 'passed'), step(1, 'expectOracle', 'failed')];
    const rep = [step(0, 'switchSection', 'passed'), step(1, 'expectOracle', 'failed')];
    const d = computeDivergence(orig, rep);
    expect(d[1].note).toBe('reproduced-failure');
  });

  it('marks a divergence when a fixed step now passes', () => {
    const orig = [step(0, 'switchSection', 'passed'), step(1, 'expectOracle', 'failed')];
    const rep = [step(0, 'switchSection', 'passed'), step(1, 'expectOracle', 'passed')];
    const d = computeDivergence(orig, rep);
    expect(d[1].note).toBe('diverged');
    expect(d[1].originalStatus).toBe('failed');
    expect(d[1].replayedStatus).toBe('passed');
  });

  it('handles steps missing from one side as skipped/diverged', () => {
    const orig = [step(0, 'switchSection', 'passed')];
    const rep = [step(0, 'switchSection', 'passed'), step(1, 'expectOracle', 'passed')];
    const d = computeDivergence(orig, rep);
    expect(d[1].originalStatus).toBe('skipped');
    expect(d[1].note).toBe('diverged');
  });
});

describe('sameFailureAtSameStep (5.3)', () => {
  it('true when both fail at the same step kind', () => {
    const orig = reportWith(
      [step(0, 'switchSection', 'passed'), step(1, 'expectOracle', 'failed')],
      1,
    );
    const rep = reportWith(
      [step(0, 'switchSection', 'passed'), step(1, 'expectOracle', 'failed')],
      1,
    );
    expect(sameFailureAtSameStep(orig, rep)).toBe(true);
  });

  it('false when the corrected replay passes', () => {
    const orig = reportWith(
      [step(0, 'switchSection', 'passed'), step(1, 'expectOracle', 'failed')],
      1,
    );
    const rep = reportWith([step(0, 'switchSection', 'passed'), step(1, 'expectOracle', 'passed')]);
    expect(sameFailureAtSameStep(orig, rep)).toBe(false);
  });

  it('false when different steps fail', () => {
    const orig = reportWith(
      [step(0, 'switchSection', 'passed'), step(1, 'expectOracle', 'failed')],
      1,
    );
    const rep = reportWith(
      [step(0, 'switchSection', 'failed'), step(1, 'expectOracle', 'passed')],
      0,
    );
    expect(sameFailureAtSameStep(orig, rep)).toBe(false);
  });
});
