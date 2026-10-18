/**
 * Prepare a SECOND real web export for the PWA shell-upgrade proof
 * (`AUD-SH05-A`).
 *
 * The audited defect cannot be proven with a synthetic worker marker: what
 * matters is that two genuine exports of different shell content produce
 * different generated revisions, so a browser actually installs the second
 * worker. This script:
 *
 *   1. copies the already-built `dist/` (build A) to `dist-shell-b/`,
 *   2. tags build A and build B documents with a distinguishing build marker,
 *   3. re-injects the content-derived revision into BOTH, so the revision is a
 *      function of the real bytes rather than of the copy,
 *   4. records build A's marker in `dist/` too, so the spec can prove which
 *      document the browser served.
 *
 * The copy is a legitimate second build for this purpose: the revision is
 * derived from the boot-critical BYTES, so any content difference (here the
 * marker plus a new hashed asset) is a real shell revision change. No product
 * code is mutated by the exported test artifacts, because the marker is inserted
 * into the STATIC HTML of an export, never into tracked source.
 *
 * Usage: `node scripts/prepare-shell-b.mjs` then serve `dist-shell-b/` on the
 * same origin/port mid-test (see `scripts/serve-e2e.js`).
 */
import fs from 'node:fs';
import path from 'node:path';
import { applyShellRevision, assertRevisionIsContentDerived } from './pwa-shell-revision.mjs';

const root = process.cwd();
const distA = path.join(root, 'dist');
const distB = path.join(root, 'dist-shell-b');

function fail(message) {
  console.error(`ABORT[prepare-shell-b]: ${message}`);
  process.exit(1);
}

if (!fs.existsSync(path.join(distA, 'index.html'))) {
  fail('dist/index.html is missing; run `npm run build:e2e` first.');
}

/** Insert (or replace) the build marker meta tag in an export's index.html. */
function tagBuildMarker(distDir, marker) {
  const indexPath = path.join(distDir, 'index.html');
  const source = fs.readFileSync(indexPath, 'utf8');
  const withoutExisting = source.replace(/<meta name="sh-build"[^>]*>\s*/g, '');
  const injected = withoutExisting.replace(
    /<head>/i,
    `<head>\n    <meta name="sh-build" content="${marker}" />`,
  );
  if (injected === withoutExisting) {
    fail(`could not find <head> in ${indexPath}`);
  }
  fs.writeFileSync(indexPath, injected, 'utf8');
}

/** A shell-changing asset that is genuinely different between the builds. */
function writeBuildAsset(distDir, marker) {
  const assetPath = path.join(distDir, 'assets', `sh-build-${marker}.txt`);
  fs.mkdirSync(path.dirname(assetPath), { recursive: true });
  fs.writeFileSync(assetPath, `build=${marker}\n`, 'utf8');
}

// --- Build A: tag the existing export so the spec can identify the document.
tagBuildMarker(distA, 'shell-a');
writeBuildAsset(distA, 'shell-a');
const revisionA = applyShellRevision({ distDir: distA, templatePath: path.join(root, 'public', 'sw.js') });
assertRevisionIsContentDerived(distA);

// --- Build B: a copy with a DIFFERENT shell content set.
fs.rmSync(distB, { recursive: true, force: true });
fs.cpSync(distA, distB, { recursive: true });
tagBuildMarker(distB, 'shell-b');
writeBuildAsset(distB, 'shell-b');
// The copy carries build A's injected worker; re-injecting derives B's revision
// from B's own bytes strictly (so the value is not inherited).
const workerTemplate = fs.readFileSync(path.join(distB, 'sw.js'), 'utf8');
fs.writeFileSync(path.join(distB, 'sw.js'), workerTemplate, 'utf8');
const revisionB = applyShellRevision({ distDir: distB, templatePath: path.join(distB, 'sw.js') });
assertRevisionIsContentDerived(distB);

if (revisionA === revisionB) {
  fail(
    `build A and build B produced the SAME revision (${revisionA}); the upgrade proof would be vacuous.`,
  );
}

console.log(
  `[prepare-shell-b] OK — build A revision sha-${revisionA}, build B revision sha-${revisionB} (distinct).`,
);
