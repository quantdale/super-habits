import { describe, expect, it } from 'vitest';
import {
  ANOMALY_SEVERITIES,
  ANOMALY_TRIAGE_OUTCOMES,
  ANOMALY_TYPES,
  isAnomalyReportValid,
  parseAnomalyReport,
  validateAnomalyReport,
  type AnomalyReport,
} from '../simulation/ai/anomaly-report';

/** A structurally valid anomaly report, used as the known-good baseline. */
function validReport(): AnomalyReport {
  return {
    schemaVersion: 1,
    reportId: 'anomaly_2026-08-04_1719_erroneous-count',
    missionId: 'error-prone-user-todos-calories',
    personaId: 'P4',
    title: 'Calories diary shows a stale count after deletion',
    anomalyType: 'data-inconsistency',
    attempted: [
      {
        action: 'Deleted a calorie entry from the diary',
        expected: 'The diary header count decrements by one',
        observed: 'The header count still shows the old total',
        at: '2026-08-04T17:19:00.000Z',
      },
    ],
    expected: 'The Calories diary header count always matches the listed rows.',
    observed: 'After deleting one entry, the header count stayed at the pre-delete total.',
    severityGuess: 'medium',
    environment: {
      buildDir: 'dist/',
      browser: 'chromium 131.0.6778.204',
      startedAt: '2026-08-04T17:00:00.000Z',
      timezone: 'Europe/Berlin',
      seed: null,
    },
    persistedState: {
      summary: '12 todos, ~40 calorie_entries, 1 just deleted; sync outbox held 1 todo.',
    },
    trace: {
      tracePath: 'trace.zip',
      screenshots: ['screenshots/01-delete.png'],
      consoleLogPath: 'console.log',
    },
  };
}

function issuesFor(input: unknown): string[] {
  return validateAnomalyReport(input).map((i) => i.message);
}

function hasIssue(input: unknown, needle: string): boolean {
  return validateAnomalyReport(input).some(
    (i) => i.path.includes(needle) || i.message.includes(needle),
  );
}

/* ------------------------------------------------------------------------ */
/* Known-good report                                                         */
/* ------------------------------------------------------------------------ */

describe('validateAnomalyReport — known-good report', () => {
  it('passes a valid report with no issues', () => {
    expect(validateAnomalyReport(validReport())).toEqual([]);
    expect(isAnomalyReportValid(validReport())).toBe(true);
  });

  it('accepts a triaged report', () => {
    const report = validReport();
    report.triage = {
      outcome: 'defect-change',
      reference: 'fix-calories-diary-count',
      decidedAt: '2026-08-05T09:00:00.000Z',
      note: 'Reproduced deterministically; filed as a defect.',
    };
    expect(validateAnomalyReport(report)).toEqual([]);
  });

  it('accepts optional fields when present', () => {
    const report = validReport();
    report.narrative = 'The header count is derived from a stale summary value.';
    report.personaId = 'error-prone-user';
    report.environment.commit = 'abc1234';
    report.environment.appVersion = '1.0.0';
    report.environment.notes = 'clock advanced to 23:59';
    report.persistedState.outbox = [{ entity: 'todos', id: 'todo_1' }];
    expect(validateAnomalyReport(report)).toEqual([]);
  });
});

/* ------------------------------------------------------------------------ */
/* Top-level structure and required fields                                   */
/* ------------------------------------------------------------------------ */

