#!/usr/bin/env node
/**
 * Repro bundle CLI (`add-user-simulation-platform` tasks 5.2 / 5.3).
 *
 * Usage:
 *   sim:repro:capture  node cli.js capture [--scenario <filter>] [--mode <m>]
 *                                        [--seed <s>] [--base-url <url>]
 *   sim:repro:replay   node cli.js replay <bundle-dir> [--build <dir>]
 *                                        [--base-url <url>]
 *
 * - `capture`: runs scenario(s) through the shared runner and captures a repro
 *   bundle on failure (via the runner's task-5.2 `onFailure` hook). The bundle
 *   lands in `<simulation-output>/bundles/<runId>/`.
 *   For a manual (non-scenario) session, drive `captureBundle()` directly from
 *   a Playwright script — the runner-driven path is the default here.
 * - `replay`: restores a bundle's db + storage into a fresh context, re-executes
 *   `actions.jsonl`, and prints the step-level divergence report.
 *   `--build <dir>` is a provenance hint for the export the replay targets
 *   (validated for existence; the build must already be served).
 *
 * Exit codes: 0 success; 1 run/replay failures or validation issues; 2 usage.
 */

/* eslint-disable no-console -- this is a CLI entry point; stdout is its output */

import { chromium } from '@playwright/test';
import type { RunMode } from '../model/types';
import { validateSimulationModel } from '../model/validate';
import { loadSimulationModel } from '../runner/library';
import { executeScenario } from '../runner/execute';
import { captureBundle } from './bundle';
import { replayBundle, renderDivergenceReport } from './replay';

/* ------------------------------------------------------------------ */
/* Minimal arg parser                                                  */
/* ------------------------------------------------------------------ */

interface CliOptions {
  command: 'capture' | 'replay';
  scenarioFilter?: string;
  mode?: RunMode;
  seed?: string;
  baseUrl?: string;
  bundleDir?: string;
  buildDir?: string;
  help: boolean;
}

function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = { command: 'capture', help: false };
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
      case '--build': {
        const value = argv[++i];
        if (!value) throw new Error('--build requires a value');
        opts.buildDir = value;
        break;
      }
      case '--help':
      case '-h':
        opts.help = true;
        break;
      default:
        positional.push(arg);
    }
  }
  if (positional[0] === 'replay') {
    opts.command = 'replay';
    opts.bundleDir = positional[1] ?? opts.bundleDir;
  }
  return opts;
}

const USAGE = `superhabits repro bundle tool

usage:
  sim:repro:capture [--scenario <filter>] [--mode <m>] [--seed <s>] [--base-url <url>]
  sim:repro:replay  <bundle-dir> [--build <dir>] [--base-url <url>]
  sim:repro:capture --help

flags:
  (capture) --scenario <filter>  filter library scenarios by id substring or tag
  (capture) --mode <m>           deterministic | seeded (default: scenario mode)
  (capture) --seed <s>           explicit seed (recorded in bundle.json)
  (replay)  --build <dir>        export directory the replay targets (provenance hint;
                                 the build must already be served at the base URL)
  --base-url <url>               served app origin (default http://localhost:8081)
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

/* ------------------------------------------------------------------ */
/* Commands                                                            */
/* ------------------------------------------------------------------ */

async function cmdCapture(opts: CliOptions): Promise<void> {
  const model = loadSimulationModel();
  const issues = validateSimulationModel(model);
  if (issues.length > 0) {
    console.error(`simulation model validation FAILED (${issues.length} issue(s)):`);
    for (const issue of issues) {
      console.error(`  ✗ ${issue.path}: ${issue.message}`);
    }
    process.exitCode = 1;
    return;
  }
  let scenarios = model.scenarios;
  if (opts.scenarioFilter) {
    scenarios = model.scenarios.filter(
      (s) =>
        s.id.includes(opts.scenarioFilter!) ||
        s.tags?.some((t) => t.includes(opts.scenarioFilter!)),
    );
    if (scenarios.length === 0) {
      fail(
        `no scenario matches --scenario '${opts.scenarioFilter}' (library has: ${model.scenarios.map((s) => s.id).join(', ')})`,
      );
    }
  }
  console.log(
    `running ${scenarios.length} scenario(s) for bundle capture, mode=${opts.mode ?? 'scenario-default'}...`,
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
        console.error(`   ⬢ repro bundle captured: ${captured.bundleDir}`);
        console.error(
          `     bundle.json: ${captured.metadata.commit ? `commit ${captured.metadata.commit}` : 'commit unknown'}`,
        );
      },
    });
    const verdict = result.report.outcome === 'passed' ? 'PASS' : 'FAIL';
    console.log(`   ${verdict}: ${result.report.artifacts.report}`);
    if (result.report.outcome !== 'passed') {
      failures += 1;
      console.error(
        `   ✗ failed at step #${result.report.failure?.stepIndex} (${result.report.failure?.stepKind})`,
      );
      console.error(`     ${result.report.failure?.error}`);
    }
  }
  if (failures > 0) {
    console.error(`\n${failures} scenario(s) FAILED — bundle(s) captured for each.`);
    process.exitCode = 1;
  } else {
    console.log(`\nall ${scenarios.length} scenario(s) passed — no bundle captured.`);
  }
}

async function cmdReplay(opts: CliOptions): Promise<void> {
  if (!opts.bundleDir) {
    fail('replay requires a bundle directory: sim:repro:replay <bundle-dir>', 2);
  }
  console.log(`replaying bundle '${opts.bundleDir}'...`);
  const result = await replayBundle({
    bundleDir: opts.bundleDir,
    buildDir: opts.buildDir,
    baseUrl: opts.baseUrl,
    browser: await chromium.launch(),
    onStep: (info) =>
      console.log(`   [${String(info.index + 1).padStart(2, '0')}] ${info.kind} → ${info.status}`),
  });
  console.log(renderDivergenceReport(result));
  const failedSteps = result.divergences.filter((d) => d.note !== 'same').length;
  if (failedSteps > 0) {
    console.log(
      `\n${failedSteps} diverging/reproduced step(s). (A reproduced failure is the expected outcome for a same-build replay.)`,
    );
  }
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
    if (opts.command === 'replay') {
      await cmdReplay(opts);
    } else {
      await cmdCapture(opts);
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
