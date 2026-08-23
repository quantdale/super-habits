/**
 * Unit tests for the run-report schema + validator (task 4.1) and the failure
 * digest builder (task 4.3). Pure — no browser, no fs.
 */

import { describe, expect, it } from 'vitest';
import { buildFailureDigest } from '../simulation/observe/digest';
import {
  createRunReport,
  finalizeRunReport,
  formatRunFailureDiagnostics,
  isRunReportValid,
  parseRunReport,
  RUN_REPORT_SCHEMA_VERSION,
  serializeRunReport,
  validateRunReport,
  type RunEnvironment,
  type RunReport,
} from '../simulation/observe/report';

function baseEnvironment(): RunEnvironment {
  return {
    browser: 'chromium',
    browserVersion: '135.0.0',
    platform: 'web',
    baseUrl: 'http://localhost:8081',
    appVersion: '1.0.0',
  };
}

function validReport(): RunReport {
  const env = baseEnvironment();
  const report = createRunReport({
    runId: 'run_20260804_abcd1234',
    lane: 'scenario',
    mode: 'deterministic',
    seed: 'smoke-fixed-seed',
    environment: env,
    persona: { id: 'daily-driver', name: 'Maya, the Daily Driver' },
    scenario: { id: 'smoke', goal: 'exercise every step type' },
    artifacts: {
      root: 'simulation-output/run_20260804_abcd1234',
      report: 'simulation-output/run_20260804_abcd1234/run-report.json',
      screenshots: [],
    },
  });
  report.steps.push({
    index: 0,
    kind: 'createTodo',
    note: 'add a todo',
    startedAt: '2026-08-04T06:00:00.000Z',
    finishedAt: '2026-08-04T06:00:01.000Z',
    durationMs: 1000,
    status: 'passed',
    oracles: [{ kind: 'rows', sql: 'SELECT 1', result: 'passed' }],
    artifacts: { screenshots: ['simulation-output/run_x/screenshots/000-createTodo-passed.png'] },
  });
  report.actionLog.push('createTodo title="Pay rent"');
  return finalizeRunReport(report, {
    outcome: 'passed',
    startedAt: '2026-08-04T06:00:00.000Z',
  });
}

describe('createRunReport / finalizeRunReport', () => {
  it('produces a report that passes its own validator', () => {
    const report = validReport();
    expect(validateRunReport(report)).toEqual([]);
    expect(isRunReportValid(report)).toBe(true);
    expect(report.schemaVersion).toBe(RUN_REPORT_SCHEMA_VERSION);
    expect(report.outcome).toBe('passed');
  });

  it('records duration from startedAt to finalize time', () => {
    const report = createRunReport({
      runId: 'run_dur',
      lane: 'seeded',
      mode: 'seeded',
      seed: '0x1234',
      environment: baseEnvironment(),
      persona: null,
      scenario: null,
      artifacts: {
        root: 'simulation-output/run_dur',
        report: 'simulation-output/run_dur/run-report.json',
        screenshots: [],
      },
    });
    const startedAt = new Date(Date.now() - 2500).toISOString();
    finalizeRunReport(report, { outcome: 'failed', startedAt });
    expect(report.durationMs).toBeGreaterThanOrEqual(2000);
  });
});

