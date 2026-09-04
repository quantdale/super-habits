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
 *   node scripts/qa-native.mjs --platform android --tag smoke --avd Nitro_API_36 --avd CRBABot_API_36
 *   node scripts/qa-native.mjs --list-avds
 */
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  parseAdbDevices,
  parseAndroidProperties,
  parsePackageIdentity,
  selectAndroidDevice,
} from './native-qa-utils.mjs';
import { readGitProvenance } from './native-provenance.mjs';
import {
  assertMockProof,
  interpretDeviceProbe,
  isPidAlive,
  mockSliceTouched,
  parseMockLog,
  reverseSpecPresent,
  buildTargetRunRecord,
  findNewEmulatorSerial,
  isBootReady,
  matchConnectedAvd,
  parseAvdListOutput,
  planAvdSequence,
  summarizeTargetRuns,
  targetLabel,
} from './native-avd.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const APP_ID = 'com.dale16.superhabits';
const REPORT_DIR = resolve(ROOT, 'simulation-output', 'native');
const BUILD_METADATA_PATH = resolve(REPORT_DIR, 'native-android-build.json');
const MOCK_METADATA_PATH = resolve(REPORT_DIR, 'native-android-build-mock.json');
const MOCK_SERVER_SCRIPT = resolve(ROOT, 'scripts', 'native-auth-mock-server.mjs');
// Device-loopback literal (not `localhost`): Android may resolve `localhost`
// to ::1 first and only fall back to 127.0.0.1, adding nondeterministic
// per-request failure modes under `adb reverse`. The literal is proven.
const MOCK_DEVICE_HOST = '127.0.0.1';
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
    avds: [],
    listAvds: false,
    bootTimeoutMs: 300000,
    noStop: false,
    reset: false,
    authMock: false,
    authMockPort: 4545,
    buildMetadata: null,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--platform') args.platform = argv[++i];
    else if (arg === '--tag') args.tag = argv[++i];
    else if (arg === '--flow') args.flow = argv[++i];
    else if (arg === '--serial') args.serial = argv[++i];
    else if (arg === '--provision') args.provision = true;
    else if (arg === '--no-provision') args.provision = false;
    else if (arg === '--avd') {
      const value = argv[++i] ?? '';
      for (const name of String(value).split(',')) {
        const trimmed = name.trim();
        if (trimmed) args.avds.push(trimmed);
      }
    } else if (arg === '--list-avds') args.listAvds = true;
    else if (arg === '--boot-timeout') {
      const seconds = Number(argv[++i]);
      if (!Number.isFinite(seconds) || seconds <= 0) {
        throw new Error(`Invalid --boot-timeout '${argv[i]}'. Pass a positive number of seconds.`);
      }
      args.bootTimeoutMs = Math.round(seconds * 1000);
    } else if (arg === '--no-stop') args.noStop = true;
    else if (arg === '--reset') args.reset = true;
    else if (arg === '--no-reset') args.reset = false;
    else if (arg === '--auth-mock') args.authMock = true;
    else if (arg === '--auth-mock-port') {
      const port = Number(argv[++i]);
      if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new Error(`Invalid --auth-mock-port '${argv[i]}'. Pass an integer 1..65535.`);
      }
      args.authMockPort = port;
      args.authMock = true;
    } else if (arg === '--build-metadata') args.buildMetadata = argv[++i];
    else if (arg === '--help' || arg === '-h') {
      console.log(
        'Usage: node scripts/qa-native.mjs [--platform android|ios|all] [--tag TAG] [--flow PATH] [--serial SERIAL] [--no-provision] [--avd NAME ...] [--list-avds] [--boot-timeout SECONDS] [--no-stop] [--reset] [--auth-mock] [--auth-mock-port PORT] [--build-metadata PATH]',
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

function reportPath(platform, tag, label = null) {
  const stamp = new Date().toISOString().replaceAll(':', '').replaceAll('.', '');
  const infix = label ? `-${label}` : '';
  return resolve(REPORT_DIR, `native-${platform}-${tag ?? 'all'}${infix}-${stamp}.json`);
}

function writeReport(report) {
  mkdirSync(REPORT_DIR, { recursive: true });
  const path = reportPath(report.platform, report.tag, report.targetLabel ?? null);
  writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`Native QA report: ${path}`);
  return path;
}

function deviceAuthMockUrl(options) {
  return `http://${MOCK_DEVICE_HOST}:${options.authMockPort}`;
}

function metadataPathFor(options) {
  if (options.buildMetadata) return resolve(ROOT, options.buildMetadata);
  return options.authMock ? MOCK_METADATA_PATH : BUILD_METADATA_PATH;
}

function readBuildMetadata(metadataPath = BUILD_METADATA_PATH) {
  if (!existsSync(metadataPath)) return null;
  try {
    return JSON.parse(readFileSync(metadataPath, 'utf8'));
  } catch {
    return null;
  }
}

function blocked(platform, tag, replayCommand, reason, details) {
  const provenance = readGitProvenance(ROOT);
  const hasTargetIdentity = Boolean(details.targetLabel ?? details.avd ?? details.serial);
  const label = hasTargetIdentity
    ? (details.targetLabel ??
      targetLabel({ avd: details.avd ?? null, serial: details.serial ?? null }))
    : null;
  const report = {
    schemaVersion: 1,
    status: 'BLOCKED',
    classification: 'ENVIRONMENT',
    failureClasses: FAILURE_CLASSES,
    platform,
    appId: APP_ID,
    tag,
    flow: details.flow,
    gitSha: provenance.sourceSha,
    sourceSha: provenance.sourceSha,
    sourceTreeClean: provenance.sourceTreeClean,
    sourceTreeStatus: provenance.sourceTreeStatus,
    sourceShaError: provenance.sourceShaError,
    sourceTreeStatusError: provenance.sourceTreeStatusError,
    reason,
    targetLabel: details.targetLabel ?? label,
    avd: details.avd ?? null,
    ownedEmulator: details.ownedEmulator ?? false,
    mockState: details.mockState ?? null,
    details,
    replayCommand,
    capturedAt: new Date().toISOString(),
  };
  console.error(`Native QA blocked [ENVIRONMENT]: ${reason}`);
  if (details.remediation) console.error(`Remediation: ${details.remediation}`);
  const reportPath = writeReport(report);
  return { exitCode: 2, report, reportPath };
}

function provisionAndroid(serial, options) {
  const command = process.execPath;
  const args = [resolve(ROOT, 'scripts/qa-native-provision.mjs'), '--serial', serial];
  if (options.authMock) args.push('--mock-auth-url', deviceAuthMockUrl(options));
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
    const currentProvenance = readGitProvenance(ROOT);
    if (currentProvenance.sourceShaError || currentProvenance.sourceSha === null) {
      return {
        blocked: `Android certification requires a verifiable Git HEAD; ${currentProvenance.sourceShaError ?? 'the current SHA is unavailable'}.`,
        remediation: 'Run from a valid Git checkout and retry the native certification lane.',
      };
    }
    if (currentProvenance.sourceTreeStatusError) {
      return {
        blocked: `Android certification requires a verifiable Git working-tree status; ${currentProvenance.sourceTreeStatusError}.`,
        remediation: 'Repair Git status access, then retry the native certification lane.',
      };
    }
    if (!currentProvenance.sourceTreeClean) {
      return {
        blocked: `Android certification requires a clean Git working tree; changed entries: ${currentProvenance.sourceTreeStatus.join(', ')}.`,
        remediation:
          'Commit, stash, or reconcile tracked and relevant untracked source changes before running native certification.',
      };
    }
    const currentSha = currentProvenance.sourceSha;
    const metadataPath = metadataPathFor(options);
    let metadata = readBuildMetadata(metadataPath);
    let installed = run(adb, ['-s', serial, 'shell', 'pm', 'path', APP_ID]);
    let packageInstalled = installed.status === 0 && installed.stdout.includes('package:');
    const metadataMatches = () => {
      // Provenance separation is enforced here, not just by filename:
      // mock mode requires an explicit test-only build for this mock
      // URL, and canonical mode never accepts a test-only build.
      // Recomputed per call: provisioning refreshes `metadata` above.
      const buildKindOk = options.authMock
        ? metadata?.buildKind === 'test-only' &&
          metadata?.mockAuthUrl === deviceAuthMockUrl(options)
        : metadata?.buildKind !== 'test-only';
      return (
        metadata?.status === 'PASS' &&
        metadata.sourceTreeClean === true &&
        metadata.appId === APP_ID &&
        metadata.sourceSha === currentSha &&
        metadata.target?.serial === serial &&
        metadata.target?.api === targetIdentity.api &&
        metadata.target?.abi === targetIdentity.abi &&
        metadata.target?.avd === targetIdentity.avd &&
        metadata.e2eEnvironment?.[E2E_ENV_NAME] === 'true' &&
        buildKindOk
      );
    };
    if ((!packageInstalled || !metadataMatches()) && options.provision) {
      const provisioningBlock = provisionAndroid(serial, options);
      if (provisioningBlock) return provisioningBlock;
      metadata = readBuildMetadata(metadataPath);
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
  const avdContext = options.avdContext ?? null;
  if (target.blocked) {
    return blocked(platform, options.tag, options.replayCommand, target.blocked, {
      flow: options.flow ?? '.maestro',
      avd: avdContext?.avd ?? null,
      serial: options.serial ?? null,
      ownedEmulator: avdContext?.owned ?? false,
      remediation: target.remediation,
    });
  }

  let stateReset = false;
  if (options.reset) {
    const adb = findCommand('adb');
    const clear = run(adb, ['-s', target.serial, 'shell', 'pm', 'clear', APP_ID]);
    if (clear.status !== 0) {
      return blocked(
        platform,
        options.tag,
        options.replayCommand,
        `State reset (pm clear ${APP_ID}) failed on '${target.serial}' with exit code ${clear.status}.`,
        {
          flow: options.flow ?? '.maestro',
          avd: avdContext?.avd ?? target.targetIdentity?.avd ?? null,
          serial: target.serial,
          ownedEmulator: avdContext?.owned ?? false,
          remediation: `Replay adb -s ${target.serial} shell pm clear ${APP_ID} and inspect the target.`,
        },
      );
    }
    stateReset = true;
  }

  const label = targetLabel({
    avd: avdContext?.avd ?? target.targetIdentity?.avd ?? null,
    serial: target.serial ?? null,
  });
  const debugStamp = new Date().toISOString().replaceAll(':', '').replaceAll('.', '');
  const debugOutputDir = resolve(
    REPORT_DIR,
    `debug-${platform}-${options.tag ?? 'all'}-${label}-${debugStamp}`,
  );
  const args = ['test', '--no-ansi', '--reinstall-driver', '--debug-output', debugOutputDir];
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
    targetLabel: label,
    avd: avdContext?.avd ?? target.targetIdentity?.avd ?? null,
    ownedEmulator: avdContext?.owned ?? false,
    stateReset,
    mockState:
      options.authMock && options.authSlice
        ? mockProofSlice(options.authSlice.logPath, options.authSlice.startOffset)
        : null,
    targetIdentity: target.targetIdentity ?? null,
    packageIdentity: target.packageIdentity ?? null,
    buildMetadata: target.buildMetadata ?? null,
    tag: options.tag,
    flow: options.flow ?? '.maestro',
    debugOutputDir: debugOutputDir,
    gitSha: gitSha(),
    replayCommand: options.replayCommand,
    exitCode: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
    capturedAt: new Date().toISOString(),
  };
  const reportPath = writeReport(report);
  if (result.status !== 0) {
    console.error(
      'Native QA failed without an automatic classification. Preserve artifacts, replay, and classify with evidence.',
    );
  }
  return { exitCode: result.status === 0 ? 0 : 1, report, reportPath };
}

function sleepMs(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, Math.max(0, ms));
}

