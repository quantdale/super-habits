import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  evaluateNativeResources,
  NATIVE_MIN_FREE_DISK_BYTES,
  NATIVE_MIN_FREE_MEMORY_BYTES,
} from '../scripts/native-resource-preflight.mjs';

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

  it('checks before multi-AVD tools and immediately before emulator launch', () => {
    const source = readFileSync(resolve('scripts/qa-native.mjs'), 'utf8');
    const multi = source.slice(source.indexOf('function runMultiAvd(options)'));
    expect(multi.indexOf('checkNativeResources(ROOT)')).toBeLessThan(
      multi.indexOf('findEmulator()'),
    );
    expect(source).toMatch(
      /requireNativeResources\(ROOT\);\r?\n  bootOwnedEmulator\(emulator, avdName\);/,
    );
  });
});
