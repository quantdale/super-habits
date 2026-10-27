/**
 * AUD-SH18-A / AUD-SH18-B: simulation oracle integrity.
 *
 * Audited defect (SH-18): an oracle with no `expected` was reported as
 * `passed` — an attached outbox oracle with a nonempty expectation and an empty
 * query result passed with 0 records, and a standalone outbox oracle swallowed a
 * failed SQLite read and still returned `expectOracle outbox`. A scenario could
 * therefore claim "offline writes enqueued" while asserting nothing.
 *
 * These tests discriminate the fixed contract at the model boundary, at the
 * runner's oracle evaluator/dispatch boundary, and at the placeholder binding
 * that lets a scenario assert on an id it actually produced. The browser-driven
 * end-to-end proof lives in `simulation/runner/specs/oracleIntegrity.spec.ts`
 * (Playwright, real page) and in the deterministic scenario lane.
 */

import { describe, expect, it } from 'vitest';
import { defineModel, definePersona, defineScenario } from '../simulation/model/builders';
import { isAssertingOracle, KNOWN_ORACLE_KINDS } from '../simulation/model/steps';
import type { Oracle, SemanticStep, SimulationModel } from '../simulation/model/types';
import { validateSimulationModel } from '../simulation/model/validate';
import {
  markAssertionOutcome,
  oraclePasses,
  selectAttachedOracles,
  standaloneOracleLabel,
} from '../simulation/runner/oracleContract';
import { unresolvedCapturePlaceholders } from '../simulation/runner/execute';

const persona = definePersona({
  id: 'p1',
  name: 'P',
  description: 'd',
  goals: ['g'],
});

function modelWith(steps: SemanticStep[]): SimulationModel {
  const scenario = defineScenario({
    id: 's',
    personaId: 'p1',
    goal: 'g',
    steps,
  });
  return defineModel({ personas: [persona], scenarios: [scenario] });
}

const issuesFor = (steps: SemanticStep[]): string[] =>
  validateSimulationModel(modelWith(steps)).map((issue) => issue.message);

describe('AUD-SH18-A: rows oracle without expected is rejected', () => {
  it('flags an unspecified rows oracle as a validation issue', () => {
    // The audited shape still type-checks at runtime (scenario files are data),
    // so the guard must live in validation, not only in the type.
    const malformed = {
      kind: 'rows',
      sql: 'SELECT COUNT(*) AS n FROM sync_outbox',
    } as unknown as Oracle;
    const issues = issuesFor([
      { kind: 'createTodo', title: 'x', oracles: [malformed] },
    ] as SemanticStep[]);
    expect(issues.join('\n')).toMatch(/rows oracle requires an `expected` array/);
  });

  it('accepts the same oracle once it carries an expectation', () => {
    const issues = issuesFor([
      {
        kind: 'createTodo',
        title: 'x',
        oracles: [
          {
            kind: 'rows',
            sql: 'SELECT COUNT(*) AS n FROM sync_outbox',
            expected: [{ n: 1 }],
          },
        ],
      },
    ]);
    expect(issues.join('\n')).not.toMatch(/rows oracle requires an `expected` array/);
  });
});

describe('AUD-SH18-A: outbox oracle without expected is rejected', () => {
  it('flags an unspecified outbox oracle', () => {
    const malformed = { kind: 'outbox' } as unknown as Oracle;
    const issues = issuesFor([
      { kind: 'createTodo', title: 'x', oracles: [malformed] },
    ] as SemanticStep[]);
    expect(issues.join('\n')).toMatch(/outbox oracle requires an `expected` array/);
  });

  it('flags an unspecified outbox oracle on a standalone expectOracle step', () => {
    const malformed = { kind: 'outbox' } as unknown as Oracle;
    const issues = issuesFor([
      { kind: 'expectOracle', oracle: malformed } as unknown as SemanticStep,
    ]);
    expect(issues.join('\n')).toMatch(/outbox oracle requires an `expected` array/);
  });
});

describe('AUD-SH18-B: diagnostic reads never certify a mutation', () => {
  it('is not an asserting oracle kind', () => {
    expect(KNOWN_ORACLE_KINDS).toContain('diagnostic');
    expect(isAssertingOracle({ kind: 'diagnostic' })).toBe(false);
    expect(isAssertingOracle({ kind: 'rows' })).toBe(true);
    expect(isAssertingOracle({ kind: 'outbox' })).toBe(true);
    expect(isAssertingOracle({ kind: 'unchanged' })).toBe(true);
    expect(isAssertingOracle({ kind: 'across-surfaces' })).toBe(true);
  });

  it('rejects a mutating step whose only oracle is a diagnostic read', () => {
    const issues = issuesFor([
      {
        kind: 'createTodo',
        title: 'x',
        oracles: [{ kind: 'diagnostic', sql: 'SELECT COUNT(*) AS n FROM todos' }],
      },
    ]);
    expect(issues.join('\n')).toMatch(/declares no asserting oracle/);
  });

  it('accepts a diagnostic read alongside a real assertion', () => {
    const issues = issuesFor([
      {
        kind: 'createTodo',
        title: 'x',
        oracles: [
          {
            kind: 'rows',
            sql: "SELECT title FROM todos WHERE title = 'x'",
            expected: [{ title: 'x' }],
          },
          { kind: 'diagnostic', sql: 'SELECT COUNT(*) AS n FROM todos' },
        ],
      },
    ]);
    expect(issues.join('\n')).not.toMatch(/declares no asserting oracle/);
  });
});

