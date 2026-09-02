/**
 * Phase A web-lifecycle tests: finite server ownership, bounded readiness,
 * guaranteed tree cleanup, port release, and no accidental process reuse.
 *
 * These tests never launch Metro. They exercise the lifecycle library with
 * tiny inline Node servers and (in one integration smoke) the real
 * `web:verify` CLI against the real static export when `dist/` exists.
 */
import { spawn, execFileSync, type ChildProcess } from 'node:child_process';
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  WebLifecycleError,
  isPortAvailable,
  pickPort,
  runWebVerify,
  spawnOwnedServer,
  terminateOwnedTree,
  waitForHttp,
  waitForPortRelease,
} from '../scripts/web-lifecycle.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

type OwnedServer = ReturnType<typeof spawnOwnedServer>;

const SERVER_SCRIPT = `
const http = require('http');
const argPort = process.argv.indexOf('--port');
const port = Number(argPort >= 0 ? process.argv[argPort + 1] : process.env.WV_PORT);
const server = http.createServer((req, res) => {
  res.writeHead(200, {
    'Cross-Origin-Embedder-Policy': 'require-corp',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Content-Type': 'text/html',
  });
  res.end('<html><body>ok</body></html>');
});
server.listen(port, '127.0.0.1', () => console.log('READY ' + port));
process.on('SIGTERM', () => process.exit(0));
`;

const EXIT_EARLY_SCRIPT = 'process.exit(7);';
const NEVER_LISTEN_SCRIPT = 'setInterval(() => {}, 1000);';

async function freePort() {
  return pickPort({ preferred: 18081, rangeLimit: 18099 });
}

function spawnServer(port: number, script: string = SERVER_SCRIPT) {
  return spawnOwnedServer({
    command: process.execPath,
    args: ['-e', script],
    env: { ...process.env, WV_PORT: String(port) },
  });
}

function writeTempServer(script: string) {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'web-verify-'));
  const file = path.join(dir, 'server.cjs');
  writeFileSync(file, script);
  return file;
}

function writeTempDist() {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'web-verify-dist-'));
  writeFileSync(path.join(dir, 'index.html'), '<html><body>ok</body></html>');
  return dir;
}

describe('pickPort / isPortAvailable', () => {
  it('returns the preferred port when free', async () => {
    const port = await freePort();
    await expect(pickPort({ preferred: port, rangeLimit: port })).resolves.toBe(port);
  });

  it('skips an occupied port instead of reusing it (no accidental reuse)', async () => {
    const server = http.createServer();
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const occupied = (server.address() as { port: number }).port;
    const chosen = await pickPort({ preferred: occupied, rangeLimit: occupied + 10 });
    expect(chosen).not.toBe(occupied);
    await new Promise((resolve) => server.close(resolve));
  });

  it('rejects invalid port arguments', async () => {
    await expect(pickPort({ preferred: 0 })).rejects.toBeInstanceOf(WebLifecycleError);
    await expect(pickPort({ preferred: 'x' as unknown as number })).rejects.toBeInstanceOf(
      WebLifecycleError,
    );
    expect(() => isPortAvailable(0)).toThrow(WebLifecycleError);
  });
});

describe('waitForHttp', { timeout: 30_000 }, () => {
  it('resolves when the server becomes ready', async () => {
    const port = await freePort();
    const owned = spawnServer(port);
    try {
      const probe = await waitForHttp({
        url: `http://localhost:${port}/`,
        timeoutMs: 5000,
        child: owned.child,
      });
      expect(probe.status).toBe(200);
      expect(String(probe.headers['cross-origin-embedder-policy'])).toContain('require-corp');
    } finally {
      await terminateOwnedTree(owned);
    }
  });

  it('fails immediately when the server exits before readiness (exit code surfaced)', async () => {
    const port = await freePort();
    const owned = spawnServer(port, EXIT_EARLY_SCRIPT);
    await expect(
      waitForHttp({ url: `http://localhost:${port}/`, timeoutMs: 3000, child: owned.child }),
    ).rejects.toThrow(/exit code 7/);
  });

  it('times out with a bounded deadline when nothing listens', async () => {
    const port = await freePort();
    await expect(waitForHttp({ url: `http://localhost:${port}/`, timeoutMs: 500 })).rejects.toThrow(
      /did not become ready/,
    );
  });

  it('rejects invalid urls', async () => {
    await expect(waitForHttp({ url: 'not-a-url' })).rejects.toBeInstanceOf(WebLifecycleError);
  });
});

