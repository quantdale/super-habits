import {
  existsSync,
  lstatSync,
  readdirSync,
  readFileSync,
  realpathSync,
  statfsSync,
  statSync,
} from 'node:fs';
import { freemem, homedir, tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';

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
  return realpathSync(current);
}

// Package links and linked native project subdirectories can escape an otherwise
// ordinary node_modules directory. Follow only in-tree links and bound cycles.
function hasSharedDependencies(dependencies) {
  if (!existsSync(dependencies)) return false;
  if (lstatSync(dependencies).isSymbolicLink()) return true;
  const boundary = realpathSync(dependencies);
  const pending = [boundary];
  const visited = new Set();
  while (pending.length) {
    const directory = pending.pop();
    if (visited.has(directory)) continue;
    visited.add(directory);
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isSymbolicLink()) {
        const target = realpathSync(path); // Broken/unreadable links fail closed.
        const offset = relative(boundary, target);
        if (offset === '..' || offset.startsWith(`..${sep}`) || isAbsolute(offset)) return true;
        if (statSync(target).isDirectory()) pending.push(target);
      } else if (entry.isDirectory()) {
        pending.push(path);
      }
    }
  }
  return false;
}

function selectedAvdDirectory(avdName, avdHome, androidHome) {
  if (!/^[A-Za-z0-9_.-]+$/.test(avdName)) throw new Error('Invalid selected AVD name.');
  const ini = readFileSync(join(avdHome, `${avdName}.ini`), 'utf8');
  const fields = new Map(
    ini.split(/\r?\n/).flatMap((line) => {
      const match = line.match(/^\s*(path|path\.rel)\s*=\s*(.+?)\s*$/);
      return match ? [[match[1], match[2]]] : [];
    }),
  );
  const absolute = fields.get('path');
  const relativePath = fields.get('path.rel');
  const path = absolute || (relativePath && resolve(androidHome, relativePath));
  if (!path || !isAbsolute(path) || !statSync(path).isDirectory()) {
    throw new Error(`Cannot resolve writable data directory for AVD ${avdName}.`);
  }
  return realpathSync(path);
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

export function checkNativeResources(
  root,
  { build = false, env = process.env, avdName = '' } = {},
) {
  try {
    const androidHome = env.ANDROID_USER_HOME || resolve(homedir(), '.android');
    const avdHome = env.ANDROID_AVD_HOME || resolve(androidHome, 'avd');
    const paths = [
      root,
      tmpdir(),
      avdHome,
      env.GRADLE_USER_HOME || resolve(homedir(), '.gradle'),
      ...(avdName ? [selectedAvdDirectory(avdName, avdHome, androidHome)] : []),
    ];
    const disks = [...new Set(paths.map(existingAncestor))].map((path) => {
      const stats = statfsSync(path);
      return { path, freeBytes: stats.bavail * stats.bsize };
    });
    const dependencies = resolve(root, 'node_modules');
    return evaluateNativeResources({
      freeMemoryBytes: freemem(),
      disks,
      sharedDependencies: build && hasSharedDependencies(dependencies),
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
