/**
 * Finite web-server lifecycle helpers for SuperHabits autonomous agents.
 *
 * The repository distinguishes three web workflows:
 * - Persistent (human HMR): `npm run web` / `npm run web:dev` — long-lived
 *   Metro servers that intentionally never exit. Autonomous agents MUST NOT
 *   await them as validation gates.
 * - One-shot build: `npm run build:web` — finite.
 * - Automated verification: `npm run web:verify` — finite; backed by this
 *   module plus `scripts/web-verify.mjs`.
 *
 * Every function here is bounded: owned children, polled readiness with a
 * deadline (never arbitrary sleeps), guaranteed process-tree cleanup, and
 * port-release verification. Nothing in this module starts Metro.
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import process from 'node:process';

export const DEFAULT_PORT = 8081;
export const PORT_SCAN_LIMIT = 8099;

export class WebLifecycleError extends Error {
  constructor(message) {
    super(message);
    this.name = 'WebLifecycleError';
  }
}

function assertIntegerPort(value, label) {
  if (!Number.isInteger(value) || value <= 0 || value > 65535) {
    throw new WebLifecycleError(
      `${label} must be an integer port in 1..65535, received ${JSON.stringify(value)}`,
    );
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * True when nothing is listening on `port` (bound to loopback). Mirrors the
 * check used by `scripts/dev-doctor.mjs`.
 */
export function isPortAvailable(port, host = '127.0.0.1') {
  assertIntegerPort(port, 'port');
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.listen(port, host, () => {
      server.close(() => resolve(true));
    });
  });
}

/**
 * Choose a controlled port: prefer `preferred` when free, otherwise scan
 * upward to `rangeLimit`. Never returns a port that is already occupied, so
 * the verifier can never silently attach to an unknown existing server.
 */
export async function pickPort({ preferred = DEFAULT_PORT, rangeLimit = PORT_SCAN_LIMIT } = {}) {
  assertIntegerPort(preferred, 'preferred');
  assertIntegerPort(rangeLimit, 'rangeLimit');
  if (rangeLimit < preferred) {
    throw new WebLifecycleError(`rangeLimit ${rangeLimit} is below preferred port ${preferred}`);
  }
  if (await isPortAvailable(preferred)) return preferred;
  for (let port = preferred + 1; port <= rangeLimit; port += 1) {
    if (await isPortAvailable(port)) return port;
  }
  throw new WebLifecycleError(
    `no free port found in ${preferred}..${rangeLimit}; free a port or pass an explicit --port`,
  );
}

/**
 * Poll an HTTP endpoint until it answers with a non-error status (bounded).
 * `child` (optional) makes the poll fail immediately if the owned server
 * exits before readiness, surfacing its exit code/signal.
 */
export async function waitForHttp({ url, timeoutMs = 30_000, intervalMs = 250, child = null }) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new WebLifecycleError(`waitForHttp: invalid url ${JSON.stringify(url)}`);
  }
  if (parsed.protocol !== 'http:') {
    throw new WebLifecycleError(`waitForHttp: url must use http:, received ${url}`);
  }

  let lastError = null;
  const deadline = Date.now() + timeoutMs;
  while (true) {
    if (child && child.exitCode !== null) {
      const detail = `(exit code ${child.exitCode}${
        child.signalCode ? `, signal ${child.signalCode}` : ''
      })`;
      throw new WebLifecycleError(`server exited before readiness ${detail}`);
    }
    const probe = await new Promise((resolve) => {
      const req = http.get(url, (res) => {
        res.resume();
        resolve({ status: res.statusCode ?? 0, headers: res.headers });
      });
      req.on('error', (err) => {
        lastError = err.message;
        resolve(null);
      });
      req.setTimeout(3000, () => {
        req.destroy();
        lastError = 'HTTP probe timed out';
        resolve(null);
      });
    });
    if (probe) return probe;
    if (Date.now() >= deadline) {
      throw new WebLifecycleError(
        `server did not become ready within ${timeoutMs}ms at ${url}${
          lastError ? ` — last error: ${lastError}` : ''
        }`,
      );
    }
    await delay(intervalMs);
  }
}

