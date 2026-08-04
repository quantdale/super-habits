/**
 * Disposable-backend provisioning (design D8, task 8.2).
 *
 * Creates-or-reuses a throwaway Supabase project, applies the reference schema
 * (simulation/backend/schema.sql), optionally deploys the `parse-ai-command`
 * edge function, emits a short-lived env file for the `dist-live/` build, and
 * tears the project down at the end of the run.
 *
 * HARD ISOLATION: every command first runs the disposable-backend guard
 * (simulation/backend/guard.ts) BEFORE any build or network call. The guard
 * refuses (a) a target host that matches production, (b) an ambient shell that
 * already carries production client credentials, and (c) a project that lacks
 * the disposable marker. The `dist-live/` build is produced only inside the
 * guarded job (see build-dist-live.sh).
 *
 * EXECUTION BLOCKED IN THIS ENVIRONMENT: it requires the Supabase CLI and a
 * login, neither of which is present here, and live execution is externally
 * blocked. The script therefore fails fast and clearly when the preconditions
 * (CLI, login, disposable marker, production-host config) are absent — it
 * never fabricates or fakes a run.
 *
 * RUNNER: no `tsx`/`ts-node` dependency is added to this repo by design
 * (constraint: no package.json changes). Invoke with `npx tsx` (one-off, not
 * a dependency) or compile-then-run via the repo's `tsc`:
 *   npx tsx simulation/backend/provision.ts run --with-parser
 */

import { execFile } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { assertDisposableBackend, checkDisposableBackend } from './guard';

const execFileAsync = promisify(execFile);

/* ------------------------------------------------------------------ */
/* Constants                                                            */
/* ------------------------------------------------------------------ */

const STATE_DIR = path.join(__dirname, 'state');
const LIVE_ENV_FILE = path.join(STATE_DIR, 'live-env.sh');
const MARKER_FILE = path.join(STATE_DIR, 'disposable-marker.txt');
const SCHEMA_FILE = path.join(__dirname, 'schema.sql');

const DEFAULT_MARKER_PREFIX = 'superhabits-disposable';
const DEFAULT_REGION = 'us-east-1';
const MANAGEMENT_API = 'https://api.supabase.com/v1';

/** The four tables the sync engine writes (core/sync/supabase.adapter.ts). */
const DATA_TABLES = ['todos', 'habits', 'calorie_entries', 'workout_routines'] as const;

/** Env var names produced into the emitted `live-env.sh` for the dist-live build. */
const EMITTED_ENV_KEYS = [
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_ANON_KEY',
  'SIMULATION_LANE',
  'SIMULATION_DISPOSABLE_MARKER',
  'SIMULATION_DISPOSABLE_PROJECT_NAME',
  'SUPABASE_PROJECT_REF',
  'SUPABASE_PROJECT_URL',
] as const;

/* ------------------------------------------------------------------ */
/* Small helpers                                                        */
/* ------------------------------------------------------------------ */

/** Abort with a clear, greppable message. Never swallow the reason. */
function failFast(message: string): never {
  throw new Error(`ABORT[disposable-backend]: ${message}`);
}

/** Run an async function and exit non-zero with a clear message on failure. */
async function runMain(fn: () => Promise<number>): Promise<void> {
  try {
    const code = await fn();
    process.exit(code);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
  }
}

/** Run a `supabase` CLI command, returning trimmed stdout. Throws on failure. */
async function supabase(
  args: string[],
  options: { cwd?: string; timeoutMs?: number } = {},
): Promise<string> {
  const { stdout } = await execFileAsync('supabase', args, {
    cwd: options.cwd,
    timeout: options.timeoutMs ?? 3 * 60_000,
    maxBuffer: 10 * 1024 * 1024,
  });
  return stdout.trim();
}

function shortRunId(): string {
  const stamp = new Date()
    .toISOString()
    .replace(/[-:TZ]/g, '')
    .slice(0, 12);
  const rand = Math.random().toString(36).slice(2, 6);
  return `${stamp}-${rand}`;
}