function findEmulator() {
  // `emulator --version` exits nonzero when no AVD is specified, so the
  // generic version-probe cannot discover it. `-list-avds` is read-only,
  // fast, and exits 0 exactly when the CLI is usable.
  for (const candidate of commandCandidates('emulator')) {
    const useWindowsBatchShell = process.platform === 'win32' && /\.(?:cmd|bat)$/i.test(candidate);
    const spawnCommand = useWindowsBatchShell ? quoteWindowsShellArg(candidate) : candidate;
    const result = spawnSync(
      useWindowsBatchShell ? `${spawnCommand} -list-avds` : spawnCommand,
      useWindowsBatchShell ? [] : ['-list-avds'],
      {
        cwd: ROOT,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
        shell: useWindowsBatchShell,
      },
    );
    if (!result.error && result.status === 0) return candidate;
  }
  return null;
}

function listAvdTargets() {
  const emulator = findEmulator();
  if (!emulator) {
    console.error('Android emulator CLI is not installed or not on PATH.');
    return 1;
  }
  const avds = run(emulator, ['-list-avds']);
  if (avds.status !== 0) {
    console.error(`emulator -list-avds failed (exit ${avds.status}).`);
    return 1;
  }
  const names = parseAvdListOutput(avds.stdout);
  console.log(`Configured AVDs (${names.length}):`);
  for (const name of names) console.log(`  ${name}`);
  const adb = findCommand('adb');
  if (!adb) {
    console.log('adb is not installed or not on PATH; connected targets unknown.');
    return 0;
  }
  const devices = run(adb, ['devices']);
  if (devices.status !== 0) {
    console.error(`adb devices failed (exit ${devices.status}).`);
    return 1;
  }
  console.log('Connected targets:');
  const connected = parseAdbDevices(devices.stdout);
  if (connected.length === 0) console.log('  (none)');
  for (const device of connected) {
    let avd = null;
    if (device.state === 'device') {
      const props = run(adb, ['-s', device.serial, 'shell', 'getprop']);
      if (props.status === 0) {
        avd = parseAndroidProperties(props.stdout)['ro.boot.qemu.avd_name'] ?? null;
      }
    }
    console.log(`  ${device.serial} ${device.state}${avd ? ` avd=${avd}` : ''}`);
  }
  return 0;
}