/**
 * Spawn a server process that this verifier owns. On POSIX the child gets its
 * own process group (`detached: true`) so the whole tree can be signalled;
 * on Windows the tree is terminated via `taskkill /T`. stdout/stderr are
 * captured (bounded ring buffer) for diagnostics.
 */
export function spawnOwnedServer({
  command,
  args = [],
  cwd,
  env = process.env,
  stdio = ['ignore', 'pipe', 'pipe'],
}) {
  const child = spawn(command, args, {
    cwd,
    env,
    stdio,
    detached: process.platform !== 'win32',
    windowsHide: true,
  });
  const logLines = [];
  const MAX_LOG_LINES = 60;
  const capture = (stream) => {
    if (!stream) return;
    stream.setEncoding('utf8');
    stream.on('data', (chunk) => {
      for (const line of chunk.split(/\r?\n/)) {
        if (line) logLines.push(line);
      }
      if (logLines.length > MAX_LOG_LINES) {
        logLines.splice(0, logLines.length - MAX_LOG_LINES);
      }
    });
  };
  capture(child.stdout);
  capture(child.stderr);
  return {
    child,
    pid: child.pid,
    logTail: () => logLines.join('\n'),
  };
}

/**
 * Wait (bounded) for a child to exit. Resolves true when it exited, false on
 * timeout.
 */
export function waitForChildExit(child, timeoutMs = 5000) {
  return new Promise((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) {
      resolve(true);
      return;
    }
    const timer = setTimeout(() => {
      child.removeListener('exit', onExit);
      resolve(false);
    }, timeoutMs);
    const onExit = () => {
      clearTimeout(timer);
      resolve(true);
    };
    child.on('exit', onExit);
  });
}

/**
 * Terminate ONLY the process tree that this verifier spawned (exact owned
 * PID). Never broad commands like `taskkill /IM node.exe` or `killall node`.
 * POSIX: SIGTERM to the owned process group, SIGKILL after a bounded grace.
 * Windows: `taskkill /PID <ownedPid> /T /F` (native tree termination).
 */
export async function terminateOwnedTree(owned, { graceMs = 1500, log = () => {} } = {}) {
  const child = owned?.child ?? null;
  const pid = owned?.pid ?? child?.pid;
  if (!Number.isInteger(pid)) {
    throw new WebLifecycleError(`terminateOwnedTree: no pid on ${JSON.stringify(owned)}`);
  }
  if (child && child.exitCode !== null) {
    return { code: child.exitCode, signal: child.signalCode };
  }
  if (process.platform === 'win32') {
    const result = spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
    if (result.status !== 0) {
      log(`warn: taskkill /PID ${pid} /T /F returned exit ${result.status}`);
    }
    if (child) await waitForChildExit(child, 5000);
    return { code: child?.exitCode ?? null, signal: child?.signalCode ?? null };
  }
  // POSIX: signal the owned group; fall back to the single PID if the group
  // is already gone.
  try {
    process.kill(-pid, 'SIGTERM');
  } catch {
    try {
      process.kill(pid, 'SIGTERM');
    } catch {
      // already gone
    }
  }
  if (child) {
    const exited = await waitForChildExit(child, graceMs);
    if (!exited) {
      try {
        process.kill(-pid, 'SIGKILL');
      } catch {
        try {
          process.kill(pid, 'SIGKILL');
        } catch {
          // already gone
        }
      }
      await waitForChildExit(child, 3000);
    }
  }
  return { code: child?.exitCode ?? null, signal: child?.signalCode ?? null };
}

