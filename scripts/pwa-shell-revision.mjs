// @ts-nocheck
/**
 * Post-export PWA shell revision injection (`AUD-SH05-A`/`B`/`C`).
 *
 * ## The audited defect
 *
 * `public/sw.js` carried a hand-maintained `CACHE_VERSION = 'v10'` and a
 * `CORE_SHELL_URLS` list, and the file itself was byte-identical across shell
 * revisions (`55eccb49…` at 3c4b96c and at the audited HEAD) even though newer
 * shells had shipped. Worker updates are detected by BYTE comparison, so a
 * byte-identical worker never installs: existing v10 clients kept serving the
 * old precached shell from a cache-first fetch handler. The source comments
 * themselves described content-hash revision injection as future work that was
 * absent from the production export — fresh installs were the only
 * counterexample, which is why a real two-build upgrade worth proving.
 *
 * ## The rule this module implements
 *
 * After every export, compute a REVISION from a deterministic, sorted manifest of
 * the boot-critical output bytes and write it into the worker, so:
 *
 *  - identical content ⇒ identical revision (no spurious update banners),
 *  - any change to a boot-critical asset or to index.html ⇒ a different
 *    revision ⇒ a byte-different worker ⇒ a real install,
 *  - the revision is derived from CONTENT only: file mtimes, wall-clock time and
 *    randomness never contribute.
 *
 * The worker's own file is EXCLUDED from the hash input (its revision field is
 * what we are computing), which avoids a hash cycle.
 *
 * Every export path (production `build:web`, hermetic `build:e2e`, the
 * `dist-sync` lane and `web:verify`) calls the same function, so a tested
 * artifact cannot differ from a released one by this step.
 */

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Marker in `public/sw.js` that receives the generated revision.
 *
 * Kept as an explicit token so the substitution is unambiguous and idempotent,
 * and so a worker that has already been injected can be re-injected from its
 * template.
 */
export const REVISION_TOKEN = '__SUPERHABITS_SHELL_REVISION__';

/** The token form the source file uses for the cache version. */
export const CACHE_VERSION_TOKEN = '__SUPERHABITS_CACHE_VERSION__';

/**
 * Files whose bytes define the shell revision.
 *
 * `index.html` plus the boot-critical graph it references (hashed entry JS/CSS,
 * the web manifest, icons and fonts). The worker is excluded on purpose.
 *
 * @param distDir absolute export directory
 * @returns repo-relative-ish paths, sorted, relative to `distDir`
 */
export function shellRevisionInputs(distDir) {
  const roots = ['index.html', 'manifest.json'];
  // `AUD-SH05-A`: root-level shell assets count too. The worker's
  // CORE_SHELL_URLS precaches `/icon-192.png`, `/icon-512.png` and
  // `/icon-maskable-512.png` from the export ROOT, so omitting them let their
  // bytes change without changing the revision — an installed client would keep
  // serving the old icon forever. Every regular file at the export root is
  // included except the worker itself (already excluded below), so a newly added
  // root asset cannot silently escape the hash either.
  const directories = ['_expo/static/js/web', '_expo/static/css', 'assets'];
  const files = new Set();

  for (const relative of roots) {
    const absolute = path.join(distDir, relative);
    if (fs.existsSync(absolute)) files.add(relative.split(path.sep).join('/'));
  }
  for (const entry of fs.readdirSync(distDir, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    if (entry.name === 'sw.js' || entry.name === 'sw.js.map') continue;
    files.add(entry.name);
  }
  const walk = (current) => {
    if (!fs.existsSync(current)) return;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      // The worker and its source map are the things being revised.
      if (entry.name === 'sw.js' || entry.name === 'sw.js.map') continue;
      files.add(path.relative(distDir, full).split(path.sep).join('/'));
    }
  };
  for (const directory of directories) walk(path.join(distDir, directory));

  // Deterministic order: the revision must not depend on filesystem iteration.
  return [...files].sort();
}

