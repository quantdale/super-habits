#!/usr/bin/env node
/**
 * Simulation runner CLI (`add-user-simulation-platform` task 3.3).
 *
 * Usage:
 *   sim:run       node cli.js run      [--scenario <filter>] [--mode <m>] [--seed <s>] [--base-url <u>]
 *   sim:validate  node cli.js validate [--scenario <filter>]
 *   sim:run --self-test / node cli.js self-test [--base-url <u>]
 *
 * - `run`: executes every matching scenario in the library through
 *   `executeScenario` against the served `dist/` export (default
 *   http://localhost:8081, the same origin the Playwright webServer serves).
 *   `--mode` / `--seed` override the scenario's run configuration.
 * - `validate`: model validation only (plus the apiLeg raw-SQL guard
 *   pre-check); exits non-zero on ANY issue without touching a browser.
 * - `self-test`: task 3.5 + 4.4 verification — runs the smoke scenario twice
 *   in deterministic mode and asserts identical action logs, then emits
 *   seeded and repro-lane reports and validates all of them.
 *
 * Exit codes: 0 success; 1 validation/run failures; 2 usage errors.
 */

/* eslint-disable no-console -- this is a CLI entry point; stdout is its output */

import type { RunMode, Scenario, SimulationModel } from '../model/types';
import { validateSimulationModel } from '../model/validate';
import { validateRunReport } from '../observe/report';
import { validateMatrix } from '../matrix';
import { assertApiLegSafe } from './apiLeg';
import { executeScenario, expandScenarioSteps } from './execute';
import { loadSimulationModel } from './library';
import { selfTestModel } from './selfTest';

/* ------------------------------------------------------------------ */
/* Minimal arg parser                                                  */
/* ------------------------------------------------------------------ */

interface CliOptions {
  command: 'run' | 'validate' | 'self-test';
  scenarioFilter?: string;
  mode?: RunMode;
  seed?: string;
  baseUrl?: string;
  help: boolean;
}

function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = { command: 'run', help: false };
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '--scenario': {
        const value = argv[++i];
        if (!value) throw new Error('--scenario requires a value');
        opts.scenarioFilter = value;
        break;
      }
      case '--mode': {
        const value = argv[++i];
        if (!value || !['deterministic', 'seeded', 'exploratory'].includes(value)) {
          throw new Error('--mode must be one of: deterministic | seeded | exploratory');
        }
        opts.mode = value as RunMode;
        break;
      }
      case '--seed': {
        const value = argv[++i];
        if (!value) throw new Error('--seed requires a value');
        opts.seed = value;
        break;
      }
      case '--base-url': {
        const value = argv[++i];
        if (!value) throw new Error('--base-url requires a value');
        opts.baseUrl = value;
        break;
      }
      case '--self-test':
        // The npm script (`sim:run`) injects the `run` positional; `--self-test`
        // must win over it so `npm run sim:run -- --self-test` runs the matrix.
        opts.command = 'self-test';
        break;
      case '--help':
      case '-h':
        opts.help = true;
        break;
      default:
        positional.push(arg);
    }
  }
  if (opts.command === 'self-test') {
    return opts;
  }
  if (positional[0] === 'validate' || positional[0] === 'run' || positional[0] === 'self-test') {
    opts.command = positional[0];
  }
  return opts;
}

const USAGE = `superhabits simulation runner

usage:
  sim:run       <scenario library> [--scenario <filter>] [--mode <m>] [--seed <s>] [--base-url <url>]
  sim:validate  [--scenario <filter>]
  sim:run --self-test                (task 3.5/4.4 verification matrix)
  sim:run --help

flags:
  --scenario <filter>   filter library scenarios by id substring or tag (e.g. '@p0')
  --mode <m>            deterministic | seeded | exploratory (default: scenario mode)
  --seed <s>            explicit seed (recorded in run-report.json)
  --base-url <url>      served app origin (default http://localhost:8081)
`;

class CliError extends Error {
  exitCode: number;
  constructor(message: string, exitCode: number) {
    super(message);
    this.exitCode = exitCode;
  }
}

function fail(message: string, exitCode = 1): never {
  throw new CliError(message, exitCode);
}

function printIssues(issues: { path: string; message: string }[]): void {
  for (const issue of issues) {
    console.error(`  ✗ ${issue.path}: ${issue.message}`);
  }
}

