import { type Page } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * The DB harness: a same-origin page whose dedicated worker opens the real
 * `expo-sqlite` OPFS database (the AccessHandlePoolVFS layout under
 * `expo-sqlite/` with random filenames + path headers) through the app's own
 * wa-sqlite machinery, and exposes raw SQL via `window.__sh`.
 *
 * Why this exists: `page.evaluate` on the app page cannot reach the data layer
 * (module-private, inside expo-sqlite's worker) and the static export exposes
 * no global bridge. Raw SQL through this harness is the only browser-side path
 * to row-level seeding and assertions — it writes/reads the *same* database the
 * app uses, verified by `e2e/helpers/__probe__` during development.
 *
 * TRADE-OFF: the harness is a separate document, so entering it destroys the
 * app page's React state (the app's worker holds the one OPFS lock anyway).
 * Use `ensureDbContext`/`returnToApp` at reload boundaries, not mid-session.
 *
 * The wa-sqlite JS files are served from `node_modules/expo-sqlite/web/wa-sqlite`
 * via `page.route()` at runtime; `wa-sqlite.js` is rewritten (UMD tail →
 * `globalThis.WaSQLiteFactory` + `export default`) so a module worker can load
 * it. Version-pinned to the installed expo-sqlite.
 */

/**
 * Where the app under test is served from. The standard projects serve
 * `dist/` on :8081 by default; E2E_PORT can select an isolated local port. The
 * dedicated `journeys-sync` project serves the dummy-Supabase `dist-sync/`
 * export on :8082 via `npm run e2e:sync`, which sets `E2E_BASE_URL` and
 * `E2E_DIST_DIR` (see package.json).
 */
const defaultPort =
  process.env.E2E_PORT ?? (process.env.E2E_DIST_DIR === 'dist-sync' ? '8082' : '8081');
export const APP_BASE_URL = process.env.E2E_BASE_URL ?? `http://localhost:${defaultPort}`;

/**
 * The on-disk export directory that holds the wa-sqlite WASM assets the
 * harness loads at `${APP_BASE_URL}/assets/...`. Defaults to `dist`; the
 * journeys-sync lane points it at `dist-sync`.
 */
export const DIST_DIR = process.env.E2E_DIST_DIR ?? 'dist';

/** Harness document URL (same origin as the app, so OPFS is shared). */
// Keep the harness navigation out of an old service-worker cache entry. The
// query is not part of application state and is constant within one worker.
export const DB_HARNESS_URL = `${APP_BASE_URL}/__sh__/db/?e2e-harness=${process.pid}`;

/** Route covering the harness document + its worker imports. */
// Match both slash-normalized and slashless URLs before Expo's SPA fallback
// turns the harness into an "Unmatched Route" document. A pathname check in
// the handler below keeps query strings from affecting the dispatch.
const DB_HARNESS_ROUTE = /\/__sh__\/db(?:\/.*)?(?:\?.*)?$/;

const WA_DIR = path.resolve(process.cwd(), 'node_modules', 'expo-sqlite', 'web', 'wa-sqlite');
const WA_ESM_FILES = [
  'sqlite-constants.js',
  'VFS.js',
  'FacadeVFS.js',
  'sqlite-api.js',
  'AccessHandlePoolVFS.js',
];

/** Optional but harmless on localhost; keeps the harness honest about the lock. */
const JS_HEADERS = {
  'Cross-Origin-Embedder-Policy': 'require-corp',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Access-Control-Allow-Origin': '*',
  'Cross-Origin-Resource-Policy': 'cross-origin',
};

/** On-disk wa-sqlite asset directory of the served export (e.g. `dist/assets/...`). */
export const WA_SQLITE_ASSET_DIR = path.resolve(
  process.cwd(),
  DIST_DIR,
  'assets',
  'node_modules',
  'expo-sqlite',
  'web',
  'wa-sqlite',
);

/** The single `.wasm` filename inside the export's wa-sqlite asset dir. */
export function discoverWasmName(): string {
  const name = fs.readdirSync(WA_SQLITE_ASSET_DIR).find((f) => f.endsWith('.wasm'));
  if (!name) {
    throw new Error(
      `expo-sqlite wasm not found under ${DIST_DIR}/assets — run \`npm run build:web\` (or the dist-sync build) before journeys.`,
    );
  }
  return name;
}

function discoverWasmUrl(): string {
  return `${APP_BASE_URL}/assets/node_modules/expo-sqlite/web/wa-sqlite/${discoverWasmName()}`;
}

function readWaModule(file: string): string {
  return fs.readFileSync(path.join(WA_DIR, file), 'utf8');
}