function projectHostFromRef(ref: string): string {
  return `https://${ref}.supabase.co`;
}

function parseProductionHosts(env: NodeJS.ProcessEnv): string[] {
  const raw = env.SIMULATION_PRODUCTION_SUPABASE_HOSTS ?? '';
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/* ------------------------------------------------------------------ */
/* Preconditions (fail fast)                                            */
/* ------------------------------------------------------------------ */

async function assertPreconditions(opts: {
  markerPrefix: string;
  orgId: string | null;
  productionHosts: string[];
}): Promise<void> {
  // 1. CLI present.
  try {
    await supabase(['--version']);
  } catch {
    failFast(
      'Supabase CLI is not installed or not on PATH. Install it (e.g. `npm i -g supabase`) or run `supabase login`. Missing precondition: CLI.',
    );
  }

  // 2. Authenticated (a lightweight network probe — the first network call;
  //    the guard above already passed, so this cannot touch production).
  try {
    await supabase(['projects', 'list']);
  } catch {
    failFast(
      'Supabase CLI is not authenticated: `supabase projects list` failed. Run `supabase login` or export SUPABASE_ACCESS_TOKEN. Missing precondition: login.',
    );
  }

  // 3. Disposable marker + org configured.
  if (!opts.markerPrefix) {
    failFast(
      'Disposable marker prefix is not configured (--marker-prefix or SUPABASE_DISPOSABLE_MARKER_PREFIX). Missing precondition: disposable marker.',
    );
  }
  if (!opts.orgId) {
    failFast(
      'Supabase org id is not configured (--org-id or SUPABASE_ORG_ID). Missing precondition: org id.',
    );
  }

  // 4. Production hosts configured, so rule (a) is not vacuous.
  if (opts.productionHosts.length === 0) {
    failFast(
      'Production Supabase hosts are not configured (SIMULATION_PRODUCTION_SUPABASE_HOSTS or --production-hosts). Without them the production-host guard cannot prove the target is not production. Missing precondition: production-host config.',
    );
  }
}

/* ------------------------------------------------------------------ */
/* Guard helpers                                                        */
/* ------------------------------------------------------------------ */

function guardFor(
  targetHost: string,
  targetProjectName: string | null,
  opts: { markerPrefix: string; ambientEnv: NodeJS.ProcessEnv; productionHosts: string[] },
): void {
  assertDisposableBackend({
    targetHost,
    productionHosts: opts.productionHosts,
    ambientEnv: opts.ambientEnv,
    disposableMarkerPrefix: opts.markerPrefix,
    targetProjectName,
  });
}

/* ------------------------------------------------------------------ */
/* Management API (raw SQL + readiness) - Cloud disposable lane         */
/* ------------------------------------------------------------------ */

async function managementApi(
  ref: string,
  method: string,
  pathname: string,
  body?: unknown,
): Promise<unknown> {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) {
    failFast('SUPABASE_ACCESS_TOKEN is required for the Management API path.');
  }
  const response = await fetch(`${MANAGEMENT_API}${pathname}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    const text = await response.text();
    failFast(
      `Management API ${method} ${pathname} failed (${response.status}): ${text.slice(0, 400)}`,
    );
  }
  return response.json();
}

/** Apply the reference schema (with an optional table wipe) to a project. */
async function applySchemaToProject(ref: string, wipe: boolean): Promise<void> {
  const sql = await readFile(SCHEMA_FILE, 'utf8');
  const wipeSql = wipe ? `DROP TABLE IF EXISTS ${DATA_TABLES.join(', ')};\n` : '';
  await managementApi(ref, 'POST', `/projects/${ref}/database/query`, {
    query: `${wipeSql}${sql}`,
  });
}

/** Poll until the project's PostgREST endpoint is reachable (any HTTP status proves the host is up). */
async function waitForProjectReady(ref: string, attempts = 60, delayMs = 5_000): Promise<void> {
  const host = projectHostFromRef(ref);
  for (let i = 0; i < attempts; i++) {
    try {
      const response = await fetch(`${host}/rest/v1/`, { method: 'GET' });
      if (response.status >= 200 && response.status < 600) {
        return; // reachable — an error status (e.g. 401/404) still proves the host resolves
      }
    } catch {
      // not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  failFast(`Project ${ref} did not become reachable within ${(attempts * delayMs) / 1000}s.`);
}

/* ------------------------------------------------------------------ */
/* Project lifecycle                                                    */
/* ------------------------------------------------------------------ */

interface ProjectInfo {
  ref: string;
  name: string;
}

/** Find a project in the account by ref, or null. */
async function lookupProject(ref: string): Promise<ProjectInfo | null> {
  const list = await supabase(['projects', 'list']);
  // CLI prints lines like: <ref> <region> <name> ... (or a table). Be tolerant.
  const lines = list.split('\n');
  for (const line of lines) {
    const tokens = line.trim().split(/\s+/);
    const candidate = tokens[0];
    if (/^[a-z0-9]{20}$/.test(candidate) && candidate === ref) {
      return { ref, name: tokens.slice(2).join(' ') || candidate };
    }
  }
  return null;
}

async function createProject(opts: {
  orgId: string;
  name: string;
  region: string;
}): Promise<ProjectInfo> {
  const out = await supabase([
    'projects',
    'create',
    '--org-id',
    opts.orgId,
    '--name',
    opts.name,
    '--region',
    opts.region,
  ]);
  // The CLI prints the new project ref somewhere in the output; extract the
  // 20-char ref token, then confirm via the projects list.
  const match = /([a-z0-9]{20})/.exec(out);
  const ref = match?.[1];
  if (!ref) {
    failFast(`Could not read the new project ref from CLI output: ${out}`);
  }
  const info = await lookupProject(ref);
  if (!info) {
    failFast(`Created project ${ref} but could not find it in the projects list.`);
  }
  return info;
}

/** Best-effort teardown of a project. Never throws (cleanup path). */
async function teardownProject(ref: string): Promise<void> {
  try {
    await supabase(['projects', 'delete', ref, '--yes']);
    console.log(`[disposable-backend] project ${ref} deleted.`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(
      `[disposable-backend] WARNING: could not delete project ${ref} automatically (${message}). ` +
        'Delete it manually from the Supabase dashboard. The project is disposable; no real data is at risk.',
    );
  }
}

/* ------------------------------------------------------------------ */
/* Env emission (dist-live build)                                       */
/* ------------------------------------------------------------------ */

async function emitLiveEnv(info: ProjectInfo, marker: string): Promise<void> {
  // Fetch the anon key via the CLI (list all keys; pick the anon one).
  const keysOut = await supabase(['projects', 'api-keys', '--project-ref', info.ref]);
  let anonKey = '';
  try {
    const keys = JSON.parse(keysOut) as { name?: string; api_key?: string }[];
    const anon = keys.find((k) => k.name === 'anon');
    if (anon?.api_key) anonKey = anon.api_key;
  } catch {
    // fall through — anonKey stays empty and the guard/env write will flag it
  }
  if (!anonKey) {
    failFast(`Could not read the anon key from CLI output for ${info.ref}: ${keysOut}`);
  }

  const url = projectHostFromRef(info.ref);
  const env = {
    EXPO_PUBLIC_SUPABASE_URL: url,
    EXPO_PUBLIC_SUPABASE_ANON_KEY: anonKey,
    SIMULATION_LANE: 'disposable',
    SIMULATION_DISPOSABLE_MARKER: marker,
    SIMULATION_DISPOSABLE_PROJECT_NAME: info.name,
    SUPABASE_PROJECT_REF: info.ref,
    SUPABASE_PROJECT_URL: url,
  };

  await mkdir(STATE_DIR, { recursive: true });
  const lines = [
    `# Generated by simulation/backend/provision.ts — short-lived, disposable-lane only.`,
  ];
  for (const key of EMITTED_ENV_KEYS) {
    lines.push(`export ${key}=${JSON.stringify(env[key])}`);
  }
  await writeFile(LIVE_ENV_FILE, `${lines.join('\n')}\n`, 'utf8');
  await writeFile(MARKER_FILE, `${marker}\n`, 'utf8');

  console.log(`[disposable-backend] env emitted to ${LIVE_ENV_FILE}`);
}