function bootOwnedEmulator(emulator, avdName) {
  const child = spawn(emulator, ['-avd', avdName, '-no-boot-anim', '-no-snapshot-save'], {
    cwd: ROOT,
    detached: true,
    stdio: 'ignore',
  });
  child.unref();
  if (child.pid == null) {
    throw new Error(`Could not start an owned emulator for AVD '${avdName}' (no process id).`);
  }
  console.log(`Booted owned emulator for AVD '${avdName}' (pid ${child.pid}).`);
  return child.pid;
}

function waitForNewSerial(adb, beforeOutput, deadlineMs) {
  for (;;) {
    const current = run(adb, ['devices']);
    if (current.status === 0) {
      const found = findNewEmulatorSerial(beforeOutput, current.stdout);
      if (found.serial) return found.serial;
      if (found.reason && !/No new connected device/.test(found.reason))
        throw new Error(found.reason);
    }
    if (Date.now() >= deadlineMs) {
      throw new Error('Timed out waiting for the booted emulator to appear in adb devices.');
    }
    sleepMs(5000);
  }
}

function waitForTargetReady(adb, serial, deadlineMs) {
  let lastReason = 'no getprop response yet';
  for (;;) {
    const props = run(adb, ['-s', serial, 'shell', 'getprop']);
    if (props.status === 0) {
      const readiness = isBootReady(parseAndroidProperties(props.stdout));
      if (readiness.ready) return;
      lastReason = readiness.reason;
    } else {
      lastReason = `getprop exited ${props.status}`;
    }
    if (Date.now() >= deadlineMs) {
      throw new Error(
        `Timed out waiting for '${serial}' to finish booting. Last state: ${lastReason}`,
      );
    }
    sleepMs(5000);
  }
}

