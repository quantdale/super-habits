/**
 * Launch-race triage helpers for the iOS certification lane.
 *
 * Evidence (run 38726951043, flow workout-gym-v2-session-lifecycle): Maestro's
 * `launchApp` can return while the relaunched app is still mid-boot, and the
 * very next view-hierarchy probe then receives XCTestDriver's
 * "Application com.dale16.superhabits is not running" (HTTP 500) — which the
 * Maestro iOS driver surfaces as `IOSDeviceErrors.AppCrash` ("App crashed or
 * stopped while executing flow"). That error is not a `MaestroException`, so
 * Maestro's `optional: true` cannot absorb it (MaestroCommandRunner rethrows
 * non-MaestroException failures) and the flow aborts on a false negative.
 *
 * In the proven incident the app process was alive the whole time
 * (SpringBoard recorded the relaunched PID `running-active-Visible` before the
 * probe, and that PID kept logging app/JS activity afterwards), the failure
 * screenshot was the black pre-first-frame screen, and no crash report
 * existed.
 *
 * A recovery re-run is therefore allowed ONLY when all three hold:
 *   1. the flow failed with the launch-race error signature (necessary, not
 *      sufficient: Maestro wraps REAL crashes in the same message),
 *   2. the app process is alive right after the failure,
 *   3. the DiagnosticReports folder was readable AND holds no new app crash
 *      report (an unreadable folder fails closed — "no evidence" is never
 *      "evidence of no crash").
 * It is bounded (exactly one re-run per flow per lane run) and reported as
 * `PASS_AFTER_LAUNCH_RACE_RECOVERY`, never as a plain PASS. The re-run itself
 * is the final discriminator: a real crash fails it again and the original
 * failure stands.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';

const LAUNCH_RACE_PATTERN = /App crashed or stopped|is not running/i;

/** True when a command/flow error message matches the launch-race wrapper. */
export function isLaunchRaceErrorMessage(message) {
  return typeof message === 'string' && LAUNCH_RACE_PATTERN.test(message);
}

/**
 * Collect every command-level error message recorded for a flow in a Maestro
 * debug-output directory (2.x flat `commands-(<flow>.yaml).json` evidence).
 * Returns [] when no command log is present — an unprovable failure must not
 * qualify for recovery.
 */
export function findFlowErrorMessages(debugDir, flowPath) {
  const flowFile = basename(flowPath ?? '');
  const messages = [];
  let testRoots;
  try {
    testRoots = readdirSync(join(debugDir, '.maestro', 'tests'), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => join(debugDir, '.maestro', 'tests', entry.name));
  } catch {
    return messages;
  }
  for (const testRoot of testRoots) {
    let entries;
    try {
      entries = readdirSync(testRoot);
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (flowFile && entry !== `commands-(${flowFile}).json`) continue;
      let parsed;
      try {
        parsed = JSON.parse(readFileSync(join(testRoot, entry), 'utf8'));
      } catch {
        continue;
      }
      if (!Array.isArray(parsed)) continue;
      for (const command of parsed) {
        const error = command?.metadata?.error;
        if (error?.message) messages.push(String(error.message));
      }
    }
  }
  return messages;
}

/**
 * Decide whether a failed flow attempt may be re-run once. Pure decision
 * function: the caller gathers the evidence (failure messages, process
 * liveness, crash-report scan) and this returns the verdict and its reason.
 */
export function decideLaunchRaceRecovery({ errorMessages, appProcessAlive, crashReportScan }) {
  const messages = Array.isArray(errorMessages) ? errorMessages : [];
  const scan = crashReportScan ?? { readable: false, reports: [] };
  const reports = Array.isArray(scan.reports) ? scan.reports : [];
  if (!messages.some((message) => isLaunchRaceErrorMessage(message))) {
    return { eligible: false, reason: 'NO_LAUNCH_RACE_SIGNATURE' };
  }
  if (!scan.readable) {
    // "No evidence" must never stand in for "evidence of no crash".
    return { eligible: false, reason: 'CRASH_REPORT_SCAN_UNAVAILABLE' };
  }
  if (reports.length > 0) {
    return { eligible: false, reason: 'CRASH_REPORT_PRESENT', crashReports: reports };
  }
  if (!appProcessAlive) {
    return { eligible: false, reason: 'APP_PROCESS_NOT_ALIVE' };
  }
  return {
    eligible: true,
    reason: 'LAUNCH_RACE_PROVEN_ALIVE_NO_CRASH',
  };
}

/**
 * Scan the macOS DiagnosticReports folder for app crash reports (`.ips`) whose
 * mtime is at or after `sinceMs`. `readable: false` means the folder could not
 * be listed and the caller must treat crash state as unknown.
 */
export function scanCrashReports(diagnosticReportsDir, sinceMs, appId = 'com.dale16.superhabits') {
  let entries;
  try {
    entries = readdirSync(diagnosticReportsDir);
  } catch {
    return { readable: false, reports: [] };
  }
  const appStem = appId.split('.').pop() ?? appId;
  const reports = [];
  for (const entry of entries) {
    if (!/\.ips$/i.test(entry)) continue;
    const lower = entry.toLowerCase();
    if (!lower.includes(appStem.toLowerCase()) && !lower.includes(appId.toLowerCase())) continue;
    try {
      const stats = statSync(join(diagnosticReportsDir, entry));
      if (stats.mtimeMs >= sinceMs) reports.push({ file: entry, mtimeMs: stats.mtimeMs });
    } catch {
      // Ignore entries that vanish mid-scan.
    }
  }
  return { readable: true, reports };
}

/**
 * The only pass signal for one flow attempt: Maestro exit 0 AND a PASS native
 * report at the exact lane source SHA. A native report that claims PASS while
 * the harness predicate fails is surfaced as NOT_VERIFIED, never as PASS.
 *
 * @param {{ passed: boolean, nativeReportStatus?: string }} attempt
 * @returns {string}
 */
export function attemptStatus({ passed, nativeReportStatus }) {
  if (passed) return 'PASS';
  const reported = nativeReportStatus ?? 'NOT_REPORTED';
  return reported === 'PASS' ? 'NOT_VERIFIED' : reported;
}

/**
 * Lane-level status. Subset runs never certify; recovered flows are named as
 * such and never collapse into a plain PASS; source drift is never certified;
 * and a run that did not reach every expected flow is never a pass (a lane
 * that breaks early on ENVIRONMENT must not certify by omission).
 *
 * @param {{ flowStatuses?: string[], expectedCount?: number, subset?: string[] | null, sourceUnchanged?: boolean }} options
 * @returns {string}
 */
export function resolveLaneStatus({
  flowStatuses = [],
  expectedCount = 0,
  subset = null,
  sourceUnchanged = true,
}) {
  if (!sourceUnchanged) return 'NOT_CERTIFIED';
  const allPassed =
    flowStatuses.length > 0 &&
    flowStatuses.length === expectedCount &&
    flowStatuses.every(
      (status) => status === 'PASS' || status === 'PASS_AFTER_LAUNCH_RACE_RECOVERY',
    );
  const anyRecovery = flowStatuses.some((status) => status === 'PASS_AFTER_LAUNCH_RACE_RECOVERY');
  if (subset) {
    if (!allPassed) return 'SUBSET_NOT_CERTIFIED';
    return anyRecovery ? 'SUBSET_PASS_WITH_LAUNCH_RACE_RECOVERY' : 'SUBSET_PASS';
  }
  if (!allPassed) return 'NOT_CERTIFIED';
  return anyRecovery ? 'PASS_WITH_LAUNCH_RACE_RECOVERY' : 'PASS';
}
