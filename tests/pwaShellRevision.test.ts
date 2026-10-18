/**
 * AUD-SH05-A / AUD-SH05-B / AUD-SH05-C — the PWA worker revision must be derived
 * from shell CONTENT.
 *
 * Audited defect (SH-05, High; deployment impact conditional on an installed
 * worker): `public/sw.js` carried a hand-maintained `CACHE_VERSION = 'v10'` and
 * the worker BLOB was byte-identical (`55eccb49…`) at 3c4b96c and at the audited
 * HEAD despite newer shell revisions. Production documents are cache-first, and
 * browser worker updates are detected by byte comparison — so a byte-identical
 * worker never installs and every existing v10 client kept serving the old
 * precached shell. The build comments themselves described content-hash revision
 * injection as future work that was absent from the production export; fresh
 * installs were the only counterexample.
 *
 * These cases prove the property that matters: identical content yields an
 * identical revision, any boot-critical change yields a different one, mtimes and
 * clock time never contribute, and every export path runs the step. The real
 * two-build browser upgrade is a Playwright lane; this file pins the pure
 * revision contract it depends on.
 */

import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  applyShellRevision,
  assertRevisionIsContentDerived,
  CACHE_VERSION_TOKEN,
  computeShellRevision,
  injectShellRevision,
  REVISION_TOKEN,
  shellRevisionInputs,
} from '../scripts/pwa-shell-revision.mjs';

const ROOT = path.resolve(__dirname, '..');
const TEMPLATE = path.join(ROOT, 'public', 'sw.js');

/** A minimal export tree with the boot-critical shape. */
function makeExport(options: { indexHtml?: string; entryJs?: string; extraCss?: string } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sh05-'));
  fs.mkdirSync(path.join(dir, '_expo', 'static', 'js', 'web'), { recursive: true });
  fs.mkdirSync(path.join(dir, '_expo', 'static', 'css'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'assets'), { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'index.html'),
    options.indexHtml ?? '<html><body>shell</body></html>',
  );
  fs.writeFileSync(path.join(dir, 'manifest.json'), '{"name":"SuperHabits"}');
  fs.writeFileSync(
    path.join(dir, '_expo', 'static', 'js', 'web', 'entry-abc.js'),
    options.entryJs ?? 'console.log("shell v1")',
  );
  if (options.extraCss !== undefined) {
    fs.writeFileSync(path.join(dir, '_expo', 'static', 'css', 'shell.css'), options.extraCss);
  }
  // The exported worker is present so the injection target exists.
  fs.writeFileSync(path.join(dir, 'sw.js'), fs.readFileSync(TEMPLATE, 'utf8'));
  return dir;
}

describe('AUD-SH05-A: the revision is content-derived and change-sensitive', () => {
  it('identical content yields an identical revision', () => {
    const a = makeExport();
    const b = makeExport();
    expect(computeShellRevision(a)).toBe(computeShellRevision(b));
    fs.rmSync(a, { recursive: true, force: true });
    fs.rmSync(b, { recursive: true, force: true });
  });

  it('a changed index.html yields a different revision', () => {
    const a = makeExport();
    const base = computeShellRevision(a);
    fs.writeFileSync(path.join(a, 'index.html'), '<html><body>shell v2</body></html>');
    expect(computeShellRevision(a)).not.toBe(base);
    fs.rmSync(a, { recursive: true, force: true });
  });

  it('a changed hashed entry bundle yields a different revision', () => {
    const a = makeExport();
    const base = computeShellRevision(a);
    fs.writeFileSync(
      path.join(a, '_expo', 'static', 'js', 'web', 'entry-abc.js'),
      'console.log("shell v2")',
    );
    expect(computeShellRevision(a)).not.toBe(base);
    fs.rmSync(a, { recursive: true, force: true });
  });

  it('adding a boot-critical CSS asset yields a different revision', () => {
    const a = makeExport();
    const base = computeShellRevision(a);
    fs.writeFileSync(path.join(a, '_expo', 'static', 'css', 'shell.css'), 'body{margin:0}');
    expect(computeShellRevision(a)).not.toBe(base);
    fs.rmSync(a, { recursive: true, force: true });
  });

  it('mtimes never contribute: touching every file changes nothing', () => {
    const a = makeExport();
    const base = computeShellRevision(a);
    const future = new Date(Date.now() + 3_600_000);
    for (const relative of shellRevisionInputs(a)) {
      fs.utimesSync(path.join(a, relative), future, future);
    }
    expect(computeShellRevision(a)).toBe(base);
    fs.rmSync(a, { recursive: true, force: true });
  });

  it('the worker itself is excluded from the hash input (no cycle)', () => {
    const a = makeExport();
    const base = computeShellRevision(a);
    fs.writeFileSync(path.join(a, 'sw.js'), 'const CACHE_VERSION = "whatever";');
    expect(computeShellRevision(a)).toBe(base);
    expect(shellRevisionInputs(a)).not.toContain('sw.js');
    fs.rmSync(a, { recursive: true, force: true });
  });

  it('inputs are sorted, so filesystem iteration order cannot matter', () => {
    const a = makeExport({ extraCss: 'x' });
    const inputs = shellRevisionInputs(a);
    expect(inputs).toEqual([...inputs].sort());
    fs.rmSync(a, { recursive: true, force: true });
  });
});