function stopOwnedEmulator(adb, serial) {
  const kill = run(adb, ['-s', serial, 'emu', 'kill']);
  if (kill.status !== 0) {
    throw new Error(`adb emu kill failed on owned emulator '${serial}' (exit ${kill.status}).`);
  }
  const deadline = Date.now() + 60000;
  for (;;) {
    const devices = run(adb, ['devices']);
    if (devices.status === 0) {
      const stillThere = parseAdbDevices(devices.stdout).some((device) => device.serial === serial);
      if (!stillThere) return;
    }
    if (Date.now() >= deadline) {
      throw new Error(`Owned emulator '${serial}' did not disappear within 60s of emu kill.`);
    }
    sleepMs(5000);
  }
}

function isMockServing(port) {
  const probe = spawnSync(
    process.execPath,
    [
      '-e',
      `fetch('http://127.0.0.1:${port}/rest/v1/auth-mock-probe',{signal:AbortSignal.timeout(2000)}).then((response)=>process.exit(response.ok?0:1)).catch(()=>process.exit(1))`,
    ],
    { cwd: ROOT, stdio: 'ignore' },
  );
  return probe.status === 0;
}

function startAuthMockSession(options) {
  const port = options.authMockPort;
  if (isMockServing(port)) {
    throw new Error(
      `Auth-mock port ${port} is already serving; refusing to adopt a possibly stale mock. Free the port and retry.`,
    );
  }
  mkdirSync(REPORT_DIR, { recursive: true });
  const stamp = new Date().toISOString().replaceAll(':', '').replaceAll('.', '');
  const logPath = resolve(REPORT_DIR, `mock-auth-${port}-${stamp}.log`);
  const fd = openSync(logPath, 'a');
  let child;
  try {
    child = spawn(process.execPath, [MOCK_SERVER_SCRIPT, String(port)], {
      cwd: ROOT,
      stdio: ['ignore', fd, fd],
    });
  } finally {
    closeSync(fd);
  }
  if (child.pid == null) {
    throw new Error(`Could not start the owned auth-mock server (no process id); see ${logPath}.`);
  }
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if (!isPidAlive(child.pid)) {
      throw new Error(`Owned auth-mock (pid ${child.pid}) exited during startup; see ${logPath}.`);
    }
    if (isMockServing(port)) {
      console.log(`Owned auth-mock ready on :${port} (pid ${child.pid}); log ${logPath}.`);
      return { port, deviceUrl: deviceAuthMockUrl(options), logPath, child, pid: child.pid };
    }
    sleepMs(250);
  }
  try {
    child.kill('SIGTERM');
  } catch {
    // Fall through to the timeout error below.
  }
  throw new Error(`Owned auth-mock did not become ready on :${port} within 15s; see ${logPath}.`);
}

function stopAuthMockSession(session) {
  const { child, pid, port, logPath } = session;
  const tryKill = (signal) => {
    try {
      if (isPidAlive(pid)) child.kill(signal);
    } catch {
      // Rechecked below; a TOCTOU exit between probe and kill is success.
    }
  };
  if (isPidAlive(pid)) {
    tryKill('SIGTERM');
    const deadline = Date.now() + 10000;
    while (isPidAlive(pid) && Date.now() < deadline) sleepMs(250);
  }
  if (isPidAlive(pid)) {
    tryKill('SIGKILL');
    const deadline = Date.now() + 5000;
    while (isPidAlive(pid) && Date.now() < deadline) sleepMs(250);
  }
  if (isPidAlive(pid)) {
    throw new Error(`Owned auth-mock pid ${pid} did not exit; refusing to leave it running.`);
  }
  if (isMockServing(port)) {
    throw new Error(
      `Port ${port} still serves after the owned mock (pid ${pid}) exited; see ${logPath}.`,
    );
  }
  console.log(`Stopped owned auth-mock (pid ${pid}); port ${port} closed; log ${logPath}.`);
}

