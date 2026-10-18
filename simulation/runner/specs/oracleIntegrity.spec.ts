/**
 * AUD-SH18-A / AUD-SH18-B — oracle integrity through the REAL runner.
 *
 * The audited defect was a false pass: an attached oracle whose expectation was
 * nonempty returned `passed` with 0 rows, and a standalone outbox oracle
 * swallowed a failed read and still reported success. `tests/simulation.oracleIntegrity.test.ts`
 * pins the pure contract; this spec proves the same rules hold when the runner
 * drives a live page, so the fix cannot be a unit-test-only illusion.
 *
 * Each case runs the full executor against the served `dist/` export with a
 * deliberately unsatisfiable expectation and asserts the RUN outcome (not just
 * an evaluator return value) is `failed`.
 */

import { test, expect } from '@playwright/test';
import { executeScenario } from '../execute';
import { defineModel, definePersona, defineScenario } from '../../model/builders';
import { formatRunFailureDiagnostics } from '../../observe/report';
import type { Scenario, SemanticStep } from '../../model/types';

const persona = definePersona({
  id: 'oracle-integrity',
  name: 'Oracle Integrity Probe',
  description: 'Deterministic probe for oracle assertion semantics.',
  goals: ['prove a false oracle cannot pass'],
});

function run(steps: SemanticStep[]): Scenario {
  return defineScenario({
    id: 'oracle-integrity',
    personaId: 'oracle-integrity',
    goal: 'an oracle that cannot be satisfied must fail the scenario',
    fixture: 'SMALL',
    mode: 'deterministic',
    steps,
  });
}

const model = (scenario: Scenario) => defineModel({ personas: [persona], scenarios: [scenario] });

test('AUD-SH18-A: a nonempty outbox expectation against an empty outbox fails the run', async ({
  browser,
}) => {
  test.setTimeout(120_000);
  // A freshly seeded fixture writes rows directly (not through the outbox), so
  // the outbox is empty and this expectation cannot be met. Before the fix the
  // evaluator returned `passed` with "0 record(s)".
  const scenario = run([
    {
      kind: 'expectOracle',
      note: 'unmet: no outbox records exist for a fixture-seeded database',
      oracle: {
        kind: 'outbox',
        expected: [{ entity: 'todos', operation: 'create' }],
      },
    },
  ]);
  const result = await executeScenario({
    scenario,
    model: model(scenario),
    mode: 'deterministic',
    browser,
  });
  expect(
    result.report.outcome,
    `expected a failure; report:\n${formatRunFailureDiagnostics(result.report)}`,
  ).toBe('failed');
});

test('AUD-SH18-A: a rows expectation that does not match fails the run', async ({ browser }) => {
  test.setTimeout(120_000);
  const scenario = run([
    {
      kind: 'expectOracle',
      oracle: {
        kind: 'rows',
        sql: 'SELECT COUNT(*) AS n FROM todos WHERE deleted_at IS NULL',
        // SMALL seeds a non-zero visible todo count; 999 can never match.
        expected: [{ n: 999 }],
      },
    },
  ]);
  const result = await executeScenario({
    scenario,
    model: model(scenario),
    mode: 'deterministic',
    browser,
  });
  expect(
    result.report.outcome,
    `expected a failure; report:\n${formatRunFailureDiagnostics(result.report)}`,
  ).toBe('failed');
});

test('AUD-SH18-B: a standalone oracle whose query fails fails the run (no swallowed read)', async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const scenario = run([
    {
      kind: 'expectOracle',
      note: 'a missing table must surface, not vanish',
      oracle: { kind: 'diagnostic', sql: 'SELECT 1 AS n FROM sh18_missing_table' },
    },
  ]);
  const result = await executeScenario({
    scenario,
    model: model(scenario),
    mode: 'deterministic',
    browser,
  });
  expect(
    result.report.outcome,
    `expected a failure; report:\n${formatRunFailureDiagnostics(result.report)}`,
  ).toBe('failed');
  expect(JSON.stringify(result.report.failure ?? {})).toMatch(/sh18_missing_table/);
});

test('AUD-SH18-B: a captured id binds into a later outbox assertion', async ({ browser }) => {
  test.setTimeout(180_000);
  // The leg publishes the id it really created; the oracle then pins that exact
  // identity, so the assertion is meaningful instead of a row count.
  const scenario = run([
    {
      kind: 'apiLeg',
      functionName: 'createTodo',
      args: { title: 'Captured identity todo' },
      captures: 'todo',
      oracles: [
        {
          kind: 'rows',
          sql: "SELECT COUNT(*) AS n FROM todos WHERE title = 'Captured identity todo' AND deleted_at IS NULL",
          expected: [{ n: 1 }],
        },
      ],
    },
    {
      kind: 'expectOracle',
      note: 'the outbox holds exactly the captured todo id as a pending create',
      oracle: {
        kind: 'outbox',
        expected: [{ entity: 'todos', id: '{{capture.todo.id}}', operation: 'create' }],
      },
    },
  ]);
  const result = await executeScenario({
    scenario,
    model: model(scenario),
    mode: 'deterministic',
    browser,
  });
  expect(
    result.report.outcome,
    `expected a pass; report:\n${formatRunFailureDiagnostics(result.report)}`,
  ).toBe('passed');
});

test('AUD-SH18-B: an unresolved capture placeholder is a runner error, not a silent literal', async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const scenario = run([
    {
      kind: 'expectOracle',
      oracle: {
        kind: 'outbox',
        expected: [{ entity: 'todos', id: '{{capture.neverPublished.id}}' }],
      },
    },
  ]);
  const result = await executeScenario({
    scenario,
    model: model(scenario),
    mode: 'deterministic',
    browser,
  });
  expect(result.report.outcome).toBe('failed');
  expect(JSON.stringify(result.report.failure ?? {})).toMatch(/unresolved capture placeholder/);
});
