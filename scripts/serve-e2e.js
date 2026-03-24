/**
 * Minimal static file server for E2E (Node built-ins only).
 * Serves Expo web export from `dist/` with COOP/COEP headers for OPFS SQLite.
 */
const http = require("http");
const fs = require("fs").promises;
const path = require("path");

const PORT = 8081;
const DIST = path.resolve(__dirname, "..", "dist");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".wasm": "application/wasm",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".map": "application/json",
  ".txt": "text/plain; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
};

function getMime(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return MIME[ext] || "application/octet-stream";
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
    "Cross-Origin-Embedder-Policy": "require-corp",
    "Cross-Origin-Opener-Policy": "same-origin",
    ...extra,
  };
}

const server = http.createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url || "/", "http://localhost").pathname;
    const rel =
      pathname === "/" ? "index.html" : pathname.replace(/^\//, "");
    const decoded = decodeURIComponent(rel);
    const filePath = path.resolve(DIST, decoded);

    if (!isInsideDist(filePath)) {
      res.writeHead(403, coopCoepHeaders());
      res.end("Forbidden");
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
      res.writeHead(200, coopCoepHeaders({ "Content-Type": getMime(filePath) }));
      res.end(data);
      return;
    }

    const indexPath = path.join(DIST, "index.html");
    const data = await fs.readFile(indexPath);
    res.writeHead(200, coopCoepHeaders({ "Content-Type": "text/html; charset=utf-8" }));
    res.end(data);
  } catch {
    res.writeHead(500, coopCoepHeaders());
    res.end();
  }
});

server.listen(PORT, () => {
  console.log(`E2E static server: http://localhost:${PORT} (root: ${DIST})`);
});