function ensureAuthReverse(adb, serial, port, owned = false) {
  if (owned) {
    // Owned targets boot fresh, so no legitimate forward can exist here;
    // clearing ADBD ghost state before establishing our own forward.
    const clear = run(adb, ['-s', serial, 'reverse', '--remove-all']);
    console.log(
      clear.status === 0
        ? `Cleared reverse forwards on owned '${serial}'.`
        : `Note: reverse --remove-all on '${serial}' exited ${clear.status}; continuing.`,
    );
  }
  const list = run(adb, ['-s', serial, 'reverse', '--list']);
  if (list.status === 0 && reverseSpecPresent(list.stdout, port)) {
    const stale = run(adb, ['-s', serial, 'reverse', '--remove', `tcp:${port}`]);
    if (stale.status !== 0) {
      throw new Error(
        `Could not remove stale reverse tcp:${port} on '${serial}' (exit ${stale.status}).`,
      );
    }
    console.log(`Removed stale reverse tcp:${port} on '${serial}'.`);
  }
  const forward = run(adb, ['-s', serial, 'reverse', `tcp:${port}`, `tcp:${port}`]);
  if (forward.status !== 0) {
    throw new Error(`adb reverse tcp:${port} failed on '${serial}' (exit ${forward.status}).`);
  }
  const verify = run(adb, ['-s', serial, 'reverse', '--list']);
  if (verify.status !== 0 || !reverseSpecPresent(verify.stdout, port)) {
    throw new Error(`adb reverse tcp:${port} on '${serial}' did not appear in reverse --list.`);
  }
  // The --list entry proves the forward exists, not that bytes flow
  // (stale ADBD state can list a dead forward). Probe end-to-end from
  // the device via shell /dev/tcp (no curl needed); one
  // re-establishment is allowed, then fail with the reason.
  const probeArgs = [
    '-s',
    serial,
    'shell',
    `cat < /dev/null > /dev/tcp/127.0.0.1/${port} && echo PROBE_OPEN || echo PROBE_CLOSED`,
  ];
  let probe = interpretDeviceProbe(run(adb, probeArgs));
  if (!probe.ok && !probe.skipped) {
    console.log(
      `Device connectivity probe failed (${probe.reason}); re-establishing reverse tcp:${port} once.`,
    );
    const redo = run(adb, ['-s', serial, 'reverse', `tcp:${port}`, `tcp:${port}`]);
    if (redo.status !== 0) {
      throw new Error(`adb reverse tcp:${port} retry failed on '${serial}' (exit ${redo.status}).`);
    }
    probe = interpretDeviceProbe(run(adb, probeArgs));
  }
  if (probe.skipped) {
    console.log(`Device connectivity probe skipped (${probe.reason}).`);
  } else if (!probe.ok) {
    throw new Error(
      `Device-side mock connectivity probe failed on '${serial}' (${probe.reason}); the lane would run offline.`,
    );
  } else {
    console.log(`Reverse tcp:${port} verified end-to-end on '${serial}' (device HTTP 200).`);
  }
}

function removeAuthReverse(adb, serial, port) {
  const remove = run(adb, ['-s', serial, 'reverse', '--remove', `tcp:${port}`]);
  if (remove.status !== 0) {
    throw new Error(`Could not remove reverse tcp:${port} on '${serial}' (exit ${remove.status}).`);
  }
  const verify = run(adb, ['-s', serial, 'reverse', '--list']);
  if (verify.status === 0 && reverseSpecPresent(verify.stdout, port)) {
    throw new Error(`Reverse tcp:${port} on '${serial}' persisted after removal.`);
  }
  console.log(`Reverse tcp:${port} removed on '${serial}'.`);
}

function mockLogOffset(logPath) {
  try {
    return statSync(logPath).size;
  } catch {
    return 0;
  }
}

function mockProofSlice(logPath, startOffset) {
  // The mock log is ASCII-only `[mock]` lines, so a byte offset is a safe slice point.
  let text = '';
  try {
    text = readFileSync(logPath, 'utf8').slice(startOffset);
  } catch {
    text = '';
  }
  const parsed = parseMockLog(text);
  const verdict = assertMockProof(parsed);
  return {
    ok: verdict.ok,
    reasons: verdict.reasons,
    signupCount: parsed.signupCount,
    unauthenticatedChecks: parsed.unauthenticatedChecks,
    putUserRequests: parsed.putUserRequests,
    userIds: parsed.userIds,
    verifyPermanentIds: parsed.verifyPermanentIds,
  };
}

function resolveAvdTarget(adb, emulator, avdName, bootTimeoutMs) {
  const devices = run(adb, ['devices']);
  if (devices.status !== 0) {
    throw new Error(
      `adb devices failed (exit ${devices.status}) while resolving AVD '${avdName}'.`,
    );
  }
  const known = [];
  for (const device of parseAdbDevices(devices.stdout).filter(
    (entry) => entry.state === 'device',
  )) {
    const props = run(adb, ['-s', device.serial, 'shell', 'getprop']);
    known.push({
      ...device,
      avd:
        props.status === 0
          ? (parseAndroidProperties(props.stdout)['ro.boot.qemu.avd_name'] ?? null)
          : null,
    });
  }
  const reuse = matchConnectedAvd(known, avdName);
  if (reuse) {
    console.log(`Reusing connected '${avdName}' on ${reuse} (not owned; it will not be stopped).`);
    return { serial: reuse, owned: false, pid: null };
  }
  bootOwnedEmulator(emulator, avdName);
  const deadline = Date.now() + bootTimeoutMs;
  const serial = waitForNewSerial(adb, devices.stdout, deadline);
  waitForTargetReady(adb, serial, deadline);
  return { serial, owned: true, pid: null };
}

