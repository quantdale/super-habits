import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { runNativeCommand } from './qa-native-process.mjs';

export const IOS_SIMCTL_TIMEOUT_MS = 150_000;
export const IOS_SIMULATOR_APP_ID = 'com.dale16.superhabits';

const IOS_DIAGNOSTIC_COMMANDS = [
  {
    name: 'booted-devices',
    args: (_simulatorId, _appId, _screenshotPath) => ['simctl', 'list', 'devices', 'booted'],
    timeoutMs: 15_000,
  },
  {
    name: 'installed-app-container',
    args: (simulatorId, appId) => ['simctl', 'get_app_container', simulatorId, appId],
    timeoutMs: 15_000,
  },
  {
    name: 'recent-app-log',
    args: (simulatorId) => [
      'simctl',
      'spawn',
      simulatorId,
      'log',
      'show',
      '--last',
      '2m',
      '--style',
      'compact',
      '--predicate',
      'process == "SuperHabits"',
    ],
    timeoutMs: 30_000,
    maxBuffer: 4 * 1024 * 1024,
  },
  {
    name: 'screenshot',
    args: (simulatorId, _appId, screenshotPath) => [
      'simctl',
      'io',
      simulatorId,
      'screenshot',
      screenshotPath,
    ],
    timeoutMs: 30_000,
  },
];

