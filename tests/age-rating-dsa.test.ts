import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const draftPath = resolve(repositoryRoot, 'docs', 'release', 'age-rating-and-trader.md');
const readinessPath = resolve(repositoryRoot, 'docs', 'release', 'app-store-readiness.md');

function readDraft(): string {
  return readFileSync(draftPath, 'utf8');
}

describe('age rating + trader draft', () => {
  it('ships the questionnaire posture (Apple 4+, Play Everyone)', () => {
    const draft = readDraft();
    expect(draft).toContain('Age rating');
    expect(draft).toContain('4+');
    expect(draft).toContain('Everyone');
    expect(draft).toContain('not legal advice');
    expect(draft).toContain('Owner');
  });

  it('grounds every answer in verified product facts', () => {
    const draft = readDraft();
    expect(draft).toContain('offline-first');
    expect(draft).toContain('local SQLite');
    expect(draft).toContain('optional');
    expect(draft).toContain('local-only');
    expect(draft).toContain('no social feed');
    expect(draft).toContain('No gambling');
    expect(draft).toContain('No unrestricted web');
    expect(draft).toContain('English only');
    expect(draft).toContain('no ads');
  });

  it('leaves legal and trader identity to explicit owner actions', () => {
    const draft = readDraft();
    expect(draft).toContain('[OWNER ACTION');
    expect(draft).toContain('trader legal name');
    expect(draft).toContain('support email');
    expect(draft).toContain('trader address');
  });

  it('invents no contact email, URL, or owner identity', () => {
    const draft = readDraft();
    expect(draft).not.toMatch(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
    expect(draft).not.toMatch(/https?:\/\//i);
    expect(draft).not.toContain('example.com');
    const readiness = readFileSync(readinessPath, 'utf8');
    expect(readiness).toContain('age-rating-and-trader.md');
    expect(readiness).toContain('delivered 2026-09-19');
  });
});
