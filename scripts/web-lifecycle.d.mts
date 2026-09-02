/**
 * Type declarations for `scripts/web-lifecycle.mjs` so TypeScript consumers
 * (primarily `tests/web-lifecycle.test.ts`) are typechecked. The runtime
 * implementation is plain ESM in `scripts/web-lifecycle.mjs`.
 */
import type { ChildProcess } from 'node:child_process';

export const DEFAULT_PORT: number;
export const PORT_SCAN_LIMIT: number;

export class WebLifecycleError extends Error {
  name: string;
}

export function isPortAvailable(port: number, host?: string): Promise<boolean>;
export function pickPort(options?: { preferred?: number; rangeLimit?: number }): Promise<number>;

export interface HttpProbeResult {
  status: number;
  headers: Record<string, string | string[] | undefined>;
}

export interface OwnedServerProcess {
  pid: number;
  child: ChildProcess;
  logTail: () => string;
}

export function waitForHttp(options: {
  url: string;
  timeoutMs?: number;
  intervalMs?: number;
  child?: ChildProcess | null;
}): Promise<HttpProbeResult>;

export function spawnOwnedServer(options: {
  command: string;
  args?: string[];
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  stdio?: unknown[];
}): OwnedServerProcess;

export function waitForChildExit(child: ChildProcess, timeoutMs?: number): Promise<boolean>;

export function terminateOwnedTree(
  owned: { pid?: number; child?: ChildProcess | null },
  options?: { graceMs?: number; log?: (message: string) => void },
): Promise<{ code: number | null; signal: string | null }>;

export function waitForPortRelease(
  port: number,
  options?: { timeoutMs?: number; intervalMs?: number },
): Promise<boolean>;

export interface RunWebVerifyOptions {
  port: number;
  distDir?: string;
  serverScript: string;
  skipBuild?: boolean;
  build?: (() => Promise<void>) | null;
  browserProbe?: ((options: { url: string; timeoutMs: number }) => Promise<void>) | null;
  log?: (message: string) => void;
  readinessTimeoutMs?: number;
  releaseTimeoutMs?: number;
}

export function runWebVerify(options: RunWebVerifyOptions): Promise<number>;
