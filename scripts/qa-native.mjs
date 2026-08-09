/**
 * Run the focused Maestro native QA lane with actionable local preflight.
 *
 * This command intentionally does not build, install, submit, or publish an
 * app. A local target must already have the E2E build installed. EAS installs
 * the build for its Maestro job separately.
 *
 * Examples:
 *   npm run qa:native:android
 *   npm run qa:native:ios
 *   node scripts/qa-native.mjs --platform android --tag lifecycle
 *   node scripts/qa-native.mjs --platform android --flow .maestro/flows/native-smoke.yaml
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const APP_ID = 'com.dale16.superhabits';
const REPORT_DIR = resolve(ROOT, 'simulation-output', 'native');
const FAILURE_CLASSES = [
  'PRODUCT_BUG',
  'TEST_BUG',
  'FLAKY_TEST',
  'ENVIRONMENT',
  'EXPECTED_KNOWN_GAP',
  'SPEC_AMBIGUITY',
];

function parseArgs(argv) {
  const args = { platform: process.env.NATIVE_PLATFORM ?? 'android', tag: null, flow: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--platform') args.platform = argv[++i];
    else if (arg === '--tag') args.tag = argv[++i];
    else if (arg === '--flow') args.flow = argv[++i];
    else if (arg === '--help' || arg === '-h') {
      console.log(
        'Usage: node scripts/qa-native.mjs [--platform android|ios|all] [--tag TAG] [--flow PATH]',
      );
      process.exit(0);
    } else {
      throw new Error(`Unknown argument '${arg}'. Use --help for usage.`);
    }
  }
  if (!['android', 'ios', 'all'].includes(args.platform)) {
    throw new Error(`Unsupported native platform '${args.platform}'. Use android, ios, or all.`);
  }
  if (args.tag && !/^[a-z0-9_-]+$/i.test(args.tag)) {
    throw new Error(`Invalid Maestro tag '${args.tag}'.`);
  }
  return args;
}

function commandCandidates(command) {
  return process.platform === 'win32' ? [`${command}.cmd`, `${command}.bat`, command] : [command];
}

function findCommand(command) {
  for (const candidate of commandCandidates(command)) {
    const result = spawnSync(candidate, ['--version'], {
      cwd: ROOT,
      stdio: 'ignore',
      shell: false,
    });
    if (!result.error && result.status === 0) return candidate;
  }
  return null;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    encoding: 'utf8',
    shell: false,
    ...options,
  });
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    error: result.error?.message ?? null,
  };
}

function gitSha() {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

function reportPath(platform, tag) {
  const stamp = new Date().toISOString().replaceAll(':', '').replaceAll('.', '');
  return resolve(REPORT_DIR, `native-${platform}-${tag ?? 'all'}-${stamp}.json`);
}

function writeReport(report) {
  mkdirSync(REPORT_DIR, { recursive: true });
  const path = reportPath(report.platform, report.tag);
  writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`Native QA report: ${path}`);
}

function blocked(platform, tag, replayCommand, reason, details) {
  const report = {
    schemaVersion: 1,
    status: 'BLOCKED',
    classification: 'ENVIRONMENT',
    failureClasses: FAILURE_CLASSES,
    platform,
    appId: APP_ID,
    tag,
    flow: details.flow,
    gitSha: gitSha(),
    reason,
    details,
    replayCommand,
    capturedAt: new Date().toISOString(),
  };
  console.error(`Native QA blocked [ENVIRONMENT]: ${reason}`);
  if (details.remediation) console.error(`Remediation: ${details.remediation}`);
  writeReport(report);
  return 2;
}

function checkTarget(platform) {
  const maestro = findCommand('maestro');
  if (!maestro) {
    return {
      blocked: 'Maestro CLI is not installed or not on PATH.',
      remediation: 'Install Maestro, then rerun the same command.',
    };
  }

  if (platform === 'android') {
    const adb = findCommand('adb');
    if (!adb) {
      return {
        blocked: 'Android adb is not installed or not on PATH.',
        remediation:
          'Install Android SDK platform-tools and start an emulator or connect a device.',
      };
    }
    const devices = run(adb, ['devices']);
    const connected = devices.stdout.split(/\r?\n/).some((line) => line.endsWith('\tdevice'));
    if (!connected) {
      return {
        blocked: 'No booted Android emulator/device is available.',
        remediation:
          'Start an Android E2E emulator, install the E2E APK, and rerun the same command.',
      };
    }
    const installed = run(adb, ['shell', 'pm', 'path', APP_ID]);
    if (installed.status !== 0 || !installed.stdout.includes('package:')) {
      return {
        blocked: `${APP_ID} is not installed on the connected Android target.`,
        remediation: 'Build/install the e2e-test APK, then rerun the same command.',
      };
    }
    return { command: maestro, target: 'android device' };
  }

  const xcrun = findCommand('xcrun');
  if (!xcrun) {
    return {
      blocked: 'Xcode xcrun/simctl is unavailable on this host.',
      remediation: 'Run on macOS with Xcode or use the EAS native-e2e workflow for iOS.',
    };
  }
  const devices = run(xcrun, ['simctl', 'list', 'devices', 'booted']);
  if (!/Booted/.test(devices.stdout)) {
    return {
      blocked: 'No booted iOS simulator is available.',
      remediation: 'Boot an iOS simulator or use the EAS native-e2e workflow.',
    };
  }
  const installed = run(xcrun, ['simctl', 'get_app_container', 'booted', APP_ID]);
  if (installed.status !== 0) {
    return {
      blocked: `${APP_ID} is not installed on the booted iOS simulator.`,
      remediation: 'Build/install the e2e-test simulator app, then rerun the same command.',
    };
  }
  return { command: maestro, target: 'iOS simulator' };
}

function runPlatform(platform, options) {
  const flow = options.flow ? resolve(ROOT, options.flow) : resolve(ROOT, '.maestro');
  if (options.flow) {
    try {
      readFileSync(flow);
    } catch {
      return blocked(
        platform,
        options.tag,
        options.replayCommand,
        `Maestro flow does not exist: ${options.flow}`,
        {
          flow: options.flow,
          remediation: 'Choose a flow under .maestro/flows or omit --flow to use the workspace.',
        },
      );
    }
  }

  const target = checkTarget(platform);
  if (target.blocked) {
    return blocked(platform, options.tag, options.replayCommand, target.blocked, {
      flow: options.flow ?? '.maestro',
      remediation: target.remediation,
    });
  }

  const args = ['test', flow];
  if (options.tag) args.push(`--include-tags=${options.tag}`);
  console.log(`Running native ${platform} QA on ${target.target}: maestro ${args.join(' ')}`);
  const result = run(target.command, args, { stdio: 'inherit' });
  const report = {
    schemaVersion: 1,
    status: result.status === 0 ? 'PASS' : 'FAILED_NEEDS_TRIAGE',
    classification: null,
    failureClasses: FAILURE_CLASSES,
    platform,
    appId: APP_ID,
    target: target.target,
    tag: options.tag,
    flow: options.flow ?? '.maestro',
    gitSha: gitSha(),
    replayCommand: options.replayCommand,
    exitCode: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
    capturedAt: new Date().toISOString(),
  };
  writeReport(report);
  if (result.status !== 0) {
    console.error(
      'Native QA failed without an automatic classification. Preserve artifacts, replay, and classify with evidence.',
    );
  }
  return result.status === 0 ? 0 : 1;
}

try {
  const options = parseArgs(process.argv.slice(2));
  const platforms = options.platform === 'all' ? ['android', 'ios'] : [options.platform];
  const command = ['npm run qa:native', `-- --platform ${options.platform}`];
  if (options.tag) command.push(`--tag ${options.tag}`);
  if (options.flow) command.push(`--flow ${options.flow}`);
  options.replayCommand = command.join('');
  let exitCode = 0;
  for (const platform of platforms) exitCode = Math.max(exitCode, runPlatform(platform, options));
  process.exit(exitCode);
} catch (error) {
  console.error(
    `Native QA configuration error: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
}
