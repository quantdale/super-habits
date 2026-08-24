/**
 * Run the focused Maestro native QA lane with actionable local preflight.
 *
 * Android runs auto-provision the current credential-free E2E APK when the
 * selected target is missing or has stale provenance. iOS remains a
 * preinstalled/cloud path because Windows cannot build it locally.
 *
 * Examples:
 *   npm run qa:native:android
 *   npm run qa:native:ios
 *   node scripts/qa-native.mjs --platform android --tag lifecycle
 *   node scripts/qa-native.mjs --platform android --flow .maestro/flows/native-smoke.yaml
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  parseAndroidProperties,
  parsePackageIdentity,
  selectAndroidDevice,
} from './native-qa-utils.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const APP_ID = 'com.dale16.superhabits';
const REPORT_DIR = resolve(ROOT, 'simulation-output', 'native');
const BUILD_METADATA_PATH = resolve(REPORT_DIR, 'native-android-build.json');
const E2E_ENV_NAME = 'EXPO_PUBLIC_HABIT_REMINDER_E2E_TEST';
const FAILURE_CLASSES = [
  'PRODUCT_BUG',
  'TEST_BUG',
  'FLAKY_TEST',
  'ENVIRONMENT',
  'EXPECTED_KNOWN_GAP',
  'SPEC_AMBIGUITY',
];

function parseArgs(argv) {
  const args = {
    platform: process.env.NATIVE_PLATFORM ?? 'android',
    tag: null,
    flow: null,
    serial: process.env.NATIVE_ANDROID_SERIAL ?? process.env.ANDROID_SERIAL ?? null,
    provision: process.env.NATIVE_AUTO_PROVISION !== '0',
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--platform') args.platform = argv[++i];
    else if (arg === '--tag') args.tag = argv[++i];
    else if (arg === '--flow') args.flow = argv[++i];
    else if (arg === '--serial') args.serial = argv[++i];
    else if (arg === '--provision') args.provision = true;
    else if (arg === '--no-provision') args.provision = false;
    else if (arg === '--help' || arg === '-h') {
      console.log(
        'Usage: node scripts/qa-native.mjs [--platform android|ios|all] [--tag TAG] [--flow PATH] [--serial SERIAL] [--no-provision]',
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
  const names =
    process.platform === 'win32' ? [`${command}.cmd`, `${command}.bat`, command] : [command];
  if (process.platform !== 'win32') return names;

  // A long-running Codex/IDE process can retain the PATH that existed before
  // a user-level installer updated HKCU\Environment. Read that persisted
  // PATH as a fallback so normal Windows installs remain discoverable without
  // committing a machine-specific path or injecting one into every command.
  const currentPath = process.env.PATH ?? process.env.Path ?? '';
  const persistedPath = readPersistedWindowsUserPath();
  const directories = [...currentPath.split(';'), ...persistedPath.split(';')]
    .map((entry) => entry.trim())
    .filter(Boolean);
  const absoluteCandidates = directories.flatMap((directory) =>
    names.map((name) => join(directory, name)),
  );
  return [...new Set([...names, ...absoluteCandidates])];
}

function readPersistedWindowsUserPath() {
  try {
    const result = spawnSync(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        "[Environment]::GetEnvironmentVariable('Path', 'User')",
      ],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    );
    return result.status === 0 ? String(result.stdout ?? '').trim() : '';
  } catch {
    return '';
  }
}

function findCommand(command) {
  for (const candidate of commandCandidates(command)) {
    const useWindowsBatchShell = process.platform === 'win32' && /\.(?:cmd|bat)$/i.test(candidate);
    for (const versionArgs of [['--version'], ['-v']]) {
      const spawnCommand = useWindowsBatchShell
        ? [quoteWindowsShellArg(candidate), ...versionArgs].join(' ')
        : candidate;
      const result = spawnSync(spawnCommand, useWindowsBatchShell ? [] : versionArgs, {
        cwd: ROOT,
        stdio: 'ignore',
        shell: useWindowsBatchShell,
      });
      if (!result.error && result.status === 0) return candidate;
    }
  }
  return null;
}

function quoteWindowsShellArg(value) {
  const text = String(value);
  return /[\s"]/.test(text) ? `"${text.replaceAll('"', '\\"')}"` : text;
}

function run(command, args, options = {}) {
  const useWindowsBatchShell = process.platform === 'win32' && /\.(?:cmd|bat)$/i.test(command);
  const spawnCommand = useWindowsBatchShell
    ? [command, ...args].map(quoteWindowsShellArg).join(' ')
    : command;
  const spawnArgs = useWindowsBatchShell ? [] : args;
  const result = spawnSync(spawnCommand, spawnArgs, {
    cwd: ROOT,
    encoding: 'utf8',
    shell: useWindowsBatchShell,
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

function readBuildMetadata() {
  if (!existsSync(BUILD_METADATA_PATH)) return null;
  try {
    return JSON.parse(readFileSync(BUILD_METADATA_PATH, 'utf8'));
  } catch {
    return null;
  }
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

function provisionAndroid(serial) {
  const command = process.execPath;
  const args = [resolve(ROOT, 'scripts/qa-native-provision.mjs'), '--serial', serial];
  console.log(
    `Android E2E package is absent or stale; provisioning current source with ${command} ${args.slice(1).join(' ')}`,
  );
  const result = run(command, args, { stdio: 'inherit' });
  if (result.status !== 0) {
    return {
      blocked: `Current-source Android E2E provisioning failed with exit code ${result.status}.`,
      remediation:
        'Inspect the provisioning report under simulation-output/native and replay npm run qa:native:provision -- --serial <serial>.',
    };
  }
  return null;
}

function checkTarget(platform, options) {
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
    let selected;
    try {
      selected = selectAndroidDevice(devices.stdout, options.serial);
    } catch (error) {
      return {
        blocked: error instanceof Error ? error.message : String(error),
        remediation:
          'Start one Android E2E emulator or set ANDROID_SERIAL/NATIVE_ANDROID_SERIAL to the intended target.',
      };
    }
    const serial = selected.serial;
    const targetProperties = run(adb, ['-s', serial, 'shell', 'getprop']);
    if (targetProperties.status !== 0) {
      return {
        blocked: `Could not inspect Android target '${serial}'.`,
        remediation: `Replay adb -s ${serial} shell getprop and inspect the native environment.`,
      };
    }
    const properties = parseAndroidProperties(targetProperties.stdout);
    const targetIdentity = {
      serial,
      api: properties['ro.build.version.sdk'] ?? null,
      abi: properties['ro.product.cpu.abi'] ?? null,
      avd: properties['ro.boot.qemu.avd_name'] ?? null,
    };
    if (targetIdentity.api !== '36' || targetIdentity.abi !== 'x86_64') {
      return {
        blocked: `The local Android qualification path requires API 36 x86_64; target '${serial}' reports API ${targetIdentity.api ?? 'unknown'} / ABI ${targetIdentity.abi ?? 'unknown'}.`,
        remediation:
          'Boot the documented Nitro_API_36 x86_64 emulator or use the EAS native-e2e workflow.',
      };
    }
    const currentSha = gitSha();
    let metadata = readBuildMetadata();
    let installed = run(adb, ['-s', serial, 'shell', 'pm', 'path', APP_ID]);
    let packageInstalled = installed.status === 0 && installed.stdout.includes('package:');
    const metadataMatches = () =>
      metadata?.status === 'PASS' &&
      metadata.appId === APP_ID &&
      metadata.sourceSha === currentSha &&
      metadata.target?.serial === serial &&
      metadata.target?.api === targetIdentity.api &&
      metadata.target?.abi === targetIdentity.abi &&
      metadata.e2eEnvironment?.[E2E_ENV_NAME] === 'true';
    if ((!packageInstalled || !metadataMatches()) && options.provision) {
      const provisioningBlock = provisionAndroid(serial);
      if (provisioningBlock) return provisioningBlock;
      metadata = readBuildMetadata();
      installed = run(adb, ['-s', serial, 'shell', 'pm', 'path', APP_ID]);
      packageInstalled = installed.status === 0 && installed.stdout.includes('package:');
    }
    if (!packageInstalled) {
      return {
        blocked: `${APP_ID} is not installed on Android target '${serial}'.`,
        remediation:
          'Run npm run qa:native:provision -- --serial <serial>, or allow automatic provisioning by omitting --no-provision.',
      };
    }
    const packageDetails = run(adb, ['-s', serial, 'shell', 'dumpsys', 'package', APP_ID]);
    const packageIdentity = parsePackageIdentity(packageDetails.stdout, APP_ID);
    if (!packageIdentity.present) {
      return {
        blocked: `ADB could not verify the installed package identity for ${APP_ID} on '${serial}'.`,
        remediation: 'Rebuild/install the current e2e-test equivalent and rerun the same command.',
      };
    }
    if (!metadataMatches()) {
      return {
        blocked: `Installed Android build identity does not match current source ${currentSha ?? '<unknown SHA>'}.`,
        remediation:
          'Allow automatic provisioning or run npm run qa:native:provision -- --force --serial <serial>.',
      };
    }
    if (metadata.versionName && metadata.versionName !== packageIdentity.versionName) {
      return {
        blocked: `Installed ${APP_ID} version ${packageIdentity.versionName ?? '<unknown>'} does not match provisioned version ${metadata.versionName}.`,
        remediation: 'Rebuild/install the current e2e-test equivalent and rerun the same command.',
      };
    }
    if (
      metadata.versionCode !== null &&
      metadata.versionCode !== undefined &&
      metadata.versionCode !== packageIdentity.versionCode
    ) {
      return {
        blocked: `Installed ${APP_ID} version code ${packageIdentity.versionCode ?? '<unknown>'} does not match provisioned version code ${metadata.versionCode}.`,
        remediation: 'Rebuild/install the current e2e-test equivalent and rerun the same command.',
      };
    }
    return {
      command: maestro,
      target: `android ${serial}`,
      serial,
      targetIdentity,
      packageIdentity,
      buildMetadata: metadata,
    };
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

  const target = checkTarget(platform, options);
  if (target.blocked) {
    return blocked(platform, options.tag, options.replayCommand, target.blocked, {
      flow: options.flow ?? '.maestro',
      remediation: target.remediation,
    });
  }

  const args = ['test', '--no-ansi', '--reinstall-driver'];
  if (target.serial) args.push('--device', target.serial);
  args.push(flow);
  if (options.tag) args.push(`--include-tags=${options.tag}`);
  console.log(`Running native ${platform} QA on ${target.target}: maestro ${args.join(' ')}`);
  const result = run(target.command, args, {
    stdio: 'inherit',
    env: target.serial
      ? {
          ...process.env,
          ANDROID_SERIAL: target.serial,
          NATIVE_ANDROID_SERIAL: target.serial,
        }
      : undefined,
  });
  const report = {
    schemaVersion: 1,
    status: result.status === 0 ? 'PASS' : 'FAILED_NEEDS_TRIAGE',
    classification: null,
    failureClasses: FAILURE_CLASSES,
    platform,
    appId: APP_ID,
    target: target.target,
    targetIdentity: target.targetIdentity ?? null,
    packageIdentity: target.packageIdentity ?? null,
    buildMetadata: target.buildMetadata ?? null,
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
  if (options.serial) command.push(`--serial ${options.serial}`);
  if (!options.provision) command.push('--no-provision');
  options.replayCommand = command.join(' ');
  let exitCode = 0;
  for (const platform of platforms) exitCode = Math.max(exitCode, runPlatform(platform, options));
  process.exit(exitCode);
} catch (error) {
  console.error(
    `Native QA configuration error: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
}
