/**
 * Repro bundle replay (`add-user-simulation-platform` task 5.3, design D5).
 *
 * `replayBundle` restores a captured bundle's DB + storage into a FRESH browser
 * context (full reset, then the app bootstraps the real schema, then the
 * captured rows are re-inserted and the AsyncStorage keys restored), then
 * re-executes `actions.jsonl` through the runner's own step machinery
 * (`replaySteps` — same action dispatch + oracle evaluation as a live run).
 *
 * The output is a step-level DIVERGENCE report: each step's original status vs
 * the replayed status, plus a `sameFailure` flag (the original failed at step N
 * and the replay failed at the same step kind). Two replay scenarios are
 * supported (and proven by the task 5.5 self-test):
 *
 * 1. **Same build** — replay against the build the bundle was captured from:
 *    the same failure reproduces at the same step (`sameFailure: true`).
 * 2. **Changed expectation** — edit `actions.jsonl` (e.g. correct a wrong
 *    oracle) and replay: the corrected step now passes and the divergence is
 *    reported, confirming the fix without rebuilding the export.
 *
 * ## Replay fidelity note
 *
 * The bundle captures the DB state AT the failure point, and the replay
 * re-executes the FULL action log from that state. For a failure at a pure
 * verification step (`expectOracle` / `expectAcrossSurfaces`) this reproduces
 * bit-for-bit. If the failing step itself mutates the DB, re-running the log
 * re-applies earlier mutations — the divergence report surfaces this (the step
 * may fail for a different reason), and the honest fix is to capture a bundle
 * whose failing step is verification-only, or to trim `actions.jsonl` to the
 * steps that lead up to the assertion.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Browser, Page } from '@playwright/test';
import { resetAll } from '../../e2e/helpers/reset';
import { ensureAppContext, runSql, returnToApp, APP_BASE_URL } from '../../e2e/helpers/dbHarness';
import { replaySteps } from '../runner/execute';
import {
  parseRunReport,
  serializeRunReport,
  type RunReport,
  type RunStepEntry,
} from '../observe/report';
import { ensureRunOutputDir, writeRunReportJson } from '../observe/artifacts';
import type { SemanticStep } from '../model/types';
import {
  buildRestoreSql,
  parseActionsJsonl,
  parseBundleMetadata,
  parseSqliteDump,
  type BundleMetadata,
  type SqliteDump,
} from './bundle';

/** A bundle loaded from disk, ready to replay. */
export interface LoadedBundle {
  metadata: BundleMetadata;
  /** The original run report — the divergence baseline. */
  originalReport: RunReport;
  dbDump: SqliteDump;
  storage: Record<string, string>;
  /** The ordered semantic steps to re-execute (from `actions.jsonl`). */
  actions: SemanticStep[];
}

/** Per-step divergence between the original run and the replay. */
export interface StepDivergence {
  index: number;
  kind: string;
  originalStatus: RunStepEntry['status'] | 'skipped';
  replayedStatus: RunStepEntry['status'] | 'skipped';
  originalError?: string;
  replayedError?: string;
  /** `same` = both passed; `reproduced-failure` = both failed; `diverged` = otherwise. */
  note: 'same' | 'reproduced-failure' | 'diverged';
}

/** The full replay outcome. */
export interface ReplayResult {
  bundleDir: string;
  metadata: BundleMetadata;
  originalReport: RunReport;
  replayedReport: RunReport;
  divergences: StepDivergence[];
  /** True when the original failure reproduced at the same step kind. */
  sameFailure: boolean;
  /** The export directory the replay targeted (provenance hint), if given. */
  buildDir?: string;
}

export interface ReplayOptions {
  bundleDir: string;
  /**
   * Provenance hint: the export directory the replay targets. The build must
   * already be served at `baseUrl` (the replay does not re-serve); this is
   * validated for existence and recorded in the result so a replay against a
   * "fixed build" is auditable.
   */
  buildDir?: string;
  /** Served origin of the build to replay against (default `http://localhost:8081`). */
  baseUrl?: string;
  /** A browser to reuse (the CLI launches its own; the self-test passes the fixture). */
  browser: Browser;
  /** Progress callback for each replayed step. */
  onStep?: (info: { index: number; kind: string; status: string }) => void;
}