/**
 * Compute the shell revision from a deterministic content manifest.
 *
 * Each entry contributes its path and the SHA-256 of its bytes, so a rename and
 * a content change are both visible while mtimes and clock time are not.
 *
 * @param distDir absolute export directory
 * @returns a short content revision, or `null` when there is nothing to hash
 */
export function computeShellRevision(distDir) {
  const inputs = shellRevisionInputs(distDir);
  if (inputs.length === 0) return null;
  const hash = createHash('sha256');
  for (const relative of inputs) {
    const bytes = fs.readFileSync(path.join(distDir, relative));
    hash.update(relative);
    hash.update('\0');
    hash.update(createHash('sha256').update(bytes).digest());
    hash.update('\0');
  }
  // 16 hex chars is plenty for update detection and keeps the worker readable.
  return hash.digest('hex').slice(0, 16);
}

/**
 * The worker source with its revision substituted.
 *
 * Idempotent: both tokens are recognised whether they are still raw tokens or
 * already-injected literal values, so re-running on an already-injected export
 * produces the same bytes for the same content.
 *
 * @param sourceTemplate the worker source (from `public/sw.js` or a prior copy)
 * @param revision the computed revision
 */
export function injectShellRevision(sourceTemplate, revision) {
  return sourceTemplate
    // Replace any previously-injected cache version, then the raw token.
    .replace(/const CACHE_VERSION = '(?:v\d+|sha-[0-9a-f]+)';/, `const CACHE_VERSION = 'sha-${revision}';`)
    .replace(/const CACHE_VERSION = '[^']*';/, `const CACHE_VERSION = 'sha-${revision}';`)
    .replace(new RegExp(REVISION_TOKEN, 'g'), `sha-${revision}`);
}

/**
 * Inject the revision into the exported worker.
 *
 * Writes `dist/sw.js` from `public/sw.js` (the template), so the step is
 * reproducible from tracked source and never depends on whatever an exporter
 * happened to copy.
 *
 * @param options.distDir absolute export directory
 * @param options.templatePath the tracked worker template (default `public/sw.js`)
 * @returns the injected revision, or `null` when nothing was hashed
 */
export function applyShellRevision({ distDir, templatePath = 'public/sw.js' }) {
  const revision = computeShellRevision(distDir);
  if (revision === null) {
    throw new Error(`applyShellRevision: no shell inputs found in ${distDir}`);
  }
  const template = fs.readFileSync(templatePath, 'utf8');
  const injected = injectShellRevision(template, revision);
  const target = path.join(distDir, 'sw.js');
  fs.writeFileSync(target, injected, 'utf8');
  return revision;
}

/**
 * Verify an export carries a content-derived revision.
 *
 * Used by the build scripts as a fail-closed gate: an export whose worker still
 * holds the hand-maintained placeholder cannot update an existing client.
 *
 * @param distDir absolute export directory
 * @param needle the tracked template's placeholder version string
 */
export function assertRevisionIsContentDerived(distDir, needle = "const CACHE_VERSION = 'v") {
  const workerPath = path.join(distDir, 'sw.js');
  if (!fs.existsSync(workerPath)) {
    throw new Error('assertRevisionIsContentDerived: dist/sw.js is missing');
  }
  const source = fs.readFileSync(workerPath, 'utf8');
  if (source.includes(needle)) {
    throw new Error(
      'assertRevisionIsContentDerived: the exported worker still carries a hand-maintained CACHE_VERSION; ' +
        'existing clients would never install the new shell.',
    );
  }
  if (!/const CACHE_VERSION = 'sha-[0-9a-f]{8,}';/.test(source)) {
    throw new Error(
      'assertRevisionIsContentDerived: the exported worker carries no content-derived revision.',
    );
  }
  if (source.includes(REVISION_TOKEN) || source.includes(CACHE_VERSION_TOKEN)) {
    throw new Error('assertRevisionIsContentDerived: an unsubstituted revision token remains.');
  }
  return true;
}