/* ------------------------------------------------------------------ */
/* Commands                                                             */
/* ------------------------------------------------------------------ */

interface CommonOpts {
  markerPrefix: string;
  orgId: string | null;
  region: string;
  productionHosts: string[];
  /** The ambient shell captured at CLI start; the guard scans it for production credentials. */
  ambientEnv: NodeJS.ProcessEnv;
}

function parseCommonOpts(argv: string[]): CommonOpts {
  const get = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    return i >= 0 && i + 1 < argv.length ? argv[i + 1] : undefined;
  };
  return {
    markerPrefix:
      get('--marker-prefix') ??
      process.env.SUPABASE_DISPOSABLE_MARKER_PREFIX ??
      DEFAULT_MARKER_PREFIX,
    orgId: get('--org-id') ?? process.env.SUPABASE_ORG_ID ?? null,
    region: get('--region') ?? process.env.SUPABASE_REGION ?? DEFAULT_REGION,
    productionHosts: parseProductionHosts(process.env),
    ambientEnv: process.env,
  };
}

function hasFlag(argv: string[], flag: string): boolean {
  return argv.includes(flag);
}

/**
 * `run` — the full guarded lifecycle. Guards before any network call, then
 * provisions, applies schema, (optionally) deploys the parser, emits env, and
 * tears down in a finally.
 */