// CG-9: the isolation spec's worst path is 4 × 10s readiness probes +
// terminate + port release; the describe ceiling must exceed that sum, or
// the *outer* bound becomes the load-sensitive failure (observed: 30s
// describe timeout firing while every inner bound still had headroom).
describe('terminateOwnedTree', { timeout: 60_000 }, () => {
  it('cleans up the owned server after a successful probe and releases the port', async () => {
    const port = await freePort();
    const owned = spawnServer(port);
    try {
      await waitForHttp({ url: `http://localhost:${port}/`, timeoutMs: 5000, child: owned.child });
    } finally {
      await terminateOwnedTree(owned);
    }
    expect(owned.child.exitCode !== null).toBe(true);
    await expect(waitForPortRelease(port, { timeoutMs: 5000 })).resolves.toBe(true);
  });

  it('cleans up after a failing probe (server never ready) and releases the port', async () => {
    const port = await freePort();
    const owned = spawnServer(port, NEVER_LISTEN_SCRIPT);
    await expect(
      waitForHttp({ url: `http://localhost:${port}/`, timeoutMs: 500, child: owned.child }),
    ).rejects.toThrow();
    await terminateOwnedTree(owned, { graceMs: 500 });
    expect(owned.child.exitCode !== null).toBe(true);
    await expect(waitForPortRelease(port, { timeoutMs: 5000 })).resolves.toBe(true);
  });

  it('terminates only the owned tree, never an unrelated process', async () => {
    // CG-9 bind-race guard: pickPort() sees a port as free while a previous
    // test's server is still mid-shutdown; the spawned server then fails to
    // bind and dies instantly (observed: "did not become ready within
    // 10000ms at :18081"). Spawn + probe with a child watcher so a bind
    // death fails fast, and retry on a fresh port (bounded, 3 attempts).
    // The isolation assertions themselves are unchanged.
    let owned: OwnedServer | null = null;
    let ownedPort = 0;
    let victimPort = 0;
    let victim: ChildProcess | null = null;
    try {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        ownedPort = await freePort();
        owned = spawnServer(ownedPort);
        try {
          await waitForHttp({
            url: `http://localhost:${ownedPort}/`,
            timeoutMs: 10_000,
            child: owned.child,
          });
          break;
        } catch (error) {
          await terminateOwnedTree(owned, { graceMs: 250 });
          owned = null;
          if (attempt === 2) throw error;
        }
      }

      for (let attempt = 0; attempt < 3; attempt += 1) {
        victimPort = await freePort();
        victim = spawn(process.execPath, ['-e', SERVER_SCRIPT], {
          env: { ...process.env, WV_PORT: String(victimPort) },
          stdio: 'ignore',
        });
        try {
          await waitForHttp({
            url: `http://localhost:${victimPort}/`,
            timeoutMs: 10_000,
          });
          break;
        } catch (error) {
          victim.kill('SIGKILL');
          victim = null;
          if (attempt === 2) throw error;
        }
      }

      await terminateOwnedTree(owned!, { graceMs: 500 });
      expect(owned!.child.exitCode !== null).toBe(true);
      // The unrelated victim must still be serving.
      const victimProbe = await waitForHttp({
        url: `http://localhost:${victimPort}/`,
        timeoutMs: 10_000,
      });
      expect(victimProbe.status).toBe(200);
    } finally {
      victim?.kill('SIGKILL');
      // CG-9: bound the cleanup wait — an unbounded exit wait hangs the
      // whole describe budget if SIGKILL delivery stalls under
      // process-table pressure. The assertion under test (isolation) has
      // already completed by then.
      if (victim) {
        await Promise.race([
          new Promise((resolve) => victim!.once('exit', resolve)),
          new Promise((resolve) => setTimeout(resolve, 5_000)),
        ]);
      }
    }
  });
});

