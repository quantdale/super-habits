import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * The production-dependency advisory gate must fail on anything it has not
 * documented, and must never hide a documented finding.
 *
 * The live tree state it encodes (2026-09-29): three `brace-expansion`
 * advisories reach the production tree through `test-exclude`
 * (`babel-plugin-istanbul`, coverage only) and `glob@9` -> `minimatch@8`, with no
 * non-breaking fixed version — npm's only offered resolution is
 * `react-native@0.87.1`. The 5.x copy IS fixed by an `overrides` entry and is
 * deliberately not allowlisted.
 *
 * The gate's own logic is a CLI, so this test pins the two properties that
 * matter and that a future edit could silently break: the allowlist is matched
 * on advisory id + package + every reported path, and the overrides entry that
 * fixes the 5.x copy actually exists.
 */
const scriptPath = resolve(__dirname, '..', 'scripts', 'audit-runtime-deps.mjs');
const script = readFileSync(scriptPath, 'utf8');

describe('audit-runtime-deps gate policy', () => {
  it('matches a documented finding on advisory id, package, and every reported path', () => {
    // The allowlist entry must exist for the live tree's three advisories.
    for (const advisory of ['GHSA-q2hr-2g5m-vwhr', 'GHSA-qhr7-859c-m2p7', 'GHSA-6j4f-fj2g-mc7p']) {
      expect(script).toContain(`advisory: '${advisory}'`);
    }
    // ...and the matcher must require every reported node to be covered, so a
    // new path for a known advisory is still a failure.
    expect(script).toContain('finding.nodes.every((node) => entry.nodes.includes(node))');
  });

  it('documents the build-time-only reason and its date beside every entry', () => {
    for (const entry of script.match(/const DOCUMENTED_BUILD_TIME_ADVISORIES = \[[\s\S]*?\n\];/) ??
      []) {
      const reasonMatches = entry.match(/reason:/g) ?? [];
      expect(reasonMatches.length).toBeGreaterThanOrEqual(3);
      // The date lives in the block's own header comment, next to the entries.
      expect(script).toContain('allowlist dated 2026-09-29');
      expect(entry).toContain('coverage/glob tooling only');
    }
  });

  it('keeps the 5.x brace-expansion copy fixed by an overrides entry, not allowlisted', () => {
    const pkg = JSON.parse(readFileSync(resolve(__dirname, '..', 'package.json'), 'utf8'));
    expect(pkg.overrides['brace-expansion@^5.0.0']).toBe('^5.0.12');
    // The allowlist names only the 1.x/2.x paths, never the 5.x copy.
    expect(script).not.toContain('node_modules/brace-expansion"');
  });

  it('fails the run on an undocumented finding rather than reporting it', () => {
    expect(script).toContain('process.exit(1)');
    expect(script).toContain('undocumented high/critical advisory(ies)');
  });
});
