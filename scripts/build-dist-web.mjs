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
import { scanDirectoryForNeedle } from './hermetic-build.mjs';

const root = process.cwd();
const distDir = path.join(root, 'dist');

// Resolve the Expo CLI entry directly: the installed Windows `.bin/expo` shim is
// a POSIX script node cannot parse, and `npx` then fails with no diagnostic at
// all (see scripts/hermetic-build.mjs for the same fix).
// `AUD-SH19-B`: a PRODUCTION export must never enable the simulation mutation
// bridge. The build inherited the ambient environment, so an exported
// `EXPO_PUBLIC_SIM_DATA_BRIDGE=true` produced a callable `__shDataBridge` in a
// user-facing build while the release-profile guard (which inspects tracked
// config declarations, not this process) reported no errors. The flag is removed
// from the child environment unconditionally, and the built output is scanned so
// the guarantee does not depend on the mechanism above.
const productionEnv = { ...process.env };
delete productionEnv.EXPO_PUBLIC_SIM_DATA_BRIDGE;
// `AUD-SH19-B`: force the Metro resolver to substitute the no-op bridge stub,
// so the simulation mutation module is excluded from the production artifact
// entirely (not merely left unarmed). Setting this explicitly (rather than
// relying on the flag being absent) means an ambient/`.env` simulation flag
// cannot arm the module: `.env` loading does not overwrite an already-set env
// var, and the resolver keys module inclusion on SH_SIM_BRIDGE. The `__shdatabridge`
// scan below remains the fail-closed backstop.
productionEnv.SH_SIM_BRIDGE = 'disabled';

execFileSync(
  process.execPath,
  [
    path.join(root, 'node_modules', '@expo', 'cli', 'build', 'bin', 'cli'),
    'export',
    '-p',
    'web',
    '--clear',
  ],
  { cwd: root, stdio: 'inherit', env: productionEnv },
);

// Fail closed if the bridge installer or flag reached the production artifact.
const bridgeHits = scanDirectoryForNeedle(distDir, root, '__shdatabridge');
if (bridgeHits.length > 0) {
  console.error(
    `ABORT[build:web]: the simulation data bridge reached a PRODUCTION export (${bridgeHits.slice(0, 3).join(', ')}). ` +
      'Only the hermetic test export may enable it.',
  );
  process.exit(1);
}

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
