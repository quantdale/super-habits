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

  it('carries the draft publication gate and current remote-data disclosures', () => {
    const html = readHtml();
    expect(html).toContain('[OWNER ACTION: publication date]');
    expect(html).toMatch(/draft\s+revised 2026-09-25/);
    expect(html).toContain('on your device');
    expect(html).toContain('Configured backup');
    expect(html).toContain('no in-app backup opt-in switch');
    expect(html).toContain('one-way push plus restore');
    expect(html).toContain('anonymous session during startup');
    expect(html).toContain('AI-assisted requests (when enabled)');
    expect(html).toContain('third-party model service');
    expect(html).toContain('provider retention');
    expect(html).toContain('never uploaded');
    expect(html).toContain('no remote push-messaging service');
    expect(html).not.toContain('no personal data ever leaves your device');
    expect(html).not.toContain('We collect nothing by default');
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
    const flatMarkdown = markdown.replace(/\s+/g, ' ');
    const flatHtml = html.replace(/\s+/g, ' ');
    for (const disclosure of [
      'anonymous session during startup',
      'no in-app backup opt-in switch',
      'selected conversation turns',
      'provider retention',
    ]) {
      expect(flatMarkdown).toContain(disclosure);
      expect(flatHtml).toContain(disclosure);
    }
    expect(html).toContain('docs/release/privacy-policy.md');
  });
});
