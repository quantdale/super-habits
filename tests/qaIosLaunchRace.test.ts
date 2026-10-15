import { mkdtempSync, mkdirSync, utimesSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import {
  attemptStatus,
  decideLaunchRaceRecovery,
  findFlowErrorMessages,
  isLaunchRaceErrorMessage,
  resolveLaneStatus,
  scanCrashReports,
} from '../scripts/qa-ios-launch-race.mjs';

const FIXTURE_ROOT = mkdtempSync(join(tmpdir(), 'qa-ios-launch-race-'));

afterAll(() => {
  rmSync(FIXTURE_ROOT, { recursive: true, force: true });
});

function writeCommandLog(debugDir: string, flowFile: string, errors: string[]) {
  const testRoot = join(debugDir, '.maestro', 'tests', '2026-10-15_142300');
  mkdirSync(testRoot, { recursive: true });
  const commands = errors.map((message, index) => ({
    command: { assertConditionCommand: {} },
    metadata: {
      status: 'FAILED',
      sequenceNumber: index,
      error: { message },
    },
  }));
  writeFileSync(join(testRoot, `commands-(${flowFile}).json`), JSON.stringify(commands));
}

const RACE_MESSAGE =
  'App crashed or stopped while executing flow, please check diagnostic logs: ~/Library/Logs/DiagnosticReports directory';
const NO_RACE_SCAN = { readable: true, reports: [] };

describe('iOS launch-race signature', () => {
  it('recognizes the XCTestDriver "app is not running" false negative wrapper', () => {
    expect(isLaunchRaceErrorMessage(RACE_MESSAGE)).toBe(true);
    expect(isLaunchRaceErrorMessage('Application com.dale16.superhabits is not running')).toBe(
      true,
    );
  });

  it('does not treat ordinary assertion failures as launch races', () => {
    expect(isLaunchRaceErrorMessage('Assertion is false: "Calories edit food" is visible')).toBe(
      false,
    );
    expect(
      isLaunchRaceErrorMessage('No visible element found: "Native custom press minimum reps"'),
    ).toBe(false);
    expect(isLaunchRaceErrorMessage(undefined)).toBe(false);
  });
});

describe('findFlowErrorMessages', () => {
  it('reads command-level errors from the Maestro 2.x flat evidence layout', () => {
    const debugDir = join(FIXTURE_ROOT, 'debug-a');
    writeCommandLog(debugDir, 'workout-gym-v2-session-lifecycle.yaml', [RACE_MESSAGE]);
    expect(
      findFlowErrorMessages(debugDir, '.maestro/flows/workout-gym-v2-session-lifecycle.yaml'),
    ).toEqual([RACE_MESSAGE]);
  });

  it('scopes to the requested flow and returns empty for missing evidence', () => {
    const debugDir = join(FIXTURE_ROOT, 'debug-b');
    writeCommandLog(debugDir, 'calories-persistence.yaml', ['Assertion is false: "X" is visible']);
    expect(
      findFlowErrorMessages(debugDir, '.maestro/flows/workout-gym-v2-session-lifecycle.yaml'),
    ).toEqual([]);
    expect(findFlowErrorMessages(join(FIXTURE_ROOT, 'does-not-exist'), 'any.yaml')).toEqual([]);
  });
});

describe('decideLaunchRaceRecovery', () => {
  it('is eligible only with the signature, a live process, and a readable empty crash scan', () => {
    expect(
      decideLaunchRaceRecovery({
        errorMessages: [RACE_MESSAGE],
        appProcessAlive: true,
        crashReportScan: NO_RACE_SCAN,
      }),
    ).toMatchObject({ eligible: true, reason: 'LAUNCH_RACE_PROVEN_ALIVE_NO_CRASH' });
  });

  it('refuses recovery when a crash report exists or the process is gone', () => {
    expect(
      decideLaunchRaceRecovery({
        errorMessages: [RACE_MESSAGE],
        appProcessAlive: true,
        crashReportScan: {
          readable: true,
          reports: [{ file: 'SuperHabits-2026-10-15-142300.ips' }],
        },
      }),
    ).toMatchObject({ eligible: false, reason: 'CRASH_REPORT_PRESENT' });
    expect(
      decideLaunchRaceRecovery({
        errorMessages: [RACE_MESSAGE],
        appProcessAlive: false,
        crashReportScan: NO_RACE_SCAN,
      }),
    ).toMatchObject({ eligible: false, reason: 'APP_PROCESS_NOT_ALIVE' });
  });

  it('fails closed when the crash-report folder is unreadable', () => {
    expect(
      decideLaunchRaceRecovery({
        errorMessages: [RACE_MESSAGE],
        appProcessAlive: true,
        crashReportScan: { readable: false, reports: [] },
      }),
    ).toMatchObject({ eligible: false, reason: 'CRASH_REPORT_SCAN_UNAVAILABLE' });
  });

  it('refuses recovery for failures without the launch-race signature', () => {
    expect(
      decideLaunchRaceRecovery({
        errorMessages: ['Assertion is false: "Today" is visible'],
        appProcessAlive: true,
        crashReportScan: NO_RACE_SCAN,
      }),
    ).toMatchObject({ eligible: false, reason: 'NO_LAUNCH_RACE_SIGNATURE' });
    expect(
      decideLaunchRaceRecovery({
        errorMessages: [],
        appProcessAlive: true,
        crashReportScan: NO_RACE_SCAN,
      }),
    ).toMatchObject({ eligible: false, reason: 'NO_LAUNCH_RACE_SIGNATURE' });
  });
});

describe('scanCrashReports', () => {
  it('lists only app crash reports newer than the flow start and stays readable', () => {
    const dir = join(FIXTURE_ROOT, 'DiagnosticReports');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'SuperHabits-2026-10-15-100000.ips'), 'old');
    writeFileSync(join(dir, 'SuperHabits-2026-10-15-150000.ips'), 'new');
    writeFileSync(join(dir, 'OtherApp-2026-10-15-150000.ips'), 'unrelated');
    const since = Date.parse('2026-10-15T12:00:00Z');
    for (const [file, at] of [
      ['SuperHabits-2026-10-15-100000.ips', since - 3600_000],
      ['SuperHabits-2026-10-15-150000.ips', since + 3600_000],
      ['OtherApp-2026-10-15-150000.ips', since + 3600_000],
    ] as const) {
      utimesSync(join(dir, file), new Date(at), new Date(at));
    }

    const scan = scanCrashReports(dir, since);
    expect(scan.readable).toBe(true);
    expect(scan.reports.map((report) => report.file)).toEqual([
      'SuperHabits-2026-10-15-150000.ips',
    ]);
  });

  it('reports an unreadable folder as unknown, not as an empty crash list', () => {
    expect(scanCrashReports(join(FIXTURE_ROOT, 'missing'), Date.now())).toEqual({
      readable: false,
      reports: [],
    });
  });
});