describe('validation — top-level structure', () => {
  it('rejects a non-object payload', () => {
    expect(issuesFor('nope')).toContain('anomaly report must be a JSON object');
    expect(issuesFor(null)).toContain('anomaly report must be a JSON object');
    expect(issuesFor([])).toContain('anomaly report must be a JSON object');
  });

  it('rejects an unsupported schema version', () => {
    const report = validReport() as unknown as Record<string, unknown>;
    report.schemaVersion = 2;
    expect(issuesFor(report)).toContain('unsupported schema version: 2; expected 1');
  });

  it('flags missing reportId, missionId, and title', () => {
    const report = validReport() as unknown as Record<string, unknown>;
    delete report.reportId;
    delete report.missionId;
    delete report.title;
    const messages = issuesFor(report);
    expect(messages).toContain('reportId must be a non-empty string');
    expect(messages).toContain('missionId must be a non-empty string');
    expect(messages).toContain('title must be a non-empty string');
  });

  it('flags an unknown anomaly type', () => {
    const report = validReport() as unknown as Record<string, unknown>;
    report.anomalyType = 'magic';
    expect(issuesFor(report)).toContain(
      `unknown anomaly type: magic; known: ${ANOMALY_TYPES.join(', ')}`,
    );
  });

  it('flags an unknown severity guess', () => {
    const report = validReport() as unknown as Record<string, unknown>;
    report.severityGuess = 'astronomical';
    expect(issuesFor(report)).toContain(
      `unknown severity guess: astronomical; known: ${ANOMALY_SEVERITIES.join(', ')}`,
    );
  });

  it('flags empty expected and observed', () => {
    const report = validReport() as unknown as Record<string, unknown>;
    report.expected = '   ';
    report.observed = '';
    const messages = issuesFor(report);
    expect(messages).toContain('expected must be a non-empty string');
    expect(messages).toContain('observed must be a non-empty string');
  });
});

/* ------------------------------------------------------------------------ */
/* attempted — step-level log                                                */
/* ------------------------------------------------------------------------ */

describe('validation — attempted log', () => {
  it('flags a missing or empty attempted array', () => {
    const report = validReport() as unknown as Record<string, unknown>;
    delete report.attempted;
    expect(issuesFor(report)).toContain('attempted must be a non-empty array of attempt entries');
    report.attempted = [];
    expect(issuesFor(report)).toContain('attempted must be a non-empty array of attempt entries');
  });

  it('flags an attempt entry missing its action', () => {
    const report = validReport();
    report.attempted = [{ expected: 'x', observed: 'y' } as never];
    expect(issuesFor(report)).toContain('attempted[0].action must be a non-empty string');
  });

  it('flags an attempt entry with an invalid timestamp', () => {
    const report = validReport();
    report.attempted = [{ action: 'tapped delete', at: 'not-a-date' }];
    expect(issuesFor(report)).toContain('attempted[0].at must be a valid ISO 8601 timestamp');
  });

  it('flags a consoleErrors array containing non-strings', () => {
    const report = validReport();
    report.attempted = [{ action: 'tapped delete', consoleErrors: ['ok', 42] as never }];
    expect(issuesFor(report)).toContain('console error entries must be non-empty strings');
  });
});

/* ------------------------------------------------------------------------ */
/* environment                                                               */
/* ------------------------------------------------------------------------ */

describe('validation — environment', () => {
  it('requires environment to be an object', () => {
    const report = validReport() as unknown as Record<string, unknown>;
    report.environment = null;
    expect(issuesFor(report)).toContain('environment must be an object');
  });

  it('flags missing buildDir and browser', () => {
    const report = validReport() as unknown as Record<string, unknown>;
    delete (report.environment as Record<string, unknown>).buildDir;
    (report.environment as Record<string, unknown>).browser = '';
    const messages = issuesFor(report);
    expect(messages).toContain('environment.buildDir must be a non-empty string');
    expect(messages).toContain('environment.browser must be a non-empty string');
  });

  it('flags an invalid startedAt timestamp', () => {
    const report = validReport() as unknown as Record<string, unknown>;
    (report.environment as Record<string, unknown>).startedAt = 'yesterday';
    expect(issuesFor(report)).toContain('environment.startedAt must be a valid ISO 8601 timestamp');
  });

  it('flags a non-string seed', () => {
    const report = validReport() as unknown as Record<string, unknown>;
    (report.environment as Record<string, unknown>).seed = 42;
    expect(hasIssue(report, 'environment.seed')).toBe(true);
  });
});

/* ------------------------------------------------------------------------ */
/* persistedState — repro evidence                                           */
/* ------------------------------------------------------------------------ */

