/**
 * Build and install the credential-free local Android equivalent of the
 * e2e-test profile, then write ignored provenance metadata for the native QA
 * runner. This is intentionally a Windows-friendly local path: EAS local
 * builds are not the supported Windows workflow.
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseAndroidProperties,
  parsePackageIdentity,
  selectAndroidDevice,
} from './native-qa-utils.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const APP_ID = 'com.dale16.superhabits';
const REPORT_DIR = resolve(ROOT, 'simulation-output', 'native');
const METADATA_PATH = resolve(REPORT_DIR, 'native-android-build.json');
const E2E_ENV_NAME = 'EXPO_PUBLIC_HABIT_REMINDER_E2E_TEST';

function parseArgs(argv) {
  const args = {
    serial: process.env.NATIVE_ANDROID_SERIAL ?? process.env.ANDROID_SERIAL ?? null,
    force: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--serial') args.serial = argv[++i];
    else if (arg === '--force') args.force = true;
    else if (arg === '--help' || arg === '-h') {
      console.log('Usage: node scripts/qa-native-provision.mjs [--serial SERIAL] [--force]');
      process.exit(0);
    } else {
      throw new Error(`Unknown argument '${arg}'. Use --help for usage.`);
    }
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

function gitSha() {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

function apkSha256(apkPath) {
  return createHash('sha256').update(readFileSync(apkPath)).digest('hex').toUpperCase();
}

function writeFailure(args, reason, details = {}) {
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
        gitSha: gitSha(),
        requestedSerial: args.serial,
        reason,
        details,
        replayCommand: `npm run qa:native:provision -- --serial ${args.serial ?? '<serial>'}`,
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

function main(args) {
  const adb = findCommand('adb');
  if (!adb) throw new Error('Android adb is not installed or not discoverable on PATH.');

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

  const prebuildCommand = 'npx expo prebuild --platform android --clean';
  const buildEnv = { ...process.env, [E2E_ENV_NAME]: 'true' };
  const npx = findCommand('npx');
  if (!npx) throw new Error('npx is not installed or not discoverable on PATH.');
  if (args.force) console.log('Forcing a fresh current-source Android E2E build.');
  console.log(`Preparing current source ${gitSha() ?? '<unknown SHA>'} for ${serial}...`);
  const prebuild = run(npx, ['expo', 'prebuild', '--platform', 'android', '--clean'], {
    env: buildEnv,
    stdio: 'inherit',
  });
  requireSuccess(prebuild, 'Expo Android prebuild', prebuildCommand);

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
  const gradle = run(gradleWrapper, gradleArgs, { env: buildEnv, stdio: 'inherit' });
  requireSuccess(gradle, 'Gradle Android release build', gradleCommand);

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

  const metadata = {
    schemaVersion: 1,
    status: 'PASS',
    classification: null,
    platform: 'android',
    appId: APP_ID,
    sourceSha: gitSha(),
    apkSha256: apkHash,
    apkPath: relative(ROOT, apkPath),
    versionName: packageIdentity.versionName,
    versionCode: packageIdentity.versionCode,
    target,
    e2eEnvironment: { [E2E_ENV_NAME]: 'true' },
    prebuildCommand,
    buildCommand: gradleCommand,
    installCommand: `${adb} -s ${serial} install -r -d -g <apk>`,
    capturedAt: new Date().toISOString(),
  };
  mkdirSync(dirname(METADATA_PATH), { recursive: true });
  writeFileSync(METADATA_PATH, `${JSON.stringify(metadata, null, 2)}\n`, 'utf8');
  console.log(
    `Android E2E APK installed: ${APP_ID} ${packageIdentity.versionName ?? '<unknown>'} on ${serial} (source ${metadata.sourceSha}, APK SHA-256 ${apkHash}).`,
  );
}

let args = {
  serial: process.env.NATIVE_ANDROID_SERIAL ?? process.env.ANDROID_SERIAL ?? null,
  force: false,
};
try {
  args = parseArgs(process.argv.slice(2));
  main(args);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  writeFailure(args, message);
  process.exit(2);
}