/* ------------------------------------------------------------------ */
/* Loading                                                             */
/* ------------------------------------------------------------------ */

/** Load and validate every bundle file from disk. */
export function loadBundle(bundleDir: string): LoadedBundle {
  const read = (name: string): string => fs.readFileSync(path.join(bundleDir, name), 'utf8');
  const metadata = parseBundleMetadata(read('bundle.json'));
  let originalReport: RunReport;
  try {
    originalReport = parseRunReport(read('report.json'));
  } catch (err) {
    throw new Error(`bundle '${bundleDir}' has an invalid report.json: ${(err as Error).message}`);
  }
  const dbDump = parseSqliteDump(read('db.sqlite.json'));
  const storage = JSON.parse(read('storage.json')) as Record<string, string>;
  const actions = parseActionsJsonl(read('actions.jsonl'));
  if (actions.length === 0) {
    throw new Error(`bundle '${bundleDir}' has an empty actions.jsonl — nothing to replay`);
  }
  return { metadata, originalReport, dbDump, storage, actions };
}

/* ------------------------------------------------------------------ */
/* Pure divergence logic (unit-tested)                                 */
/* ------------------------------------------------------------------ */

/**
 * Compare the original run's step entries with the replayed ones. Divergence is
 * per-index: `diverged` when statuses differ, `reproduced-failure` when both
 * failed, `same` when both passed. Steps missing from one side are `skipped`.
 */
export function computeDivergence(
  original: RunStepEntry[],
  replayed: RunStepEntry[],
): StepDivergence[] {
  const maxLen = Math.max(original.length, replayed.length);
  const out: StepDivergence[] = [];
  for (let i = 0; i < maxLen; i++) {
    const o = original[i];
    const r = replayed[i];
    if (!o) {
      out.push({
        index: i,
        kind: r.kind,
        originalStatus: 'skipped',
        replayedStatus: r.status,
        note: 'diverged',
      });
      continue;
    }
    if (!r) {
      out.push({
        index: i,
        kind: o.kind,
        originalStatus: o.status,
        replayedStatus: 'skipped',
        note: 'diverged',
      });
      continue;
    }
    const same = o.status === r.status;
    out.push({
      index: i,
      kind: o.kind,
      originalStatus: o.status,
      replayedStatus: r.status,
      originalError: o.error,
      replayedError: r.error,
      note: same ? (o.status === 'failed' ? 'reproduced-failure' : 'same') : 'diverged',
    });
  }
  return out;
}

/**
 * True when the original failure reproduced at the same step: both runs failed,
 * both at the same step index, with the same step kind.
 */
export function sameFailureAtSameStep(original: RunReport, replayed: RunReport): boolean {
  if (!original.failure || !replayed.failure) return false;
  if (original.outcome !== 'failed' || replayed.outcome !== 'failed') return false;
  const oStep = original.steps[original.failure.stepIndex];
  const rStep = replayed.steps[replayed.failure.stepIndex];
  if (!oStep || !rStep) return false;
  return original.failure.stepIndex === replayed.failure.stepIndex && oStep.kind === rStep.kind;
}

/* ------------------------------------------------------------------ */
/* State restoration (browser)                                         */
/* ------------------------------------------------------------------ */

function makeReplayRunId(): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `replay_${Date.now().toString(36)}_${rand}`;
}

/** Restore the captured storage (AsyncStorage keys) on the page. */
export async function restoreStorage(page: Page, storage: Record<string, string>): Promise<void> {
  await page.evaluate((entries) => {
    for (const [key, value] of Object.entries(entries)) {
      window.localStorage.setItem(key, value);
    }
  }, storage);
}

/**
 * Restore a bundle's DB + storage into a fresh context: full reset (OPFS +
 * AsyncStorage wiped), app load to bootstrap the real schema, captured rows
 * re-inserted, storage restored, then back on the app. Leaves the page in app
 * context, ready for `replaySteps`.
 */
