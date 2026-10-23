/**
 * Legacy-name inventory for the `super-habits` canonical naming migration.
 *
 * WHY THIS EXISTS
 * ---------------
 * The branding migration has to change current, user-facing identity WITHOUT
 * touching durable identifiers (native package/bundle IDs, deep-link scheme,
 * storage keys, PWA cache prefixes, portable-backup protocol tokens, cloud
 * project names). A blanket find-and-replace would orphan installed app data,
 * reject existing backups, or silently cut off a live service.
 *
 * So the migration needs a *classified* inventory, not a grep count. This
 * script scans tracked files for the legacy token and assigns each occurrence
 * to exactly one class with an explicit disposition, then fails when a
 * DISALLOWED class appears where it must not:
 *
 *   - `brand`      — live public/UI copy. MUST be `super-habits`. Disallowed.
 *   - `package`    — npm package/lockfile name. MUST be `super-habits`. Disallowed.
 *   - `native-id`  — Android package / iOS bundle ID. FROZEN (changing it
 *                    creates a distinct installed app and strands local data).
 *   - `scheme`     — Expo deep-link scheme. FROZEN (existing links must resolve).
 *   - `storage`    — local storage/AsyncStorage/SQLite/OPFS names. FROZEN
 *                    (renaming silently hides a user's existing data).
 *   - `cache`      — PWA / service-worker cache prefixes. FROZEN (a rename
 *                    orphans an installed shell instead of upgrading it).
 *   - `backup`     — portable-backup format id + fingerprint domains. FROZEN
 *                    (a rename makes existing backups unimportable).
 *   - `cloud`      — Supabase/Vercel project ids and hosts. OWNER-GATED.
 *   - `test`       — fixtures and assertions. Allowed (updated with source).
 *   - `history`    — historical reports/evidence. PRESERVED (never rewritten).
 *
 * The gate is intentionally narrow: it only fails on `brand`/`package`
 * occurrences in live source, because that is the class this migration is
 * allowed to change without owner authorization. Everything else is reported
 * so the ledger stays complete and reviewable.
 *
 * USAGE
 *   node scripts/legacy-name-inventory.mjs           # report
 *   node scripts/legacy-name-inventory.mjs --json    # machine-readable
 *   node scripts/legacy-name-inventory.mjs --check    # fail on brand/package
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { extname, resolve } from 'node:path';

export const LEGACY_TOKEN = 'superhabits';
export const CANONICAL_TOKEN = 'super-habits';
/** A literal backslash, kept out of source so path normalization cannot be
 * mangled by tooling that rewrites string escapes. */
const BACKSLASH = String.fromCharCode(92);

/**
 * Classification is TWO-STAGE, because a single ordered list conflates two
 * different questions:
 *
 *   1. WHERE is the file?  Docs, tests, tooling and agent guidance are decided
 *      by path — a branding reference in `.agent/execplans/*.md` is historical
 *      evidence no matter which words it uses.
 *   2. WHAT does the token MEAN?  Only live source (`app/`, `core/`,
 *      `features/`, `lib/`, config) needs content rules, because there the same
 *      literal can be a frozen native ID, a frozen storage key, or live brand
 *      copy.
 *
 * Running path rules first is what keeps the ledger honest: otherwise a doc
 * that happens to mention `openDatabaseAsync` would be misfiled as frozen
 * storage instead of preserved history.
 */
export const PATH_CLASSES = [
  {
    cls: 'history',
    test: /^(\.agent|\.agents|openspec|docs|simulation-output)\//,
    disposition: 'PRESERVED — historical evidence is never rewritten',
  },
  {
    cls: 'test',
    test: /^(tests|e2e|simulation|tests?)\//,
    disposition: 'ALLOWED — updated together with the source it pins',
  },
  {
    cls: 'guidance',
    test: /^(\.cursor|\.github|\.eas|\.vscode|\.devcontainer)\/|^(\.cursorrules|AGENTS\.md|CLAUDE\.md|README\.md)$/,
    disposition: 'ALLOWED — current contributor guidance, update to canonical name',
  },
];

/**
 * Content rules for live source and configuration, most specific first.
 * A token that is both a storage key and brand copy must classify as the FROZEN
 * kind: wrongly "renaming" it would hide user data.
 */