function requireString(name, value) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${name} is required.`);
  }
}

export function buildIosSimctlInvocation(operation, options = {}) {
  const {
    simulatorId = process.env.IOS_SIMULATOR_ID,
    appPath = process.env.IOS_APP_PATH,
    appId = IOS_SIMULATOR_APP_ID,
  } = options;
  requireString('IOS_SIMULATOR_ID', simulatorId);

  if (operation === 'install') {
    requireString('IOS_APP_PATH', appPath);
    return { command: 'xcrun', args: ['simctl', 'install', simulatorId, appPath] };
  }

  if (operation === 'launch') {
    requireString('bundle identifier', appId);
    return { command: 'xcrun', args: ['simctl', 'launch', simulatorId, appId] };
  }

  throw new Error(`Unsupported iOS simulator operation: ${operation}`);
}

export function runIosSimctlOperation(operation, options = {}) {
  const {
    timeoutMs = IOS_SIMCTL_TIMEOUT_MS,
    runCommand = runNativeCommand,
    now = () => new Date().toISOString(),
    clock = () => performance.now(),
    ...invocationOptions
  } = options;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new RangeError('timeoutMs must be a positive finite number.');
  }

  const invocation = buildIosSimctlInvocation(operation, invocationOptions);
  const startedAt = now();
  const started = clock();
  const result = runCommand(invocation.command, invocation.args, { timeoutMs });
  const durationMs = Math.max(0, Math.round(clock() - started));
  const timedOut = Boolean(result.timedOut);

  return {
    operation,
    command: invocation.command,
    args: invocation.args,
    timeoutMs,
    startedAt,
    completedAt: now(),
    durationMs,
    status: result.status ?? 1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    error: result.error ?? null,
    timedOut,
    success: !timedOut && result.status === 0,
  };
}

export function runIosSimulatorDiagnostics(options = {}) {
  const {
    simulatorId = process.env.IOS_SIMULATOR_ID,
    appId = IOS_SIMULATOR_APP_ID,
    screenshotPath,
    runCommand = runNativeCommand,
    now = () => new Date().toISOString(),
    clock = () => performance.now(),
  } = options;
  requireString('IOS_SIMULATOR_ID', simulatorId);
  requireString('screenshotPath', screenshotPath);

  const commands = IOS_DIAGNOSTIC_COMMANDS.map((diagnostic) => ({
    name: diagnostic.name,
    command: 'xcrun',
    args: diagnostic.args(simulatorId, appId, screenshotPath),
    timeoutMs: diagnostic.timeoutMs,
    ...(diagnostic.maxBuffer ? { maxBuffer: diagnostic.maxBuffer } : {}),
  }));
  const startedAt = now();
  const started = clock();
  const results = commands.map((command) => {
    const commandStartedAt = now();
    const commandStarted = clock();
    const result = runCommand(command.command, command.args, {
      timeoutMs: command.timeoutMs,
      ...(command.maxBuffer ? { maxBuffer: command.maxBuffer } : {}),
    });
    return {
      name: command.name,
      command: command.command,
      args: command.args,
      timeoutMs: command.timeoutMs,
      startedAt: commandStartedAt,
      completedAt: now(),
      durationMs: Math.max(0, Math.round(clock() - commandStarted)),
      status: result.status ?? 1,
      stdout: result.stdout ?? '',
      stderr: result.stderr ?? '',
      error: result.error ?? null,
      timedOut: Boolean(result.timedOut),
      success: !result.timedOut && result.status === 0,
    };
  });

  return {
    simulatorId,
    appId,
    screenshotPath,
    startedAt,
    completedAt: now(),
    durationMs: Math.max(0, Math.round(clock() - started)),
    commands: results,
  };
}

export function writeIosSimctlEvidence(report, options = {}) {
  const {
    outputDirectory = path.resolve('simulation-output/native'),
    runId = process.env.GITHUB_RUN_ID ?? 'local',
    attempt = process.env.GITHUB_RUN_ATTEMPT ?? '1',
  } = options;
  mkdirSync(outputDirectory, { recursive: true });
  const outputPath = path.join(
    outputDirectory,
    `ios-simctl-${report.operation ?? 'diagnostics'}-${runId}-${attempt}.json`,
  );
  writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return outputPath;
}

function logCommandResult(result) {
  console.log(
    `[ios-simctl] ${result.operation} ${result.success ? 'PASS' : 'FAIL'} ` +
      `status=${result.status} timedOut=${result.timedOut} durationMs=${result.durationMs}`,
  );
  if (result.stdout)
    process.stdout.write(result.stdout.endsWith('\n') ? result.stdout : `${result.stdout}\n`);
  if (result.stderr)
    process.stderr.write(result.stderr.endsWith('\n') ? result.stderr : `${result.stderr}\n`);
  if (result.error) console.error(`[ios-simctl] ${result.error}`);
}

function main() {
  const operation = process.argv[2];
  const runId = process.env.GITHUB_RUN_ID ?? 'local';
  const attempt = process.env.GITHUB_RUN_ATTEMPT ?? '1';
  const evidenceDirectory = path.resolve('simulation-output/native');

  try {
    if (operation === 'diagnostics') {
      const screenshotDirectory = path.join(evidenceDirectory, `debug-ios-${runId}-${attempt}`);
      mkdirSync(screenshotDirectory, { recursive: true });
      const report = runIosSimulatorDiagnostics({
        screenshotPath: path.join(screenshotDirectory, 'simulator-screenshot.png'),
      });
      const reportPath = writeIosSimctlEvidence(report, {
        outputDirectory: evidenceDirectory,
        runId,
        attempt,
      });
      for (const command of report.commands) {
        console.log(
          `[ios-simctl] diagnostics ${command.name} ` +
            `${command.success ? 'PASS' : 'FAIL'} status=${command.status} ` +
            `timedOut=${command.timedOut} durationMs=${command.durationMs}`,
        );
      }
      console.log(`[ios-simctl] diagnostics evidence: ${reportPath}`);
      return 0;
    }

    if (operation !== 'install' && operation !== 'launch') {
      console.error('Usage: node scripts/qa-ios-simctl.mjs <install|launch|diagnostics>');
      return 2;
    }

    const invocation = buildIosSimctlInvocation(operation);
    console.log(
      `[ios-simctl] ${operation} start: ${invocation.command} ${invocation.args.join(' ')} ` +
        `(timeout=${IOS_SIMCTL_TIMEOUT_MS}ms)`,
    );
    const report = runIosSimctlOperation(operation);
    const reportPath = writeIosSimctlEvidence(report, {
      outputDirectory: evidenceDirectory,
      runId,
      attempt,
    });
    logCommandResult(report);
    console.log(`[ios-simctl] evidence: ${reportPath}`);
    return report.success ? 0 : 1;
  } catch (error) {
    console.error(`[ios-simctl] ${error instanceof Error ? error.message : String(error)}`);
    return 2;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  process.exitCode = main();
}
