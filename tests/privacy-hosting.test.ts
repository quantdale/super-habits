import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const htmlPath = resolve(repositoryRoot, 'public', 'privacy.html');
const markdownPath = resolve(repositoryRoot, 'docs', 'release', 'privacy-policy.md');

function readHtml(): string {
  return readFileSync(htmlPath, 'utf8');
}

describe('privacy hosting artifact', () => {
  it('ships a standalone hostable page with zero external requests', () => {
    const html = readHtml();
    expect(html).toContain('<!doctype html>');
    expect(html).toContain('<html lang="en">');
    expect(html).toContain('SuperHabits — Privacy Policy');
    // No external fetches: offline-safe under COEP require-corp.
    expect(html).not.toMatch(/src="https?:\/\//i);
    expect(html).not.toMatch(/href="https?:\/\//i);
    expect(html).not.toMatch(/<script/i);
    expect(html).toContain('<a href="/">');
  });

  it('carries the effective date and key disclosures', () => {
    const html = readHtml();
    expect(html).toContain('2026-09-19');
    expect(html).toContain('on your device');
    expect(html).toContain('optional backup');
    expect(html).toContain('one-way push plus restore');
    expect(html).toContain('Anonymous account');
    expect(html).toContain('never uploaded');
    expect(html).toContain('No analytics');
    expect(html).toContain('no remote push-messaging service');
  });

  it('preserves owner-action placeholders instead of inventing contact details', () => {
    const html = readHtml();
    expect(html).toContain('[OWNER ACTION: support email]');
    expect(html).toContain(
      '[OWNER ACTION: public policy hosting URL — required for both store listings]',
    );
  });

  it('stays in sync with the markdown source of truth', () => {
    const html = readHtml();
    const markdown = readFileSync(markdownPath, 'utf8');
    const headings = markdown
      .split('\n')
      .filter((line) => line.startsWith('## '))
      .map((line) => line.replace(/^##\s*/, '').trim())
      .filter(Boolean);
    // The policy has the short version + 12 numbered sections.
    expect(headings.length).toBeGreaterThanOrEqual(12);
    for (const heading of headings) {
      expect(html, `missing heading in privacy.html: ${heading}`).toContain(heading);
    }
    expect(html).toContain('docs/release/privacy-policy.md');
  });
});
