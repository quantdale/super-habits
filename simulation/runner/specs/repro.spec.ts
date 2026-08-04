/**
 * Repro bundle self-test (`add-user-simulation-platform` task 5.5).
 *
 * Proves the spec's two replay scenarios against the served `dist/` build:
 *
 *   1. **Same-build replay** — capture a deliberately failing scenario, replay
 *      the bundle against the same build → the SAME failure reproduces at the
 *      SAME step (`sameFailure: true`).
 *   2. **Corrected expectation** — edit the bundle's `actions.jsonl` oracle to
 *      the correct value and replay → the step now passes and the divergence is
 *      reported (`sameFailure: false`, step `diverged`).
 *
 * The "corrected build" is simulated by editing the replayed expectation rather
 * than rebuilding the export (rebuilding `dist/` is not economical here); the
 * divergence report is what proves the fix path. This is documented honestly in
 * `simulation/repro/README.md`.
 *
 * The failing scenario is deliberately **verification-only**: the failing step
 * is an `expectOracle` that reads a fixture row count that does not match its
 * (wrong) expectation. Because the failing step never mutates the DB, replaying
 * the full action log from the captured state reproduces the failure exactly
 * (see the replay fidelity note in `simulation/repro/replay.ts`).
 */

import { test, expect } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { defineModel, definePersona, defineScenario } from '../../model/builders';
import { executeScenario } from '../execute';
import type { SemanticStep } from '../../model/types';
import { captureBundle, parseActionsJsonl, serializeActionsJsonl } from '../../repro/bundle';
import { loadBundle, replayBundle } from '../../repro/replay';

const reproPersona = definePersona({
  id: 'repro-driver',
  name: 'Repro Driver',
  description: 'Self-test persona for the repro bundle layer.',
  goals: ['reproduce a bug'],
});

/** A scenario that fails at a verification-only step (wrong expectation). */
const failingScenario = defineScenario({
  id: 'repro-fixture-fail',
  personaId: 'repro-driver',
  goal: 'deliberately fail at a row-count oracle',
  fixture: 'SMALL',
  mode: 'deterministic',
  steps: [
    { kind: 'switchSection', tab: 'todos' },
    {
      kind: 'expectOracle',
      oracle: {
        kind: 'rows',
        sql: 'SELECT COUNT(*) AS n FROM todos WHERE deleted_at IS NULL',
        // SMALL seeds 2 todos, 1 soft-deleted → n = 1. Expecting 99 fails.
        expected: [{ n: 99 }],
      },
    },
  ],
});

const selfTestModel = defineModel({
  personas: [reproPersona],
  scenarios: [failingScenario],
});

test('5.5 repro bundle: same-build replay reproduces, corrected expectation diverges', async ({
  browser,
}) => {
  test.setTimeout(360_000);

  // --- 1. Capture a deliberately failing scenario. ---
  let bundleDir: string | undefined;
  const run = await executeScenario({
    scenario: failingScenario,
    model: selfTestModel,
    mode: 'deterministic',
    browser,
    onFailure: async (ctx) => {
      const captured = await captureBundle({
        page: ctx.page,
        context: ctx.context,
        report: ctx.report,
        runId: ctx.runId,
        steps: ctx.steps,
        consoleLines: ctx.consoleLines,
        networkEvents: ctx.networkEvents,
      });
      bundleDir = captured.bundleDir;
    },
  });
  expect(run.report.outcome).toBe('failed');
  expect(run.report.failure?.stepIndex).toBe(1);
  expect(bundleDir).toBeTruthy();
  for (const f of [
    'bundle.json',
    'report.json',
    'db.sqlite.json',
    'storage.json',
    'actions.jsonl',
    'console.log',
    'network.har',
    'narrative.md',
    'trace.zip',
  ]) {
    expect(fs.existsSync(path.join(bundleDir!, f)), `missing bundle file ${f}`).toBe(true);
  }
  const capturedMeta = JSON.parse(
    fs.readFileSync(path.join(bundleDir!, 'bundle.json'), 'utf8'),
  ) as { commit: string | null; scenario: { id: string } | null; stepCount: number };
  expect(capturedMeta.scenario?.id).toBe('repro-fixture-fail');
  expect(capturedMeta.stepCount).toBe(2);

  // --- 2. Replay against the same build → same failure at the same step. ---
  const same = await replayBundle({ bundleDir: bundleDir!, browser });
  expect(same.sameFailure).toBe(true);
  expect(same.replayedReport.failure?.stepIndex).toBe(1);
  expect(same.replayedReport.failure?.stepKind).toBe('expectOracle');

  // --- 3. Correct the expectation in actions.jsonl → replay → divergence. ---
  const loaded = loadBundle(bundleDir!);
  const corrected = loaded.actions.map((s) => {
    if (s.kind === 'expectOracle') {
      return { ...s, oracle: { ...s.oracle, expected: [{ n: 1 }] } } as SemanticStep;
    }
    return s;
  });
  fs.writeFileSync(path.join(bundleDir!, 'actions.jsonl'), serializeActionsJsonl(corrected));

  // Sanity: the corrected actions.jsonl parses back to the corrected expectation.
  const reparsed = parseActionsJsonl(
    fs.readFileSync(path.join(bundleDir!, 'actions.jsonl'), 'utf8'),
  );
  expect(reparsed[1].kind).toBe('expectOracle');

  const fixedReplay = await replayBundle({ bundleDir: bundleDir!, browser });
  expect(fixedReplay.sameFailure).toBe(false);
  expect(fixedReplay.replayedReport.outcome).toBe('passed');
  const diverged = fixedReplay.divergences.find((d) => d.index === 1);
  expect(diverged?.note).toBe('diverged');
  expect(diverged?.originalStatus).toBe('failed');
  expect(diverged?.replayedStatus).toBe('passed');
});
