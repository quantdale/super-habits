import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import net from 'node:net';

const require = createRequire(import.meta.url);
const results = [];

function report(status, name, detail, required = false) {
  results.push({ status, name, detail, required });
  console.log(`${status.padEnd(11)} ${name}: ${detail}`);
}

function commandPath(command) {
  if (process.platform === 'win32') {
    for (const candidate of [`${command}.cmd`, `${command}.exe`, `${command}.bat`, command]) {
      const result = spawnSync('where.exe', [candidate], { encoding: 'utf8' });
      if (result.status === 0) return result.stdout.trim().split(/\r?\n/)[0];
    }
    return null;
  }
  const result = spawnSync('sh', ['-lc', `command -v ${command}`], { encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim().split(/\r?\n/)[0] : null;
}

function run(command, args = []) {
  const executable = commandPath(command) ?? command;
  const options = { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] };
  if (process.platform === 'win32' && /\.(cmd|bat|ps1)$/i.test(executable)) {
    return spawnSync(process.env.ComSpec ?? 'cmd.exe', ['/d', '/c', command, ...args], options);
  }
  return spawnSync(executable, args, options);
}

function outputOf(result) {
  return `${result.stdout ?? ''}${result.stderr ?? ''}`.trim().split(/\r?\n/)[0] ?? '';
}

function checkCommand(name, command, args, { required = false, optional = false } = {}) {
  if (!commandPath(command)) {
    report(optional ? 'OPTIONAL' : 'MISSING', name, `${command} is not on PATH`, required);
    return;
  }
  const result = run(command, args);
  if (result.status === 0) {
    report('PASS', name, outputOf(result) || 'available');
  } else {
    report('ENVIRONMENT', name, `${command} did not return a usable version`, required);
  }
}

function checkLocalCli(name, packageName, args = ['--version']) {
  if (!existsSync('node_modules')) {
    report('MISSING', name, 'node_modules is absent; run npm ci', true);
    return;
  }
  const result = run('npx', ['--no-install', packageName, ...args]);
  if (result.status === 0) {
    report('PASS', name, outputOf(result) || 'available from node_modules');
  } else {
    report('MISSING', name, `${packageName} is not available from node_modules`, true);
  }
}

async function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.listen(port, '127.0.0.1', () => {
      server.close(() => resolve(true));
    });
  });
}

console.log('SuperHabits development doctor (read-only)');
console.log(`Platform: ${process.platform} ${process.arch}`);

const nodeVersion = process.versions.node.split('.').map(Number);
const supportedNode =
  nodeVersion[0] === 22 && (nodeVersion[1] > 22 || (nodeVersion[1] === 22 && nodeVersion[2] >= 1));
if (supportedNode) {
  report('PASS', 'Node.js', `v${process.versions.node} (22.22.1–22.x supported)`);
} else {
  report(
    'MISSING',
    'Node.js',
    `v${process.versions.node}; Node.js 22.22.1–22.x is required (see .nvmrc)`,
    true,
  );
}
checkCommand('npm', 'npm', ['--version'], { required: true });
checkCommand('Git', 'git', ['--version'], { required: true });

if (!existsSync('package-lock.json')) {
  report('MISSING', 'package-lock.json', 'lockfile is absent; clone the complete repository', true);
} else {
  report('PASS', 'package-lock.json', 'present; npm ci can reproduce dependencies');
}

if (!existsSync('node_modules')) {
  report('MISSING', 'Dependencies', 'node_modules is absent; run npm ci', true);
} else {
  const result = run('npm', ['ls', '--depth=0', '--ignore-scripts', '--json']);
  report(
    result.status === 0 ? 'PASS' : 'MISSING',
    'Dependencies',
    result.status === 0
      ? 'top-level dependency tree is complete'
      : 'npm ls found missing or invalid packages; run npm ci',
    true,
  );
}

checkLocalCli('Expo CLI', 'expo');
checkLocalCli('TypeScript', 'tsc');
checkLocalCli('Vitest', 'vitest');
checkLocalCli('Playwright CLI', 'playwright');
checkLocalCli('OpenSpec CLI', 'openspec');

try {
  const { chromium } = require('@playwright/test');
  const executable = chromium.executablePath();
  report(
    existsSync(executable) ? 'PASS' : 'MISSING',
    'Playwright Chromium',
    existsSync(executable)
      ? 'browser executable is installed'
      : 'browser executable is missing; run npx playwright install chromium',
    true,
  );
} catch {
  report('MISSING', 'Playwright Chromium', 'Playwright is not installed; run npm ci', true);
}

checkCommand('JDK', 'java', ['-version'], { optional: true });
checkCommand('Android adb', 'adb', ['version'], { optional: true });
checkCommand('Android emulator', 'emulator', ['-version'], { optional: true });
checkCommand('Maestro', 'maestro', ['--version'], { optional: true });
checkCommand('EAS CLI', 'eas', ['--version'], { optional: true });
checkCommand('Supabase CLI', 'supabase', ['--version'], { optional: true });

const androidSdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
if (androidSdk) {
  report('PASS', 'Android SDK path', 'ANDROID_HOME/ANDROID_SDK_ROOT is set (value hidden)');
} else {
  report(
    'OPTIONAL',
    'Android SDK path',
    'set ANDROID_HOME or ANDROID_SDK_ROOT for local Android builds',
  );
}

const supabaseConfigured = Boolean(
  process.env.EXPO_PUBLIC_SUPABASE_URL && process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
);
const oneSupabaseValue = Boolean(
  process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
);
if (supabaseConfigured) {
  report('PASS', 'Optional Supabase client env', 'URL and anon key are present (values hidden)');
} else if (oneSupabaseValue) {
  report(
    'ENVIRONMENT',
    'Optional Supabase client env',
    'URL and anon key must be supplied together',
  );
} else {
  report('OPTIONAL', 'Optional Supabase client env', 'unset; local-only mode is supported');
}

for (const port of [8081, 8082]) {
  const available = await isPortAvailable(port);
  report(
    available ? 'PASS' : 'ENVIRONMENT',
    `Port ${port}`,
    available ? 'available' : 'already in use; choose another port with E2E_PORT when needed',
  );
}

const blocking = results.filter((result) => result.required && result.status !== 'PASS');
console.log('');
if (blocking.length === 0) {
  console.log('Doctor result: PASS (optional native/cloud capabilities are reported above).');
} else {
  console.log(
    `Doctor result: MISSING/ENVIRONMENT (${blocking.length} required check(s) need attention).`,
  );
  process.exitCode = 1;
}