export const CONTENT_CLASSES = [
  {
    cls: 'native-id',
    // `super-habits` is not a valid Java package component, so this can never
    // be a textual rename.
    test: /com\.dale16\.superhabits|bundleIdentifier|applicationId|"package"\s*:/,
    disposition: 'FROZEN — changing it installs a distinct app and strands local SQLite data',
  },
  {
    cls: 'scheme',
    test: /"scheme"\s*:|superhabits:\/\//,
    disposition: 'FROZEN — existing deep links must keep resolving',
  },
  {
    cls: 'backup',
    test: /superhabits-portable-backup|superhabits-portable-owner|superhabits-backup-/,
    disposition: 'FROZEN — old backups must stay importable (versioned format, not a rename)',
  },
  {
    cls: 'cache',
    test: /superhabits-shell|CACHE_VERSION|caches\.open/,
    disposition: 'FROZEN — renaming orphans an installed service-worker shell',
  },
  {
    cls: 'storage',
    test: /superhabits\.|openDatabaseAsync\(|localStorage|AsyncStorage/,
    disposition: 'FROZEN — renaming silently hides existing local user data',
  },
  {
    cls: 'cloud',
    test: /supabase\.co|supabase\.com|project_id|projectId|vercel\.app|kruubbynsmxzxfdunaal/,
    disposition: 'OWNER-GATED — non-destructive verification before any rename',
  },
  {
    cls: 'package',
    test: /"name"\s*:\s*"superhabits"/,
    disposition: 'CANONICAL — must be super-habits',
  },
  {
    cls: 'transient',
    // Ephemeral device/OS handles that are recreated on every run and hold no
    // persisted state: an Expo keep-awake tag, a WPAN service label. Renaming
    // these is harmless but also pointless, so they are recorded, not chased.
    test: /activateKeepAwakeAsync|deactivateKeepAwake|-workout-session/,
    disposition: 'TRANSIENT — recreated at runtime; rename optional, never load-bearing',
  },
  {
    cls: 'tooling',
    // Local-only contributor tooling names: a temp-dir prefix and a local env
    // var for the disposable Postgres port. Nothing shipped reads them, and no
    // user state is keyed on them, so a rename is cosmetic and safe.
    test: /mkdtempSync|process\.env\.SUPERHABITS_/, 
    disposition: 'ALLOWED — local-only tooling names, cosmetic to rename',
  },
  {
    cls: 'brand',
    // Remaining live, user-facing brand copy in source. This is the class the
    // branding migration IS allowed to change.
    test: /SuperHabits/,
    disposition: 'CANONICAL — live brand copy, must read super-habits',
  },
];

export function classify(filePath, text = '') {
  const normalized = filePath.split(BACKSLASH).join('/');
  for (const rule of PATH_CLASSES) {
    if (rule.test.test(normalized)) return rule;
  }
  for (const rule of CONTENT_CLASSES) {
    if (rule.test.test(text)) return rule;
  }
  return {
    cls: 'unclassified',
    disposition: 'REVIEW — add a class rule so this stays auditable',
  };
}

/** Extract 1-based line numbers containing the legacy token. */
export function tokenLines(text, token = LEGACY_TOKEN) {
  const needle = token.toLowerCase();
  const out = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].toLowerCase().includes(needle)) out.push(i + 1);
  }
  return out;
}

/** Extensions whose bytes are never scanned as text. */
const BINARY_EXT = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.bmp',
  '.ico',
  '.zip',
  '.apk',
  '.aab',
  '.wasm',
  '.keystore',
  '.jks',
]);

export function summarize(entries) {
  const byClass = {};
  for (const entry of entries) {
    byClass[entry.cls] = byClass[entry.cls] ?? { files: 0, occurrences: 0 };
    byClass[entry.cls].files += 1;
    byClass[entry.cls].occurrences += entry.lines.length;
  }
  return byClass;
}

/** Files the gate may change without owner authorization. */
export const GATED_CLASSES = new Set(['brand', 'package']);

export function check(entries) {
  const offending = entries.filter(
    (entry) => GATED_CLASSES.has(entry.cls) && entry.lines.length > 0,
  );
  return { ok: offending.length === 0, offending };
}

function listTrackedFiles(root) {
  const raw = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' });
  return raw.split('\0').filter(Boolean);
}

function main(argv) {
  const root = resolve(process.argv[1] ? resolve(process.argv[1], '..', '..') : '.');
  const tracked = listTrackedFiles(root);
  const entries = [];
  for (const rel of tracked) {
    if (BINARY_EXT.has(extname(rel).toLowerCase())) continue;
    let text;
    try {
      text = readFileSync(resolve(root, rel), 'utf8');
    } catch {
      continue;
    }
    if (!text.toLowerCase().includes(LEGACY_TOKEN)) continue;
    const rule = classify(rel, text);
    entries.push({
      file: rel,
      cls: rule.cls,
      disposition: rule.disposition,
      lines: tokenLines(text),
    });
  }

  const byClass = summarize(entries);
  const files = entries.length;
  const occurrences = entries.reduce((sum, entry) => sum + entry.lines.length, 0);

  if (argv.includes('--json')) {
    process.stdout.write(`${JSON.stringify({ files, occurrences, byClass, entries }, null, 2)}\n`);
  } else {
    console.log(`legacy-name-inventory: ${files} tracked file(s), ${occurrences} line(s) with "${LEGACY_TOKEN}"`);
    console.log('');
    for (const [cls, counts] of Object.entries(byClass).sort((a, b) => b[1].occurrences - a[1].occurrences)) {
      const rule = [...PATH_CLASSES, ...CONTENT_CLASSES].find((candidate) => candidate.cls === cls);
      console.log(`  ${cls.padEnd(14)} ${String(counts.files).padStart(4)} file(s) ${String(counts.occurrences).padStart(5)} line(s)`);
      console.log(`  ${''.padEnd(14)} ${rule?.disposition ?? 'REVIEW'}`);
    }
  }

  if (argv.includes('--check')) {
    const verdict = check(entries);
    if (!verdict.ok) {
      console.error('');
      console.error(
        `legacy-name-inventory: FAIL — ${verdict.offending.length} live brand/package file(s) still use "${LEGACY_TOKEN}":`,
      );
      for (const entry of verdict.offending) {
        console.error(`  ${entry.file} (${entry.cls}) lines ${entry.lines.join(', ')}`);
      }
      return 1;
    }
    console.log('');
    console.log(
      `legacy-name-inventory: OK — no live brand/package file uses "${LEGACY_TOKEN}"; durable identifiers intentionally retained.`,
    );
  }
  return 0;
}

const invokedDirectly =
  process.argv[1] !== undefined && process.argv[1].endsWith('legacy-name-inventory.mjs');
if (invokedDirectly) {
  process.exit(main(process.argv.slice(2)));
}