function pushTargetRecord(
  records,
  outcome,
  avdName,
  options,
  resolution,
  startedAt,
  endedAt,
  attempt,
) {
  const report = outcome.report;
  records.push(
    buildTargetRunRecord({
      repoSha: report.gitSha ?? report.sourceSha ?? null,
      sourceSha: report.sourceSha ?? report.gitSha ?? null,
      apkSha256: report.buildMetadata?.apkSha256 ?? null,
      buildKind: report.buildMetadata?.buildKind ?? 'canonical',
      platform: 'android',
      avd: report.avd ?? avdName,
      api: report.targetIdentity?.api ?? null,
      abi: report.targetIdentity?.abi ?? null,
      serial: report.targetIdentity?.serial ?? report.details?.serial ?? resolution?.serial ?? null,
      ownedEmulator: report.ownedEmulator ?? resolution?.owned ?? false,
      stateReset: report.stateReset ?? false,
      mockState: report.mockState ?? null,
      tag: options.tag,
      flow: options.flow ?? '.maestro',
      startedAt,
      endedAt,
      status: report.status,
      classification: report.classification ?? (report.status === 'BLOCKED' ? 'ENVIRONMENT' : null),
      artifactPath: outcome.reportPath,
      replayCommand: `${options.replayCommand} --avd ${avdName}`,
      attempt,
    }),
  );
  console.log(
    `Target '${avdName}' attempt ${attempt}: ${report.status} (artifact: ${outcome.reportPath})`,
  );
  return outcome.exitCode;
}

function blockedTargetOutcome(avdName, options, resolution, message, remediation) {
  return blocked('android', options.tag, `${options.replayCommand} --avd ${avdName}`, message, {
    flow: options.flow ?? '.maestro',
    avd: avdName,
    serial: resolution?.serial ?? null,
    ownedEmulator: resolution?.owned ?? false,
    mockState: null,
    remediation,
  });
}

