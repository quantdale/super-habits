/**
 * Quarantine-register parity guard.
 *
 * Standing rule it guards (docs/testing/known-gaps.md): "Any skipped or
 * quarantined test is added to this register, with its reason. Weakening an
 * assertion is never an acceptable resolution."
 *
 * Root cause it guards against: V2-era `@sync` journeys
 * (new-phone-v2, new-phone-v2-settings-failures, portable-owner-recovery,
 * command-center-v2-ask) rode the dist-sync lane gate for weeks with no
 * register entry, and e2e/README.md still described CG-4/CG-5 as quarantined
 * months after they closed — because nothing compared gate sites to the
 * register.
 *
 * Rule, in BOTH directions:
 *   1. every gate site (e2e spec or Vitest test file) that contains a real
 *      `test.fixme(` / `test.skip(` / `describe.skipIf(` / `it.skipIf(` /
 *      `it.fails(` call must be named by a STRUCTURED register entry — one that
 *      carries a `**Gate site:**` line naming the file — not merely mentioned
 *      somewhere in the prose;
 *   2. every structured register entry must name a file that actually contains
 *      a gate call, so a register entry cannot outlive the gate it describes.
 *
 * Only spec/test files are scanned — helpers such as e2e/helpers/journey.ts
 * implement the quarantine mechanism itself.
 *
 * Exit 1 with the mismatched stems on any failure. Wired into `qa:fast` and the
 * CI `quality` job.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';

const root = process.cwd();
const REGISTER_PATH = join(root, 'docs', 'testing', 'known-gaps.md');

/**
 * Strip line and block comments so doc mentions of a gate do not count as
 * gate sites. Single-pass lexer: `//`, block opens, and quote toggles are
 * only honoured outside strings, and comment delimiters inside strings
 * (e.g. the `'**' + '/*.supabase.co/' + '**'` route patterns, which contain
 * both open and close sequences) never open or close a comment. Template
 * `${}` expressions are scanned as code. Backslash escapes are honoured.
 * Exported for the unit test.
 */
export function stripComments(source) {
  let out = '';
  // Stack of modes: 'code' | 'single' | 'double' | 'template' | 'expr'.
  // '${' inside a template pushes 'expr' (scanned as code); '}' pops it.
  // Each expr frame owns a brace depth so nested templates cannot corrupt it.
  const stack = ['code'];
  const exprDepths = [];
  let i = 0;
  const top = () => stack[stack.length - 1];
  while (i < source.length) {
    const ch = source[i];
    const next = source[i + 1] ?? '';
    const mode = top();
    if (mode === 'code' || mode === 'expr') {
      if (ch === '/' && next === '/') {
        while (i < source.length && source[i] !== '\n') i += 1;
        continue;
      }
      if (ch === '/' && next === '*') {
        i += 2;
        while (i < source.length && !(source[i] === '*' && source[i + 1] === '/')) i += 1;
        i += 2;
        continue;
      }
      if (ch === "'") {
        stack.push('single');
        out += ch;
        i += 1;
        continue;
      }
      if (ch === '"') {
        stack.push('double');
        out += ch;
        i += 1;
        continue;
      }
      if (ch === '`') {
        stack.push('template');
        out += ch;
        i += 1;
        continue;
      }
      if (mode === 'expr' && ch === '{') exprDepths[exprDepths.length - 1] += 1;
      if (mode === 'expr' && ch === '}') {
        if (exprDepths[exprDepths.length - 1] === 0) {
          stack.pop();
          exprDepths.pop();
          out += ch;
          i += 1;
          continue;
        }
        exprDepths[exprDepths.length - 1] -= 1;
      }
      out += ch;
      i += 1;
      continue;
    }
    if (mode === 'template') {
      if (ch === '\\') {
        out += ch + next;
        i += 2;
        continue;
      }
      if (ch === '`') {
        stack.pop();
        out += ch;
        i += 1;
        continue;
      }
      if (ch === '$' && next === '{') {
        stack.push('expr');
        exprDepths.push(0);
        out += ch + next;
        i += 2;
        continue;
      }
      out += ch;
      i += 1;
      continue;
    }
    // single / double string modes.
    if (ch === '\\') {
      out += ch + next;
      i += 2;
      continue;
    }
    if ((mode === 'single' && ch === "'") || (mode === 'double' && ch === '"')) {
      stack.pop();
    }
    out += ch;
    i += 1;
  }
  return out;
}

/**
 * Gate calls this guard recognizes. `test.fixme(` and `test.skip(` are the
 * Playwright quarantine/skip mechanisms; `describe.skipIf(` / `it.skipIf(` /
 * `it.fails(` are the Vitest equivalents (conditional skips and the
 * contract-gap quarantine mechanism tests/ uses).
 */
