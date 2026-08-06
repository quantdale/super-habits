/**
 * Scaffold the next append-only SQLite migration in core/db/client.ts.
 *
 * Local DB migrations are sequential `if (version < N) { ... }` blocks inside
 * `runMigrations()`; each one persists its version bump atomically through
 * `applyMigration(db, N, ...)` (there is no separate version-persist statement
 * inside `runMigrations()` — that lives in `applyMigration`). Hand-writing a
 * new block is error-prone, so this script:
 *
 *   1. Parses the `if (version < N)` blocks inside `runMigrations()` and
 *      detects the current max migration version (fails loudly if none found).
 *   2. Inserts a well-commented, inert stub for `N+1` right before the closing
 *      brace of `runMigrations()` — matching the file's 2-space indentation.
 *      The stub body is comments only, so it compiles, runs as a no-op, and
 *      does not bump the stored schema version.
 *   3. Prints the follow-up steps (types.ts, integration tests, schema.sql).
 *
 * Idempotent: refuses to insert when a block for `N+1` already exists, and
 * refuses again when the newest block is still the unmodified stub this
 * script generated (so a second run never stacks two adjacent stubs).
 *
 * Usage:
 *   node scripts/new-migration.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const CLIENT_PATH = join(ROOT, 'core/db/client.ts');

/** Matches a migration block opener, e.g. `  if (version < 11) {`. */
const MIGRATION_BLOCK_RE = /^\s*if \(version < (\d+)\)\s*\{$/gm;

function fail(message) {
  console.error(`error: ${message}`);
  process.exit(1);
}

/**
 * Returns the index of the `}` that closes the brace opened at `openIndex`,
 * skipping strings, template literals, and comments so braces inside them
 * never count toward the depth.
 */
function findClosingBrace(source, openIndex) {
  let depth = 0;
  let i = openIndex;
  const end = source.length;
  while (i < end) {
    const ch = source[i];
    const next = source[i + 1];
    if (ch === '/' && next === '/') {
      i += 2;
      while (i < end && source[i] !== '\n') i += 1;
      continue;
    }
    if (ch === '/' && next === '*') {
      i += 2;
      while (i < end && !(source[i] === '*' && source[i + 1] === '/')) i += 1;
      i += 2;
      continue;
    }
    if (ch === "'" || ch === '"') {
      i += 1;
      while (i < end && source[i] !== ch) {
        if (source[i] === '\\') i += 1;
        i += 1;
      }
      i += 1;
      continue;
    }
    if (ch === '`') {
      i += 1;
      while (i < end && source[i] !== '`') {
        if (source[i] === '\\') i += 1;
        i += 1;
      }
      i += 1;
      continue;
    }
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return i;
    }
    i += 1;
  }
  return -1;
}

/**
 * True when `source[start..end)` contains nothing but whitespace and
 * comments — i.e. the scaffold stub is still untouched (its `applyMigration`
 * call is still commented out), so it is a no-op at runtime.
 */
function isOnlyCommentsAndWhitespace(source, start, end) {
  let i = start;
  while (i < end) {
    const ch = source[i];
    const next = source[i + 1];
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
      i += 1;
    } else if (ch === '/' && next === '/') {
      i += 2;
      while (i < end && source[i] !== '\n') i += 1;
    } else if (ch === '/' && next === '*') {
      i += 2;
      while (i < end && !(source[i] === '*' && source[i + 1] === '/')) i += 1;
      i += 2;
    } else {
      return false;
    }
  }
  return true;
}

let source;
try {
  source = readFileSync(CLIENT_PATH, 'utf8');
} catch (err) {
  fail(`cannot read core/db/client.ts (${err.message})`);
}
const eol = source.includes('\r\n') ? '\r\n' : '\n';

// Locate `runMigrations()` and its closing brace — the insertion anchor. The
// version-persist statement does not exist here: `applyMigration()` persists
// each bump, so the new block goes at the end of the function body.
const sigIndex = source.indexOf('async function runMigrations(');
if (sigIndex === -1) {
  fail(
    `could not find 'async function runMigrations(' in core/db/client.ts — ` +
      `the anchor pattern has changed; update this script.`,
  );
}
const bodyOpen = source.indexOf('{', sigIndex);
if (bodyOpen === -1) {
  fail(`could not find the opening brace of runMigrations() in core/db/client.ts.`);
}
const closeIndex = findClosingBrace(source, bodyOpen);
if (closeIndex === -1) {
  fail(`could not find the closing brace of runMigrations() in core/db/client.ts.`);
}

