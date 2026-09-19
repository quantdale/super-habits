import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const auditPath = resolve(repositoryRoot, 'docs', 'release', 'version-build-consistency.md');
const readinessPath = resolve(repositoryRoot, 'docs', 'release', 'app-store-readiness.md');
const notesPath = resolve(repositoryRoot, 'docs', 'release', 'release-notes-1.0.0.md');
const packageJsonPath = resolve(repositoryRoot, 'package.json');
const appJsonPath = resolve(repositoryRoot, 'app.json');
const easJsonPath = resolve(repositoryRoot, 'eas.json');

type AppJson = {
  expo?: {
    version?: string;
    ios?: { buildNumber?: string };
    android?: { versionCode?: number };
  };
};

type EasJson = {
  cli?: { appVersionSource?: string };
  build?: { production?: { autoIncrement?: boolean } };
  submit?: { production?: Record<string, unknown> };
};

function readJson<T>(absolutePath: string): T {
  return JSON.parse(readFileSync(absolutePath, 'utf8')) as T;
}

describe('version / build-number consistency', () => {
  it('package.json version equals app.json expo.version at 1.0.0', () => {
    const packageJson = readJson<{ version?: string }>(packageJsonPath);
    const appJson = readJson<AppJson>(appJsonPath);
    expect(packageJson.version).toBe('1.0.0');
    expect(appJson.expo?.version).toBe('1.0.0');
    expect(appJson.expo?.version).toBe(packageJson.version);
  });

  it('pins the first-release iOS buildNumber and Android versionCode with JSON types', () => {
    const appJson = readJson<AppJson>(appJsonPath);
    expect(appJson.expo?.ios?.buildNumber).toBe('1');
    expect(typeof appJson.expo?.ios?.buildNumber).toBe('string');
    expect(appJson.expo?.android?.versionCode).toBe(1);
    expect(typeof appJson.expo?.android?.versionCode).toBe('number');
  });

  it('keeps the eas.json production posture credential-free with autoIncrement on', () => {
    const easJson = readJson<EasJson>(easJsonPath);
    expect(easJson.cli?.appVersionSource).toBe('remote');
    expect(easJson.build?.production?.autoIncrement).toBe(true);
    expect(easJson.submit?.production).toEqual({});
  });

  it('release-notes checklist names the pinned files, values, and tag command', () => {
    const notes = readFileSync(notesPath, 'utf8');
    expect(notes).toContain('package.json');
    expect(notes).toContain('1.0.0');
    expect(notes).toContain('ios.buildNumber');
    expect(notes).toContain('android.versionCode');
    expect(notes).toContain('production.autoIncrement');
    expect(notes).toContain('submit.production');
    expect(notes).toContain('git tag -a v1.0.0');
    expect(notes).toContain('[OWNER ACTION]');
  });

  it('readiness item 5 agrees with the release notes on versions and owner gates', () => {
    const readiness = readFileSync(readinessPath, 'utf8');
    expect(readiness).toContain('release-notes-1.0.0.md');
    expect(readiness).toContain('1.0.0');
    expect(readiness).toContain('buildNumber: 1');
    expect(readiness).toContain('versionCode: 1');
    expect(readiness).toContain('autoIncrement: true');
    expect(readiness).toContain('version-build-consistency.md');
  });

  it('audit doc ships the read-only proof with owner-gated tag and submit', () => {
    expect(existsSync(auditPath)).toBe(true);
    const audit = readFileSync(auditPath, 'utf8');
    const flat = audit.replace(/\s+/g, ' ');
    expect(flat).toContain('measured evidence only');
    expect(flat).toContain('No version was bumped');
    expect(audit).toContain('git tag -l v1.0.0');
    expect(audit).toContain('[OWNER ACTION]');
    expect(audit).toContain('submit.production');
  });
});
