/**
 * Bug-reproduction bundle — writer + schema (`add-user-simulation-platform`
 * task 5.1, design D5).
 *
 * A bundle is a portable, replayable capture of the state + actions + environment
 * that produced a bug. It is a plain directory (not a zip) so it can be inspected
 * and edited by hand (e.g. to correct a wrong expectation before replaying).
 *
 * ## Bundle layout
 *
 * ```
 * <bundleDir>/
 *   bundle.json      # metadata: schema version, commit, scenario/persona refs,
 *                    #   seed, mode, lane, timezone, browser, timestamps, file index
 *   report.json      # the original run-report (run-report.json schema) — the
 *                    #   baseline for step-level divergence comparison on replay
 *   db.sqlite.json   # SQLite row-level dump: { tables: { <table>: [row, ...] } }
 *                    #   (see "Why a row dump, not a binary file" below)
 *   storage.json     # AsyncStorage dump: { "<superhabits.* key>": "<value>" }
 *   actions.jsonl    # one semantic step per line (the replayable action log)
 *   trace.zip        # Playwright trace, copied from the run's artifacts (best-effort)
 *   console.log      # captured console error/warn/log lines (best-effort)
 *   network.har      # HAR-lite network log (best-effort; empty when not captured)
 *   narrative.md     # template for the human story of the bug
 * ```
 *
 * ## Why a row dump, not a binary file
 *
 * The web export stores the app database in the browser's OPFS (per-origin, side
 * channel to the page), so there is no single `*.sqlite` file on disk a capture
 * can copy. The DB harness (`e2e/helpers/dbHarness.ts`) opens the SAME database
 * the app uses and exposes raw SQL, so the writer dumps every app table's rows
 * and replay restores them with `INSERT` statements. This is a documented
 * deviation from the design's `db.sqlite` name — the file is `db.sqlite.json`
 * and is a row-level dump, not a SQLite binary.
 *
 * ## Synthetic-data-only rule
 *
 * Bundles are SYNTHETIC-DATA-ONLY. Every captured row must come from a test
 * fixture or a scenario's own writes — never real user data. See
 * `simulation/repro/README.md`.
 *
 * The module is split into pure (unit-testable) serializers and browser-touching
 * functions. The pure parts import no Playwright runtime and no fs I/O on the
 * browser object.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';
import type { Page, BrowserContext } from '@playwright/test';
import { ensureDbContext, queryRows } from '../../e2e/helpers/dbHarness';
import type { NetworkEvent } from '../runner/execute';
import type { RunReport } from '../observe/report';
import type { SemanticStep } from '../model/types';
import { simulationOutputRoot } from '../observe/artifacts';

/** Current bundle schema version. Bump on any breaking change to the layout. */
export const BUNDLE_SCHEMA_VERSION = 1;

/** Default bundle output root (gitignored via `/simulation-output/`). */
export const BUNDLE_OUTPUT_SUBDIR = 'bundles';

/** The `bundle.json` metadata document. */
export interface BundleMetadata {
  schemaVersion: typeof BUNDLE_SCHEMA_VERSION;
  /** Stable identifier for the bundle, e.g. `bundle_<ts>_<8 chars>`. */
  bundleId: string;
  /** The run this bundle was captured from. */
  runId: string;
  /** ISO timestamp of capture. */
  createdAt: string;
  /** Git commit the build was exported from, or null when unavailable. */
  commit: string | null;
  /** Scenario reference from the original run report (null for ad-hoc). */
  scenario: RunReport['scenario'];
  persona: RunReport['persona'];
  seed: RunReport['seed'];
  mode: RunReport['mode'];
  lane: RunReport['lane'];
  /** IANA timezone of the capture host, e.g. `Asia/Manila`. */
  timezone: string;
  /** The environment the run executed against (from the run report). */
  environment: RunReport['environment'];
  /** Outcome of the original run (a bundle is usually captured on failure). */
  outcome: RunReport['outcome'];
  /** Number of semantic steps in `actions.jsonl`. */
  stepCount: number;
  /** File index (relative paths within the bundle directory). */
  files: {
    db: string;
    storage: string;
    actions: string;
    report: string;
    trace?: string;
    console?: string;
    network: string;
    narrative: string;
  };
}