describe('runWebVerify (finite pipeline)', { timeout: 30_000 }, () => {
  it('passes end-to-end and releases its port', async () => {
    const port = await freePort();
    const serverScript = writeTempServer(SERVER_SCRIPT);
    const distDir = writeTempDist();
    const exitCode = await runWebVerify({
      port,
      distDir,
      serverScript,
      skipBuild: true,
      browserProbe: null,
      log: () => {},
      readinessTimeoutMs: 5000,
    });
    expect(exitCode).toBe(0);
    await expect(waitForPortRelease(port, { timeoutMs: 5000 })).resolves.toBe(true);
  });

  it('fails (exit 1) when the browser probe fails and still cleans up', async () => {
    const port = await freePort();
    const serverScript = writeTempServer(SERVER_SCRIPT);
    const distDir = writeTempDist();
    const exitCode = await runWebVerify({
      port,
      distDir,
      serverScript,
      skipBuild: true,
      browserProbe: async () => {
        throw new Error('injected probe failure');
      },
      log: () => {},
      readinessTimeoutMs: 5000,
    });
    expect(exitCode).toBe(1);
    await expect(waitForPortRelease(port, { timeoutMs: 5000 })).resolves.toBe(true);
  });

  it('propagates a non-zero server exit as exit 1', async () => {
    const port = await freePort();
    const serverScript = writeTempServer(EXIT_EARLY_SCRIPT);
    const distDir = writeTempDist();
    const exitCode = await runWebVerify({
      port,
      distDir,
      serverScript,
      skipBuild: true,
      browserProbe: null,
      log: () => {},
      readinessTimeoutMs: 5000,
    });
    expect(exitCode).toBe(1);
  });

  it('fails fast when the server never becomes ready (bounded timeout)', async () => {
    const port = await freePort();
    const serverScript = writeTempServer(NEVER_LISTEN_SCRIPT);
    const distDir = writeTempDist();
    const startedAt = Date.now();
    const exitCode = await runWebVerify({
      port,
      distDir,
      serverScript,
      skipBuild: true,
      browserProbe: null,
      log: () => {},
      readinessTimeoutMs: 800,
    });
    expect(exitCode).toBe(1);
    expect(Date.now() - startedAt).toBeLessThan(10_000);
    await expect(waitForPortRelease(port, { timeoutMs: 5000 })).resolves.toBe(true);
  });

  it('fails when --skip-build is used without a dist', async () => {
    const port = await freePort();
    const serverScript = writeTempServer(SERVER_SCRIPT);
    const missingDist = path.join(os.tmpdir(), `no-such-dist-${Date.now()}`);
    const exitCode = await runWebVerify({
      port,
      distDir: missingDist,
      serverScript,
      skipBuild: true,
      browserProbe: null,
      log: () => {},
    });
    expect(exitCode).toBe(1);
  });

  it('rejects invalid ports', async () => {
    await expect(
      runWebVerify({ port: 0, serverScript: 'x', skipBuild: true }),
    ).rejects.toBeInstanceOf(WebLifecycleError);
  });
});

describe('web:verify CLI (real scripts)', () => {
  const distExists = existsSync(path.join(ROOT, 'dist', 'index.html'));

  it(
    'smoke: verifies the real static export and exits by itself (dist/ present)',
    { timeout: 150_000, skip: !distExists },
    async () => {
      const port = await freePort();
      const output = execFileSync(
        process.execPath,
        ['scripts/web-verify.mjs', '--skip-build', '--no-browser', '--port', String(port)],
        { cwd: ROOT, encoding: 'utf8', timeout: 120_000 },
      );
      expect(output).toContain('(exit 0)');
      await expect(waitForPortRelease(port, { timeoutMs: 5000 })).resolves.toBe(true);
    },
  );

  it('usage error: invalid --port exits non-zero', async () => {
    expect(() =>
      execFileSync(process.execPath, ['scripts/web-verify.mjs', '--port', 'abc'], {
        cwd: ROOT,
        encoding: 'utf8',
        timeout: 30_000,
      }),
    ).toThrow();
  });

  it('refuses to attach to an occupied port (no accidental reuse)', async () => {
    const server = http.createServer();
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const occupied = (server.address() as { port: number }).port;
    try {
      expect(() =>
        execFileSync(process.execPath, ['scripts/web-verify.mjs', '--port', String(occupied)], {
          cwd: ROOT,
          encoding: 'utf8',
          timeout: 30_000,
        }),
      ).toThrow(/refusing to attach/);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });
});
