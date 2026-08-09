/**
 * Build the `dist-sync/` web export with a dummy Supabase env baked in.
 *
 * The dedicated `journeys-sync` Playwright project (npm run e2e:sync) runs
 * against this export on :8082. The dummy env guarantees the sync lane never
 * touches real credentials: EXPO_NO_DOTENV blocks any real .env from leaking
 * in, the URL is a non-routable host and the key is a literal placeholder.
 *
 * CI delegates to this script ("Build dist-sync/" steps in
 * .github/workflows/ci.yml run `npm run build:sync`), so local e2e:sync runs
 * and CI never silently test a stale or missing dist-sync/. Exit code is
 * non-zero on export failure or when the dummy URL is not baked into the
 * output.
 *
 * Usage:
 *   node scripts/build-dist-sync.mjs
 *   npm run build:sync
 */
import { spawn } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const EXPORT_DIR = join(ROOT, 'dist-sync');

const DUMMY_URL = 'https://dummy.supabase.co';
const DUMMY_KEY = 'dummy-anon-key';

function collectTextFiles(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const st = statSync(p);
    if (st.isDirectory()) {
      collectTextFiles(p, out);
    } else if (p.endsWith('.html') || p.endsWith('.js')) {
      out.push(p);
    }
  }
  return out;
}

function verifyBakedEnv() {
  if (!existsSync(EXPORT_DIR)) {
    throw new Error(`abort: dist-sync/ not found — the export produced no output directory`);
  }
  const files = collectTextFiles(EXPORT_DIR);
  for (const file of files) {
    if (readFileSync(file).includes(DUMMY_URL)) {
      console.log(
        `dist-sync/ carries the dummy Supabase env (${DUMMY_URL}; non-routable host, no real credentials in any build).`,
      );
      return;
    }
  }
  throw new Error(
    `abort: '${DUMMY_URL}' not found in any .html/.js file under dist-sync/ — the export did not bake the dummy env`,
  );
}

// Stale output must not mask a failed export: rebuild from scratch, then
// re-verify. rmSync force ignores a missing dir.
rmSync(EXPORT_DIR, { recursive: true, force: true });

const isWindows = process.platform === 'win32';
const child = spawn(
  isWindows ? (process.env.ComSpec ?? 'cmd.exe') : 'npx',
  isWindows
        ? ['/d', '/s', '/c', 'npx expo export -p web --clear --output-dir dist-sync']
        : ['expo', 'export', '-p', 'web', '--clear', '--output-dir', 'dist-sync'],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      EXPO_NO_DOTENV: '1',
      EXPO_PUBLIC_SUPABASE_URL: DUMMY_URL,
      EXPO_PUBLIC_SUPABASE_ANON_KEY: DUMMY_KEY,
    },
  },
);

child.on('error', (err) => {
  console.error(`build:sync — failed to start npx expo export: ${err.message}`);
  process.exit(1);
});

child.on('exit', (code, signal) => {
  if (code !== 0) {
    console.error(
      `build:sync — expo export failed (${signal ? `signal ${signal}` : `exit code ${code}`})`,
    );
    process.exit(code !== null ? code : 1);
  }
  try {
    verifyBakedEnv();
  } catch (err) {
    console.error(`build:sync — ${err.message}`);
    process.exit(1);
  }
  process.exit(0);
});
