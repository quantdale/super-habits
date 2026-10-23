import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (file: string) => readFileSync(resolve(root, file), 'utf8');

type PackageInfo = { name: string };
type LockInfo = { name: string; packages: { '': { name: string } } };
type ExpoInfo = {
  expo: {
    name: string;
    slug: string;
    scheme: string;
    android: { package: string };
    ios: { bundleIdentifier: string };
  };
};
type PwaInfo = { name: string; short_name: string };

describe('canonical public name: super-habits', () => {
  it('aligns npm package and lockfile roots', () => {
    const pkg = JSON.parse(read('package.json')) as PackageInfo;
    const lock = JSON.parse(read('package-lock.json')) as LockInfo;
    expect(pkg.name).toBe('super-habits');
    expect(lock.name).toBe(pkg.name);
    expect(lock.packages[''].name).toBe(pkg.name);
  });

  it('aligns Expo display metadata and PWA metadata', () => {
    const expo = (JSON.parse(read('app.json')) as ExpoInfo).expo;
    const manifest = JSON.parse(read('public/manifest.json')) as PwaInfo;
    expect(expo.name).toBe('super-habits');
    expect(expo.slug).toBe('super-habits');
    expect(manifest.name).toBe('super-habits');
    expect(manifest.short_name).toBe('super-habits');
    expect(read('app/_layout.tsx')).toContain('<title>super-habits</title>');
    expect(read('core/ui/BootSplash.tsx')).toContain('super-habits is starting');
  });

  it('preserves legacy native IDs and deep links until an explicitly tested migration', () => {
    const expo = (JSON.parse(read('app.json')) as ExpoInfo).expo;
    expect(expo.android.package).toBe('com.dale16.superhabits');
    expect(expo.ios.bundleIdentifier).toBe('com.dale16.superhabits');
    expect(expo.scheme).toBe('superhabits');
  });
});