describe('validation — persistedState', () => {
  it('requires persistedState to be an object', () => {
    const report = validReport() as unknown as Record<string, unknown>;
    report.persistedState = 'nope';
    expect(issuesFor(report)).toContain('persistedState must be an object');
  });

  it('requires at least one repro-evidence field (dbPath/storagePath/summary)', () => {
    const report = validReport();
    report.persistedState = { outbox: [] };
    expect(issuesFor(report)).toContain(
      'persistedState must carry at least one of dbPath, storagePath, or a summary (repro evidence)',
    );
  });

  it('flags outbox present but not an array', () => {
    const report = validReport();
    report.persistedState = { summary: 's', outbox: 'nope' as never };
    expect(issuesFor(report)).toContain('persistedState.outbox must be an array when present');
  });
});

/* ------------------------------------------------------------------------ */
/* trace — repro evidence                                                    */
/* ------------------------------------------------------------------------ */

describe('validation — trace', () => {
  it('requires trace to be an object', () => {
    const report = validReport() as unknown as Record<string, unknown>;
    report.trace = [];
    expect(issuesFor(report)).toContain('trace must be an object');
  });

  it('requires at least one repro-evidence artifact', () => {
    const report = validReport();
    report.trace = {};
    expect(issuesFor(report)).toContain(
      'trace must carry at least one repro-evidence artifact (trace/video/console/HAR/narrative path or a screenshot)',
    );
  });

  it('accepts a trace with only screenshots', () => {
    const report = validReport();
    report.trace = { screenshots: ['screenshots/01.png'] };
    expect(validateAnomalyReport(report)).toEqual([]);
  });

  it('flags trace artifact paths that are empty strings', () => {
    const report = validReport();
    report.trace = { tracePath: '   ', consoleLogPath: '' };
    const messages = issuesFor(report);
    expect(messages).toContain('trace.tracePath must be a non-empty string when present');
    expect(messages).toContain('trace.consoleLogPath must be a non-empty string when present');
  });

  it('flags screenshots containing non-string entries', () => {
    const report = validReport();
    report.trace = { screenshots: ['ok', 7] as never };
    expect(issuesFor(report)).toContain('screenshot paths must be non-empty strings');
  });
});

/* ------------------------------------------------------------------------ */
/* triage                                                                    */
/* ------------------------------------------------------------------------ */

describe('validation — triage', () => {
  it('requires triage to be an object when present', () => {
    const report = validReport() as unknown as Record<string, unknown>;
    report.triage = 'x';
    expect(issuesFor(report)).toContain('triage must be an object when present');
  });

  it('rejects an unknown triage outcome', () => {
    const report = validReport();
    report.triage = {
      outcome: 'ignore' as never,
      reference: 'CG-1',
      decidedAt: '2026-08-05T09:00:00.000Z',
    };
    expect(issuesFor(report)).toContain(
      `unknown triage outcome: ignore; known: ${ANOMALY_TRIAGE_OUTCOMES.join(', ')}`,
    );
  });

  it('flags a triage missing reference and an invalid decidedAt', () => {
    const report = validReport();
    report.triage = {
      outcome: 'documented-non-issue',
      reference: '',
      decidedAt: 'soon',
    };
    const messages = issuesFor(report);
    expect(messages).toContain('triage.reference must be a non-empty string');
    expect(messages).toContain('triage.decidedAt must be a valid ISO 8601 timestamp');
  });

  it('accepts each valid triage outcome', () => {
    for (const outcome of ANOMALY_TRIAGE_OUTCOMES) {
      const report = validReport();
      report.triage = { outcome, reference: 'x', decidedAt: '2026-08-05T09:00:00.000Z' };
      expect(validateAnomalyReport(report)).toEqual([]);
    }
  });
});

/* ------------------------------------------------------------------------ */
/* parseAnomalyReport                                                        */
/* ------------------------------------------------------------------------ */

describe('parseAnomalyReport', () => {
  it('returns ok with a typed report for a valid payload', () => {
    const result = parseAnomalyReport(validReport());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.report.missionId).toBe('error-prone-user-todos-calories');
      expect(result.report.anomalyType).toBe('data-inconsistency');
    }
  });

  it('returns the issues for an invalid payload', () => {
    const result = parseAnomalyReport({ schemaVersion: 1 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.length).toBeGreaterThan(0);
    }
  });

  it('round-trips a JSON payload through JSON.parse', () => {
    const raw = JSON.stringify(validReport());
    const parsed: unknown = JSON.parse(raw);
    expect(parseAnomalyReport(parsed).ok).toBe(true);
  });
});