describe('attemptStatus', () => {
  it('never surfaces PASS unless the harness predicate passed', () => {
    expect(attemptStatus({ passed: true, nativeReportStatus: 'PASS' })).toBe('PASS');
    // A native report claiming PASS while exit code/SHA checks failed is not a pass.
    expect(attemptStatus({ passed: false, nativeReportStatus: 'PASS' })).toBe('NOT_VERIFIED');
    expect(attemptStatus({ passed: false, nativeReportStatus: 'FAILED_NEEDS_TRIAGE' })).toBe(
      'FAILED_NEEDS_TRIAGE',
    );
    expect(attemptStatus({ passed: false, nativeReportStatus: undefined })).toBe('NOT_REPORTED');
  });
});

describe('resolveLaneStatus', () => {
  it('certifies only full non-subset runs with clean passes', () => {
    expect(
      resolveLaneStatus({
        flowStatuses: ['PASS', 'PASS', 'PASS'],
        expectedCount: 3,
        subset: null,
        sourceUnchanged: true,
      }),
    ).toBe('PASS');
  });

  it('names recovered flows and never collapses them into a plain PASS', () => {
    expect(
      resolveLaneStatus({
        flowStatuses: ['PASS', 'PASS_AFTER_LAUNCH_RACE_RECOVERY'],
        expectedCount: 2,
        subset: null,
        sourceUnchanged: true,
      }),
    ).toBe('PASS_WITH_LAUNCH_RACE_RECOVERY');
  });

  it('never certifies subset runs, incomplete runs, or unclean runs', () => {
    expect(
      resolveLaneStatus({
        flowStatuses: ['PASS', 'PASS'],
        expectedCount: 2,
        subset: ['calories-persistence'],
        sourceUnchanged: true,
      }),
    ).toBe('SUBSET_PASS');
    expect(
      resolveLaneStatus({
        flowStatuses: ['PASS', 'FAILED_NEEDS_TRIAGE'],
        expectedCount: 2,
        subset: ['calories-persistence'],
        sourceUnchanged: true,
      }),
    ).toBe('SUBSET_NOT_CERTIFIED');
    expect(
      resolveLaneStatus({
        flowStatuses: ['PASS', 'NOT_VERIFIED'],
        expectedCount: 2,
        subset: null,
        sourceUnchanged: true,
      }),
    ).toBe('NOT_CERTIFIED');
    // A lane that broke early after passing flows must not certify by omission.
    expect(
      resolveLaneStatus({
        flowStatuses: ['PASS'],
        expectedCount: 3,
        subset: null,
        sourceUnchanged: true,
      }),
    ).toBe('NOT_CERTIFIED');
    expect(
      resolveLaneStatus({
        flowStatuses: ['PASS', 'PASS'],
        expectedCount: 2,
        subset: null,
        sourceUnchanged: false,
      }),
    ).toBe('NOT_CERTIFIED');
    expect(
      resolveLaneStatus({
        flowStatuses: [],
        expectedCount: 2,
        subset: null,
        sourceUnchanged: true,
      }),
    ).toBe('NOT_CERTIFIED');
  });
});