describe('validateRunReport', () => {
  it('accepts reports from every lane', () => {
    for (const lane of ['scenario', 'seeded', 'repro'] as const) {
      const report = validReport();
      report.lane = lane;
      expect(validateRunReport(report)).toEqual([]);
    }
  });

  it('rejects a non-object', () => {
    const issues = validateRunReport(null);
    expect(issues).toContainEqual({ path: 'report', message: 'must be an object' });
  });

  it('rejects a wrong schema version', () => {
    const report = validReport();
    (report as unknown as Record<string, unknown>).schemaVersion = 2;
    expect(validateRunReport(report)).toContainEqual({
      path: 'schemaVersion',
      message: 'must be 1',
    });
  });

  it('rejects missing mandatory fields', () => {
    const report = validReport() as unknown as Record<string, unknown>;
    delete report.runId;
    delete report.finishedAt;
    const issues = validateRunReport(report);
    expect(issues.some((i) => i.path === 'runId')).toBe(true);
    expect(issues.some((i) => i.path === 'finishedAt')).toBe(true);
  });

  it('rejects unknown lane / mode / outcome / step status', () => {
    const report = validReport();
    (report as unknown as Record<string, unknown>).lane = 'spaceship';
    expect(validateRunReport(report)).toContainEqual({
      path: 'lane',
      message: 'unknown lane: spaceship',
    });
    const report2 = validReport();
    report2.mode = 'chaos' as never;
    expect(validateRunReport(report2)).toContainEqual({
      path: 'mode',
      message: 'unknown mode: chaos',
    });
    const report3 = validReport();
    report3.outcome = 'transcended' as never;
    expect(validateRunReport(report3)).toContainEqual({
      path: 'outcome',
      message: 'unknown outcome: transcended',
    });
    const report4 = validReport();
    report4.steps[0].status = 'maybe' as never;
    expect(validateRunReport(report4)).toContainEqual({
      path: 'steps[0].status',
      message: 'unknown status: maybe',
    });
  });

  it('rejects non-ISO dates and negative durations', () => {
    const report = validReport();
    report.startedAt = 'yesterday';
    expect(validateRunReport(report)).toContainEqual({
      path: 'startedAt',
      message: 'must be an ISO date string',
    });
    const report2 = validReport();
    report2.steps[0].durationMs = -5;
    expect(validateRunReport(report2)).toContainEqual({
      path: 'steps[0].durationMs',
      message: 'must be a number >= 0',
    });
  });

  it('rejects bad actionLog entries', () => {
    const report = validReport();
    (report.actionLog as unknown[]).push(42);
    expect(validateRunReport(report)).toContainEqual({
      path: 'actionLog[1]',
      message: 'must be a string',
    });
  });

  it('requires a failure summary on failed runs', () => {
    const report = finalizeRunReport(validReport(), {
      outcome: 'failed',
      startedAt: '2026-08-04T06:00:00.000Z',
    });
    // finalizeRunReport with outcome failed but no failure → invalid.
    expect(validateRunReport(report)).toContainEqual({
      path: 'failure',
      message: 'failed run must carry a failure summary',
    });
  });

  it('accepts a failed run WITH a failure summary', () => {
    const report = validReport();
    report.steps[0].status = 'failed';
    report.steps[0].error = 'boom';
    report.failure = {
      stepIndex: 0,
      stepKind: 'createTodo',
      action: 'createTodo title="Pay rent"',
      error: 'boom',
      expected: '1 row',
      actual: '0 rows',
      stateSummary: 'todos: 0',
      browserErrors: ['console.error: hydration failed'],
      serverErrors: ['HTTP 503 POST http://localhost:8081/api'],
    };
    finalizeRunReport(report, { outcome: 'failed', startedAt: '2026-08-04T06:00:00.000Z' });
    expect(validateRunReport(report)).toEqual([]);
  });

  it('formats lane-level diagnostics for a failed run', () => {
    const report = validReport();
    report.failure = {
      stepIndex: 0,
      stepKind: 'createTodo',
      action: 'createTodo title="Pay rent"',
      error: 'oracle failed',
      expected: '[{"title":"Pay rent"}]',
      actual: '0 rows',
      stateSummary: 'todos=0',
      browserErrors: ['console.error: hydration failed'],
      serverErrors: ['HTTP 503 POST http://localhost:8081/api'],
    };
    finalizeRunReport(report, { outcome: 'failed', startedAt: '2026-08-04T06:00:00.000Z' });
    const diagnostics = formatRunFailureDiagnostics(report);
    expect(diagnostics).toContain('lane=scenario');
    expect(diagnostics).toContain('runId=run_20260804_abcd1234');
    expect(diagnostics).toContain('seed=smoke-fixed-seed');
    expect(diagnostics).toContain('action=createTodo title="Pay rent"');
    expect(diagnostics).toContain('classification=UNTRIAGED');
    expect(diagnostics).toContain('report=simulation-output/run_20260804_abcd1234/run-report.json');
    expect(diagnostics).toContain('oracleActual=0 rows');
    expect(diagnostics).toContain('browserErrors=console.error: hydration failed');
    expect(diagnostics).toContain('serverErrors=HTTP 503 POST http://localhost:8081/api');
  });

  it('rejects unknown oracle kinds', () => {
    const report = validReport();
    report.steps[0].oracles = [{ kind: 'magic', result: 'passed' }] as never;
    expect(validateRunReport(report)).toContainEqual({
      path: 'steps[0].oracles[0].kind',
      message: 'unknown oracle kind: magic',
    });
  });
});