/** Poll the loopback bind until `port` is released (bounded). */
export async function waitForPortRelease(port, { timeoutMs = 8000, intervalMs = 200 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (true) {
    if (await isPortAvailable(port)) return true;
    if (Date.now() >= deadline) return false;
    await delay(intervalMs);
  }
}

/**
 * The finite verification pipeline used by `npm run web:verify`:
 * build (unless skipped) → own a static server → bounded readiness poll →
 * header assertions → optional in-browser smoke probe → guaranteed tree
 * cleanup → port-release check.
 *
 * Returns an exit code (0 = PASS, 1 = FAIL). Never leaves the owned server
 * running, regardless of which step failed.
 */
export async function runWebVerify({
  port,
  distDir = 'dist',
  serverScript,
  skipBuild = false,
  build = null,
  browserProbe = null,
  log = console.log,
  readinessTimeoutMs = 90_000,
  releaseTimeoutMs = 8000,
}) {
  assertIntegerPort(port, 'port');
  const failures = [];
  let owned = null;
  try {
    if (!skipBuild) {
      if (!build) {
        throw new WebLifecycleError('runWebVerify: build is required unless skipBuild is set');
      }
      log('step 1/5: building static export (npm run build:web)…');
      await build();
      log('step 1/5: build complete');
    } else {
      const indexPath = path.join(distDir, 'index.html');
      if (!existsSync(indexPath)) {
        throw new WebLifecycleError(
          `--skip-build but ${indexPath} does not exist; run \`npm run build:web\` first`,
        );
      }
      log(`step 1/5: reusing existing static export (${distDir}/)`);
    }

    log(`step 2/5: starting owned static server on :${port}…`);
    owned = spawnOwnedServer({
      command: process.execPath,
      args: [serverScript, '--port', String(port), '--dist', distDir],
    });

    const url = `http://localhost:${port}/`;
    log(`step 3/5: waiting for readiness at ${url}…`);
    const probe = await waitForHttp({ url, timeoutMs: readinessTimeoutMs, child: owned.child });
    if (probe.status < 200 || probe.status >= 400) {
      failures.push(`HTTP probe returned status ${probe.status}`);
    } else {
      log(`step 3/5: HTTP ${probe.status} from ${url}`);
    }

    const coep = String(probe.headers['cross-origin-embedder-policy'] ?? '').toLowerCase();
    const coop = String(probe.headers['cross-origin-opener-policy'] ?? '').toLowerCase();
    if (!coep.includes('require-corp')) {
      failures.push(`missing Cross-Origin-Embedder-Policy: require-corp (got ${coep || 'none'})`);
    } else if (!coop.includes('same-origin')) {
      failures.push(`missing Cross-Origin-Opener-Policy: same-origin (got ${coop || 'none'})`);
    } else {
      log('step 3/5: COOP/COEP isolation headers present (require-corp / same-origin)');
    }

    if (browserProbe) {
      log('step 4/5: launching bounded browser smoke probe…');
      await browserProbe({ url, timeoutMs: readinessTimeoutMs });
      log('step 4/5: browser probe complete');
    } else {
      log('step 4/5: browser probe skipped (--no-browser)');
    }
  } catch (error) {
    const tail = owned ? owned.logTail() : '';
    failures.push(
      `${error && error.message ? error.message : String(error)}${
        tail ? `\nserver log tail:\n${tail}` : ''
      }`,
    );
  } finally {
    if (owned) {
      log('step 5/5: terminating owned server (exact process tree)…');
      try {
        await terminateOwnedTree(owned, { log });
      } catch (error) {
        failures.push(`cleanup error: ${error && error.message ? error.message : String(error)}`);
      }
      const released = await waitForPortRelease(port, { timeoutMs: releaseTimeoutMs });
      if (!released) {
        failures.push(`port ${port} was NOT released after cleanup`);
      } else {
        log(`step 5/5: port ${port} released`);
      }
    } else {
      log('step 5/5: no owned server was started; nothing to clean up');
    }
  }
  if (failures.length > 0) {
    log('');
    log('web verification FAILED:');
    for (const failure of failures) log(`- ${failure}`);
    return 1;
  }
  return 0;
}
