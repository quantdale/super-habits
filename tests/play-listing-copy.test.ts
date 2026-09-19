import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const declarationsPath = resolve(repositoryRoot, 'docs', 'release', 'store-data-declarations.md');
const readinessPath = resolve(repositoryRoot, 'docs', 'release', 'app-store-readiness.md');

function readDeclarations(): string {
  return readFileSync(declarationsPath, 'utf8');
}

function extractListingSection(notes: string): string {
  const start = notes.indexOf('## 3. Google Play');
  expect(start).toBeGreaterThanOrEqual(0);
  const end = notes.indexOf('## 4.', start);
  expect(end).toBeGreaterThan(start);
  return notes.slice(start, end);
}

function collectQuoteParagraphs(source: string): string[] {
  const paragraphs: string[] = [];
  let current: string[] = [];
  const flush = () => {
    const text = current.join(' ').trim();
    if (text.length > 0) paragraphs.push(text);
    current = [];
  };
  for (const line of source.split('\n')) {
    if (!line.startsWith('>')) continue;
    const text = line.replace(/^>\s?/, '').trim();
    if (text.length === 0) {
      flush();
    } else {
      current.push(text);
    }
  }
  flush();
  return paragraphs;
}

function extractListingCopy(section: string): { short: string; full: string } {
  // The short block sits before the 'Full description' header and the full
  // draft after it; the header line itself is not a quote, so split there
  // instead of relying on an empty-quote separator that does not exist.
  const markerIdx = section.indexOf('Full description');
  expect(markerIdx).toBeGreaterThanOrEqual(0);
  const shortParagraphs = collectQuoteParagraphs(section.slice(0, markerIdx));
  const fullParagraphs = collectQuoteParagraphs(section.slice(markerIdx));
  expect(shortParagraphs.length).toBe(1);
  expect(fullParagraphs.length).toBeGreaterThanOrEqual(1);
  return {
    short: shortParagraphs.join('\n\n'),
    full: fullParagraphs.join('\n\n'),
  };
}

describe('play listing copy length guard', () => {
  it('declares the Play limits in section 3', () => {
    const section = extractListingSection(readDeclarations());
    expect(section).toContain('Short description');
    expect(section).toContain('80');
    expect(section).toContain('Full description');
    expect(section).toContain('4000');
  });

  it('keeps the short description within the 80-char Play limit', () => {
    const { short } = extractListingCopy(extractListingSection(readDeclarations()));
    expect(short.length).toBeGreaterThan(0);
    expect(short.length).toBeLessThanOrEqual(80);
    expect(short).toMatch(/offline-first/i);
  });

  it('keeps the full description within the 4000-char Play limit', () => {
    const { full } = extractListingCopy(extractListingSection(readDeclarations()));
    expect(full.length).toBeGreaterThan(0);
    expect(full.length).toBeLessThanOrEqual(4000);
    expect(full).toContain('SuperHabits');
    expect(full).toContain('1.0.0');
    expect(full).toContain('English');
    expect(full).toMatch(/Today/);
    expect(full).toMatch(/workout/i);
    expect(full).toMatch(/Calories/);
  });

  it('keeps paste-ready copy free of owner placeholders while preserving the owner contact box', () => {
    const section = extractListingSection(readDeclarations());
    const { short, full } = extractListingCopy(section);
    const paste = `${short}\n\n${full}`;
    expect(paste).not.toContain('[OWNER ACTION');
    // The contact-email owner action lives outside the paste blocks and must stay.
    expect(section).toContain('[OWNER ACTION]');
  });

  it('keeps readiness pointing at the declarations file', () => {
    const readiness = readFileSync(readinessPath, 'utf8');
    expect(readiness).toContain('store-data-declarations.md');
  });
});
