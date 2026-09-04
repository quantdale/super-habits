/**
 * Build and install the credential-free local Android equivalent of the
 * e2e-test profile, then write ignored provenance metadata for the native QA
 * runner. This is intentionally a Windows-friendly local path: EAS local
 * builds are not the supported Windows workflow.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseAndroidProperties,
  parsePackageIdentity,
  selectAndroidDevice,
} from './native-qa-utils.mjs';
import { addCleartextAttr, validateInstallOnlyMetadata } from './native-avd.mjs';
import { readGitProvenance, requireCleanGitTree } from './native-provenance.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const APP_ID = 'com.dale16.superhabits';
const REPORT_DIR = resolve(ROOT, 'simulation-output', 'native');
const METADATA_PATH = resolve(REPORT_DIR, 'native-android-build.json');
const MOCK_METADATA_PATH = resolve(REPORT_DIR, 'native-android-build-mock.json');
const E2E_ENV_NAME = 'EXPO_PUBLIC_HABIT_REMINDER_E2E_TEST';
const MOCK_SUPABASE_ANON_KEY = 'mock-anon-key-for-tests-only';

function parseArgs(argv) {
  const args = {
    serial: process.env.NATIVE_ANDROID_SERIAL ?? process.env.ANDROID_SERIAL ?? null,
    force: false,
    mockAuthUrl: null,
    installOnly: false,
    metadataPath: null,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--serial') args.serial = argv[++i];
    else if (arg === '--force') args.force = true;
    else if (arg === '--mock-auth-url') args.mockAuthUrl = argv[++i];
    else if (arg === '--install-only') args.installOnly = true;
    else if (arg === '--metadata-path') args.metadataPath = argv[++i];
    else if (arg === '--help' || arg === '-h') {
      console.log(
        'Usage: node scripts/qa-native-provision.mjs [--serial SERIAL] [--force] [--mock-auth-url URL] [--install-only --metadata-path PATH]',
      );
      process.exit(0);
    } else {
      throw new Error(`Unknown argument '${arg}'. Use --help for usage.`);
    }
  }
  if (args.installOnly && !args.metadataPath) {
    throw new Error('--install-only requires --metadata-path.');
  }
  if (args.installOnly && (args.mockAuthUrl !== null || args.force)) {
    throw new Error(
      '--install-only cannot be combined with --mock-auth-url or --force; build kind is read from the metadata file.',
    );
  }
  if (
    args.mockAuthUrl !== null &&
    !/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(args.mockAuthUrl)
  ) {
    throw new Error(
      `Refusing TEST-ONLY mock build for non-loopback URL '${args.mockAuthUrl}'. Use http://localhost:<port> or http://127.0.0.1:<port>.`,
    );
  }
  return args;
}

function readPersistedWindowsUserPath() {
  if (process.platform !== 'win32') return '';
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

function commandCandidates(command) {
  const names =
    process.platform === 'win32' ? [`${command}.cmd`, `${command}.bat`, command] : [command];
  if (process.platform !== 'win32') return names;
  const currentPath = process.env.PATH ?? process.env.Path ?? '';
  const persistedPath = readPersistedWindowsUserPath();
  const directories = [...currentPath.split(';'), ...persistedPath.split(';')]
    .map((entry) => entry.trim())
    .filter(Boolean);
  const absoluteCandidates = directories.flatMap((directory) =>
    names.map((name) => resolve(directory, name)),
  );
  return [...new Set([...names, ...absoluteCandidates])];
}

function findCommand(command) {
  for (const candidate of commandCandidates(command)) {
    const isBatch = process.platform === 'win32' && /\.(?:cmd|bat)$/i.test(candidate);
    const spawnCommand = isBatch ? quoteWindowsShellArg(candidate) : candidate;
    const result = spawnSync(spawnCommand, isBatch ? [] : ['--version'], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: 'ignore',
      shell: isBatch,
    });
    if (!result.error && result.status === 0) return candidate;
  }
  return null;
}

function quoteWindowsShellArg(value) {
  const text = String(value);
  return /[\s"]/.test(text) ? `"${text.replaceAll('"', '\\"')}"` : text;
}

function run(command, args, options = {}) {
  const isBatch = process.platform === 'win32' && /\.(?:cmd|bat)$/i.test(command);
  const spawnCommand = isBatch ? [command, ...args].map(quoteWindowsShellArg).join(' ') : command;
  const spawnArgs = isBatch ? [] : args;
  const result = spawnSync(spawnCommand, spawnArgs, {
    cwd: ROOT,
    encoding: 'utf8',
    shell: isBatch,
    ...options,
  });
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    error: result.error?.message ?? null,
  };
}

function apkSha256(apkPath) {
  return createHash('sha256').update(readFileSync(apkPath)).digest('hex').toUpperCase();
}

function writeFailure(args, reason, details = {}) {
  const provenance = readGitProvenance(ROOT);
  mkdirSync(REPORT_DIR, { recursive: true });
  const stamp = new Date().toISOString().replaceAll(':', '').replaceAll('.', '');
  const path = resolve(REPORT_DIR, `native-android-provision-${stamp}.json`);
  writeFileSync(
    path,
    `${JSON.stringify(
      {
        schemaVersion: 1,
        status: 'BLOCKED',
        classification: 'ENVIRONMENT',
        platform: 'android',
        appId: APP_ID,
        gitSha: provenance.sourceSha,
        sourceSha: provenance.sourceSha,
        sourceTreeClean: provenance.sourceTreeClean,
        sourceTreeStatus: provenance.sourceTreeStatus,
        sourceShaError: provenance.sourceShaError,
        sourceTreeStatusError: provenance.sourceTreeStatusError,
        requestedSerial: args.serial,
        reason,
        details,
        replayCommand: `npm run qa:native:provision -- --serial ${args.serial ?? '<serial>'}${args.mockAuthUrl ? ` --mock-auth-url ${args.mockAuthUrl}` : ''}`,
        capturedAt: new Date().toISOString(),
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
  console.error(`Android provisioning blocked [ENVIRONMENT]: ${reason}`);
  console.error(`Provisioning report: ${path}`);
}

function requireSuccess(result, label, command) {
  if (result.status === 0) return result;
  const output = `${result.stdout}\n${result.stderr}`.trim();
  throw new Error(
    `${label} failed (exit ${result.status}) while running ${command}.${output ? `\n${output.slice(-6000)}` : ''}`,
  );
}

function resolveTargetDevice(adb, args) {
  const devicesResult = run(adb, ['devices']);
  requireSuccess(devicesResult, 'adb devices', `${adb} devices`);
  const selected = selectAndroidDevice(devicesResult.stdout, args.serial);
  const serial = selected.serial;
  const targetPropertiesResult = run(adb, ['-s', serial, 'shell', 'getprop']);
  requireSuccess(
    targetPropertiesResult,
    'Android target inspection',
    `${adb} -s ${serial} shell getprop`,
  );
  const properties = parseAndroidProperties(targetPropertiesResult.stdout);
  const target = {
    serial,
    api: properties['ro.build.version.sdk'] ?? null,
    abi: properties['ro.product.cpu.abi'] ?? null,
    avd: properties['ro.boot.qemu.avd_name'] ?? null,
    bootCompleted: properties['sys.boot_completed'] ?? null,
  };
  if (target.bootCompleted !== '1') {
    throw new Error(`Android target '${serial}' is connected but not fully booted.`);
  }
  if (target.api !== '36' || target.abi !== 'x86_64') {
    throw new Error(
      `The local provisioning path targets Android API 36 x86_64; observed API ${target.api ?? 'unknown'} / ABI ${target.abi ?? 'unknown'} on '${serial}'.`,
    );
  }
  return { adb, serial, target };
}

function installOnlyMain(args) {
  // Reinstall the hash-verified APK recorded in a provenance metadata file
  // without rebuilding: snapshot-reverted emulator boots can otherwise
  // present a stale binary that version checks cannot distinguish
  // (canonical and mock builds share versionName/versionCode).
  // Returns { fallback: reason } when a full provision is needed instead.
  const adb = findCommand('adb');
  if (!adb) throw new Error('Android adb is not installed or not discoverable on PATH.');
  const metadataPath = resolve(ROOT, args.metadataPath);
  let metadata = null;
  try {
    metadata = JSON.parse(readFileSync(metadataPath, 'utf8'));
  } catch {
    return {
      fallback: `no readable build metadata at ${args.metadataPath}; full provision required`,
    };
  }
  const sourceProvenance = requireCleanGitTree(ROOT);
  const check = validateInstallOnlyMetadata(metadata, {
    sourceSha: sourceProvenance.sourceSha,
    appId: APP_ID,
    e2eEnvName: E2E_ENV_NAME,
  });
  if (!check.ok) return { fallback: `${check.reason}; full provision required` };
  const apkPath = resolve(ROOT, metadata.apkPath ?? '');
  if (!metadata.apkPath || !existsSync(apkPath)) {
    return {
      fallback: `recorded APK missing at ${metadata.apkPath ?? '<none>'}; full provision required`,
    };
  }
  if (apkSha256(apkPath) !== metadata.apkSha256) {
    return { fallback: 'recorded APK hash mismatch; full provision required' };
  }
  const { serial, target } = resolveTargetDevice(adb, args);
  const install = run(adb, ['-s', serial, 'install', '-r', '-d', '-g', apkPath], {
    stdio: 'inherit',
  });
  requireSuccess(install, 'ADB APK install', `${adb} -s ${serial} install -r -d -g <apk>`);
  const packageResult = run(adb, ['-s', serial, 'shell', 'dumpsys', 'package', APP_ID]);
  requireSuccess(
    packageResult,
    'Installed package inspection',
    `${adb} -s ${serial} shell dumpsys package ${APP_ID}`,
  );
  const packageIdentity = parsePackageIdentity(packageResult.stdout, APP_ID);
  if (
    !packageIdentity.present ||
    (metadata.versionName && metadata.versionName !== packageIdentity.versionName) ||
    (metadata.versionCode !== null &&
      metadata.versionCode !== undefined &&
      metadata.versionCode !== packageIdentity.versionCode)
  ) {
    throw new Error(
      `ADB install completed but ${APP_ID} identity does not match the recorded build on '${serial}'.`,
    );
  }
  metadata.target = {
    serial: target.serial,
    api: target.api,
    abi: target.abi,
    avd: target.avd,
  };
  metadata.installedAt = new Date().toISOString();
  mkdirSync(dirname(metadataPath), { recursive: true });
  writeFileSync(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, 'utf8');
  console.log(
    `Reinstalled verified ${metadata.buildKind} APK on ${serial} (source ${metadata.sourceSha}, APK SHA-256 ${metadata.apkSha256}).`,
  );
  return { fallback: null };
}

function main(args) {
  const adb = findCommand('adb');
  if (!adb) throw new Error('Android adb is not installed or not discoverable on PATH.');

  const { serial, target } = resolveTargetDevice(adb, args);
  const sourceProvenance = requireCleanGitTree(ROOT);
  console.log(`Preparing clean source ${sourceProvenance.sourceSha} for ${serial}...`);

  const prebuildCommand = 'npx expo prebuild --platform android --clean';
  const buildEnv = { ...process.env, [E2E_ENV_NAME]: 'true' };
  const mockMode = args.mockAuthUrl !== null;
  if (mockMode) {
    buildEnv.EXPO_PUBLIC_SUPABASE_URL = args.mockAuthUrl;
    buildEnv.EXPO_PUBLIC_SUPABASE_ANON_KEY = MOCK_SUPABASE_ANON_KEY;
    console.log(
      `TEST-ONLY mock-auth build: Supabase endpoint is ${args.mockAuthUrl} (device loopback) with a non-secret placeholder key.`,
    );
  }
  const npx = findCommand('npx');
  if (!npx) throw new Error('npx is not installed or not discoverable on PATH.');
  if (args.force) console.log('Forcing a fresh current-source Android E2E build.');
  const prebuild = run(npx, ['expo', 'prebuild', '--platform', 'android', '--clean'], {
    env: buildEnv,
    stdio: 'inherit',
  });
  requireSuccess(prebuild, 'Expo Android prebuild', prebuildCommand);
  if (mockMode) {
    // TEST-ONLY: allow cleartext HTTP to the device-loopback mock in the
    // generated, gitignored android/ tree. Tracked config is untouched;
    // release builds never pass through here.
    const manifestPath = resolve(ROOT, 'android', 'app', 'src', 'main', 'AndroidManifest.xml');
    const manifest = readFileSync(manifestPath, 'utf8');
    writeFileSync(manifestPath, addCleartextAttr(manifest), 'utf8');
    console.log(
      'TEST-ONLY cleartext patch applied to the generated manifest (gitignored android/ only).',
    );
  }
  const postPrebuildProvenance = requireCleanGitTree(ROOT);
  if (postPrebuildProvenance.sourceSha !== sourceProvenance.sourceSha) {
    throw new Error(
      `Git HEAD changed during Expo prebuild (${sourceProvenance.sourceSha} -> ${postPrebuildProvenance.sourceSha}); refusing to certify the resulting APK.`,
    );
  }

  const gradleWrapper = resolve(
    ROOT,
    'android',
    process.platform === 'win32' ? 'gradlew.bat' : 'gradlew',
  );
  const gradleArgs = [
    'app:assembleRelease',
    '--no-daemon',
    '--no-build-cache',
    '-PreactNativeArchitectures=x86_64',
  ];
  const gradleCommand = `${relative(ROOT, gradleWrapper)} ${gradleArgs.join(' ')}`;
  console.log(`Building credential-free native E2E APK: ${gradleCommand}`);
  const gradle = run(gradleWrapper, gradleArgs, {
    cwd: resolve(ROOT, 'android'),
    env: buildEnv,
    stdio: 'inherit',
  });
  requireSuccess(gradle, 'Gradle Android release build', gradleCommand);
  const builtSourceProvenance = requireCleanGitTree(ROOT);
  if (builtSourceProvenance.sourceSha !== sourceProvenance.sourceSha) {
    throw new Error(
      `Git HEAD or working-tree provenance changed during the Android build (${sourceProvenance.sourceSha} -> ${builtSourceProvenance.sourceSha}); refusing to certify the resulting APK.`,
    );
  }

  const apkPath = resolve(
    ROOT,
    'android',
    'app',
    'build',
    'outputs',
    'apk',
    'release',
    'app-release.apk',
  );
  const apkHash = apkSha256(apkPath);
  const install = run(adb, ['-s', serial, 'install', '-r', '-d', '-g', apkPath], {
    stdio: 'inherit',
  });
  requireSuccess(install, 'ADB APK install', `${adb} -s ${serial} install -r -d -g <apk>`);

  const packageResult = run(adb, ['-s', serial, 'shell', 'dumpsys', 'package', APP_ID]);
  requireSuccess(
    packageResult,
    'Installed package inspection',
    `${adb} -s ${serial} shell dumpsys package ${APP_ID}`,
  );
  const packageIdentity = parsePackageIdentity(packageResult.stdout, APP_ID);
  if (!packageIdentity.present) {
    throw new Error(
      `ADB install completed but ${APP_ID} was not present in dumpsys package output.`,
    );
  }

  const builtAt = new Date().toISOString();
  const metadataPath = mockMode ? MOCK_METADATA_PATH : METADATA_PATH;
  const metadata = {
    schemaVersion: 1,
    status: 'PASS',
    classification: null,
    platform: 'android',
    appId: APP_ID,
    buildKind: mockMode ? 'test-only' : 'canonical',
    mockAuthUrl: mockMode ? args.mockAuthUrl : null,
    sourceSha: builtSourceProvenance.sourceSha,
    sourceTreeClean: builtSourceProvenance.sourceTreeClean,
    sourceTreeStatus: builtSourceProvenance.sourceTreeStatus,
    apkSha256: apkHash,
    apkPath: relative(ROOT, apkPath),
    versionName: packageIdentity.versionName,
    versionCode: packageIdentity.versionCode,
    target,
    e2eEnvironment: { [E2E_ENV_NAME]: 'true' },
    prebuildCommand,
    buildCommand: gradleCommand,
    installCommand: `${adb} -s ${serial} install -r -d -g <apk>`,
    builtAt,
    installedAt: builtAt,
    capturedAt: builtAt,
  };
  mkdirSync(dirname(metadataPath), { recursive: true });
  writeFileSync(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, 'utf8');
  console.log(
    `${mockMode ? 'TEST-ONLY mock-auth' : 'Android E2E'} APK installed: ${APP_ID} ${packageIdentity.versionName ?? '<unknown>'} on ${serial} (source ${metadata.sourceSha}, APK SHA-256 ${apkHash}).`,
  );
  console.log(`Build provenance: ${relative(ROOT, metadataPath)}`);
}

let args = {
  serial: process.env.NATIVE_ANDROID_SERIAL ?? process.env.ANDROID_SERIAL ?? null,
  force: false,
  mockAuthUrl: null,
  installOnly: false,
  metadataPath: null,
};
try {
  args = parseArgs(process.argv.slice(2));
  if (args.installOnly) {
    const outcome = installOnlyMain(args);
    if (outcome.fallback) {
      console.error(`Install-only unavailable: ${outcome.fallback}`);
      process.exit(3);
    }
    process.exit(0);
  }
  main(args);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  writeFailure(args, message);
  process.exit(2);
}