async function run(argv: string[]): Promise<number> {
  const opts = parseCommonOpts(argv);
  const withParser = hasFlag(argv, '--with-parser');
  const noTeardown = hasFlag(argv, '--no-teardown');
  const reuseRef = argv.find((a) => a.startsWith('--reuse='))?.slice('--reuse='.length) ?? null;

  // Preconditions (CLI, login, marker, org, production hosts).
  await assertPreconditions(opts);

  const marker = `${opts.markerPrefix}-${shortRunId()}`;

  // GUARD *before* any project creation or network call: with the planned
  // disposable name (rule c satisfied by construction) and the ambient env
  // (rule b). targetHost is unknown until the project exists, so pass '' here;
  // the post-create guard below re-checks with the real host.
  guardFor('', marker, opts);

  let info: ProjectInfo;
  if (reuseRef) {
    const existing = await lookupProject(reuseRef);
    if (!existing) failFast(`--reuse project ${reuseRef} not found in account.`);
    info = existing;
    // GUARD on the real, reused project: host + name + ambient env. A reused
    // project that lost its disposable marker is refused here.
    guardFor(projectHostFromRef(info.ref), info.name, opts);
  } else {
    info = await createProject({ orgId: opts.orgId as string, name: marker, region: opts.region });
    // GUARD on the real project we just created (defense-in-depth).
    guardFor(projectHostFromRef(info.ref), info.name, opts);
  }

  try {
    await waitForProjectReady(info.ref);
    await applySchemaToProject(info.ref, /* wipe */ Boolean(reuseRef));
    if (withParser) {
      await supabase(['functions', 'deploy', 'parse-ai-command', '--project-ref', info.ref], {
        cwd: path.join(__dirname, '..', '..'),
      });
    }
    await emitLiveEnv(info, marker);
    console.log(
      `[disposable-backend] ready: ref=${info.ref} name=${info.name} marker=${marker}\n` +
        `  next: build dist-live via build-dist-live.sh, then run the round-trip scenario set.`,
    );
  } finally {
    if (noTeardown) {
      console.log(`[disposable-backend] --no-teardown: leaving project ${info.ref} in place.`);
    } else {
      await teardownProject(info.ref);
    }
  }
  return 0;
}

