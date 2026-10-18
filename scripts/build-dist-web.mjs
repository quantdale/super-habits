/**
 * Production web export (`npm run build:web`).
 *
 * Wraps the plain `expo export` so the PWA shell revision step runs on EVERY
 * production build (`AUD-SH05-C`). Before this, the revision step existed only
 * in the source comments as "future work", which is exactly how a released
 * worker stayed byte-identical across shell revisions and stranded installed
 * clients on the old cache.
 *
 * Deliberately NOT hermetic: a production export is supposed to inline the
 * operator's configured public backend values, unlike `build:e2e`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { applyShellRevision, assertRevisionIsContentDerived } from './pwa-shell-revision.mjs';

const root = process.cwd();
const distDir = path.join(root, 'dist');

execFileSync('npx', ['expo', 'export', '-p', 'web', '--clear'], {
  cwd: root,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

if (!fs.existsSync(path.join(distDir, 'index.html'))) {
  console.error('ABORT[build:web]: dist/index.html missing after export.');
  process.exit(1);
}

try {
  const revision = applyShellRevision({
    distDir,
    templatePath: path.join(root, 'public', 'sw.js'),
  });
  assertRevisionIsContentDerived(distDir);
  console.log(`[build:web] OK — shell revision sha-${revision} injected into dist/sw.js.`);
} catch (error) {
  console.error(`ABORT[build:web]: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
