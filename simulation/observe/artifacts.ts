/**
 * Artifact writer (`add-user-simulation-platform` task 4.2).
 *
 * Output layout under the gitignored `simulation-output/` directory
 * (entry added to `.gitignore`):
 *
 * ```
 * simulation-output/
 *   <runId>/
 *     run-report.json      # 4.1 schema, always written
 *     digest.md            # 4.3 failure digest, failure only
 *     screenshots/
 *       <NNN>-<kind>-<status>.png   # per-step screenshots
 *     artifacts/
 *       trace.zip          # Playwright trace, failure only
 *       video.webm         # context video, failure only
 *       console.log        # captured console lines, failure only
 * ```
 *
 * Per-artifact rule (design D6): per-step screenshots are ALWAYS captured
 * (they document the run); video and trace are captured for every step but
 * RETAINED ONLY ON FAILURE — a green run deletes them so the directory stays
 * small. Screenshot + video + trace are captured via the Playwright page API;
 * a conflation of the two (video from `recordVideo`, screenshots via
 * `page.screenshot`) is intentional: screenshots are per-Oracle/step evidence,
 * video is the continuity record.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Page } from '@playwright/test';
import type { RunArtifacts } from './report';

/** Gitignored output root (relative to the repo root / process.cwd()). */
export const SIMULATION_OUTPUT = 'simulation-output';

/** Absolute path to the gitignored output root. */
export function simulationOutputRoot(): string {
  return path.resolve(process.cwd(), SIMULATION_OUTPUT);
}

/** Absolute path to one run's output directory. */
export function runOutputDir(runId: string): string {
  return path.join(simulationOutputRoot(), runId);
}

/** Ensure a run's output directory exists; returns its absolute path. */
export function ensureRunOutputDir(runId: string): string {
  const dir = runOutputDir(runId);
  fs.mkdirSync(path.join(dir, 'screenshots'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'artifacts'), { recursive: true });
  return dir;
}

/** Convert an absolute path into a repo-root-relative path for pointers/links. */
export function relativeToRoot(absPath: string): string {
  return path.relative(process.cwd(), absPath).split(path.sep).join('/');
}

/** Absolute path to the video directory Playwright `recordVideo` writes into. */
export function videoDir(runId: string): string {
  return path.join(runOutputDir(runId), 'artifacts', 'video');
}

/** Absolute path where `context.tracing.stop({ path })` should write. */
export function tracePath(runId: string): string {
  return path.join(runOutputDir(runId), 'artifacts', 'trace.zip');
}

/**
 * Capture a per-step screenshot. Returns the repo-root-relative path, used as
 * the artifact pointer in the run report. Status is embedded in the filename
 * so a glance at the directory shows the failure point.
 */
export async function captureStepScreenshot(
  page: Page,
  opts: { runId: string; stepIndex: number; kind: string; status: string },
): Promise<string> {
  const dir = path.join(runOutputDir(opts.runId), 'screenshots');
  fs.mkdirSync(dir, { recursive: true });
  const pad = String(opts.stepIndex).padStart(3, '0');
  const file = `${pad}-${opts.kind}-${opts.status}.png`;
  const abs = path.join(dir, file);
  try {
    await page.screenshot({ path: abs });
  } catch {
    // Page may be gone (e.g. a failed reload). A missing screenshot is
    // documented by the console/log; do not fail the report for it.
  }
  return relativeToRoot(abs);
}

/** Write the run report JSON. Returns the relative path. */
export function writeRunReportJson(runId: string, json: string): string {
  const abs = path.join(runOutputDir(runId), 'run-report.json');
  fs.writeFileSync(abs, json, 'utf8');
  return relativeToRoot(abs);
}

/** Write the failure digest Markdown. Returns the relative path. */
export function writeDigestMd(runId: string, markdown: string): string {
  const abs = path.join(runOutputDir(runId), 'digest.md');
  fs.writeFileSync(abs, markdown, 'utf8');
  return relativeToRoot(abs);
}

/** Write the captured console log. Returns the relative path. */
export function writeConsoleLog(runId: string, lines: string[]): string {
  const abs = path.join(runOutputDir(runId), 'artifacts', 'console.log');
  fs.writeFileSync(abs, lines.join('\n') + (lines.length ? '\n' : ''), 'utf8');
  return relativeToRoot(abs);
}

/** Find the recorded video file after `context.close()` (failure retention). */
export function findRecordedVideo(runId: string): string | undefined {
  const dir = videoDir(runId);
  try {
    if (!fs.existsSync(dir)) return undefined;
    const files = fs.readdirSync(dir).filter((f) => /\.(webm|mov)$/i.test(f));
    if (files.length === 0) return undefined;
    return relativeToRoot(path.join(dir, files[0]));
  } catch {
    return undefined;
  }
}

/** Remove the video directory (called after a PASSING run). */
export function deleteRecordedVideo(runId: string): void {
  const dir = videoDir(runId);
  try {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  } catch {
    // Retention cleanup is best-effort.
  }
}

/** Remove the retained trace (called after a PASSING run). */
export function deleteRecordedTrace(runId: string): void {
  try {
    fs.rmSync(tracePath(runId), { force: true });
  } catch {
    // best-effort
  }
}

/** Build the `artifacts` section of a run report from paths gathered so far. */
export function buildRunArtifacts(input: {
  runId: string;
  reportPath: string;
  screenshots: string[];
  video?: string;
  trace?: string;
  consoleLog?: string;
  digest?: string;
}): RunArtifacts {
  return {
    root: `${SIMULATION_OUTPUT}/${input.runId}`,
    report: input.reportPath,
    screenshots: input.screenshots,
    video: input.video,
    trace: input.trace,
    consoleLog: input.consoleLog,
    digest: input.digest,
  };
}
