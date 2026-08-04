/**
 * Runner self-test specs (`add-user-simulation-platform` task 3.4).
 *
 * These are the runner's own integration specs, run under the `simulation`
 * Playwright project (see `playwright.config.ts`). They drive the full
 * scenario executor (`executeScenario`) against the served `dist/` export via
 * the injected `browser` fixture — the runner still creates its own single
 * context per run (workers: 1, OPFS semantics).
 *
 *   - 3.5: the smoke scenario runs twice in `deterministic` mode and MUST
 *     produce identical action logs (spec: "Deterministic mode is
 *     reproducible").
 *   - 4.4: scenario, seeded, and repro lanes all emit reports that pass the
 *     run-report validator (one schema across lanes).
 *
 * NOTE: this spec reproduces the CLI `sim:run --self-test` verification under
 * Playwright so CI gets it as a test; the CLI path is what `npm run sim:run`
 * exercises. Both are intentionally kept minimal (the smoke waits 0ms think
 * time outside its single 50ms `waitThinkTime`).
 */

import { test, expect } from '@playwright/test';
import { executeScenario } from '../execute';
import { selfTestModel } from '../selfTest';
import { validateRunReport } from '../../observe/report';

const smoke = selfTestModel.scenarios.find((s) => s.id === 'smoke');
if (!smoke) {
  throw new Error('self-test model is missing the smoke scenario');
}

test('3.5 deterministic mode is reproducible — identical action logs', async ({ browser }) => {
  test.setTimeout(360_000);
  const r1 = await executeScenario({
    scenario: smoke,
    model: selfTestModel,
    mode: 'deterministic',
    browser,
  });
  expect(r1.report.outcome).toBe('passed');
  const r2 = await executeScenario({
    scenario: smoke,
    model: selfTestModel,
    mode: 'deterministic',
    browser,
  });
  expect(r2.report.outcome).toBe('passed');
  expect(r2.actionLog).toEqual(r1.actionLog);
  expect(validateRunReport(r1.report)).toEqual([]);
  expect(validateRunReport(r2.report)).toEqual([]);
});

test('4.4 one run-report schema across lanes (scenario / seeded / repro)', async ({ browser }) => {
  test.setTimeout(360_000);
  const scenario = await executeScenario({
    scenario: smoke,
    model: selfTestModel,
    mode: 'deterministic',
    browser,
  });
  const seeded = await executeScenario({
    scenario: smoke,
    model: selfTestModel,
    mode: 'seeded',
    seed: '0x5e1f7e57',
    lane: 'seeded',
    browser,
  });
  const repro = await executeScenario({
    scenario: smoke,
    model: selfTestModel,
    mode: 'deterministic',
    seed: '0x5e1f7e57',
    lane: 'repro',
    browser,
  });
  for (const r of [scenario, seeded, repro]) {
    expect(r.report.outcome).toBe('passed');
    expect(validateRunReport(r.report)).toEqual([]);
  }
  expect(seeded.report.lane).toBe('seeded');
  expect(repro.report.lane).toBe('repro');
});
