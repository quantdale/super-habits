// @ts-nocheck
/**
 * Shared hermetic-build envelope (OpenSpec change
 * `harden-native-evidence-and-release-posture`, task 1.1).
 *
 * WHY THIS EXISTS: `scripts/build-dist-e2e.mjs` already made the WEB E2E
 * export hermetic after the J8 oracle incident (a developer's `.env` pointed
 * the test export at a LIVE Supabase project, so a local E2E battery pushed
 * throwaway rows into production). The NATIVE lane never got the same
 * treatment: `scripts/qa-native-provision.mjs` built with
 * `{ ...process.env }` plus one flag, so an APK described as credential-free
 * could carry live Supabase credentials.
 *
 * Two copies of a credential-leak guard drift, and the drift direction is
 * exactly the failure this module exists to prevent, so the envelope lives
 * here and both build paths call it.
 *
 * The envelope has three jobs, and each one is falsifiable by a test:
 *   1. `EXPO_NO_DOTENV=1` — no `.env`/`.env.local` is read at build time.
 *   2. Every ambient `EXPO_PUBLIC_*` is stripped from the child environment,
 *      so a public-by-design flag cannot change app behavior between a local
 *      lane and a CI lane.
 *   3. The stripped names are REPORTED, and Supabase names are called out as
 *      dangerous rather than silently dropped: a workstation that exports
 *      `EXPO_PUBLIC_SUPABASE_*` in its shell is configured against a real
 *      project, and the caller decides whether that is fatal.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

/** Ambient public-flag prefix that must never reach a hermetic build. */
export const PUBLIC_ENV_PREFIX = 'EXPO_PUBLIC_';

/**
 * Prefixes whose presence in the ambient environment means the workstation is
 * pointed at a real remote. Stripping them is correct; failing loudly about
 * them is the caller's decision, because "this developer always exports
 * EXPO_PUBLIC_SUPABASE_URL" is worth a hard stop and "EXPO_PUBLIC_AI_COMMAND_
 * PARSE_MODE is set" is not.
 */
export const REMOTE_ENV_MARKERS = ['SUPABASE'];

/**
 * Build the hermetic child environment.
 *
 * @param {object} [options]
 * @param {NodeJS.ProcessEnv} [options.baseEnv] environment to derive from
 * @param {Record<string, string>} [options.set] values the build itself needs
 *   (applied AFTER stripping, so an explicit value always wins)
 * @returns {{ env: NodeJS.ProcessEnv, stripped: string[], remoteStripped: string[] }}
 */
export function hermeticBuildEnv({ baseEnv = process.env, set = {} } = {}) {
  const env = { ...baseEnv, ...set, EXPO_NO_DOTENV: '1' };
  const stripped = [];
  for (const key of Object.keys(env)) {
    if (!key.startsWith(PUBLIC_ENV_PREFIX)) continue;
    // A value the caller passed explicitly is not ambient; keep it.
    if (Object.prototype.hasOwnProperty.call(set, key)) continue;
    delete env[key];
    stripped.push(key);
  }
  const remoteStripped = stripped.filter((key) =>
    REMOTE_ENV_MARKERS.some((marker) => key.includes(marker)),
  );
  return { env, stripped: stripped.sort(), remoteStripped: remoteStripped.sort() };
}

/**
 * One line naming the ambient variables that were removed, for the build log.
 *
 * @param {string[]} stripped
 * @returns {string}
 */
export function describeStrippedEnv(stripped) {
  if (stripped.length === 0) return 'no ambient EXPO_PUBLIC_* variables were present';
  return `stripped ambient build-time variable(s): ${stripped.join(', ')}`;
}

/**
 * The message for a build that must not continue because the ambient
 * environment names a live remote.
 *
 * @param {string[]} remoteStripped
 * @param {string} label
 * @returns {string}
 */
export function remoteEnvRefusal(remoteStripped, label) {
  return (
    `${label} refuses to build: the ambient environment exports ` +
    `${remoteStripped.join(', ')}, which points a build at a real Supabase project. ` +
    `The hermetic envelope removed it, but a certification build must not be ` +
    `produced from a workstation that is configured against a live remote. ` +
    `Start a clean shell (or unset the variable) and rerun.`
  );
}

