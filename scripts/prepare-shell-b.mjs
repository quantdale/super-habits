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

// --- Build A: the export `build:e2e` already produced, tagged with its identity
// marker so the spec can prove which document the browser is serving.
tagBuildMarker(distA, 'shell-a');
writeBuildAsset(distA, 'shell-a');
const revisionA = applyShellRevision({
  distDir: distA,
  templatePath: path.join(root, 'public', 'sw.js'),
});
assertRevisionIsContentDerived(distA);

// --- Build B: a REAL SECOND EXPORT, not a copy (`AUD-SH05-A`).
//
// The earlier version of this script copied dist/ and edited one HTML marker.
// Review correctly rejected that: it exercised the update plumbing but did not
// satisfy the plan's requirement of a second real export with changed
// APPLICATION content and changed offline assets.
//
// This runs the full `expo export` again with EXPO_PUBLIC_SHELL_BUILD_ID set to
// a different value, which Metro inlines into the built JavaScript (see
// `AppProviders`), so the shell's actual code differs. It is hermetic: dotenv
// disabled and every ambient EXPO_PUBLIC_* stripped, exactly like build:e2e.
fs.rmSync(distB, { recursive: true, force: true });
const { runHermeticBuild } = await import('./hermetic-build.mjs');
try {
  runHermeticBuild({
    label: 'build:shell-b',
    command: 'npx',
    args: ['expo', 'export', '-p', 'web', '--clear', '--output-dir', 'dist-shell-b'],
    set: { EXPO_PUBLIC_SHELL_BUILD_ID: 'shell-b' },
  });
} catch (error) {
  fail(
    `the second real export failed: ${error instanceof Error ? error.message : String(error)}`,
  );
}
if (!fs.existsSync(path.join(distB, 'index.html'))) {
  fail('the second export produced no dist-shell-b/index.html.');
}

// Prove the two builds' APPLICATION code genuinely differs before relying on it.
const entryFiles = (dir) =>
  fs
    .readdirSync(path.join(dir, '_expo', 'static', 'js', 'web'))
    .filter((name) => name.endsWith('.js'));
const entryA = entryFiles(distA).map((name) => fs.readFileSync(path.join(distA, '_expo/static/js/web', name)));
const entryB = entryFiles(distB).map((name) => fs.readFileSync(path.join(distB, '_expo/static/js/web', name)));
const joinedA = Buffer.concat(entryA).toString('utf8');
const joinedB = Buffer.concat(entryB).toString('utf8');
if (joinedA === joinedB) {
  fail(
    'the two exports produced IDENTICAL application JavaScript; the upgrade proof would be vacuous.',
  );
}
if (!joinedB.includes('shell-b')) {
  fail('the second export does not carry its inlined build identity.');
}

tagBuildMarker(distB, 'shell-b');
const revisionB = applyShellRevision({
  distDir: distB,
  templatePath: path.join(root, 'public', 'sw.js'),
});
assertRevisionIsContentDerived(distB);

if (revisionA === revisionB) {
  fail(
    `build A and build B produced the SAME revision (${revisionA}); the upgrade proof would be vacuous.`,
  );
}

console.log(
  `[prepare-shell-b] OK — two REAL exports. Build A revision sha-${revisionA}, build B revision sha-${revisionB} (distinct application bytes).`,
);
