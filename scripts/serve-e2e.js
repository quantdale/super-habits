/**
 * Minimal static file server for E2E (Node built-ins only).
 * Serves an Expo web export (default `dist/`) with COOP/COEP headers for OPFS
 * SQLite.
 *
 * Usage:
 *   node scripts/serve-e2e.js                 # dist/ on :8081 (default)
 *   node scripts/serve-e2e.js --port 8082     # dist/ on :8082
 *   node scripts/serve-e2e.js -p 8082 --dist dist-sync   # dist-sync/ on :8082
 *
 * The `--port`/`-p` and `--dist`/`-d` arguments let the dedicated
 * `journeys-sync` Playwright project serve the `dist-sync/` (dummy-Supabase)
 * export on a second port. Defaults are unchanged (8081 → dist/).
 */
const http = require('http');
const fs = require('fs').promises;
const path = require('path');

function parseArgs(argv) {
  const args = { port: 8081, dist: 'dist' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--port' || a === '-p') {
      args.port = Number(argv[++i]);
    } else if (a === '--dist' || a === '-d') {
      args.dist = argv[++i];
    }
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
if (!Number.isInteger(args.port) || args.port <= 0 || !args.dist) {
  console.error(
    'usage: node scripts/serve-e2e.js [--port <port>] [--dist <export-dir>] (defaults: 8081, dist)',
  );
  process.exit(1);
}
const PORT = args.port;
const DIST = path.resolve(__dirname, '..', args.dist);

// Audit AREA 9 F5: product sw.js bypasses localhost in its fetch handler
// (never cache Metro/dev responses), which also makes the cache-serving path
// untestable against this E2E server. The worker ships a marked constant; we
// serve /sw.js with it flipped so Playwright exercises the REAL fetch
// handler. Product builds are untouched. A stale dist/ (marker missing)
// fails loudly instead of silently testing the old semantics.
const SW_BYPASS_MARKER = 'const E2E_DISABLE_DEV_BYPASS = false;';
const SW_BYPASS_PATCHED = 'const E2E_DISABLE_DEV_BYPASS = true;';

// Test support for SW update flows: Playwright cannot intercept service-
// worker script fetches with page.route, so specs need the SERVER to change
// the served /sw.js bytes on demand. POST /__e2e__/sw-variant/<marker> sets
// an in-memory marker appended as a trailing comment to the served worker;
// POST /__e2e__/sw-variant/ (empty) restores the plain patched bytes. The
// marker lives only for this server process and defaults to ''.
let swVariantMarker = '';

async function readPatchedSwSource() {
  let source;
  try {
    source = await fs.readFile(path.join(DIST, 'sw.js'), 'utf8');
  } catch {
    throw new Error(
      `serve-e2e: ${path.join(DIST, 'sw.js')} not found — run \`npm run build:web\` first.`,
    );
  }
  if (!source.includes(SW_BYPASS_MARKER)) {
    throw new Error(
      'serve-e2e: served sw.js is missing the E2E_DISABLE_DEV_BYPASS marker — ' +
        'the export is stale relative to public/sw.js. Run `npm run build:web`.',
    );
  }
  const patched = source.replace(SW_BYPASS_MARKER, SW_BYPASS_PATCHED);
  return swVariantMarker ? `${patched}\n// pwa-e2e variant: ${swVariantMarker}\n` : patched;
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.wasm': 'application/wasm',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
};

function getMime(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return MIME[ext] || 'application/octet-stream';
}

function isInsideDist(candidate) {
  const root = path.resolve(DIST);
  const resolved = path.resolve(candidate);
  if (resolved === root) return true;
  const prefix = root.endsWith(path.sep) ? root : root + path.sep;
  return resolved.startsWith(prefix);
}

function coopCoepHeaders(extra = {}) {
  return {
    'Cross-Origin-Embedder-Policy': 'require-corp',
    'Cross-Origin-Opener-Policy': 'same-origin',
    ...extra,
  };
}

const server = http.createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url || '/', 'http://localhost').pathname;
    const rel = pathname === '/' ? 'index.html' : pathname.replace(/^\//, '');
    const decoded = decodeURIComponent(rel);
    const filePath = path.resolve(DIST, decoded);

    if (!isInsideDist(filePath)) {
      res.writeHead(403, coopCoepHeaders());
      res.end('Forbidden');
      return;
    }

    if (pathname.startsWith('/__e2e__/sw-variant/')) {
      swVariantMarker = decodeURIComponent(pathname.slice('/__e2e__/sw-variant/'.length));
      res.writeHead(200, coopCoepHeaders({ 'Content-Type': 'text/plain; charset=utf-8' }));
      res.end(`sw variant set to: ${JSON.stringify(swVariantMarker)}`);
      return;
    }

    if (pathname === '/sw.js') {
      try {
        const body = await readPatchedSwSource();
        // no-store so worker update checks always see the current bytes.
        res.writeHead(
          200,
          coopCoepHeaders({
            'Content-Type': MIME['.js'],
            'Cache-Control': 'no-store',
          }),
        );
        res.end(body);
      } catch (error) {
        res.writeHead(500, coopCoepHeaders({ 'Content-Type': 'text/plain; charset=utf-8' }));
        res.end(String(error && error.message ? error.message : error));
      }
      return;
    }

    let stat;
    try {
      stat = await fs.stat(filePath);
    } catch {
      stat = null;
    }

    if (stat?.isFile()) {
      const data = await fs.readFile(filePath);
      res.writeHead(200, coopCoepHeaders({ 'Content-Type': getMime(filePath) }));
      res.end(data);
      return;
    }

    const indexPath = path.join(DIST, 'index.html');
    const data = await fs.readFile(indexPath);
    res.writeHead(200, coopCoepHeaders({ 'Content-Type': 'text/html; charset=utf-8' }));
    res.end(data);
  } catch {
    res.writeHead(500, coopCoepHeaders());
    res.end();
  }
});

server.listen(PORT, () => {
  console.log(`E2E static server: http://localhost:${PORT} (root: ${DIST})`);
});