const blocks = [...source.slice(bodyOpen, closeIndex).matchAll(MIGRATION_BLOCK_RE)];
if (blocks.length === 0) {
  fail(
    `no 'if (version < N)' migration blocks found inside runMigrations() in ` +
      `core/db/client.ts — the block pattern has changed; update this script.`,
  );
}

const versions = blocks.map((m) => Number(m[1]));
const maxVersion = Math.max(...versions);
const target = maxVersion + 1;

// Idempotency guard 1: a block for the target version already exists.
if (new RegExp(`if \\(version < ${target}\\)\\s*\\{`).test(source)) {
  fail(
    `a migration block for version ${target} already exists in core/db/client.ts ` +
      `— refusing to insert a duplicate.`,
  );
}

// Idempotency guard 2: the newest block is still the scaffold stub (comments
// only) — implement or remove it before scaffolding the next version.
const newestBlock = blocks[blocks.length - 1];
// Match indices are relative to the function-body slice; re-base to absolute.
const newestBlockOpen = bodyOpen + newestBlock.index + newestBlock[0].indexOf('{');
const newestBlockClose = findClosingBrace(source, newestBlockOpen);
if (
  newestBlockClose !== -1 &&
  isOnlyCommentsAndWhitespace(source, newestBlockOpen + 1, newestBlockClose)
) {
  fail(
    `the newest migration block (version ${maxVersion}) in core/db/client.ts is ` +
      `still the unmodified scaffold stub — implement it (or remove it via ` +
      `'git checkout core/db/client.ts') before scaffolding version ${target}.`,
  );
}

const stub = [
  `  if (version < ${target}) {`,
  `    // TODO(migration ${target}): implement the next schema migration.`,
  `    //`,
  `    // Pattern — uncomment, fill in, and remove the TODO:`,
  `    //   await applyMigration(db, ${target}, async () => {`,
  `    //     await addColumnIfMissing(db, 'todos', 'some_column', 'TEXT');`,
  `    //     // or: await db.execAsync('CREATE TABLE IF NOT EXISTS ...');`,
  `    //   });`,
  `    //`,
  `    // Non-negotiable invariants (see AGENTS.md):`,
  `    //   - Soft delete only: never DELETE FROM synced entity tables; use`,
  `    //     'UPDATE ... SET deleted_at = datetime('now')' and filter reads`,
  `    //     with 'WHERE deleted_at IS NULL'.`,
  `    //   - Sync enqueue: after INSERT/UPDATE on todos, habits,`,
  `    //     calorie_entries or workout_routines, call syncEngine.enqueue(...)`,
  `    //     in the feature data layer.`,
  `    //   - Append-only: do not edit earlier migration blocks.`,
  `    //   - applyMigration(db, ${target}, ...) persists the version bump`,
  `    //     atomically — no manual app_meta write is needed here.`,
  `  }`,
].join(eol);

const nextSteps = [
  `Migration stub for version ${target} inserted in core/db/client.ts (detected max: ${maxVersion}).`,
  ``,
  `Next steps:`,
  `  1. Implement the migration inside the new 'if (version < ${target})' block.`,
  `  2. If the migration adds/changes tables or columns, update the entity`,
  `     types in core/db/types.ts.`,
  `  3. Add or adjust coverage in tests/integration/migrations.test.ts`,
  `     (stored-version assertions, EXPECTED_TABLES / EXPECTED_NAMED_INDEXES).`,
  `  4. Hand-update the reference snapshot core/db/schema.sql if the schema changed.`,
  `  5. Verify: npm run typecheck && npm test -- --project integration`,
].join(eol);

try {
  writeFileSync(CLIENT_PATH, source.slice(0, closeIndex) + stub + eol + source.slice(closeIndex));
} catch (err) {
  fail(`cannot write core/db/client.ts (${err.message})`);
}

console.log(nextSteps);
