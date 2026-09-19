import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const auditPath = resolve(repositoryRoot, 'docs', 'release', 'icon-splash-asset-audit.md');
const readinessPath = resolve(repositoryRoot, 'docs', 'release', 'app-store-readiness.md');
const appJsonPath = resolve(repositoryRoot, 'app.json');
const manifestPath = resolve(repositoryRoot, 'public', 'manifest.json');

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

type PngHeader = {
  width: number;
  height: number;
  bitDepth: number;
  colorType: number;
};

function readPngHeader(absolutePath: string): PngHeader {
  const bytes = readFileSync(absolutePath);
  expect(bytes.length).toBeGreaterThan(28);
  expect(bytes.subarray(0, 8).equals(PNG_SIGNATURE)).toBe(true);
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  const bitDepth = bytes[24];
  const colorType = bytes[25];
  return { width, height, bitDepth, colorType };
}

function repoPath(relativePath: string): string {
  return resolve(repositoryRoot, relativePath);
}

describe('icon / splash / notification asset audit', () => {
  it('app.json-registered assets exist at their configured PNG sizes', () => {
    const expectations: { file: string; width: number; height: number }[] = [
      { file: 'assets/icon.png', width: 1024, height: 1024 },
      { file: 'assets/splash-icon.png', width: 1024, height: 1024 },
      { file: 'assets/android-icon-foreground.png', width: 512, height: 512 },
      { file: 'assets/android-icon-background.png', width: 512, height: 512 },
      { file: 'assets/android-icon-monochrome.png', width: 432, height: 432 },
      { file: 'assets/notification-icon.png', width: 96, height: 96 },
      { file: 'assets/favicon.png', width: 48, height: 48 },
    ];
    for (const { file, width, height } of expectations) {
      const absolute = repoPath(file);
      expect(existsSync(absolute), `${file} must exist`).toBe(true);
      const header = readPngHeader(absolute);
      expect(header.width, `${file} width`).toBe(width);
      expect(header.height, `${file} height`).toBe(height);
    }
    // Store icon ships without an alpha channel (no transparency).
    const iconHeader = readPngHeader(repoPath('assets/icon.png'));
    expect(iconHeader.colorType).toBe(2);
  });

  it('notification icon carries an alpha channel (artwork stays owner-checked)', () => {
    const header = readPngHeader(repoPath('assets/notification-icon.png'));
    expect(header.width).toBe(96);
    expect(header.height).toBe(96);
    expect([4, 6]).toContain(header.colorType);
    const audit = readFileSync(auditPath, 'utf8');
    expect(audit).toContain('[OWNER ACTION]');
    expect(audit).toContain('white silhouette');
  });

  it('PWA manifest sizes agree with the on-disk icon binaries', () => {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
      icons: { src: string; sizes: string; purpose: string }[];
    };
    const bySrc = new Map(manifest.icons.map((icon) => [icon.src, icon]));
    expect(bySrc.get('/icon-192.png')?.sizes).toBe('192x192');
    expect(bySrc.get('/icon-512.png')?.sizes).toBe('512x512');
    expect(bySrc.get('/icon-maskable-512.png')?.sizes).toBe('512x512');
    const expectations: { file: string; width: number; height: number }[] = [
      { file: 'public/icon-192.png', width: 192, height: 192 },
      { file: 'public/icon-512.png', width: 512, height: 512 },
      { file: 'public/icon-maskable-512.png', width: 512, height: 512 },
    ];
    for (const { file, width, height } of expectations) {
      const header = readPngHeader(repoPath(file));
      expect(header.width, `${file} width`).toBe(width);
      expect(header.height, `${file} height`).toBe(height);
    }
  });

  it('audit doc ships the read-only method without fabricating binaries', () => {
    expect(existsSync(auditPath)).toBe(true);
    const audit = readFileSync(auditPath, 'utf8');
    const flat = audit.replace(/\s+/g, ' ');
    expect(flat).toContain('measured evidence only');
    expect(audit).toContain('bytes 16–19');
    expect(flat).toContain('No PNG was created');
    expect(audit).toContain('[OWNER ACTION]');
    expect(audit).not.toMatch(/!\[[^\]]*\]\(.*\.png\)/i);
    const appJson = JSON.parse(readFileSync(appJsonPath, 'utf8')) as {
      expo: { icon: string };
    };
    expect(appJson.expo.icon).toBe('./assets/icon.png');
    const readiness = readFileSync(readinessPath, 'utf8');
    expect(readiness).toContain('icon-splash-asset-audit.md');
  });
});