describe('parseRunReport', () => {
  it('round-trips a valid report', () => {
    const json = serializeRunReport(validReport());
    const parsed = parseRunReport(json);
    expect(parsed.runId).toBe('run_20260804_abcd1234');
  });

  it('throws on malformed JSON', () => {
    expect(() => parseRunReport('{ nope')).toThrow(/not valid JSON/);
  });

  it('throws on reports failing validation', () => {
    const report = validReport();
    (report as unknown as Record<string, unknown>).runId = '';
    expect(() => parseRunReport(serializeRunReport(report))).toThrow(/failed validation/);
  });

  it('can skip validation for corrupted-but-readable reports', () => {
    const report = validReport() as unknown as Record<string, unknown>;
    delete report.persona;
    const parsed = parseRunReport(JSON.stringify(report), { validate: false });
    expect(parsed).toBeDefined();
  });
});

describe('buildFailureDigest (4.3)', () => {
  it('renders persona, scenario, step, seed, expected vs actual, artifacts', () => {
    const report = validReport();
    report.failure = {
      stepIndex: 0,
      stepKind: 'createTodo',
      action: 'createTodo title="Pay rent"',
      error: 'timeout waiting for row',
      expected: 'todos count = 1',
      actual: 'todos count = 0',
      stateSummary: 'todos: 0 rows, outbox: empty',
      browserErrors: ['console.error: hydration failed'],
      serverErrors: ['HTTP 503 POST http://localhost:8081/api'],
      digestPath: 'simulation-output/run_x/digest.md',
    };
    report.steps[0].status = 'failed';
    finalizeRunReport(report, {
      outcome: 'failed',
      startedAt: '2026-08-04T06:00:00.000Z',
    });
    report.artifacts.video = 'simulation-output/run_x/artifacts/video.webm';
    report.artifacts.trace = 'simulation-output/run_x/artifacts/trace.zip';

    const md = buildFailureDigest(report, { stateSummary: 'todos: 0 rows, outbox: empty' });
    expect(md).toContain('Maya, the Daily Driver');
    expect(md).toContain('smoke');
    expect(md).toContain('`createTodo`');
    expect(md).toContain('createTodo title="Pay rent"');
    expect(md).toContain('smoke-fixed-seed');
    expect(md).toContain('todos count = 1');
    expect(md).toContain('todos count = 0');
    expect(md).toContain('simulation-output/run_x/artifacts/video.webm');
    expect(md).toContain('simulation-output/run_x/artifacts/trace.zip');
    expect(md).toContain('console.error: hydration failed');
    expect(md).toContain('HTTP 503 POST http://localhost:8081/api');
    expect(md).toContain('run-report.json');
    expect(md).toContain('Replay exactly with');
  });

  it('names the replay command with the recorded seed', () => {
    const report = validReport();
    const md = buildFailureDigest(report);
    expect(md).toContain('--scenario smoke --mode deterministic --seed smoke-fixed-seed');
  });
});