/**
 * `check` — guard-only, used by build-dist-live.sh. Reads the emitted target
 * from the live-env file and the CURRENT ambient shell, then runs the guard.
 * Exits 0 on PASS, 1 on ABORT. This is the last line of defense before the
 * export: it must run BEFORE the disposable env is sourced into the shell.
 */
async function check(): Promise<number> {
  const env: Record<string, string | undefined> = {};
  try {
    const raw = await readFile(LIVE_ENV_FILE, 'utf8');
    for (const line of raw.split('\n')) {
      const m = /^export ([A-Z_]+)=(.*)$/.exec(line.trim());
      if (m) {
        try {
          env[m[1]] = JSON.parse(m[2]) as string;
        } catch {
          env[m[1]] = m[2];
        }
      }
    }
  } catch {
    failFast(
      `No live-env file at ${LIVE_ENV_FILE}. Provision a disposable project first (` +
        '`npx tsx simulation/backend/provision.ts run`). The dist-live build may not proceed unguarded.',
    );
  }

  const targetHost = env.EXPO_PUBLIC_SUPABASE_URL ?? '';
  const targetProjectName = env.SIMULATION_DISPOSABLE_PROJECT_NAME ?? null;
  const markerPrefix = process.env.SUPABASE_DISPOSABLE_MARKER_PREFIX ?? DEFAULT_MARKER_PREFIX;
  const productionHosts = parseProductionHosts(process.env);

  if (productionHosts.length === 0) {
    failFast(
      'SIMULATION_PRODUCTION_SUPABASE_HOSTS is not set; cannot prove the target is not production.',
    );
  }

  const result = checkDisposableBackend({
    targetHost,
    productionHosts,
    ambientEnv: process.env,
    disposableMarkerPrefix: markerPrefix,
    targetProjectName,
  });

  if (result.ok) {
    console.log(`[disposable-backend] guard PASSED for ${targetHost}`);
    return 0;
  }
  console.error(result.message);
  return 1;
}

/* ------------------------------------------------------------------ */
/* CLI entry                                                             */
/* ------------------------------------------------------------------ */

export async function main(argv: string[]): Promise<number> {
  const command = argv[0] ?? 'run';
  const rest = argv.slice(1);
  switch (command) {
    case 'run':
      return run(rest);
    case 'create':
      return run([...rest, '--no-teardown']);
    case 'check':
      return check();
    case 'help':
    case '--help':
    case '-h':
      console.log(
        [
          'usage: provision.ts <command> [options]',
          '',
          'commands:',
          '  run                 full guarded lifecycle (create/reuse -> schema -> optional parser -> env -> teardown)',
          '  create              like run but leaves the project in place (--reuse later)',
          '  check               guard-only; PASS/ABORT against the emitted live-env (used by build-dist-live.sh)',
          '  help                this help',
          '',
          'options:',
          '  --org-id <id>       Supabase org id (or SUPABASE_ORG_ID)',
          '  --marker-prefix <p> disposable marker prefix (default: superhabits-disposable)',
          '  --region <r>        creation region (default: us-east-1)',
          '  --reuse=<ref>       reuse an existing project by ref instead of creating',
          '  --with-parser       deploy the parse-ai-command edge function',
          '  --no-teardown       keep the project after the run',
          '',
          'env: SUPABASE_ACCESS_TOKEN, SUPABASE_ORG_ID, SIMULATION_PRODUCTION_SUPABASE_HOSTS, SUPABASE_DISPOSABLE_MARKER_PREFIX',
        ].join('\n'),
      );
      return 0;
    default:
      console.error(`Unknown command: ${command}`);
      return 1;
  }
}

// Run as a CLI only when executed directly (the module is also imported by
// tests/other tooling for its pure exports).
if (require.main === module) {
  void runMain(() => main(process.argv.slice(2)));
}