export async function restoreBundleState(page: Page, loaded: LoadedBundle): Promise<void> {
  await resetAll(page);
  // Bootstrap the real schema by loading the app once (same pattern as
  // `seedFixture`): the captured dump is a row-level export, so the schema must
  // exist before rows are re-inserted.
  await ensureAppContext(page);
  const sql = buildRestoreSql(loaded.dbDump);
  if (sql.trim() !== '') {
    await runSql(page, sql);
  }
  await restoreStorage(page, loaded.storage);
  await returnToApp(page);
}

/* ------------------------------------------------------------------ */
/* Replay                                                              */
/* ------------------------------------------------------------------ */

/** Render a human-readable divergence report (also used by the CLI). */
export function renderDivergenceReport(result: ReplayResult): string {
  const lines: string[] = [];
  lines.push(`replay of bundle '${result.bundleDir}'`);
  lines.push(
    `  original run: ${result.originalReport.runId} outcome=${result.originalReport.outcome}`,
  );
  if (result.originalReport.failure) {
    lines.push(
      `  original failure: step #${result.originalReport.failure.stepIndex} (${result.originalReport.failure.stepKind}) — ${result.originalReport.failure.error}`,
    );
  }
  lines.push(`  replay outcome: ${result.replayedReport.outcome}`);
  if (result.replayedReport.failure) {
    lines.push(
      `  replay failure: step #${result.replayedReport.failure.stepIndex} (${result.replayedReport.failure.stepKind}) — ${result.replayedReport.failure.error}`,
    );
  }
  lines.push(`  same failure at same step: ${result.sameFailure ? 'YES' : 'NO'}`);
  lines.push('  step divergence:');
  for (const d of result.divergences) {
    const mark = d.note === 'same' ? '  ' : d.note === 'reproduced-failure' ? '✗ ' : '≠ ';
    lines.push(
      `    ${mark}[${String(d.index).padStart(2, '0')}] ${d.kind} — original ${d.originalStatus} → replayed ${d.replayedStatus}`,
    );
    if (d.note === 'diverged') {
      if (d.originalError) lines.push(`        original error: ${d.originalError}`);
      if (d.replayedError) lines.push(`        replayed error: ${d.replayedError}`);
    }
  }
  return lines.join('\n');
}

/**
 * Replay a bundle: restore db+storage into a fresh context, re-execute
 * `actions.jsonl`, and report step-level divergence against the original run.
 * Persists the replayed run report + divergence summary under
 * `simulation-output/<replayRunId>/` (gitignored).
 */
export async function replayBundle(opts: ReplayOptions): Promise<ReplayResult> {
  if (!fs.existsSync(opts.bundleDir)) {
    throw new Error(`bundle directory not found: ${opts.bundleDir}`);
  }
  if (opts.buildDir !== undefined && !fs.existsSync(opts.buildDir)) {
    throw new Error(`--build directory not found: ${opts.buildDir}`);
  }
  const loaded = loadBundle(opts.bundleDir);
  const replayRunId = makeReplayRunId();
  const baseUrl = opts.baseUrl ?? APP_BASE_URL;

  const context = await opts.browser.newContext({
    baseURL: baseUrl,
    viewport: { width: 1280, height: 720 },
  });
  const page = await context.newPage();
  try {
    await restoreBundleState(page, loaded);
    const replayedReport = await replaySteps(page, loaded.actions, {
      runId: replayRunId,
      onStep: opts.onStep,
    });
    const result: ReplayResult = {
      bundleDir: opts.bundleDir,
      metadata: loaded.metadata,
      originalReport: loaded.originalReport,
      replayedReport,
      divergences: computeDivergence(loaded.originalReport.steps, replayedReport.steps),
      sameFailure: sameFailureAtSameStep(loaded.originalReport, replayedReport),
      buildDir: opts.buildDir,
    };

    // Persist the replay's report + divergence summary (gitignored output).
    const outDir = ensureRunOutputDir(replayRunId);
    writeRunReportJson(replayRunId, serializeRunReport(replayedReport));
    fs.writeFileSync(
      path.join(outDir, 'replay-result.json'),
      JSON.stringify(
        {
          bundleDir: opts.bundleDir,
          sameFailure: result.sameFailure,
          buildDir: opts.buildDir ?? null,
          divergences: result.divergences,
        },
        null,
        2,
      ),
      'utf8',
    );
    return result;
  } finally {
    await context.close().catch(() => {});
  }
}
