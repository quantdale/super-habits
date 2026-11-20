import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Runtime-dependency advisory reachability (docs/audit/RUNTIME_ADVISORY_REACHABILITY_2026-11-20.md).
 *
 * The production tree carried 13 moderate advisories after PR #225's audit
 * report. Three of them were real leaf advisories (`glob`, `minimatch`,
 * `uuid`); the other ten were meta-propagations of those leaves through the
 * Expo build toolchain (`@expo/*`, `expo`, `expo-sharing`, `xcode`).
 *
 * Exactly one of the three leaves has a safe, compatible fix:
 *
 *   - `uuid` <11.1.1 (GHSA-w5hq-g745-h8pq) is fixed by 11.1.1, and its only
 *     production-tree consumer is `xcode@3.0.1`, which calls nothing but
 *     `uuid.v4()` (the advisory covers v3/v5/v6 `buf` bounds). The fix
 *     therefore belongs in a NARROWLY SCOPED nested override —
 *     `overrides.xcode.uuid` — so a future `uuid` consumer is not silently
 *     dragged across a major.
 *
 *   - `glob` (GHSA-3g3m-2fjr-6pw4) has no fixed release below 14.0.2, and
 *     `minimatch` (GHSA-g3hv-75wg-m249) none below 11.0.1. Both fixes are
 *     semver-major for the copies this tree resolves (`glob@9.3.5`,
 *     `minimatch@8/10`), glob 14 drops the callable/callback API that
 *     `rimraf@3` still uses from the production tree, and minimatch 11 changes
 *     match semantics for `glob@9`'s internals. Forcing either would trade a
 *     build-time-only advisory for real breakage, so they stay
 *     documented-not-fixed and must NOT acquire a forced major override.
 *
 * These assertions run against `package.json` + `package-lock.json` (not
 * `node_modules`) so they are deterministic before and after an install.
 */
const repoRoot = resolve(__dirname, '..');

type JsonObject = Record<string, unknown>;

const readJson = (name: string): JsonObject =>
  JSON.parse(readFileSync(resolve(repoRoot, name), 'utf8')) as JsonObject;

/** A `package-lock.json` `packages[]` entry. */
interface LockEntry {
  version?: string;
  dependencies?: Record<string, string>;
}

const lockPackages = (lock: JsonObject): Record<string, LockEntry | undefined> =>
  (lock.packages ?? {}) as Record<string, LockEntry | undefined>;

describe('runtime advisory overrides', () => {
  it('pins the xcode uuid consumer to a patched release via a narrowly scoped override', () => {
    const overrides = readJson('package.json').overrides as Record<string, unknown>;

    // Narrowly scoped: the nested form only rewrites xcode's uuid dependency.
    expect(overrides.xcode).toEqual({ uuid: '11.1.1' });

    // ... and it is NOT a bare `uuid` override, which would silently force a
    // major onto every future uuid consumer in the tree.
    expect(overrides.uuid).toBeUndefined();
  });

  it('resolves a single uuid copy through the lockfile and it is the patched release', () => {
    const packages = lockPackages(readJson('package-lock.json'));
    const copies = Object.keys(packages).filter(
      (path) => path === 'node_modules/uuid' || path.endsWith('/node_modules/uuid'),
    );

    // One hoisted copy: the override must not fork a second, vulnerable copy.
    expect(copies).toEqual(['node_modules/uuid']);
    expect(packages['node_modules/uuid']?.version).toBe('11.1.1');

    // The upstream xcode range is still recorded as-is; the override is what
    // lifts resolution out of the <11.1.1 vulnerable range.
    expect(packages['node_modules/xcode']?.dependencies?.uuid).toBe('^7.0.3');
  });

  it('does not force the glob or minimatch majors that have no compatible fix', () => {
    // glob 14 drops the callable/callback API still used by rimraf@3 in the
    // production tree; minimatch 11 changes matching for glob@9's internals.
    // A flat or ranged major override for either is a breakage, not a fix.
    const overrides = readJson('package.json').overrides as Record<string, unknown>;
    const keyed = Object.keys(overrides);

    // The flat `glob` override predates this change (it exists to keep the
    // deprecated `inflight` out of the tree) and still resolves inside the
    // glob@9 API the build tooling uses.
    expect(overrides.glob).toBe('^9.3.5');

    // No extra key may target `glob` or `minimatch` by prefix: that is exactly
    // how a "fix" would pull glob@14 (callable API removed) or minimatch@11
    // (different matching) underneath a vulnerable host.
    expect(keyed.filter((key) => key.startsWith('glob'))).toEqual(['glob']);
    expect(keyed.filter((key) => key.startsWith('minimatch'))).toEqual([]);
  });

  it('keeps the documented reachability report next to the fix', () => {
    const doc = resolve(repoRoot, 'docs/audit/RUNTIME_ADVISORY_REACHABILITY_2026-11-20.md');
    expect(existsSync(doc)).toBe(true);
    const text = readFileSync(doc, 'utf8');
    for (const advisory of ['GHSA-3g3m-2fjr-6pw4', 'GHSA-g3hv-75wg-m249', 'GHSA-w5hq-g745-h8pq']) {
      expect(text).toContain(advisory);
    }
  });
});