describe('AUD-SH18-A: attached oracle outcomes propagate to the step', () => {
  it('treats an empty result against a nonempty expectation as a failure', () => {
    // This is the exact audited false pass: expected outbox rows, query
    // returned []. The evaluator contract must mark it failed.
    const evaluated = markAssertionOutcome(
      { kind: 'outbox', expected: [{ entity: 'todos', operation: 'create' }] },
      [],
    );
    expect(evaluated.result).toBe('failed');
    expect(evaluated.detail).toMatch(/0 row/);
  });

  it('passes when every expectation is claimed', () => {
    const evaluated = markAssertionOutcome(
      { kind: 'outbox', expected: [{ entity: 'todos', operation: 'create' }] },
      [{ entity: 'todos', id: 'todo_1', updatedAt: 'now', operation: 'create' }],
    );
    expect(evaluated.result).toBe('passed');
  });

  it('fails when the outbox holds an unclaimed extra record', () => {
    const evaluated = markAssertionOutcome(
      { kind: 'outbox', expected: [{ entity: 'todos', operation: 'create' }] },
      [
        { entity: 'todos', id: 'todo_1', updatedAt: 'now', operation: 'create' },
        { entity: 'habits', id: 'habit_1', updatedAt: 'now', operation: 'create' },
      ],
    );
    expect(evaluated.result).toBe('failed');
    expect(evaluated.detail).toMatch(/unclaimed/);
  });

  it('fails when a query throws instead of swallowing it', () => {
    const evaluated = markAssertionOutcome(
      { kind: 'diagnostic', sql: 'SELECT * FROM missing_table' },
      new Error('no such table: missing_table'),
    );
    expect(evaluated.result).toBe('failed');
    expect(evaluated.detail).toMatch(/missing_table/);
  });

  it('reports a scenario failure when any attached oracle fails', () => {
    const passed = markAssertionOutcome(
      { kind: 'rows', sql: 'SELECT 1 AS n', expected: [{ n: 1 }] },
      [{ n: 1 }],
    );
    const failed = markAssertionOutcome(
      { kind: 'rows', sql: 'SELECT 1 AS n', expected: [{ n: 2 }] },
      [{ n: 1 }],
    );
    expect(oraclePasses([passed, failed])).toBe(false);
    expect(oraclePasses([passed])).toBe(true);
    expect(oraclePasses([])).toBe(true);
  });

  it('keeps a diagnostic read out of the correctness verdict', () => {
    const diagnostic = markAssertionOutcome(
      { kind: 'diagnostic', sql: 'SELECT COUNT(*) AS n FROM todos' },
      [{ n: 7 }],
    );
    expect(diagnostic.result).toBe('skipped');
    expect(oraclePasses([diagnostic])).toBe(true);
  });
});

describe('AUD-SH18-B: standalone oracle dispatch labels', () => {
  it('labels a standalone outbox assertion as an assertion', () => {
    expect(standaloneOracleLabel({ kind: 'outbox', expected: [] })).toBe('expectOracle outbox');
  });

  it('labels a standalone diagnostic read as non-asserting', () => {
    expect(standaloneOracleLabel({ kind: 'diagnostic', sql: 'SELECT 1' })).toMatch(
      /diagnostic.*not an assertion/,
    );
  });
});

describe('AUD-SH18-B: attached vs standalone oracle selection', () => {
  it('collects every attached oracle, including diagnostics', () => {
    const step = {
      kind: 'createTodo',
      title: 'x',
      oracles: [
        { kind: 'rows', sql: 'SELECT 1 AS n', expected: [{ n: 1 }] },
        { kind: 'diagnostic', sql: 'SELECT 2 AS n' },
      ],
    } as SemanticStep;
    expect(selectAttachedOracles(step)).toHaveLength(2);
  });
});

describe('AUD-SH18-B: captured ids bind into later assertions', () => {
  it('resolves {{capture.name.key}} placeholders and reports unresolved ones', () => {
    const bound: SemanticStep = {
      kind: 'expectOracle',
      oracle: {
        kind: 'outbox',
        expected: [{ entity: 'todos', id: 'todo_123', operation: 'create' }],
      },
    };
    expect(unresolvedCapturePlaceholders(bound)).toEqual([]);

    const unbound: SemanticStep = {
      kind: 'expectOracle',
      oracle: {
        kind: 'outbox',
        expected: [{ entity: 'todos', id: '{{capture.todo.id}}', operation: 'create' }],
      },
    };
    expect(unresolvedCapturePlaceholders(unbound)).toEqual(['{{capture.todo.id}}']);
  });
});