/** The SQLite row dump stored in `db.sqlite.json`. */
export interface SqliteDump {
  tables: Record<string, Record<string, unknown>[]>;
}

/** A validation finding for a bundle metadata document. */
export interface BundleValidationIssue {
  path: string;
  message: string;
}

/* ------------------------------------------------------------------ */
/* Pure metadata helpers                                               */
/* ------------------------------------------------------------------ */

/** Read the current git HEAD (short sha) via `git rev-parse`, or null. */
export function getCurrentCommit(): string | null {
  try {
    const out = execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const trimmed = out.trim();
    return trimmed.length > 0 ? trimmed : null;
  } catch {
    // Not a git checkout, or git unavailable — the field is optional.
    return null;
  }
}

/** Detect the host IANA timezone, or `unknown`. */
export function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown';
  } catch {
    return 'unknown';
  }
}

/** Generate a stable bundle id (`bundle_<ts36>_<8 rand>`). */
export function makeBundleId(): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `bundle_${Date.now().toString(36)}_${rand}`;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim() !== '';
}

/** Validate a parsed `bundle.json`. Returns `[]` when valid. */
export function validateBundleMetadata(parsed: unknown): BundleValidationIssue[] {
  const issues: BundleValidationIssue[] = [];
  if (!isRecord(parsed)) {
    issues.push({ path: 'bundle', message: 'must be an object' });
    return issues;
  }
  if (parsed.schemaVersion !== BUNDLE_SCHEMA_VERSION) {
    issues.push({ path: 'schemaVersion', message: `must be ${BUNDLE_SCHEMA_VERSION}` });
  }
  if (!isNonEmptyString(parsed.bundleId)) {
    issues.push({ path: 'bundleId', message: 'must be a non-empty string' });
  }
  if (!isNonEmptyString(parsed.runId)) {
    issues.push({ path: 'runId', message: 'must be a non-empty string' });
  }
  if (typeof parsed.createdAt !== 'string' || Number.isNaN(Date.parse(parsed.createdAt))) {
    issues.push({ path: 'createdAt', message: 'must be an ISO date string' });
  }
  if (parsed.commit !== null && typeof parsed.commit !== 'string') {
    issues.push({ path: 'commit', message: 'must be a string or null' });
  }
  if (
    parsed.mode !== 'deterministic' &&
    parsed.mode !== 'seeded' &&
    parsed.mode !== 'exploratory'
  ) {
    issues.push({ path: 'mode', message: `unknown mode: ${String(parsed.mode)}` });
  }
  if (!isRecord(parsed.files)) {
    issues.push({ path: 'files', message: 'must be an object' });
  } else {
    for (const key of ['db', 'storage', 'actions', 'report', 'network', 'narrative'] as const) {
      if (!isNonEmptyString(parsed.files[key])) {
        issues.push({ path: `files.${key}`, message: 'must be a non-empty string' });
      }
    }
  }
  return issues;
}

/** Parse a bundle metadata JSON string; throws on malformed/invalid JSON. */
export function parseBundleMetadata(json: string): BundleMetadata {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (err) {
    throw new Error(`bundle.json is not valid JSON: ${(err as Error).message}`);
  }
  const issues = validateBundleMetadata(parsed);
  if (issues.length > 0) {
    const detail = issues.map((i) => `${i.path}: ${i.message}`).join('; ');
    throw new Error(`bundle.json failed validation: ${detail}`);
  }
  return parsed as BundleMetadata;
}

/* ------------------------------------------------------------------ */
/* Pure serializers (unit-testable)                                    */
/* ------------------------------------------------------------------ */