/**
 * Run a build command under the hermetic envelope.
 *
 * @param {object} options
 * @param {string} options.label human name used in log lines and errors
 * @param {string} options.command
 * @param {string[]} options.args
 * @param {string} [options.cwd]
 * @param {Record<string, string>} [options.set] build-time values (see above)
 * @param {Record<string, string>} [options.env] extra child env, merged last
 * @param {'inherit'|'pipe'} [options.stdio]
 * @returns {{ status: number, stdout: string, stderr: string, stripped: string[], remoteStripped: string[] }}
 */
export function runHermeticBuild({
  label,
  command,
  args,
  cwd = process.cwd(),
  set = {},
  env: extraEnv = {},
  stdio = 'inherit',
}) {
  const { env, stripped, remoteStripped } = hermeticBuildEnv({ set });
  console.log(`[hermetic] ${label}: EXPO_NO_DOTENV=1; ${describeStrippedEnv(stripped)}`);
  if (remoteStripped.length > 0) {
    const error = new Error(remoteEnvRefusal(remoteStripped, label));
    error.code = 'HERMETIC_REMOTE_ENV';
    error.remoteStripped = remoteStripped;
    throw error;
  }
  const useWindowsShell = process.platform === 'win32';
  const result = execFileSync(command, args, {
    cwd,
    env: { ...env, ...extraEnv },
    encoding: 'utf8',
    stdio,
    // On Windows the Expo CLI entrypoints are `.cmd` shims, which cannot be
    // spawned directly; this is the same `shell` handling the web export used
    // before this module was extracted.
    shell: useWindowsShell,
  });
  return { status: 0, stdout: result ?? '', stderr: '', stripped, remoteStripped };
}

/**
 * Describe the remote configuration a build actually targets.
 *
 * A hermetic (canonical) build must have NO remote: the envelope removed both
 * dotenv loading and every ambient `EXPO_PUBLIC_*`. A canonical build that
 * still resolved a Supabase endpoint would mean the envelope leaked, so this
 * throws rather than records a contradiction. The mock build states its
 * loopback endpoint and a FINGERPRINT of the placeholder key (never the key
 * itself), so two builds can be told apart without recording a credential.
 *
 * @param {Record<string, string | undefined>} buildEnv the hermetic child env
 * @param {boolean} mockMode
 * @returns {{ mode: string, endpoint: string | null, anonKeyFingerprint: string | null, note: string }}
 */
export function describeRemoteConfiguration(buildEnv, mockMode, createHash) {
  const url = buildEnv.EXPO_PUBLIC_SUPABASE_URL ?? null;
  const anonKey = buildEnv.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? null;
  if (!mockMode) {
    if (url) {
      throw new Error(
        `Hermetic build resolved EXPO_PUBLIC_SUPABASE_URL=${url} even though no remote was configured; refusing to certify a credential-free APK.`,
      );
    }
    return {
      mode: 'local-only',
      endpoint: null,
      anonKeyFingerprint: null,
      note: 'no remote configured — the hermetic envelope blocked dotenv loading and stripped every ambient EXPO_PUBLIC_* value',
    };
  }
  return {
    mode: 'test-only-mock',
    endpoint: url,
    anonKeyFingerprint: anonKey
      ? createHash('sha256').update(anonKey).digest('hex').slice(0, 16).toUpperCase()
      : null,
    note: 'device-loopback mock auth endpoint with a non-secret placeholder key',
  };
}

/**
 * Scan every file under `dir` for a Supabase host, as raw bytes.
 *
 * Shared with the web export guard, which scans a directory of loose files.
 * The native path needs the same check over a ZIP container, which
 * `scripts/native-apk-scan.mjs` layers on top of this byte-level reader.
 *
 * @param {string} dir
 * @param {string} root
 * @param {string} needle lowercase needle
 * @returns {string[]} repo-relative paths that contain the needle
 */
export function scanDirectoryForNeedle(dir, root, needle) {
  const hits = [];
  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (fs.readFileSync(full).toString('utf8').toLowerCase().includes(needle)) {
        hits.push(path.relative(root, full));
      }
    }
  };
  walk(dir);
  return hits;
}