describe('AUD-SH05-A: injection replaces the placeholder and is idempotent', () => {
  it('the tracked template carries the generated token, not a hand-edited version', () => {
    const template = fs.readFileSync(TEMPLATE, 'utf8');
    expect(template).toContain(CACHE_VERSION_TOKEN);
    // The audited shape: a literal hand-maintained version.
    expect(template).not.toMatch(/const CACHE_VERSION = 'v\d+';/);
  });

  it('injects sha-<revision> and removes every token', () => {
    const template = fs.readFileSync(TEMPLATE, 'utf8');
    const injected = injectShellRevision(template, 'abcdef0123456789');
    expect(injected).toContain("const CACHE_VERSION = 'sha-abcdef0123456789';");
    expect(injected).not.toContain(CACHE_VERSION_TOKEN);
    expect(injected).not.toContain(REVISION_TOKEN);
  });

  it('re-injecting the same revision produces identical bytes', () => {
    const template = fs.readFileSync(TEMPLATE, 'utf8');
    const once = injectShellRevision(template, 'abcdef0123456789');
    const twice = injectShellRevision(once, 'abcdef0123456789');
    expect(twice).toBe(once);
  });

  it('a different revision produces different bytes (a real install)', () => {
    const template = fs.readFileSync(TEMPLATE, 'utf8');
    const first = injectShellRevision(template, 'aaaaaaaaaaaaaaaa');
    const second = injectShellRevision(template, 'bbbbbbbbbbbbbbbb');
    expect(first).not.toBe(second);
  });
});

describe('AUD-SH05-C: every export path runs the step and fails closed', () => {
  it('applyShellRevision writes the exported worker', () => {
    const dir = makeExport();
    const revision = applyShellRevision({ distDir: dir, templatePath: TEMPLATE });
    const written = fs.readFileSync(path.join(dir, 'sw.js'), 'utf8');
    expect(written).toContain(`const CACHE_VERSION = 'sha-${revision}';`);
    expect(written).not.toContain(CACHE_VERSION_TOKEN);
    expect(assertRevisionIsContentDerived(dir)).toBe(true);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('refuses an export whose worker still carries a hand-maintained version', () => {
    const dir = makeExport();
    fs.writeFileSync(path.join(dir, 'sw.js'), "const CACHE_VERSION = 'v10';\n");
    expect(() => assertRevisionIsContentDerived(dir)).toThrow(/hand-maintained CACHE_VERSION/);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('refuses an export with no worker at all', () => {
    const dir = makeExport();
    fs.rmSync(path.join(dir, 'sw.js'));
    expect(() => assertRevisionIsContentDerived(dir)).toThrow(/sw\.js is missing/);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('refuses an export with an unsubstituted token', () => {
    const dir = makeExport();
    fs.writeFileSync(path.join(dir, 'sw.js'), `const CACHE_VERSION = '${CACHE_VERSION_TOKEN}';\n`);
    expect(() => assertRevisionIsContentDerived(dir)).toThrow(/hand-maintained|no content-derived/);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('every build lane invokes the shared revision step', () => {
    // `AUD-SH05-C`: the same function must be called by the production export,
    // the hermetic E2E export and the dist-sync lane, so a tested artifact cannot
    // differ from a released one by this step.
    for (const script of [
      'scripts/build-dist-web.mjs',
      'scripts/build-dist-e2e.mjs',
      'scripts/build-dist-sync.mjs',
    ]) {
      const source = fs.readFileSync(path.join(ROOT, script), 'utf8');
      expect(source, script).toContain('applyShellRevision');
      expect(source, script).toContain('assertRevisionIsContentDerived');
    }
    // And the production build script is what `npm run build:web` runs.
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
    expect(pkg.scripts['build:web']).toContain('build-dist-web.mjs');
    // web:verify delegates to build:e2e, which is covered above.
    const verify = fs.readFileSync(path.join(ROOT, 'scripts', 'web-verify.mjs'), 'utf8');
    expect(verify).toContain('build:e2e');
  });

  it('no build lane ships a synthetic revision marker', () => {
    // The step must not replace the real revision with a test-only marker.
    for (const script of [
      'scripts/build-dist-web.mjs',
      'scripts/build-dist-e2e.mjs',
      'scripts/build-dist-sync.mjs',
    ]) {
      const source = fs.readFileSync(path.join(ROOT, script), 'utf8');
      expect(source, script).not.toMatch(/CACHE_VERSION\s*=\s*['"]test/);
    }
  });
});

describe('AUD-SH05-B: isolation headers and offline assets are preserved', () => {
  it('the tracked worker keeps the offline-critical precache list', () => {
    const template = fs.readFileSync(TEMPLATE, 'utf8');
    for (const critical of [
      '/',
      '/index.html',
      '/manifest.json',
      '/icon-192.png',
      '/icon-512.png',
    ]) {
      expect(template, critical).toContain(`'${critical}'`);
    }
  });

  it('the worker only skips waiting inside the explicit SKIP_WAITING message', () => {
    const template = fs.readFileSync(TEMPLATE, 'utf8');
    // `self.skipWaiting()` is legal ONLY in the message handler the user's
    // "Update available" apply posts. The install handler must never call it,
    // because that would reload clients without the explicit apply.
    const installHandler = template.slice(
      template.indexOf("self.addEventListener('install'"),
      template.indexOf("self.addEventListener('message'"),
    );
    expect(installHandler).not.toContain('skipWaiting()');
    const messageHandler = template.slice(
      template.indexOf("self.addEventListener('message'"),
      template.indexOf("self.addEventListener('activate'"),
    );
    expect(messageHandler).toContain("event.data.type === 'SKIP_WAITING'");
    expect(messageHandler).toContain('self.skipWaiting()');
  });

  it('COOP/COEP headers remain configured for SQLite WASM', () => {
    const appJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'app.json'), 'utf8'));
    const headers = JSON.stringify(appJson);
    expect(headers).toContain('Cross-Origin-Embedder-Policy');
    expect(headers).toContain('Cross-Origin-Opener-Policy');
    const vercel = fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8');
    expect(vercel).toContain('Cross-Origin-Embedder-Policy');
    expect(vercel).toContain('require-corp');
  });
});