/** Serialize the semantic action log to one JSON object per line. */
export function serializeActionsJsonl(steps: SemanticStep[]): string {
  return steps.map((s) => JSON.stringify(s)).join('\n') + (steps.length ? '\n' : '');
}

/** Parse a serialized `actions.jsonl` back into an ordered step list. */
export function parseActionsJsonl(json: string): SemanticStep[] {
  return json
    .split('\n')
    .filter((l) => l.trim() !== '')
    .map((l) => JSON.parse(l) as SemanticStep);
}

/** Serialize a SQLite dump to the JSON string stored in `db.sqlite.json`. */
export function serializeSqliteDump(dump: SqliteDump): string {
  return JSON.stringify(dump, null, 2);
}

/** Parse a `db.sqlite.json` into a `SqliteDump`. */
export function parseSqliteDump(json: string): SqliteDump {
  const parsed = JSON.parse(json) as SqliteDump;
  if (!parsed || typeof parsed !== 'object' || !isRecord(parsed.tables)) {
    throw new Error('db.sqlite.json is malformed: expected { tables: { <table>: [row] } }');
  }
  return parsed;
}

/** Escape a value as a SQLite literal for an INSERT statement. */
export function sqlLiteral(v: unknown): string {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'NULL';
  if (typeof v === 'boolean') return v ? '1' : '0';
  if (typeof v === 'bigint') return String(v);
  if (typeof v === 'string') return `'${v.replace(/'/g, "''")}'`;
  // Objects/arrays (defensive — SQLite rows are scalars) serialize as JSON.
  if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'`;
  // symbol / function fallback (never a real SQLite row value): coerce to string.
  return `'${v as string}'`;
}

/**
 * Dependency-safe restore order: parent tables before their children so SQLite
 * foreign keys (if enforced) are satisfied. Unknown tables are appended in
 * alphabetical order afterwards.
 */
const KNOWN_TABLE_ORDER = [
  'app_meta',
  'habits',
  'todos',
  'calorie_entries',
  'saved_meals',
  'workout_routines',
  'pomodoro_sessions',
  'habit_completions',
  'routine_exercises',
  'workout_logs',
  'routine_exercise_sets',
  'workout_session_exercises',
  'linked_action_rules',
  'linked_action_events',
  'linked_action_executions',
];

/** Order tables for restore (known first, unknowns alphabetically). */
export function orderTablesForRestore(dump: SqliteDump): string[] {
  const known = KNOWN_TABLE_ORDER.filter((t) => dump.tables[t] && dump.tables[t].length > 0);
  const unknown = Object.keys(dump.tables)
    .filter((t) => !KNOWN_TABLE_ORDER.includes(t) && dump.tables[t].length > 0)
    .sort();
  return [...known, ...unknown];
}

/**
 * Build the SQL that restores a dump into a fresh, schema-bootstrapped database.
 * For each non-empty table it DELETEs existing rows (idempotent replay) then
 * INSERTS the captured rows column-by-column.
 */
export function buildRestoreSql(dump: SqliteDump): string {
  const statements: string[] = [];
  for (const table of orderTablesForRestore(dump)) {
    const rows = dump.tables[table];
    if (!Array.isArray(rows) || rows.length === 0) continue;
    const quote = (s: string) => `"${s.replace(/"/g, '""')}"`;
    statements.push(`DELETE FROM ${quote(table)};`);
    const cols = Object.keys(rows[0]);
    const colList = cols.map(quote).join(', ');
    for (const row of rows) {
      const values = cols.map((c) => sqlLiteral(row[c])).join(', ');
      statements.push(`INSERT INTO ${quote(table)} (${colList}) VALUES (${values});`);
    }
  }
  return statements.join('\n');
}

