import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  checkNativeResources,
  evaluateNativeResources,
  NATIVE_MIN_FREE_DISK_BYTES,
  NATIVE_MIN_FREE_MEMORY_BYTES,
} from '../scripts/native-resource-preflight.mjs';

const measurements = vi.hoisted(() => ({ lowPath: null as string | null }));
vi.mock('node:fs', async (importOriginal) => ({
  ...(await importOriginal<typeof import('node:fs')>()),
  statfsSync: vi.fn((path) => ({
    bavail: String(path) === measurements.lowPath ? 0 : 24 * 1024 ** 3,
    bsize: 1,
  })),
}));
vi.mock('node:os', async (importOriginal) => ({
  ...(await importOriginal<typeof import('node:os')>()),
  freemem: () => 6 * 1024 ** 3,
}));
const ownedDirectories: string[] = [];
afterEach(() => {
  measurements.lowPath = null;
  for (const directory of ownedDirectories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});
function collectorFixture() {
  const directory = mkdtempSync(join(tmpdir(), 'native-resource-collector-'));
  ownedDirectories.push(directory);
  const root = join(directory, 'workspace');
  mkdirSync(join(root, 'node_modules'), { recursive: true });
  return { directory, root };
}

const GiB = 1024 ** 3;
const enough = {
  freeMemoryBytes: 6 * GiB,
  disks: [{ path: 'workspace', freeBytes: 24 * GiB }],
  sharedDependencies: false,
};

describe('native resource preflight', () => {
  it('accepts sufficient resources without treating them as a runtime pass', () => {
    expect(evaluateNativeResources(enough)).toEqual({ ok: true, issues: [], snapshot: enough });
  });

  it.each([0, 200_000_000, 3.48 * GiB, NATIVE_MIN_FREE_DISK_BYTES - 1, NaN])(
    'rejects insufficient or unverifiable free disk: %s',
    (freeBytes) => {
      const result = evaluateNativeResources({
        ...enough,
        disks: [{ path: 'AVD/cache filesystem', freeBytes }],
      });
      expect(result.ok).toBe(false);
      expect(result.issues.join(' ')).toMatch(/AVD\/cache filesystem.*16 GiB/);
    },
  );

  it('does not sum drive aliases or ignore a full AVD filesystem', () => {
    const result = evaluateNativeResources({
      ...enough,
      disks: [
        { path: 'C: workspace', freeBytes: 10 * GiB },
        { path: 'D: alias of C:', freeBytes: 10 * GiB },
        { path: 'AVD', freeBytes: 0 },
      ],
    });
    expect(result.ok).toBe(false);
    expect(result.issues).toHaveLength(3);
  });

  it.each([0, 2 * GiB, NATIVE_MIN_FREE_MEMORY_BYTES - 1, NaN])(
    'rejects insufficient or unverifiable free RAM: %s',
    (freeMemoryBytes) => {
      const result = evaluateNativeResources({ ...enough, freeMemoryBytes });
      expect(result.ok).toBe(false);
      expect(result.issues.join(' ')).toMatch(/Free RAM.*4 GiB/);
    },
  );

  it('accepts the exact documented admission floors', () => {
    expect(
      evaluateNativeResources({
        ...enough,
        freeMemoryBytes: NATIVE_MIN_FREE_MEMORY_BYTES,
        disks: [{ path: 'workspace', freeBytes: NATIVE_MIN_FREE_DISK_BYTES }],
      }).ok,
    ).toBe(true);
  });

  it('refuses linked dependency output even with enough disk and RAM', () => {
    const result = evaluateNativeResources({ ...enough, sharedDependencies: true });
    expect(result.ok).toBe(false);
    expect(result.issues.join(' ')).toMatch(/node_modules.*private dependency tree/);
  });

  it('places admission before provision target I/O and disables prebuild installation', () => {
    const source = readFileSync(resolve('scripts/qa-native-provision.mjs'), 'utf8');
    const main = source.slice(source.indexOf('function main(args)'));
    expect(main.indexOf('requireNativeResources(ROOT, { build: true })')).toBeLessThan(
      main.indexOf("findCommand('adb')"),
    );
    expect(main).toContain("'--clean', '--no-install'");
  });

  it.each(['package', 'scoped-package', 'native-project'])(
    'rejects an actual escaping %s link during collection',
    (kind) => {
      const { directory, root } = collectorFixture();
      const shared = join(directory, 'shared-native-source');
      mkdirSync(shared);
      const link = join(
        root,
        'node_modules',
        kind === 'scoped-package'
          ? '@scope/native'
          : kind === 'native-project'
            ? 'native/android'
            : 'native',
      );
      mkdirSync(dirname(link), { recursive: true });
      symlinkSync(shared, link, 'junction');
      const result = checkNativeResources(root, { build: true });
      expect(result.ok).toBe(false);
      expect(result.snapshot?.sharedDependencies).toBe(true);
    },
  );

  it('allows internal package links and bounds their directory cycles', () => {
    const { root } = collectorFixture();
    const stored = join(root, 'node_modules', '.store', 'native');
    mkdirSync(stored, { recursive: true });
    const scope = join(root, 'node_modules', '@scope');
    mkdirSync(scope);
    symlinkSync(stored, join(scope, 'native'), 'junction');
    symlinkSync(stored, join(stored, 'self'), 'junction');
    expect(checkNativeResources(root, { build: true }).ok).toBe(true);
  });

  it.each(['path', 'path.rel'])('measures the selected AVD data filesystem from %s', (field) => {
    const { directory, root } = collectorFixture();
    const home = join(directory, 'android-home');
    const avds = join(home, 'avd');
    const data = join(directory, 'relocated-data');
    mkdirSync(avds, { recursive: true });
    mkdirSync(data);
    writeFileSync(
      join(avds, 'Selected.ini'),
      `${field}=${field === 'path' ? data : relative(home, data)}\n`,
    );
    measurements.lowPath = realpathSync(data);
    const result = checkNativeResources(root, {
      avdName: 'Selected',
      env: { NODE_ENV: 'test', ANDROID_USER_HOME: home },
    });
    expect(result.ok).toBe(false);
    expect(result.snapshot?.disks).toContainEqual({ path: realpathSync(data), freeBytes: 0 });
    expect(result.issues.join(' ')).toContain('relocated-data');
  });

  it('fails closed if selected AVD metadata cannot resolve a data directory', () => {
    const { root } = collectorFixture();
    const result = checkNativeResources(root, {
      avdName: 'Absent',
      env: { NODE_ENV: 'test', ANDROID_AVD_HOME: root },
    });
    expect(result.ok).toBe(false);
    expect(result.snapshot).toBeNull();
    expect(result.issues.join(' ')).toMatch(/Cannot verify native host resources/);
  });

  it('checks before multi-AVD tools and immediately before emulator launch', () => {
    const source = readFileSync(resolve('scripts/qa-native.mjs'), 'utf8');
    const multi = source.slice(source.indexOf('function runMultiAvd(options)'));
    expect(multi.indexOf('checkNativeResources(ROOT)')).toBeLessThan(
      multi.indexOf('findEmulator()'),
    );
    expect(source).toMatch(
      /requireNativeResources\(ROOT, \{ avdName \}\);\r?\n  bootOwnedEmulator\(emulator, avdName\);/,
    );
  });
});