function printModelSummary(model: SimulationModel): void {
  const personaIds = model.personas.map((p) => p.id).join(', ') || '(none)';
  const scenarioIds = model.scenarios.map((s) => s.id).join(', ') || '(none)';
  console.log(
    `simulation model: ${model.personas.length} persona(s) [${personaIds}], ` +
      `${model.workflows?.length ?? 0} workflow(s), ${model.scenarios.length} scenario(s) [${scenarioIds}]`,
  );
}

function selectScenarios(model: SimulationModel, filter?: string): Scenario[] {
  if (!filter) return model.scenarios;
  const matches = model.scenarios.filter(
    (s) => s.id.includes(filter) || s.tags?.some((t) => t.includes(filter)),
  );
  if (matches.length === 0) {
    fail(
      `no scenario matches --scenario '${filter}' (library has: ${model.scenarios.map((s) => s.id).join(', ')})`,
    );
  }
  return matches;
}

/** apiLeg raw-SQL guard pre-check across a scenario's expanded steps (task 3.2). */
function assertScenarioApiLegsSafe(model: SimulationModel, scenario: Scenario): void {
  for (const step of expandScenarioSteps(model, scenario)) {
    if (step.kind === 'apiLeg') {
      assertApiLegSafe({ functionName: step.functionName, args: step.args });
    }
  }
}

function validateModelOrExit(model: SimulationModel): boolean {
  const issues = validateSimulationModel(model);
  if (issues.length > 0) {
    console.error(`simulation model validation FAILED (${issues.length} issue(s)):`);
    printIssues(issues);
    return false;
  }
  return true;
}

/**
 * Lane-matrix validation (task 9.1). The runner consumes simulator/matrix.ts
 * so a forbidden combination (e.g. `seeded` in the PR lane, or a remote
 * backend on a PR lane) fails fast here instead of mid-run.
 */
function validateMatrixOrExit(): boolean {
  const issues = validateMatrix();
  if (issues.length > 0) {
    console.error(`simulation lane matrix validation FAILED (${issues.length} issue(s)):`);
    printIssues(issues);
    return false;
  }
  return true;
}

/* ------------------------------------------------------------------ */
/* Commands                                                            */
/* ------------------------------------------------------------------ */

function cmdValidate(opts: CliOptions): void {
  if (!validateMatrixOrExit()) {
    process.exitCode = 1;
    return;
  }
  const model = loadSimulationModel();
  printModelSummary(model);
  if (!validateModelOrExit(model)) {
    process.exitCode = 1;
    return;
  }
  const scenarios = selectScenarios(model, opts.scenarioFilter);
  for (const scenario of scenarios) {
    try {
      assertScenarioApiLegsSafe(model, scenario);
    } catch (err) {
      console.error(`apiLeg guard FAILED in scenario '${scenario.id}': ${(err as Error).message}`);
      process.exitCode = 1;
      return;
    }
  }
  console.log(
    `simulation model valid: ${scenarios.length} scenario(s) checked, apiLeg guards clean.`,
  );
}

async function cmdRun(opts: CliOptions): Promise<void> {
  if (!validateMatrixOrExit()) {
    process.exitCode = 1;
    return;
  }
  const model = loadSimulationModel();
  printModelSummary(model);
  if (!validateModelOrExit(model)) {
    process.exitCode = 1;
    return;
  }
  const scenarios = selectScenarios(model, opts.scenarioFilter);
  for (const scenario of scenarios) {
    assertScenarioApiLegsSafe(model, scenario);
  }
  console.log(
    `running ${scenarios.length} scenario(s), mode=${opts.mode ?? 'scenario-default'}...`,
  );

  let failures = 0;
  for (const scenario of scenarios) {
    console.log(`\n→ scenario '${scenario.id}' — ${scenario.goal}`);
    const result = await executeScenario({
      scenario,
      model,
      mode: opts.mode,
      seed: opts.seed,
      baseUrl: opts.baseUrl,
      onStep: (info) =>
        console.log(
          `   [${String(info.index + 1).padStart(2, '0')}] ${info.kind} → ${info.status}`,
        ),
    });
    const verdict = result.report.outcome === 'passed' ? 'PASS' : 'FAIL';
    console.log(`   ${verdict}: ${result.report.artifacts.report}`);
    if (result.digestPath) {
      console.error(`   digest: ${result.digestPath}`);
    }
    if (result.report.outcome !== 'passed') {
      failures += 1;
      console.error(
        `   ✗ failed at step #${result.report.failure?.stepIndex} (${result.report.failure?.stepKind})`,
      );
      console.error(`     ${result.report.failure?.error}`);
    }
  }
  if (failures > 0) {
    console.error(`\n${failures} scenario(s) FAILED.`);
    process.exitCode = 1;
  } else {
    console.log(`\nall ${scenarios.length} scenario(s) passed.`);
  }
}

