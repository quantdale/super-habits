import { existsSync, lstatSync, statfsSync } from 'node:fs';
import { freemem, homedir, tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';

// A cold API-36 AVD can allocate a 10 GiB data partition before Gradle starts.
// Keep build/AVD headroom on EACH filesystem; drive aliases are not extra space.
// These are admission floors, not a guarantee that an arbitrary build will fit.
export const NATIVE_MIN_FREE_DISK_BYTES = 16 * 1024 ** 3;
export const NATIVE_MIN_FREE_MEMORY_BYTES = 4 * 1024 ** 3;

function existingAncestor(path) {
  let current = resolve(path);
  while (!existsSync(current)) {
    const parent = dirname(current);
    if (parent === current) throw new Error(`No existing filesystem ancestor for ${path}.`);
    current = parent;
  }
  return current;
}

export function evaluateNativeResources(snapshot) {
  const issues = [];
  if (
    !Number.isFinite(snapshot.freeMemoryBytes) ||
    snapshot.freeMemoryBytes < NATIVE_MIN_FREE_MEMORY_BYTES
  ) {
    issues.push(
      `Free RAM ${snapshot.freeMemoryBytes} bytes is below ${NATIVE_MIN_FREE_MEMORY_BYTES} bytes (4 GiB).`,
    );
  }
  for (const disk of snapshot.disks) {
    if (!Number.isFinite(disk.freeBytes) || disk.freeBytes < NATIVE_MIN_FREE_DISK_BYTES) {
      issues.push(
        `Free disk at ${disk.path}: ${disk.freeBytes} bytes; require ${NATIVE_MIN_FREE_DISK_BYTES} bytes (16 GiB).`,
      );
    }
  }
  if (snapshot.sharedDependencies) {
    issues.push(
      'Android builds write into node_modules. Refusing a linked dependency directory; use a private dependency tree before building.',
    );
  }
  return { ok: issues.length === 0, issues, snapshot };
}

export function checkNativeResources(root, { build = false, env = process.env } = {}) {
  try {
    const androidHome = env.ANDROID_USER_HOME || resolve(homedir(), '.android');
    const paths = [
      root,
      tmpdir(),
      env.ANDROID_AVD_HOME || resolve(androidHome, 'avd'),
      env.GRADLE_USER_HOME || resolve(homedir(), '.gradle'),
    ];
    const disks = [...new Set(paths.map(existingAncestor))].map((path) => {
      const stats = statfsSync(path);
      return { path, freeBytes: stats.bavail * stats.bsize };
    });
    const dependencies = resolve(root, 'node_modules');
    return evaluateNativeResources({
      freeMemoryBytes: freemem(),
      disks,
      sharedDependencies:
        build && existsSync(dependencies) && lstatSync(dependencies).isSymbolicLink(),
    });
  } catch (error) {
    return {
      ok: false,
      issues: [
        `Cannot verify native host resources: ${error instanceof Error ? error.message : String(error)}`,
      ],
      snapshot: null,
    };
  }
}

export function requireNativeResources(root, options) {
  const result = checkNativeResources(root, options);
  if (!result.ok) {
    const error = new Error(
      `Native resource preflight blocked [ENVIRONMENT]: ${result.issues.join(' ')} No emulator or build was started by this check.`,
    );
    error.resourcePreflight = result;
    throw error;
  }
  return result;
}
