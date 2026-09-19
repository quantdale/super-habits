import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const notesPath = resolve(repositoryRoot, 'docs', 'release', 'release-notes-1.0.0.md');
const packageJsonPath = resolve(repositoryRoot, 'package.json');
const appJsonPath = resolve(repositoryRoot, 'app.json');

function readNotes(): string {
  return readFileSync(notesPath, 'utf8');
}

function extractTextBlocks(notes: string): string[] {
  const matches = [...notes.matchAll(/```text\s*([\s\S]*?)```/g)];
  return matches.map((match) => (match[1] ?? '').trim());
}

describe('release notes store readiness', () => {
  it('ships paste-ready Apple and Play blocks', () => {
    const notes = readNotes();
    expect(notes).toContain('Store What');
    expect(notes).toContain('paste-ready');
    expect(notes).toContain('Apple App Store');
    expect(notes).toContain('Google Play');
    const blocks = extractTextBlocks(notes);
    expect(blocks.length).toBeGreaterThanOrEqual(2);
  });

  it('fits store copy limits with no owner placeholders in paste-ready copy', () => {
    const notes = readNotes();
    const [apple, play] = extractTextBlocks(notes);
    expect(apple.length).toBeGreaterThan(0);
    expect(apple.length).toBeLessThanOrEqual(4000);
    expect(play.length).toBeGreaterThan(0);
    expect(play.length).toBeLessThanOrEqual(500);
    expect(apple).toContain('1.0.0');
    expect(play).toContain('1.0.0');
    expect(apple).not.toContain('[OWNER ACTION');
    expect(play).not.toContain('[OWNER ACTION');
  });

  it('keeps the full 1.0.0 draft as the source of truth', () => {
    const notes = readNotes();
    expect(notes).toContain('# SuperHabits 1.0.0');
    expect(notes).toContain('Today dashboard');
    expect(notes).toContain('52-week heatmap');
    expect(notes).toContain('Gym V2');
    expect(notes).toContain('local SQLite');
    expect(notes).toContain('English only');
  });

  it('pins versions and the release-time tag checklist', () => {
    const notes = readNotes();
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
      version?: string;
    };
    const appJson = JSON.parse(readFileSync(appJsonPath, 'utf8')) as {
      expo?: {
        version?: string;
        ios?: { buildNumber?: string };
        android?: { versionCode?: number };
      };
    };
    expect(packageJson.version).toBe('1.0.0');
    expect(appJson.expo?.version).toBe('1.0.0');
    expect(appJson.expo?.ios?.buildNumber).toBe('1');
    expect(appJson.expo?.android?.versionCode).toBe(1);
    expect(notes).toContain('package.json');
    expect(notes).toContain('submit.production');
    expect(notes).toContain('git tag -a v1.0.0');
  });
});