/** Build a HAR-lite network log from captured network events. */
export function buildHar(networkEvents: NetworkEvent[], startedAt: string): string {
  const entries = networkEvents.map((e, i) => ({
    startedDateTime: startedAt,
    time: 0,
    _index: i,
    request: {
      method: 'GET',
      url: e.url,
      httpVersion: 'HTTP/1.1',
      headers: [],
      queryString: [],
      cookies: [],
      headersSize: -1,
      bodySize: 0,
    },
    response: {
      status: e.failed ? 0 : e.status,
      statusText: e.failed ? (e.error ?? 'failed') : '',
      httpVersion: 'HTTP/1.1',
      headers: [],
      cookies: [],
      content: { size: 0, mimeType: '' },
      redirectURL: '',
      headersSize: -1,
      bodySize: 0,
    },
    cache: {},
    timings: { send: 0, wait: 0, receive: 0 },
    _failed: e.failed,
    _error: e.error,
  }));
  return JSON.stringify(
    {
      log: {
        version: '1.2',
        creator: { name: 'superhabits-repro', version: String(BUNDLE_SCHEMA_VERSION) },
        entries,
      },
    },
    null,
    2,
  );
}

/** Build the `narrative.md` template for a bundle. */
export function buildNarrativeTemplate(meta: {
  bundleId: string;
  runId: string;
  commit: string | null;
  scenario: RunReport['scenario'];
  seed: RunReport['seed'];
}): string {
  const scenarioLine = meta.scenario
    ? `${meta.scenario.id} — ${meta.scenario.goal}`
    : '*ad-hoc (no scenario ref)*';
  const seedLine = meta.seed !== null ? `\`${meta.seed}\`` : '*none*';
  return [
    '# Repro bundle narrative',
    '',
    '<!-- Fill in the story of the bug this bundle reproduces. This is the human',
    '     half of the bundle; the machine half is in `actions.jsonl` + `db.sqlite.json`. -->',
    '',
    '- **Bundle**: `' + meta.bundleId + '`',
    '- **Run**: `' + meta.runId + '`',
    '- **Commit**: ' + (meta.commit ?? '*unknown*'),
    '- **Scenario**: ' + scenarioLine,
    '- **Seed**: ' + seedLine,
    '',
    '## What the user was doing',
    '',
    '<!-- e.g. "Typed a title, hit add, the todo list cleared." -->',
    '',
    '## Expected',
    '',
    '<!-- What should have happened. -->',
    '',
    '## Observed',
    '',
    '<!-- What actually happened (the bug). -->',
    '',
    '## Replay',
    '',
    '```bash',
    'npm run sim:repro:replay <this-bundle-directory>',
    '```',
    '',
    'Replay restores the captured DB + storage into a fresh context and',
    're-executes `actions.jsonl`, reporting step-level divergence. If the bug',
    'is a wrong expectation, correct the oracle in `actions.jsonl` and replay',
    'again to confirm the fix.',
    '',
  ].join('\n');
}

/* ------------------------------------------------------------------ */
/* Browser-side capture (runner onFailure hook + on-demand command)    */
/* ------------------------------------------------------------------ */

/** Dump every non-system table's rows via the DB harness. */
export async function dumpSqliteRows(page: Page): Promise<SqliteDump> {
  await ensureDbContext(page);
  const tableRows = await queryRows(
    page,
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  );
  const dump: SqliteDump = { tables: {} };
  for (const row of tableRows) {
    const name = String(row.name);
    const rows = await queryRows(page, `SELECT * FROM "${name.replace(/"/g, '""')}"`);
    if (rows.length > 0) dump.tables[name] = rows;
  }
  return dump;
}

/** Dump the AsyncStorage (localStorage) `superhabits.*` keys. */
export async function dumpStorage(page: Page): Promise<Record<string, string>> {
  return page.evaluate(() => {
    const out: Record<string, string> = {};
    for (const key of Object.keys(window.localStorage)) {
      if (key.startsWith('superhabits.')) {
        out[key] = window.localStorage.getItem(key) ?? '';
      }
    }
    return out;
  });
}

