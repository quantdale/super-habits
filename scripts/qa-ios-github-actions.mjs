/**
 * Certify a locally built iOS Simulator app on an opt-in GitHub macOS runner.
 * The flow inventory comes from the existing EAS iOS job so the two lanes
 * exercise the same scenarios. This script never calls EAS or uses signing.
 */
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  appendFileSync,
  createReadStream,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import {
  attemptStatus,
  decideLaunchRaceRecovery,
  findFlowErrorMessages,
  resolveLaneStatus,
  scanCrashReports,
} from './qa-ios-launch-race.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const REPORT_DIR = join(ROOT, 'simulation-output', 'native');
const DIAGNOSTIC_REPORTS_DIR = join(homedir(), 'Library', 'Logs', 'DiagnosticReports');
const APP_ID = 'com.dale16.superhabits';

function capture(command, args) {
  return execFileSync(command, args, { cwd: ROOT, encoding: 'utf8' }).trim();
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sourceUnchangedApartFromGeneratedIos() {
  const status = capture('git', ['status', '--porcelain', '--untracked-files=all']);
  return status
    .split('\n')
    .filter(Boolean)
    .every((line) => /^\?\? ios\//.test(line));
}

function iosFlows() {
  const json = capture('ruby', [
    '-rjson',
    '-ryaml',
    '-e',
    'STDOUT.write(JSON.generate(YAML.load_file(ARGV.fetch(0)).dig("jobs", "test_ios", "params", "flow_path")))',
    join(ROOT, '.eas', 'workflows', 'native-e2e.yml'),
  ]);
  const flows = JSON.parse(json);
  assert(Array.isArray(flows) && flows.length > 0, 'The EAS iOS flow list is empty.');
  assert(new Set(flows).size === flows.length, 'The EAS iOS flow list has duplicates.');
  for (const flow of flows) {
    assert(
      typeof flow === 'string' &&
        flow.startsWith('.maestro/flows/') &&
        flow.endsWith('.yaml') &&
        existsSync(join(ROOT, flow)),
      `Invalid or missing iOS flow: ${flow}`,
    );
  }
  return flows;
}

function iosReports() {
  return new Set(readdirSync(REPORT_DIR).filter((name) => /^native-ios-.*\.json$/.test(name)));
}

async function sha256(filePath) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest('hex');
}

function writeReport(report, reportPath) {
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
}

function writeSummary(report, reportPath) {
  if (!process.env.GITHUB_STEP_SUMMARY) return;
  const recoveries = report.launchRaceRecoveries ?? [];
  const lines = [
    '## iOS Simulator certification',
    '',
    `- Result: **${report.status}**`,
    `- Source SHA: \`${report.sourceSha}\``,
    `- App executable SHA-256: \`${report.app.executableSha256}\``,
    `- Xcode: \`${report.xcode.replaceAll('\n', ' / ')}\``,
    `- Simulator: ${report.simulator.name} (${report.simulator.runtime})`,
    `- Provenance JSON printed in this job log: \`${basename(reportPath)}\``,
    '',
    '| Flow | Result |',
    '| --- | --- |',
    ...report.flows.map((flow) => `| \`${flow.path}\` | ${flow.status} |`),
    '',
  ];
  if (report.subsetRequested) {
    lines.push(
      `> Subset run (${report.flows.length} of ${report.expectedFlowCount} flows). **Not a certification run.**`,
      '',
    );
  }
  if (recoveries.length > 0) {
    lines.push(
      '> Launch-race recovery attempts (identified, not concealed): each listed flow first failed with',
      '> the XCTestDriver "app is not running" false negative while the app process was provably alive',
      '> and the crash-report scan was readable and empty, then got exactly one full re-run at the same',
      '> source. `recovered: true` means the re-run passed all assertions; the flow is reported as',
      '> PASS_AFTER_LAUNCH_RACE_RECOVERY, never as a plain PASS.',
      ...recoveries.map(
        (recovery) => `> - \`${recovery.path}\` (recovered: ${recovery.recovered})`,
      ),
      '',
    );
  }
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${lines.join('\n')}\n`);
}

/**
 * Optional focused-run filter (workflow_dispatch input `flows`). Subset runs
 * can never certify: `expectedFlowCount` keeps the full inventory and the
 * report status stays out of the `PASS` certification states. A requested
 * name that matches no flow fails closed.
 */
function requestedFlowSubset() {
  const raw = (process.env.IOS_FLOW_SUBSET ?? '').trim();
  if (!raw) return null;
  const names = raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => entry.replace(/\.yaml$/, ''));
  return names.length > 0 ? names : null;
}

function captureFailureDiagnostics(nativeReport, simulator) {
  if (!nativeReport?.debugOutputDir) return null;
  const debugDir = join(REPORT_DIR, basename(nativeReport.debugOutputDir));
  mkdirSync(debugDir, { recursive: true });
  const logPath = join(debugDir, 'simulator-app.log');
  const log = spawnSync(
    'xcrun',
    [
      'simctl',
      'spawn',
      simulator.udid,
      'log',
      'show',
      '--last',
      '8m',
      '--style',
      'compact',
      '--predicate',
      'process == "SuperHabits" OR eventMessage CONTAINS[c] "com.dale16.superhabits"',
    ],
    { cwd: ROOT, encoding: 'utf8', timeout: 30000, maxBuffer: 16 * 1024 * 1024 },
  );
  const output = `${log.stdout ?? ''}\n${log.stderr ?? ''}`;
  writeFileSync(
    logPath,
    `simctl log show exit=${log.status ?? 'unknown'} error=${log.error?.message ?? 'none'}\n${output.slice(-2_000_000)}`,
  );

  // Crash reports decide crash-vs-unreachable: a missing report must never be
  // treated as proof of no crash on its own, so copy every app report into the
  // artifact directory and record the full folder listing alongside it.
  const crashListingPath = join(debugDir, 'diagnosticreports-listing.txt');
  const crashListing = spawnSync('ls', ['-la', DIAGNOSTIC_REPORTS_DIR], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 15000,
    maxBuffer: 4 * 1024 * 1024,
  });
  writeFileSync(
    crashListingPath,
    `ls exit=${crashListing.status ?? 'unknown'}\n${crashListing.stdout ?? ''}${crashListing.stderr ?? ''}`,
  );
  const crashScan = scanCrashReports(DIAGNOSTIC_REPORTS_DIR, 0);
  for (const report of crashScan.reports) {
    const copy = spawnSync(
      'cp',
      [join(DIAGNOSTIC_REPORTS_DIR, report.file), join(debugDir, report.file)],
      {
        cwd: ROOT,
        encoding: 'utf8',
        timeout: 15000,
      },
    );
    if ((copy.status ?? 1) !== 0) {
      console.warn(
        `Could not copy crash report ${report.file}: ${copy.error?.message ?? copy.stderr}`,
      );
    }
  }

  // Process liveness is the other half of the decision: a dead process is a
  // crash; a live one that XCTest calls "not running" is a launch race.
  const liveness = probeAppProcess(simulator);
  const livenessPath = join(debugDir, 'simulator-processes.txt');
  writeFileSync(livenessPath, JSON.stringify(liveness, null, 2));

  const screenshotPath = join(debugDir, 'simulator-screenshot-at-failure.png');
  const screenshot = spawnSync(
    'xcrun',
    ['simctl', 'io', simulator.udid, 'screenshot', screenshotPath],
    {
      cwd: ROOT,
      encoding: 'utf8',
      timeout: 30000,
    },
  );

  const evidencePath = join(debugDir, 'failure-diagnostics.json');
  writeFileSync(
    evidencePath,
    `${JSON.stringify(
      {
        capturedAt: new Date().toISOString(),
        simulatorAppLog: basename(logPath),
        crashReportsListing: basename(crashListingPath),
        crashReportsReadable: crashScan.readable,
        crashReports: crashScan.reports.map((report) => report.file),
        liveness,
        screenshot: (screenshot.status ?? 1) === 0 ? basename(screenshotPath) : null,
      },
      null,
      2,
    )}\n`,
  );
  return `${basename(debugDir)}/simulator-app.log`;
}

/**
 * True when the simulator's process table holds the app EXECUTABLE (SuperHabits
 * as the comm name). Matching the raw `ps` line would also match crash tooling
 * whose arguments mention the app, which falsely reports a crashed app alive.
 */
function probeAppProcess(simulator) {
  const ps = spawnSync(
    'xcrun',
    ['simctl', 'spawn', simulator.udid, 'ps', '-ax', '-o', 'pid=,comm='],
    {
      cwd: ROOT,
      encoding: 'utf8',
      timeout: 15000,
      maxBuffer: 8 * 1024 * 1024,
    },
  );
  const output = `${ps.stdout ?? ''}`;
  const lines = output.split('\n').filter((line) => {
    const comm = line.trim().split(/\s+/).pop() ?? '';
    return basename(comm) === 'SuperHabits';
  });
  return {
    alive: lines.length > 0,
    exitCode: ps.status ?? null,
    error: ps.error?.message ?? null,
    matchingLines: lines.slice(0, 8),
  };
}

async function main() {
  assert(process.env.GITHUB_ACTIONS === 'true', 'This lane runs only on GitHub Actions.');
  assert(process.env.RUNNER_OS === 'macOS', 'This lane requires a macOS runner.');
  assert(process.version === 'v22.23.2', 'Node must be v22.23.2.');
  const expectedSha = process.env.EXPECTED_SOURCE_SHA ?? '';
  assert(/^[0-9a-f]{40}$/.test(expectedSha), 'Missing exact PR-head SHA.');
  const sourceSha = capture('git', ['rev-parse', 'HEAD']);
  assert(sourceSha === expectedSha, 'Checkout differs from the labeled PR head.');
  assert(
    sourceUnchangedApartFromGeneratedIos(),
    'Source files changed during the iOS build; refusing certification.',
  );

  const appPath = resolve(ROOT, process.argv[2] ?? '');
  assert(process.argv[2] && statSync(appPath).isDirectory(), 'Simulator .app is missing.');
  const plistPath = join(appPath, 'Info.plist');
  const bundleIdentifier = capture('/usr/libexec/PlistBuddy', [
    '-c',
    'Print :CFBundleIdentifier',
    plistPath,
  ]);
  assert(bundleIdentifier === APP_ID, `Unexpected bundle identifier: ${bundleIdentifier}`);
  const executableName = capture('/usr/libexec/PlistBuddy', [
    '-c',
    'Print :CFBundleExecutable',
    plistPath,
  ]);
  const executablePath = join(appPath, executableName);
  assert(existsSync(executablePath), 'App executable is missing.');

  const xcode = capture('xcodebuild', ['-version']);
  assert(xcode.startsWith('Xcode 26.2\n'), 'Expo SDK 55 requires Xcode 26.2+.');
  const booted = JSON.parse(capture('xcrun', ['simctl', 'list', 'devices', 'booted', '-j']));
  const simulators = Object.entries(booted.devices).flatMap(([runtime, devices]) =>
    devices
      .filter((device) => device.state === 'Booted')
      .map((device) => ({
        runtime,
        name: device.name,
        udid: device.udid,
      })),
  );
  assert(simulators.length === 1, 'Expected exactly one booted iOS Simulator.');
  assert(simulators[0].runtime.endsWith('.iOS-26-2'), 'Unexpected iOS runtime.');
  capture('xcrun', ['simctl', 'get_app_container', simulators[0].udid, APP_ID]);

  const maestroVersion = capture('maestro', ['--version']);
  assert(/\b2\.2\.0\b/.test(maestroVersion), 'Unexpected Maestro CLI version.');
  const inventory = iosFlows();
  const subset = requestedFlowSubset();
  const flows = subset
    ? inventory.filter((flow) => subset.includes(basename(flow).replace(/\.yaml$/, '')))
    : inventory;
  if (subset) {
    const unmatched = subset.filter((name) =>
      flows.every((flow) => basename(flow).replace(/\.yaml$/, '') !== name),
    );
    assert(
      unmatched.length === 0,
      `IOS_FLOW_SUBSET names match no inventory flow: ${unmatched.join(', ')}`,
    );
  }
  mkdirSync(REPORT_DIR, { recursive: true });
  const reportPath = join(
    REPORT_DIR,
    `ios-gha-${process.env.GITHUB_RUN_ID ?? 'local'}-${process.env.GITHUB_RUN_ATTEMPT ?? '1'}-${sourceSha.slice(0, 12)}.json`,
  );
  const report = {
    schemaVersion: 1,
    status: 'NOT_RUN',
    sourceSha,
    expectedHeadSha: expectedSha,
    sourceUnchangedApartFromGeneratedIos: true,
    buildMode: 'Expo CLI Release / named iOS 26.2 Simulator / unsigned',
    app: {
      path: appPath,
      bundleIdentifier,
      executableName,
      executableSha256: await sha256(executablePath),
    },
    nodeVersion: process.version,
    xcode,
    maestroVersion,
    simulator: simulators[0],
    github: {
      repository: process.env.GITHUB_REPOSITORY ?? null,
      runId: process.env.GITHUB_RUN_ID ?? null,
      runAttempt: process.env.GITHUB_RUN_ATTEMPT ?? null,
    },
    flowInventory: '.eas/workflows/native-e2e.yml:jobs.test_ios.params.flow_path',
    expectedFlowCount: inventory.length,
    subsetRequested: subset,
    executedFlowCount: flows.length,
    flows: [],
    launchRaceRecoveries: [],
    capturedAt: new Date().toISOString(),
  };
  writeReport(report, reportPath);

  for (const flow of flows) {
    const attemptFlow = () => {
      const attemptStartedMs = Date.now();
      const before = iosReports();
      const run = spawnSync(
        process.execPath,
        ['scripts/qa-native.mjs', '--platform', 'ios', '--flow', flow, '--no-provision'],
        { cwd: ROOT, env: process.env, stdio: 'inherit' },
      );
      const newReports = [...iosReports()].filter((name) => !before.has(name));
      const nativeReport =
        newReports.length === 1
          ? JSON.parse(readFileSync(join(REPORT_DIR, newReports[0]), 'utf8'))
          : null;
      return {
        attemptStartedMs,
        run,
        nativeReport,
        nativeReportName: newReports.length === 1 ? newReports[0] : null,
        passed:
          run.status === 0 && nativeReport?.status === 'PASS' && nativeReport.gitSha === sourceSha,
      };
    };

    let attempt = attemptFlow();
    let status = attemptStatus({
      passed: attempt.passed,
      nativeReportStatus: attempt.nativeReport?.status,
    });
    let diagnosticLog = null;
    let diagnosticEvidence = null;
    let launchRaceRecovery = null;

    if (!attempt.passed) {
      try {
        diagnosticLog = captureFailureDiagnostics(attempt.nativeReport, simulators[0]);
      } catch (error) {
        console.warn(
          `Simulator diagnostics capture failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      // Launch-race recovery is evidence-gate and bounded to one re-run per
      // flow (MAX_LAUNCH_RACE_RECOVERIES_PER_FLOW = 1, enforced by the single
      // attemptFlow() call below): only the XCTestDriver "app is not running"
      // false negative with a provably alive process and a READABLE, empty
      // crash-report scan qualifies. The re-run is reported as
      // PASS_AFTER_LAUNCH_RACE_RECOVERY, never as a plain PASS, and a failed
      // re-run keeps the original failure's status.
      const debugDir = attempt.nativeReport?.debugOutputDir
        ? join(REPORT_DIR, basename(attempt.nativeReport.debugOutputDir))
        : null;
      const errorMessages = debugDir ? findFlowErrorMessages(debugDir, flow) : [];
      const liveness = probeAppProcess(simulators[0]);
      const crashReportScan = scanCrashReports(DIAGNOSTIC_REPORTS_DIR, attempt.attemptStartedMs);
      const gate = decideLaunchRaceRecovery({
        errorMessages,
        appProcessAlive: liveness.alive,
        crashReportScan,
      });
      diagnosticEvidence = { errorMessages, liveness, crashReportScan, gate };
      if (gate.eligible) {
        console.warn(
          `Launch-race recovery for ${flow}: ${gate.reason}. One full re-run will decide this flow.`,
        );
        const second = attemptFlow();
        const secondStatus = attemptStatus({
          passed: second.passed,
          nativeReportStatus: second.nativeReport?.status,
        });
        launchRaceRecovery = {
          reason: gate.reason,
          evidence: diagnosticEvidence,
          firstAttempt: {
            exitCode: attempt.run.status,
            nativeReport: attempt.nativeReportName,
            status,
            diagnosticLog,
          },
          secondAttempt: {
            exitCode: second.run.status,
            nativeReport: second.nativeReportName,
            status: secondStatus,
          },
          recovered: second.passed,
        };
        if (second.passed) {
          attempt = second;
          status = 'PASS_AFTER_LAUNCH_RACE_RECOVERY';
        } else {
          // The recovery did not rescue this flow: the recorded status stays
          // the FIRST attempt's failure, and both attempts stay in the report.
          try {
            launchRaceRecovery.secondDiagnosticLog = captureFailureDiagnostics(
              second.nativeReport,
              simulators[0],
            );
          } catch {
            // Best-effort; the first attempt's diagnostics already exist.
          }
        }
      }
    }

    report.flows.push({
      path: flow,
      status,
      exitCode: attempt.run.status,
      nativeReport: attempt.nativeReportName,
      error: attempt.run.error?.message ?? null,
      diagnosticLog,
      diagnosticEvidence,
      launchRaceRecovery,
    });
    writeReport(report, reportPath);
    if (
      attempt.nativeReport?.classification === 'ENVIRONMENT' ||
      attempt.nativeReport?.timedOut === true
    )
      break;
  }

  // Every recovery ATTEMPT is listed (recovered or not) so a retry is always
  // visible evidence, never a silent step.
  report.launchRaceRecoveries = report.flows
    .filter((flow) => flow.launchRaceRecovery)
    .map((flow) => ({
      path: flow.path,
      reason: flow.launchRaceRecovery.reason,
      recovered: flow.launchRaceRecovery.recovered,
    }));
  report.sourceUnchangedApartFromGeneratedIos = sourceUnchangedApartFromGeneratedIos();
  report.status = resolveLaneStatus({
    flowStatuses: report.flows.map((flow) => flow.status),
    expectedCount: flows.length,
    subset,
    sourceUnchanged: report.sourceUnchangedApartFromGeneratedIos,
  });
  report.completedAt = new Date().toISOString();
  writeReport(report, reportPath);
  writeSummary(report, reportPath);
  console.log(`iOS provenance report: ${reportPath}`);
  console.log(JSON.stringify(report, null, 2));
  if (!['PASS', 'PASS_WITH_LAUNCH_RACE_RECOVERY', 'SUBSET_PASS'].includes(report.status)) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(
    `iOS certification stopped: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
});