/** Task 3.5 + 4.4: deterministic reproducibility + one schema across lanes. */
async function cmdSelfTest(opts: CliOptions): Promise<void> {
  const model = selfTestModel;
  const smoke = model.scenarios.find((s) => s.id === 'smoke');
  if (!smoke) fail('self-test model missing smoke scenario', 2);
  printModelSummary(model);

  console.log('\n[3.5] deterministic mode is reproducible — running the smoke twice');
  const r1 = await executeScenario({
    scenario: smoke,
    model,
    mode: 'deterministic',
    baseUrl: opts.baseUrl,
  });
  const r2 = await executeScenario({
    scenario: smoke,
    model,
    mode: 'deterministic',
    baseUrl: opts.baseUrl,
  });
  for (const [n, r] of [
    ['#1', r1],
    ['#2', r2],
  ] as const) {
    console.log(
      `  run ${n} (seed ${r.seed}): ${r.report.outcome === 'passed' ? 'PASS' : 'FAIL'} — ${r.report.artifacts.report}`,
    );
    if (r.report.outcome !== 'passed' && r.report.failure) {
      console.error(
        `     ✗ step #${r.report.failure.stepIndex} ${r.report.failure.stepKind}: ${r.report.failure.error}`,
      );
    }
  }
  const logsIdentical = JSON.stringify(r1.actionLog) === JSON.stringify(r2.actionLog);
  console.log(`  action logs identical: ${logsIdentical ? 'YES' : 'NO'}`);
  if (!logsIdentical) {
    console.error('  run #1 action log: ' + JSON.stringify(r1.actionLog));
    console.error('  run #2 action log: ' + JSON.stringify(r2.actionLog));
  }
  if (r1.report.outcome !== 'passed' || r2.report.outcome !== 'passed' || !logsIdentical) {
    fail('3.5 deterministic reproducibility check FAILED');
  }

  console.log('\n[4.4] one run-report schema across lanes');
  const seededSeed = '0x5e1f7e57';
  const seeded = await executeScenario({
    scenario: smoke,
    model,
    mode: 'seeded',
    seed: seededSeed,
    lane: 'seeded',
    baseUrl: opts.baseUrl,
  });
  const repro = await executeScenario({
    scenario: smoke,
    model,
    mode: 'deterministic',
    seed: seededSeed,
    lane: 'repro',
    baseUrl: opts.baseUrl,
  });
  let laneFailure = false;
  for (const [label, result] of [
    ['scenario lane (deterministic)', r1],
    ['seeded lane', seeded],
    ['repro lane', repro],
  ] as const) {
    const issues = validateRunReport(result.report);
    const valid = issues.length === 0;
    console.log(
      `  ${label}: lane=${result.report.lane} mode=${result.report.mode} outcome=${result.report.outcome} validator=${valid ? 'PASS' : 'FAIL'}`,
    );
    if (!valid) {
      printIssues(issues);
      laneFailure = true;
    }
    if (result.report.outcome !== 'passed') {
      laneFailure = true;
    }
  }
  if (laneFailure) {
    fail('4.4 lane reports did not pass');
  }
  console.log(
    '\nself-test OK: deterministic reproducible; scenario/seeded/repro reports all valid.',
  );
}

/* ------------------------------------------------------------------ */
/* Entry                                                               */
/* ------------------------------------------------------------------ */

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log(USAGE);
    return;
  }
  try {
    if (opts.command === 'validate') {
      cmdValidate(opts);
    } else if (opts.command === 'run') {
      await cmdRun(opts);
    } else {
      await cmdSelfTest(opts);
    }
  } catch (err) {
    const e = err as CliError;
    console.error(e.message);
    if (e.exitCode === 2 || !(err instanceof CliError)) {
      console.error(USAGE);
    }
    process.exitCode = e.exitCode ?? 2;
  }
}

void main();
