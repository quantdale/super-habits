#!/usr/bin/env node
/**
 * Finite automated live-web verification for SuperHabits.
 *
 * This command is the repository-owned alternative to awaiting the persistent
 * Metro server (`npm run web` / `npm run web:dev`). It:
 *   1. builds the static export (`npm run build:web`) unless --skip-build;
 *   2. spawns `scripts/serve-e2e.js` on a controlled port as an OWNED child;
 *   3. polls HTTP readiness with a bounded deadline;
 *   4. asserts COOP/COEP isolation headers and (by default) runs a bounded
 *      headless-Chromium smoke probe (app shell, crossOriginIsolated, Add);
 *   5. ALWAYS terminates the exact owned process tree and verifies the port
 *      is released, then exits by itself.
 *
 * Usage:
 *   npm run web:verify                          # build + verify (8081 or next free)
 *   npm run web:verify -- --skip-build          # reuse existing dist/
 *   npm run web:verify -- --port 8093           # explicit free port (must be free)
 *   npm run web:verify -- --no-browser          # HTTP/headers only
 *   npm run web:verify -- --help
 *
 * Exit codes: 0 = PASS, 1 = verification/cleanup FAILED, 2 = usage error.
 * The process never stays alive waiting for the server.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { createRequire } from 'node:module';
import {
  DEFAULT_PORT,
  WebLifecycleError,
  isPortAvailable,
  pickPort,
  runWebVerify,
} from './web-lifecycle.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const SERVER_SCRIPT = path.join(ROOT, 'scripts', 'serve-e2e.js');

function usage() {
  console.log(`web:verify — finite automated live-web verification

Usage:
  npm run web:verify [-- --skip-build] [-- --port <port>] [-- --no-browser] [-- --help]

Options:
  --skip-build          Reuse the existing static export (dist/) instead of
                        running \`npm run build:web\`. Fails if dist/ is absent.
  --port <port>         Explicit port (must be free). Default: 8081 when free,
                        otherwise the next free port in 8081..8099. The
                        E2E_PORT environment variable is honored when --port
                        is absent.
  --no-browser          Skip the headless-Chromium smoke probe (HTTP + headers
                        only).
  --ready-timeout <ms>  Readiness deadline (default 90000).
  --help                Show this help.

Exit codes: 0 PASS, 1 FAILED (verification or cleanup), 2 usage error.
This command always terminates its own server and returns control.`);
}

function parseArgs(argv) {
  const args = { skipBuild: false, browser: true, port: null, readyTimeout: 90_000 };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--help' || a === '-h') args.help = true;
    else if (a === '--skip-build') args.skipBuild = true;
    else if (a === '--no-browser') args.browser = false;
    else if (a === '--port') args.port = Number(argv[++i]);
    else if (a === '--ready-timeout') args.readyTimeout = Number(argv[++i]);
    else throw new WebLifecycleError(`unknown argument ${JSON.stringify(a)} (see --help)`);
  }
  return args;
}

function runNpm(args, stdio = 'inherit') {
  if (process.platform === 'win32') {
    return spawnSync(process.env.ComSpec ?? 'cmd.exe', ['/d', '/c', 'npm', ...args], { stdio });
  }
  return spawnSync('npm', args, { stdio });
}

function buildWebExport() {
  const result = runNpm(['run', 'build:web']);
  if (result.status !== 0) {
    throw new WebLifecycleError(`npm run build:web failed (exit ${result.status})`);
  }
}

async function createBrowserProbe({ log }) {
  const require = createRequire(import.meta.url);
  let playwright;
  try {
    playwright = require('@playwright/test');
  } catch {
    throw new WebLifecycleError(
      '@playwright/test is unavailable — run `npm ci`, then `npx playwright install chromium`',
    );
  }
  return async ({ url, timeoutMs }) => {
    let browser = null;
    try {
      browser = await playwright.chromium.launch({ headless: true });
      const page = await browser.newPage();
      const bound = Math.min(timeoutMs, 60_000);
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: bound });
      await page.getByText('Today', { exact: true }).first().waitFor({
        state: 'visible',
        timeout: bound,
      });
      const isolated = await page.evaluate(() => window.crossOriginIsolated === true);
      if (!isolated) {
        throw new WebLifecycleError(
          'crossOriginIsolated is not true in the browser — COOP/COEP are not effective',
        );
      }
      const addVisible = await page
        .getByLabel('Add')
        .first()
        .isVisible()
        .catch(() => false);
      log(
        `browser probe: app shell rendered (Today nav), crossOriginIsolated=${isolated}, Add button=${addVisible}`,
      );
      if (!addVisible) {
        throw new WebLifecycleError('app shell rendered but the global Add button was not visible');
      }
    } finally {
      if (browser) await browser.close().catch(() => {});
    }
  };
}

async function resolvePort(explicitPort) {
  if (explicitPort !== null) {
    if (!Number.isInteger(explicitPort) || explicitPort <= 0 || explicitPort > 65535) {
      throw new WebLifecycleError(`--port must be an integer in 1..65535, got ${explicitPort}`);
    }
    if (!(await isPortAvailable(explicitPort))) {
      throw new WebLifecycleError(
        `port ${explicitPort} is already occupied — refusing to attach to an unknown server; ` +
          `free it or pass another --port`,
      );
    }
    return explicitPort;
  }
  const envPort = process.env.E2E_PORT;
  if (envPort) {
    const parsed = Number(envPort);
    if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65535) {
      throw new WebLifecycleError(`E2E_PORT must be an integer in 1..65535, got ${envPort}`);
    }
    if (!(await isPortAvailable(parsed))) {
      throw new WebLifecycleError(
        `E2E_PORT ${parsed} is already occupied — refusing to attach to an unknown server`,
      );
    }
    return parsed;
  }
  return pickPort({ preferred: DEFAULT_PORT });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    return 0;
  }
  const log = (message) => console.log(message);
  const port = await resolvePort(args.port);
  log(`web:verify — finite automated live-web verification`);
  log(`port: ${port}${args.port ? ' (explicit)' : process.env.E2E_PORT ? ' (E2E_PORT)' : ''}`);
  const browserProbe = args.browser ? await createBrowserProbe({ log }) : null;
  const startedAt = Date.now();
  const exitCode = await runWebVerify({
    port,
    distDir: 'dist',
    serverScript: SERVER_SCRIPT,
    skipBuild: args.skipBuild,
    build: args.skipBuild ? null : buildWebExport,
    browserProbe,
    log,
    readinessTimeoutMs: args.readyTimeout,
  });
  log(`web:verify finished in ${((Date.now() - startedAt) / 1000).toFixed(1)}s (exit ${exitCode})`);
  return exitCode;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error) => {
    console.error(`web:verify: ${error && error.message ? error.message : String(error)}`);
    process.exitCode = 2;
  });