const HARNESS_HTML = `<!doctype html><html><head><meta charset="utf-8"><title>superhabits db harness</title></head><body>
<div id="sh-status">booting</div>
<script>
window.__shWorker = new Worker('/__sh__/db/worker.mjs', { type: 'module' });
</script>
<script>
(function () {
  const worker = window.__shWorker;
  let seq = 0;
  const pending = new Map();
  worker.onmessage = function (e) {
    const p = pending.get(e.data.id);
    if (!p) return;
    pending.delete(e.data.id);
    if (e.data.ok) {
      p.resolve(e.data.result);
    } else {
      const err = new Error(String(e.data.error));
      p.reject(err);
    }
  };
  function send(cmd, args) {
    return new Promise(function (resolve, reject) {
      const id = ++seq;
      pending.set(id, { resolve: resolve, reject: reject });
      worker.postMessage({ id: id, cmd: cmd, args: args || {} });
    });
  }
  window.__sh = {
    init: function () { return send('init', {}); },
    open: function () { return send('open', {}); },
    exec: function (sql) { return send('exec', { sql: sql }); },
    query: function (sql) { return send('query', { sql: sql }); },
    close: function () { return send('close', {}); },
  };
  document.getElementById('sh-status').textContent = 'ready';
})();
</script>
</body></html>`;

function buildWorkerSource(wasmUrl: string): string {
  return [
    'const wasmUrl = ' + JSON.stringify(wasmUrl) + ';',
    'import WaSQLiteFactory from "./wa-sqlite.js";',
    'import { Factory } from "./sqlite-api.js";',
    'import { AccessHandlePoolVFS } from "./AccessHandlePoolVFS.js";',
    'let sqlite3 = null;',
    'let db = null;',
    'self.onmessage = async (e) => {',
    '  const { id, cmd, args } = e.data;',
    '  try {',
    '    let result;',
    '    if (cmd === "init") {',
    '      const module = await WaSQLiteFactory({ locateFile: () => wasmUrl });',
    '      sqlite3 = Factory(module);',
    "      const vfs = await AccessHandlePoolVFS.create('expo-sqlite', module);",
    '      sqlite3.vfs_register(vfs, true);',
    "    } else if (cmd === 'open') {",
    "      db = await sqlite3.open_v2('superhabits.db', 0x00000002 | 0x00000004, 'expo-sqlite');",
    "    } else if (cmd === 'exec') {",
    '      await sqlite3.exec(db, args.sql);',
    "    } else if (cmd === 'query') {",
    '      const rows = [];',
    '      await sqlite3.exec(db, args.sql, (row, cols) => {',
    '        const obj = {};',
    '        for (let i = 0; i < cols.length; i++) obj[cols[i]] = row[i];',
    '        rows.push(obj);',
    '      });',
    '      result = rows;',
    "    } else if (cmd === 'close') {",
    '      await sqlite3.close(db);',
    '      db = null;',
    '    }',
    '    self.postMessage({ id, ok: true, result });',
    '  } catch (err) {',
    '    self.postMessage({ id, ok: false, error: String((err && err.message) || err), stack: err && err.stack });',
    '  }',
    '};',
  ].join('\n');
}

const installed = new WeakSet<Page>();

/** Register the harness routes on a page. Idempotent per page. */
export async function installDbHarness(page: Page): Promise<void> {
  if (installed.has(page)) return;
  installed.add(page);
  const wasmUrl = discoverWasmUrl();
  const workerSource = buildWorkerSource(wasmUrl);

  await page.route(DB_HARNESS_ROUTE, (route) => {
    const url = route.request().url();
    const pathname = new URL(url).pathname;
    if (pathname === '/__sh__/db' || pathname === '/__sh__/db/') {
      return route.fulfill({
        status: 200,
        contentType: 'text/html',
        headers: JS_HEADERS,
        body: HARNESS_HTML,
      });
    }
    if (pathname === '/__sh__/db/worker.mjs') {
      return route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        headers: JS_HEADERS,
        body: workerSource,
      });
    }
    if (pathname === '/__sh__/db/wa-sqlite.js') {
      let body = readWaModule('wa-sqlite.js');
      body = body.replace(
        'if(typeof exports==="object"&&typeof module==="object"){module.exports=Module;module.exports.default=Module}else if(typeof define==="function"&&define["amd"])define([],()=>Module);',
        'globalThis.WaSQLiteFactory = Module; export default Module;',
      );
      return route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        headers: JS_HEADERS,
        body,
      });
    }
    for (const file of WA_ESM_FILES) {
      if (pathname === '/__sh__/db/' + file) {
        return route.fulfill({
          status: 200,
          contentType: 'application/javascript',
          headers: JS_HEADERS,
          body: readWaModule(file),
        });
      }
    }
    return route.fulfill({ status: 404, contentType: 'text/plain', body: 'not found' });
  });
}

