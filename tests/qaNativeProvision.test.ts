import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  parseAdbDevices,
  parseAndroidProperties,
  parsePackageIdentity,
  selectAndroidDevice,
} from '../scripts/native-qa-utils.mjs';
import { readGitProvenance, requireCleanGitTree } from '../scripts/native-provenance.mjs';

function createGitFixture() {
  const root = mkdtempSync(join(tmpdir(), 'superhabits-native-provenance-'));
  mkdirSync(join(root, 'simulation-output'));
  writeFileSync(join(root, '.gitignore'), 'simulation-output/\n', 'utf8');
  writeFileSync(join(root, 'source.txt'), 'baseline\n', 'utf8');
  execFileSync('git', ['init', '-q'], { cwd: root });
  execFileSync('git', ['config', 'user.email', 'qa@example.invalid'], { cwd: root });
  execFileSync('git', ['config', 'user.name', 'Native QA'], { cwd: root });
  execFileSync('git', ['add', '.'], { cwd: root });
  execFileSync('git', ['commit', '-qm', 'fixture baseline'], { cwd: root });
  return root;
}

function removeGitFixture(root: string) {
  rmSync(root, { recursive: true, force: true });
}

describe('native Android QA helpers', () => {
  it('parses connected ADB devices and ignores the header', () => {
    expect(
      parseAdbDevices(
        'List of devices attached\nemulator-5554\tdevice product:sdk_gphone_x86_64\nserial-offline\toffline\n',
      ),
    ).toEqual([
      {
        serial: 'emulator-5554',
        state: 'device',
        details: 'product:sdk_gphone_x86_64',
      },
      { serial: 'serial-offline', state: 'offline', details: '' },
    ]);
  });

  it('requires an unambiguous requested or single connected target', () => {
    const devices = 'List of devices attached\na\tdevice\nb\tdevice\n';
    expect(() => selectAndroidDevice(devices)).toThrow(/Multiple Android targets/);
    expect(selectAndroidDevice(devices, 'b').serial).toBe('b');
    expect(() => selectAndroidDevice(devices, 'missing')).toThrow(/not connected/);
  });

  it('parses Android properties and installed package identity', () => {
    expect(
      parseAndroidProperties(
        '[ro.build.version.sdk]: [36]\n[ro.product.cpu.abi]: [x86_64]\n[sys.boot_completed]: [1]\n',
      ),
    ).toEqual({
      'ro.build.version.sdk': '36',
      'ro.product.cpu.abi': 'x86_64',
      'sys.boot_completed': '1',
    });
    expect(
      parsePackageIdentity(
        'Package [com.dale16.superhabits]\n  versionCode=1 minSdk=24\n  versionName=1.0.0\n',
        'com.dale16.superhabits',
      ),
    ).toEqual({
      appId: 'com.dale16.superhabits',
      present: true,
      versionName: '1.0.0',
      versionCode: 1,
    });
  });
  it('records a clean tree while ignoring generated output', () => {
    const root = createGitFixture();
    try {
      writeFileSync(join(root, 'simulation-output', 'native-android-build.json'), '{}\n', 'utf8');
      const provenance = readGitProvenance(root);

      expect(provenance.sourceSha).toMatch(/^[0-9a-f]{40}$/);
      expect(provenance.sourceTreeClean).toBe(true);
      expect(provenance.sourceTreeStatus).toEqual([]);
      expect(requireCleanGitTree(root).sourceSha).toBe(provenance.sourceSha);
    } finally {
      removeGitFixture(root);
    }
  });

  it('rejects tracked and relevant untracked source changes', () => {
    const root = createGitFixture();
    try {
      writeFileSync(join(root, 'source.txt'), 'dirty\n', 'utf8');
      writeFileSync(join(root, 'relevant-source.ts'), 'export const dirty = true;\n', 'utf8');
      writeFileSync(join(root, 'simulation-output', 'native-android-build.json'), '{}\n', 'utf8');
      const provenance = readGitProvenance(root);

      expect(provenance.sourceTreeClean).toBe(false);
      expect(provenance.sourceTreeStatus.some((entry) => entry.includes('source.txt'))).toBe(true);
      expect(
        provenance.sourceTreeStatus.some((entry) => entry.includes('relevant-source.ts')),
      ).toBe(true);
      expect(provenance.sourceTreeStatus.some((entry) => entry.includes('simulation-output'))).toBe(
        false,
      );
      expect(() => requireCleanGitTree(root)).toThrow(/working tree is dirty/);
    } finally {
      removeGitFixture(root);
    }
  });
});