function runLaneAttempt(
  adb,
  avdName,
  options,
  authSession,
  resolution,
  records,
  cleanupErrors,
  attempt,
) {
  const startedAt = new Date().toISOString();
  let outcome = null;
  let reverseEstablished = false;
  try {
    if (authSession) {
      ensureAuthReverse(adb, resolution.serial, authSession.port, resolution.owned);
      reverseEstablished = true;
    }
    outcome = runPlatform('android', {
      ...options,
      serial: resolution.serial,
      avdContext: { avd: avdName, owned: resolution.owned },
      replayCommand: `${options.replayCommand} --avd ${avdName}`,
      authSlice: authSession
        ? { logPath: authSession.logPath, startOffset: mockLogOffset(authSession.logPath) }
        : null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    outcome = blockedTargetOutcome(
      avdName,
      options,
      resolution,
      message,
      'Inspect the message above; no emulator was left in an unknown state by this step.',
    );
  } finally {
    if (authSession && reverseEstablished && resolution) {
      try {
        removeAuthReverse(adb, resolution.serial, authSession.port);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        cleanupErrors.push({ avd: avdName, serial: resolution.serial, message });
        console.error(`Auth reverse cleanup failed [ENVIRONMENT]: ${message}`);
      }
    }
  }
  const endedAt = new Date().toISOString();
  return pushTargetRecord(
    records,
    outcome,
    avdName,
    options,
    resolution,
    startedAt,
    endedAt,
    attempt,
  );
}

function runMultiAvdTarget(adb, emulator, avdName, options, sessionCtl, records, cleanupErrors) {
  let resolution = null;
  try {
    resolution = resolveAvdTarget(adb, emulator, avdName, options.bootTimeoutMs);
  } catch (error) {
    // Boot/resolution failure: BLOCKED with no retry (nothing ran to retry).
    const message = error instanceof Error ? error.message : String(error);
    const outcome = blockedTargetOutcome(
      avdName,
      options,
      resolution,
      message,
      'Inspect the message above; no emulator was left in an unknown state by this step.',
    );
    const endedAt = new Date().toISOString();
    pushTargetRecord(records, outcome, avdName, options, resolution, endedAt, endedAt, 1);
    return outcome.exitCode;
  }
  let exitCode = 0;
  try {
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      exitCode = Math.max(
        exitCode,
        runLaneAttempt(
          adb,
          avdName,
          options,
          sessionCtl.get(),
          resolution,
          records,
          cleanupErrors,
          attempt,
        ),
      );
      const last = records[records.length - 1];
      const retryable =
        sessionCtl.get() !== null &&
        last.status !== 'PASS' &&
        last.mockState &&
        !mockSliceTouched(last.mockState);
      if (!retryable || attempt === 2) break;
      last.supersededByRetry = true;
      console.log(
        `Attempt ${attempt} on '${avdName}' reached the lane with zero mock traffic (dead-forward boot?); restarting the mock session and retrying once on the same target.`,
      );
      try {
        sessionCtl.restart();
      } catch (error) {
        const outcome = blockedTargetOutcome(
          avdName,
          options,
          resolution,
          `Auth-mock restart failed: ${error instanceof Error ? error.message : String(error)}`,
          'Inspect the mock log and retry the lane.',
        );
        const endedAt = new Date().toISOString();
        pushTargetRecord(
          records,
          outcome,
          avdName,
          options,
          resolution,
          endedAt,
          endedAt,
          attempt + 1,
        );
        exitCode = Math.max(exitCode, outcome.exitCode);
        break;
      }
    }
  } finally {
    if (resolution?.owned && !options.noStop) {
      try {
        stopOwnedEmulator(adb, resolution.serial);
        console.log(`Stopped owned emulator ${resolution.serial} (AVD '${avdName}').`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        cleanupErrors.push({ avd: avdName, serial: resolution.serial, message });
        console.error(`Emulator cleanup failed [ENVIRONMENT]: ${message}`);
      }
    } else if (resolution?.owned && options.noStop) {
      console.log(
        `Leaving owned emulator ${resolution.serial} (AVD '${avdName}') running (--no-stop).`,
      );
    }
  }
  return exitCode;
}

function runMultiAvd(options) {
  const emulator = findEmulator();
  if (!emulator) {
    console.error('Android emulator CLI is not installed or not on PATH.');
    return 1;
  }
  const adb = findCommand('adb');
  if (!adb) {
    console.error('Android adb is not installed or not on PATH.');
    return 1;
  }
  const available = run(emulator, ['-list-avds']);
  if (available.status !== 0) {
    console.error(`emulator -list-avds failed (exit ${available.status}).`);
    return 1;
  }
  let sequence;
  try {
    sequence = planAvdSequence(options.avds, parseAvdListOutput(available.stdout)).sequence;
  } catch (error) {
    console.error(
      `Native QA configuration error: ${error instanceof Error ? error.message : String(error)}`,
    );
    return 1;
  }
  console.log(`Multi-AVD certification (sequential): ${sequence.join(' -> ')}`);
  let authSession = null;
  if (options.authMock) {
    try {
      authSession = startAuthMockSession(options);
    } catch (error) {
      console.error(
        `Auth-mock startup failed [ENVIRONMENT]: ${error instanceof Error ? error.message : String(error)}`,
      );
      return 2;
    }
  }
  const records = [];
  const cleanupErrors = [];
  const authSessions = [];
  const sessionCtl = {
    get: () => authSession,
    restart: () => {
      if (authSession) {
        try {
          stopAuthMockSession(authSession);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          cleanupErrors.push({ avd: null, serial: null, message });
          console.error(`Auth-mock teardown failed [ENVIRONMENT]: ${message}`);
        } finally {
          authSession = null;
        }
      }
      authSession = startAuthMockSession(options);
      authSessions.push(authSession);
    },
  };
  if (options.authMock) authSessions.push(authSession);
  let exitCode = 0;
  try {
    for (const avdName of sequence) {
      exitCode = Math.max(
        exitCode,
        runMultiAvdTarget(adb, emulator, avdName, options, sessionCtl, records, cleanupErrors),
      );
    }
  } finally {
    if (authSession) {
      try {
        stopAuthMockSession(authSession);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        cleanupErrors.push({ avd: null, serial: null, message });
        console.error(`Auth-mock teardown failed [ENVIRONMENT]: ${message}`);
      }
    }
  }
  const summary = summarizeTargetRuns(records);
  let authProof = null;
  if (options.authMock) {
    authProof = {
      sessions: authSessions.map((session) => ({
        port: session.port,
        deviceUrl: session.deviceUrl,
        logPath: session.logPath,
        ...mockProofSlice(session.logPath, 0),
      })),
    };
    for (const sessionProof of authProof.sessions) {
      console.log(
        `Auth-mock session proof (${sessionProof.logPath}): signup=${sessionProof.signupCount} put=${sessionProof.putUserRequests} unauth=${sessionProof.unauthenticatedChecks} users=[${sessionProof.userIds.join(', ')}] ok=${sessionProof.ok}`,
      );
      if (!sessionProof.ok) {
        console.error(`Auth-mock proof reasons: ${sessionProof.reasons.join('; ')}`);
      }
    }
  }
  if (cleanupErrors.length > 0) exitCode = Math.max(exitCode, 1);
  const stamp = new Date().toISOString().replaceAll(':', '').replaceAll('.', '');
  const collatedPath = resolve(REPORT_DIR, `native-android-multiavd-${stamp}.json`);
  mkdirSync(REPORT_DIR, { recursive: true });
  writeFileSync(
    collatedPath,
    `${JSON.stringify({ schemaVersion: 1, summary, records, cleanupErrors, authProof, replayCommand: options.replayCommand, capturedAt: new Date().toISOString() }, null, 2)}\n`,
    'utf8',
  );
  console.log(
    `Multi-AVD summary: ${summary.pass}/${summary.total} PASS, ${summary.failed} failed, ${summary.blocked} blocked.`,
  );
  console.log(`Multi-AVD collated record: ${collatedPath}`);
  return summary.status === 'PASS' && cleanupErrors.length === 0
    ? 0
    : exitCode === 0
      ? 1
      : exitCode;
}

function runSingleWithAuthMock(options, platforms) {
  if (platforms.length !== 1 || platforms[0] !== 'android') {
    console.error('Native QA configuration error: --auth-mock supports android only.');
    return 1;
  }
  let authSession = null;
  try {
    authSession = startAuthMockSession(options);
  } catch (error) {
    console.error(
      `Auth-mock startup failed [ENVIRONMENT]: ${error instanceof Error ? error.message : String(error)}`,
    );
    return 2;
  }
  const stopSession = () => {
    try {
      stopAuthMockSession(authSession);
    } catch (error) {
      console.error(
        `Auth-mock teardown failed [ENVIRONMENT]: ${error instanceof Error ? error.message : String(error)}`,
      );
      return 1;
    }
    return 0;
  };
  const adb = findCommand('adb');
  if (!adb) {
    console.error('Android adb is not installed or not on PATH.');
    return Math.max(1, stopSession());
  }
  let serial;
  try {
    const devices = run(adb, ['devices']);
    if (devices.status !== 0) throw new Error(`adb devices failed (exit ${devices.status}).`);
    serial = selectAndroidDevice(devices.stdout, options.serial).serial;
  } catch (error) {
    const outcome = blocked(
      'android',
      options.tag,
      options.replayCommand,
      error instanceof Error ? error.message : String(error),
      {
        flow: options.flow ?? '.maestro',
        serial: options.serial ?? null,
        remediation:
          'Boot one Android E2E emulator, set ANDROID_SERIAL, or pass --avd for owned lifecycle.',
      },
    );
    return Math.max(outcome.exitCode, stopSession());
  }
  try {
    ensureAuthReverse(adb, serial, authSession.port);
  } catch (error) {
    const outcome = blocked(
      'android',
      options.tag,
      options.replayCommand,
      error instanceof Error ? error.message : String(error),
      {
        flow: options.flow ?? '.maestro',
        serial,
        remediation: 'Inspect adb reverse state on the target and retry.',
      },
    );
    return Math.max(outcome.exitCode, stopSession());
  }
  let exitCode = 0;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const outcome = runPlatform('android', {
      ...options,
      serial,
      authSlice: { logPath: authSession.logPath, startOffset: mockLogOffset(authSession.logPath) },
    });
    exitCode = Math.max(exitCode, outcome.exitCode);
    try {
      removeAuthReverse(adb, serial, authSession.port);
    } catch (error) {
      console.error(
        `Auth reverse cleanup failed [ENVIRONMENT]: ${error instanceof Error ? error.message : String(error)}`,
      );
      exitCode = Math.max(exitCode, 1);
    }
    const retryable =
      outcome.report.status !== 'PASS' &&
      outcome.report.mockState &&
      !mockSliceTouched(outcome.report.mockState);
    if (!retryable || attempt === 2) {
      return Math.max(exitCode, stopSession());
    }
    console.log(
      `Attempt ${attempt} reached the lane with zero mock traffic (dead-forward boot?); restarting the mock session and retrying once on the same target.`,
    );
    exitCode = Math.max(exitCode, stopSession());
    try {
      authSession = startAuthMockSession(options);
    } catch (error) {
      console.error(
        `Auth-mock restart failed [ENVIRONMENT]: ${error instanceof Error ? error.message : String(error)}`,
      );
      return 2;
    }
    try {
      ensureAuthReverse(adb, serial, authSession.port, false);
    } catch (error) {
      const blockedOutcome = blocked(
        'android',
        options.tag,
        options.replayCommand,
        error instanceof Error ? error.message : String(error),
        {
          flow: options.flow ?? '.maestro',
          serial,
          remediation: 'Inspect adb reverse state on the target and retry.',
        },
      );
      return Math.max(blockedOutcome.exitCode, stopSession());
    }
  }
  return Math.max(exitCode, stopSession());
}

try {
  const options = parseArgs(process.argv.slice(2));
  if (options.listAvds) process.exit(listAvdTargets());
  if (options.avds.length > 0 && options.platform !== 'android') {
    console.error(
      'Native QA configuration error: --avd multi-target orchestration supports android only.',
    );
    process.exit(1);
  }
  if (options.avds.length > 0 && options.serial) {
    console.error(
      'Native QA configuration error: --serial cannot be combined with --avd; the orchestrator pins one serial per target.',
    );
    process.exit(1);
  }
  const platforms = options.platform === 'all' ? ['android', 'ios'] : [options.platform];
  const command = ['npm run qa:native', `-- --platform ${options.platform}`];
  if (options.tag) command.push(`--tag ${options.tag}`);
  if (options.flow) command.push(`--flow ${options.flow}`);
  if (options.serial) command.push(`--serial ${options.serial}`);
  if (!options.provision) command.push('--no-provision');
  for (const avd of options.avds) command.push(`--avd ${avd}`);
  if (options.reset) command.push('--reset');
  if (options.noStop) command.push('--no-stop');
  if (options.authMock) {
    command.push('--auth-mock');
    if (options.authMockPort !== 4545) command.push(`--auth-mock-port ${options.authMockPort}`);
  }
  if (options.buildMetadata) command.push(`--build-metadata ${options.buildMetadata}`);
  options.replayCommand = command.join(' ');
  if (options.avds.length > 0) process.exit(runMultiAvd(options));
  if (options.authMock) process.exit(runSingleWithAuthMock(options, platforms));
  let exitCode = 0;
  for (const platform of platforms) {
    const outcome = runPlatform(platform, options);
    exitCode = Math.max(exitCode, outcome.exitCode);
  }
  process.exit(exitCode);
} catch (error) {
  console.error(
    `Native QA configuration error: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
}