/** Unregister the app's service worker so page.route can intercept navigations. */
export async function unregisterServiceWorker(page: Page): Promise<void> {
  try {
    await page.evaluate(async () => {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    });
    await page.waitForFunction(
      async () => (await navigator.serviceWorker.getRegistrations()).length === 0,
      null,
      { timeout: 5_000 },
    );
    // An unregistered worker can still control a same-origin document until it
    // navigates. Move through the loopback alias when the local server permits
    // it; this guarantees a new origin before the routed localhost harness
    // navigation and avoids an intermittent SPA fallback after repeated
    // service-worker registrations. `about:blank` remains the fallback for
    // remote/custom E2E origins.
    const escapeUrl = new URL(APP_BASE_URL);
    if (escapeUrl.hostname === 'localhost' || escapeUrl.hostname === '127.0.0.1') {
      escapeUrl.hostname = escapeUrl.hostname === 'localhost' ? '127.0.0.1' : 'localhost';
      escapeUrl.pathname = '/__sh__/e2e-escape';
      escapeUrl.search = `?t=${Date.now()}`;
      await page.goto(escapeUrl.href, { waitUntil: 'domcontentloaded' });
    } else {
      await page.goto('about:blank', { waitUntil: 'domcontentloaded' });
    }
  } catch {
    // Page may already be gone or not service-worker-capable.
  }
}

/**
 * Wait for the app shell (tab rail) to render and for the SQLite bootstrap +
 * migrations to finish. The shell renders before `initializeDatabase()`
 * completes, so a fixed sleep would race migrations under load; instead the
 * app sets `data-db-ready` on `documentElement` once the schema is fully
 * migrated (see AppProviders). Navigating the page away mid-migration would
 * kill the in-flight migrations and permanently strand the schema at a
 * partial version, so this wait is load-bearing for every DB-context handoff.
 */
export async function waitForAppReady(page: Page, timeout = 30_000): Promise<void> {
  await page.getByRole('button', { name: 'Overview', exact: true }).first().waitFor({ timeout });
  await page.waitForFunction(() => document.documentElement.dataset.dbReady === 'true', null, {
    timeout,
  });
  // Give the app's first post-bootstrap queries/renders a beat to settle.
  await page.waitForTimeout(300);
}

/**
 * Put the page in DB context: navigate to the harness document (if not already
 * there), boot the worker and open the app's database. Idempotent within a page
 * stay. Destroys app React state — call at reload boundaries.
 */
export async function ensureDbContext(page: Page): Promise<void> {
  await installDbHarness(page);
  if (!page.url().startsWith(DB_HARNESS_URL)) {
    await unregisterServiceWorker(page);
    await page.goto(DB_HARNESS_URL, { waitUntil: 'load' });
    await page.waitForFunction(() => (window as unknown as { __sh?: unknown }).__sh, null, {
      timeout: 20_000,
    });
  }
  await page.evaluate(async () => {
    const win = window as unknown as {
      __sh?: { __opened?: boolean; init(): Promise<unknown>; open(): Promise<unknown> };
    };
    if (!win.__sh) throw new Error('db harness not ready');
    if (win.__sh.__opened) return;
    const attempts = 20;
    let lastError: unknown = null;
    for (let i = 0; i < attempts; i++) {
      try {
        await win.__sh.init();
        await win.__sh.open();
        win.__sh.__opened = true;
        return;
      } catch (err) {
        lastError = err;
        // The previous page's worker may still hold OPFS handles for a few
        // moments after navigation; retry instead of failing a real journey.
        await new Promise((r) => setTimeout(r, 300));
      }
    }
    throw new Error('db harness could not open the SQLite database: ' + String(lastError));
  });
}

/** Run SQL (no rows expected) and return. Leaves the page in DB context. */
export async function runSql(page: Page, sql: string): Promise<void> {
  await ensureDbContext(page);
  await page.evaluate((statement) => {
    const win = window as unknown as {
      __sh?: { exec(sql: string): Promise<unknown> };
    };
    if (!win.__sh) throw new Error('db harness not ready');
    return win.__sh.exec(statement);
  }, sql);
}

/** Run a SELECT and return rows as objects keyed by column name. */
export async function queryRows(page: Page, sql: string): Promise<Record<string, unknown>[]> {
  await ensureDbContext(page);
  const rows = await page.evaluate((statement) => {
    const win = window as unknown as {
      __sh?: { query(sql: string): Promise<Record<string, unknown>[]> };
    };
    if (!win.__sh) throw new Error('db harness not ready');
    return win.__sh.query(statement);
  }, sql);
  return rows;
}

/** Release the harness DB handle (does not destroy the page). */
export async function closeDbContext(page: Page): Promise<void> {
  await page.evaluate(() => {
    const win = window as unknown as {
      __sh?: { close(): Promise<unknown>; __opened?: boolean };
    };
    if (win.__sh && win.__sh.__opened) {
      const sh = win.__sh;
      return sh.close().then(() => {
        sh.__opened = false;
      });
    }
  });
}

/** Return from DB context to the app: reloads '/' fresh and waits for it. */
export async function returnToApp(page: Page): Promise<void> {
  await unregisterServiceWorker(page);
  await page.goto(APP_BASE_URL + '/', { waitUntil: 'domcontentloaded' });
  await waitForAppReady(page);
}

/**
 * Ensure the page is on the app (reloads from DB context if needed). Does not
 * reload if already on the app.
 */
export async function ensureAppContext(page: Page): Promise<void> {
  if (page.url().startsWith(DB_HARNESS_URL)) {
    await returnToApp(page);
  }
}
