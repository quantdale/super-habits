import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  GATED_CLASSES,
  LEGACY_TOKEN,
  check,
  classify,
  summarize,
  tokenLines,
} from '../scripts/legacy-name-inventory.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * The legacy-name inventory is the auditable half of the branding migration.
 *
 * A blanket find-and-replace is unsafe here because the same literal
 * `superhabits` is simultaneously (a) live brand copy we WANT to change and
 * (b) durable identity — native package id, deep-link scheme, storage keys,
 * PWA cache prefixes, portable-backup protocol — that MUST NOT change. The
 * inventory exists so those two cases are distinguishable, so these tests pin
 * the classification RULES rather than one snapshot of the tree.
 */
describe('legacy-name inventory classification', () => {
  it('classifies by path first, so a doc mentioning storage APIs stays history', () => {
    // A historical plan that happens to quote `openDatabaseAsync(...)` must not
    // be misfiled as a frozen storage identifier.
    expect(classify('.agent/execplans/example.md', 'openDatabaseAsync("superhabits.db")').cls).toBe(
      'history',
    );
    expect(classify('openspec/changes/x/execplan.md', 'superhabits').cls).toBe('history');
    expect(classify('docs/reports/x.md', 'SuperHabits').cls).toBe('history');
  });

  it('treats tests and contributor guidance as updatable', () => {
    expect(classify('tests/example.test.ts', 'superhabits').cls).toBe('test');
    expect(classify('e2e/journeys/x.spec.ts', 'superhabits').cls).toBe('test');
    expect(classify('AGENTS.md', 'superhabits').cls).toBe('guidance');
    expect(classify('.github/workflows/ci.yml', 'superhabits').cls).toBe('guidance');
  });

  it('freezes every durable identity class in live source', () => {
    const frozen = [
      ['app.json', '"package": "com.dale16.superhabits"', 'native-id'],
      ['app.json', '"scheme": "superhabits"', 'scheme'],
      ['core/portable/portable.types.ts', "'superhabits-portable-backup'", 'backup'],
      ['public/sw.js', 'superhabits-shell-', 'cache'],
      ['core/theme/motion.ts', "'superhabits.motionPreference'", 'storage'],
      ['supabase/config.toml', 'project_id = "superhabits"', 'cloud'],
    ];
    for (const [file, text, expected] of frozen) {
      expect(classify(file, text).cls, `${file} should be ${expected}`).toBe(expected);
    }
  });

  it('marks remaining live brand copy as gated, and only brand/package are gated', () => {
    expect(
      classify('core/providers/bootstrapErrorMessage.ts', 'SuperHabits could not start').cls,
    ).toBe('brand');
    expect([...GATED_CLASSES].sort()).toEqual(['brand', 'package']);
    // A frozen class must never be gated: renaming those is the data-loss bug.
    for (const cls of ['native-id', 'scheme', 'backup', 'cache', 'storage']) {
      expect(GATED_CLASSES.has(cls)).toBe(false);
    }
  });

  it('reports line numbers so a reviewer can act without re-grepping', () => {
    const text = ['alpha', 'superhabits here', 'beta', 'SUPERHABITS too'].join('\n');
    expect(tokenLines(text)).toEqual([2, 4]);
  });

  it('never gates a file whose only occurrences are frozen classes', () => {
    const entries = [
      { file: 'app.json', cls: 'native-id', disposition: '', lines: [19] },
      { file: 'core/theme/motion.ts', cls: 'storage', disposition: '', lines: [34] },
    ];
    expect(check(entries).ok).toBe(true);
    expect(summarize(entries)).toEqual({
      'native-id': { files: 1, occurrences: 1 },
      storage: { files: 1, occurrences: 1 },
    });
  });

  it('fails the check when live brand copy still carries the legacy token', () => {
    const entries = [{ file: 'features/x/Screen.tsx', cls: 'brand', disposition: '', lines: [12] }];
    const verdict = check(entries);
    expect(verdict.ok).toBe(false);
    expect(verdict.offending).toHaveLength(1);
  });

  it('keeps the canonical and legacy tokens distinct so a rename cannot be a no-op', () => {
    expect(LEGACY_TOKEN).toBe('superhabits');
    expect(LEGACY_TOKEN).not.toContain('-');
  });

  it('is wired into an npm script so the audit is runnable, not just documented', () => {
    const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts['brand:inventory']).toContain('legacy-name-inventory.mjs');
  });
});
