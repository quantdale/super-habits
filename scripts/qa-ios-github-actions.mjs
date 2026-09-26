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
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const REPORT_DIR = join(ROOT, 'simulation-output', 'native');
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
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${lines.join('\n')}\n`);
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
  return `${basename(debugDir)}/simulator-app.log`;
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
  const flows = iosFlows();
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
    expectedFlowCount: flows.length,
    flows: [],
    capturedAt: new Date().toISOString(),
  };
  writeReport(report, reportPath);

  for (const flow of flows) {
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
    const passed =
      run.status === 0 && nativeReport?.status === 'PASS' && nativeReport.gitSha === sourceSha;
    let diagnosticLog = null;
    if (!passed) {
      try {
        diagnosticLog = captureFailureDiagnostics(nativeReport, simulators[0]);
      } catch (error) {
        console.warn(
          `Simulator log capture failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    report.flows.push({
      path: flow,
      status: passed ? 'PASS' : (nativeReport?.status ?? 'NOT_REPORTED'),
      exitCode: run.status,
      nativeReport: newReports.length === 1 ? newReports[0] : null,
      error: run.error?.message ?? null,
      diagnosticLog,
    });
    writeReport(report, reportPath);
    if (nativeReport?.classification === 'ENVIRONMENT') break;
  }

  report.status =
    report.flows.length === flows.length && report.flows.every((flow) => flow.status === 'PASS')
      ? 'PASS'
      : 'NOT_CERTIFIED';
  report.sourceUnchangedApartFromGeneratedIos = sourceUnchangedApartFromGeneratedIos();
  if (!report.sourceUnchangedApartFromGeneratedIos) report.status = 'NOT_CERTIFIED';
  report.completedAt = new Date().toISOString();
  writeReport(report, reportPath);
  writeSummary(report, reportPath);
  console.log(`iOS provenance report: ${reportPath}`);
  console.log(JSON.stringify(report, null, 2));
  if (report.status !== 'PASS') process.exitCode = 1;
}

main().catch((error) => {
  console.error(
    `iOS certification stopped: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
});