const GATE_CALL_PATTERNS = [
  /test\.fixme\s*\(/,
  /test\.skip\s*\(/,
  /describe\.skipIf\s*\(/,
  /it\.skipIf\s*\(/,
  /it\.fails\s*\(/,
];

/**
 * Return the sorted filename stems of files whose comment-stripped source
 * contains a real gate call.
 * Exported for the unit test. `files` is a Map of path -> source text.
 */
export function findGateFiles(files) {
  const stems = [];
  for (const [file, source] of files) {
    if (!isScannableFile(file)) continue;
    const code = stripComments(source);
    if (GATE_CALL_PATTERNS.some((pattern) => pattern.test(code))) {
      stems.push(stemOf(file));
    }
  }
  return stems.sort();
}

/**
 * Files excluded from the scan because they implement or test the quarantine
 * mechanism itself rather than carrying a product gate.
 *
 * `tests/quarantineRegisterParity.test.ts` holds this guard's own fixtures —
 * gate-call syntax inside string literals, which `stripComments` deliberately
 * preserves. Scanning it would report the guard as its own unregistered gate.
 */
const MECHANISM_FILES = [/(^|[\\/])tests[\\/]quarantineRegisterParity\.test\.ts$/];

/** Files this guard scans: Playwright spec files under `e2e/` and Vitest test files under `tests/`. */
function isScannableFile(file) {
  if (MECHANISM_FILES.some((pattern) => pattern.test(file))) return false;
  return (
    /(^|[\\/])e2e[\\/].*\.spec\.ts$/.test(file) || /(^|[\\/])tests[\\/].*\.test\.ts$/.test(file)
  );
}

/** `foo/bar/baz.spec.ts` -> `baz` (the stem a register entry must name). */
function stemOf(file) {
  return basename(file).replace(/\.(spec|test)\.ts$/, '');
}

/**
 * Parse the register's STRUCTURED entries: one per `**Gate site:**` line, each
 * naming the file its gate lives in (the owning heading is carried for
 * reporting). Prose mentions without that line are not registrations — the
 * incidental-mention case (`recoverable-account-v1` appearing in prose while its
 * real gate entry names the file) is exactly what this separates.
 *
 * A single register heading may own several gate sites (one lane, several
 * files), so every `**Gate site:**` line in a heading yields its own record.
 *
 * Exported for the unit test.
 */
export function parseRegisterEntries(registerText) {
  const entries = [];
  const blocks = registerText.split(/\n(?=###\s)/);
  for (const block of blocks) {
    const heading = /^###\s+(.+)$/m.exec(block);
    if (!heading) continue;
    const gateSites = [...block.matchAll(/\*\*Gate site:\*\*\s*(.+)/gi)].map(
      (match) => match[1].trim().replace(/`/g, '').split(/\s+/)[0],
    );
    for (const gateSitePath of gateSites) {
      entries.push({
        heading: heading[1].trim(),
        gateSitePath,
        stem: stemOf(gateSitePath),
        block,
      });
    }
  }
  return entries;
}

/**
 * Return the sorted subset of `stems` with no structured register entry naming
 * that stem's file as a gate site.
 * Exported for the unit test.
 */
export function findUnregistered(stems, registerEntries) {
  const registered = new Set(
    registerEntries.map((entry) => entry.stem).filter((stem) => stem.length > 0),
  );
  return stems.filter((stem) => !registered.has(stem)).sort();
}

/**
 * Return the structured register entries whose named gate site contains no gate
 * call — the reverse direction, so a register entry cannot outlive its gate.
 * Exported for the unit test.
 */
export function findStaleEntries(registerEntries, gateFiles) {
  const gateStems = new Set(gateFiles.map((file) => stemOf(file)));
  return registerEntries.filter((entry) => entry.stem.length > 0 && !gateStems.has(entry.stem));
}

function collectFiles(dir, files = [], extensions) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) collectFiles(full, files, extensions);
    else if (extensions.some((extension) => entry.endsWith(extension))) files.push(full);
  }
  return files;
}

// --- CLI body -----------------------------------------------------------
const e2eFiles = collectFiles(join(root, 'e2e'), [], ['.spec.ts']);
const testFiles = collectFiles(join(root, 'tests'), [], ['.test.ts']);
const sources = new Map(
  [...e2eFiles, ...testFiles].map((file) => [file, readFileSync(file, 'utf8')]),
);
const gateFiles = [...sources.keys()].filter((file) => isScannableFile(file));
const gateStems = findGateFiles(sources);
const registerText = readFileSync(REGISTER_PATH, 'utf8');
const registerEntries = parseRegisterEntries(registerText);

const unregistered = findUnregistered(gateStems, registerEntries);
const stale = findStaleEntries(registerEntries, gateFiles);

if (unregistered.length > 0) {
  console.error(
    `quarantine-register-parity: ${unregistered.length} gate file(s) missing a structured entry in docs/testing/known-gaps.md:`,
  );
  for (const stem of unregistered) console.error(`  - ${stem}`);
  console.error(
    'Add a register entry for each with a `**Gate site:**` line naming the file (standing rule), instead of weakening the gate.',
  );
  process.exit(1);
}

if (stale.length > 0) {
  console.error(
    `quarantine-register-parity: ${stale.length} register entr(ies) name a gate site with no gate call:`,
  );
  for (const entry of stale) console.error(`  - ${entry.heading} -> ${entry.gateSitePath}`);
  console.error('Re-point the entry at the file that carries the gate, or remove the entry.');
  process.exit(1);
}

console.log(
  `quarantine-register-parity: OK — ${gateStems.length} gate file(s) registered [${gateStems.join(', ')}]; ` +
    `${registerEntries.length} structured entr(ies), none stale`,
);
