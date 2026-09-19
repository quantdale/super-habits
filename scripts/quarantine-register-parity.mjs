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
 * Rule: every spec file under e2e (files ending in `.spec.ts`) containing a
 * real (non-comment) `test.fixme(` or `test.skip(` call must have its
 * filename stem named in docs/testing/known-gaps.md. Only spec files are
 * scanned — helpers such as e2e/helpers/journey.ts implement the quarantine
 * mechanism itself.
 *
 * Exit 1 with the unregistered stems on any mismatch. Wired into `qa:fast`.
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
 * Return the sorted filename stems (basename minus `.spec.ts`) of spec files
 * whose comment-stripped source contains a real gate call.
 * Exported for the unit test. `files` is a Map of path -> source text.
 */
export function findGateFiles(files) {
  const stems = [];
  for (const [file, source] of files) {
    if (!file.endsWith('.spec.ts')) continue;
    const code = stripComments(source);
    if (/test\.fixme\s*\(/.test(code) || /test\.skip\s*\(/.test(code)) {
      stems.push(basename(file).replace(/\.spec\.ts$/, ''));
    }
  }
  return stems.sort();
}

/**
 * Return the sorted subset of `stems` not named anywhere in the register text.
 * Exported for the unit test.
 */
export function findUnregistered(stems, registerText) {
  return stems.filter((stem) => !registerText.includes(stem)).sort();
}

function collectSpecFiles(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) collectSpecFiles(full, files);
    else if (entry.endsWith('.spec.ts')) files.push(full);
  }
  return files;
}

// --- CLI body -----------------------------------------------------------
const specFiles = collectSpecFiles(join(root, 'e2e'));
const sources = new Map(specFiles.map((file) => [file, readFileSync(file, 'utf8')]));
const gateStems = findGateFiles(sources);
const registerText = readFileSync(REGISTER_PATH, 'utf8');
const unregistered = findUnregistered(gateStems, registerText);

if (unregistered.length > 0) {
  console.error(
    `quarantine-register-parity: ${unregistered.length} gate file(s) missing from docs/testing/known-gaps.md:`,
  );
  for (const stem of unregistered) console.error(`  - ${stem}`);
  console.error('Name each stem in the register (standing rule) instead of weakening the gate.');
  process.exit(1);
}
console.log(
  `quarantine-register-parity: OK — ${gateStems.length} gate file(s) registered [${gateStems.join(', ')}]`,
);