/** Copy a repo-root-relative artifact (e.g. trace) into the bundle dir. */
function copyArtifact(
  rel: string | undefined,
  bundleDir: string,
  targetName: string,
): string | undefined {
  if (!rel) return undefined;
  const src = path.resolve(process.cwd(), rel);
  try {
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(bundleDir, targetName));
      return targetName;
    }
  } catch {
    // best-effort
  }
  return undefined;
}

/** Write helpers. */
function writeFile(dir: string, name: string, content: string): void {
  fs.writeFileSync(path.join(dir, name), content, 'utf8');
}

/** Options for `captureBundle`. */
export interface CaptureBundleOptions {
  /** The page (must be on the app origin; routed for the DB harness). */
  page: Page;
  /** The context (unused directly; kept for API symmetry / future hooks). */
  context?: BrowserContext;
  /** The original run report (baseline for replay divergence). */
  report: RunReport;
  /** The run id (used as the bundle directory name). */
  runId: string;
  /** The expanded semantic steps of the run (== `actions.jsonl`). */
  steps: SemanticStep[];
  /** Captured console lines, if any. */
  consoleLines?: string[];
  /** Captured network events, if any. */
  networkEvents?: NetworkEvent[];
  /** Output root; defaults to `<simulation-output>/bundles`. */
  outputDir?: string;
}

/**
 * Capture a repro bundle from a live page + run report. The page's DB is dumped
 * through the DB harness (leaving it in DB context) and the storage is dumped
 * for the same origin. Returns the bundle directory and metadata.
 */
export async function captureBundle(opts: CaptureBundleOptions): Promise<{
  bundleDir: string;
  metadata: BundleMetadata;
}> {
  const outputRoot = opts.outputDir ?? path.join(simulationOutputRoot(), BUNDLE_OUTPUT_SUBDIR);
  const bundleDir = path.join(outputRoot, opts.runId);
  fs.mkdirSync(bundleDir, { recursive: true });

  const createdAt = new Date().toISOString();

  const dump = await dumpSqliteRows(opts.page);
  writeFile(bundleDir, 'db.sqlite.json', serializeSqliteDump(dump));

  const storage = await dumpStorage(opts.page);
  writeFile(bundleDir, 'storage.json', JSON.stringify(storage, null, 2));

  writeFile(bundleDir, 'actions.jsonl', serializeActionsJsonl(opts.steps));
  writeFile(bundleDir, 'report.json', JSON.stringify(opts.report, null, 2));

  const trace = copyArtifact(opts.report.artifacts.trace, bundleDir, 'trace.zip');
  const consoleRel =
    opts.consoleLines && opts.consoleLines.length > 0
      ? (writeFile(bundleDir, 'console.log', opts.consoleLines.join('\n') + '\n'), 'console.log')
      : undefined;
  writeFile(bundleDir, 'network.har', buildHar(opts.networkEvents ?? [], createdAt));
  writeFile(
    bundleDir,
    'narrative.md',
    buildNarrativeTemplate({
      bundleId: makeBundleId(),
      runId: opts.runId,
      commit: getCurrentCommit(),
      scenario: opts.report.scenario,
      seed: opts.report.seed,
    }),
  );

  const metadata: BundleMetadata = {
    schemaVersion: BUNDLE_SCHEMA_VERSION,
    bundleId: makeBundleId(),
    runId: opts.runId,
    createdAt,
    commit: getCurrentCommit(),
    scenario: opts.report.scenario,
    persona: opts.report.persona,
    seed: opts.report.seed,
    mode: opts.report.mode,
    lane: opts.report.lane,
    timezone: detectTimezone(),
    environment: opts.report.environment,
    outcome: opts.report.outcome,
    stepCount: opts.steps.length,
    files: {
      db: 'db.sqlite.json',
      storage: 'storage.json',
      actions: 'actions.jsonl',
      report: 'report.json',
      trace,
      console: consoleRel,
      network: 'network.har',
      narrative: 'narrative.md',
    },
  };
  writeFile(bundleDir, 'bundle.json', JSON.stringify(metadata, null, 2));
  return { bundleDir, metadata };
}
