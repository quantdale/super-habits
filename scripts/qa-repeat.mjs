/**
 * Checked-in repetition runner (Certification Infrastructure V2, Wave 5).
 * Finite, strictly sequential, fixed named suites only. See
 * `scripts/repeat.mjs` for the contract.
 *
 * Examples:
 *   node scripts/qa-repeat.mjs --suite unit --times 2
 *   node scripts/qa-repeat.mjs --suite p0 --times 5
 *   node scripts/qa-repeat.mjs --suite native-smoke --avd Nitro_API_36 --times 2
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildRepeatRecord,
  parseRepeatArgs,
  repeatUsage,
  resolveSuiteCommand,
  summarizeRepeats,
} from './repeat.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const REPORT_DIR = resolve(ROOT, 'simulation-output', 'repeat');

function gitSha() {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

function runNpm(args) {
  if (process.platform === 'win32') {
    return spawnSync(process.env.ComSpec ?? 'cmd.exe', ['/d', '/c', 'npm', ...args], {
      cwd: ROOT,
      stdio: 'inherit',
    });
  }
  return spawnSync('npm', args, { cwd: ROOT, stdio: 'inherit' });
}

function runNode(args) {
  return spawnSync(process.execPath, args, { cwd: ROOT, stdio: 'inherit' });
}

function runSuiteCommand(resolved, timeoutMs) {
  const isWindows = process.platform === 'win32';
  const invoke =
    resolved.kind === 'npm'
      ? {
          command: isWindows ? (process.env.ComSpec ?? 'cmd.exe') : 'npm',
          args: isWindows ? ['/d', '/s', '/c', ['npm', ...resolved.args].join(' ')] : resolved.args,
        }
      : { command: process.execPath, args: resolved.args };
  const result = spawnSync(invoke.command, invoke.args, {
    cwd: ROOT,
    stdio: 'inherit',
    timeout: timeoutMs,
  });
  return { status: result.status ?? 1, timedOut: result.error?.code === 'ETIMEDOUT' };
}

function main() {
  const options = parseRepeatArgs(process.argv.slice(2));
  if (options.help) {
    console.log(repeatUsage());
    process.exit(0);
  }
  const sha = gitSha();
  const resolved = resolveSuiteCommand(options.suite, {
    avd: options.avd,
    timeoutMin: options.timeoutMin,
    scriptPath: resolve(ROOT, 'scripts/qa-native.mjs'),
  });
  const timeoutMs = Math.round(resolved.timeoutMin * 60 * 1000);
  const replayCommand = `node scripts/qa-repeat.mjs --suite ${options.suite} --times ${options.times}`;
  console.log(
    `Repeat certification: ${options.suite} (${resolved.description}) x${options.times}, ` +
      `timeout ${resolved.timeoutMin} min/attempt, repo ${sha ?? '<unknown SHA>'}.`,
  );

  let build = null;
  if (resolved.needsDist && !options.skipBuild) {
    const buildStart = new Date().toISOString();
    const buildMs0 = Date.now();
    console.log('Building a fresh web export for the repeated lane (once up front)...');
    const built = runNpm(['run', 'build:web']);
    if (built.status !== 0) {
      console.error(
        `Repeat battery blocked [ENVIRONMENT]: build:web failed (exit ${built.status}).`,
      );
      process.exit(2);
    }
    build = { sha, at: buildStart, ms: Date.now() - buildMs0, skipped: false };
  } else if (resolved.needsDist) {
    build = { sha, at: null, ms: null, skipped: true };
    console.log('Skipping the web export build (--skip-build): asserting dist/ is current.');
  }

  const records = [];
  for (let attempt = 1; attempt <= options.times; attempt += 1) {
    const startedAt = new Date().toISOString();
    console.log(`Attempt ${attempt}/${options.times} (${options.suite})...`);
    const { status, timedOut } = runSuiteCommand(resolved, timeoutMs);
    const endedAt = new Date().toISOString();
    records.push(
      buildRepeatRecord({
        suite: options.suite,
        attempt,
        repoSha: sha,
        startedAt,
        endedAt,
        exitCode: status,
        timedOut,
        artifactHint: resolved.artifactHint,
        replayCommand,
      }),
    );
    const verdict = timedOut ? 'TIMEOUT' : status === 0 ? 'PASS' : 'FAILED_NEEDS_TRIAGE';
    console.log(`Attempt ${attempt}/${options.times}: ${verdict}.`);
    if (timedOut && options.suite.startsWith('native-')) {
      console.error(
        'A native attempt hit the backstop timeout. Suites are finite by design, so inspect ' +
          'for a wedged emulator: run `adb devices` and confirm no campaign-owned emulator or ' +
          'mock process was stranded before continuing.',
      );
    }
  }

  const summary = summarizeRepeats(records);
  const stamp = new Date().toISOString().replaceAll(':', '').replaceAll('.', '');
  const collatedPath = resolve(REPORT_DIR, `${options.suite}-${options.times}x-${stamp}.json`);
  mkdirSync(REPORT_DIR, { recursive: true });
  writeFileSync(
    collatedPath,
    `${JSON.stringify({ schemaVersion: 1, suite: options.suite, repoSha: sha, build, summary, records, replayCommand, capturedAt: new Date().toISOString() }, null, 2)}\n`,
    'utf8',
  );
  console.log(
    `Repeat summary (${options.suite} x${options.times}): ${summary.pass} PASS, ${summary.failed} failed, ${summary.timeout} timed out.`,
  );
  console.log(`Repeat collated record: ${collatedPath}`);
  process.exit(summary.status === 'PASS' ? 0 : 1);
}

try {
  main();
} catch (error) {
  console.error(
    `Repeat configuration error: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
}
