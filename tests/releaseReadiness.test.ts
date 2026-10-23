import { describe, expect, it, vi } from 'vitest';
import { execFileSync } from 'node:child_process';
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
  copyFileSync,
  unlinkSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  UNOBSERVABLE_INPUTS,
  checkNativeSigning,
  checkOwnerActions,
  checkProductionHold,
  checkSubmitCredentials,
  computeVerdict,
  evaluateReleaseReadiness,
} from '../scripts/release-readiness.mjs';

vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>();
  // Real CLI tests retain the real subprocess. Policy-only tests can isolate a
  // single network audit response without changing the production audit gate.
  return { ...actual, execFileSync: vi.fn(actual.execFileSync) };
});

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const scriptPath = resolve(repoRoot, 'scripts', 'release-readiness.mjs');

const runCli = () => {
  try {
    const stdout = execFileSync(process.execPath, [scriptPath], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { exitCode: 0, stdout };
  } catch (error) {
    const failure = error as { status?: number; stdout?: string; stderr?: string };
    return {
      exitCode: failure.status ?? 1,
      stdout: `${failure.stdout ?? ''}${failure.stderr ?? ''}`,
    };
  }
};

/**
 * Release authorization used to live entirely in prose: `docs/release/*.md`
 * explained what was blocked and `submission-package.md` listed 16 owner
 * actions, but nothing COMPUTED an answer. That makes "is this release-ready?" a
 * question each reader re-derives by hand, and makes an accidental readiness
 * claim impossible to contradict mechanically.
 *
 * The script's value is therefore twofold: it must find the real blockers today,
 * and — more importantly — it must be INCAPABLE of reporting READY while a
 * blocker exists. These tests pin both, and they deliberately pin the
 * conservative direction: an unreadable input must never become a pass.
 */
describe('release-readiness verdict', () => {
  // Each full CLI invocation shells out to the dependency-audit gate (~3 s), and
  // one test runs it twice. The default 5 s budget is too tight for that, not a
  // signal of a slow/incorrect verdict.
  const CLI_TIMEOUT_MS = 30_000;

  it('reports BLOCKED with exit code 1 on the current tree', { timeout: CLI_TIMEOUT_MS }, () => {
    const result = runCli();
    // The exact blocker set drifts as work lands, so assert the INVARIANT: a
    // non-empty blocker list, a BLOCKED verdict, and a failing exit code. Pinning
    // today's list would make a legitimately cleared blocker look like a break.
    expect(result.stdout).toMatch(/release-readiness: BLOCKED/);
    expect(result.exitCode).toBe(1);
  });

  it('names the production hold, signing honesty, and submit-credential posture as clean', () => {
    // These three ARE currently satisfied and must stay that way silently: if any
    // regresses, the corresponding check must start producing a blocker.
    expect(checkProductionHold()).toEqual([]);
    expect(checkNativeSigning()).toEqual([]);
    expect(checkSubmitCredentials()).toEqual([]);
  });

  it(
    'every blocker carries an owner action, so the verdict is actionable',
    { timeout: CLI_TIMEOUT_MS },
    () => {
      const { blockers } = evaluateReleaseReadiness();
      expect(blockers.length).toBeGreaterThan(0);
      for (const blocker of blockers) {
        expect(blocker.id, 'blocker needs an id').toBeTruthy();
        expect(blocker.detail, `${blocker.id} needs detail`).toBeTruthy();
        expect(blocker.ownerAction, `${blocker.id} needs an owner action`).toBeTruthy();
        // No blocker may be downgraded to a warning: that is the whole contract.
        expect(blocker.severity).toBe('blocker');
      }
    },
  );

  it(
    'declares what it cannot observe instead of implying blanket coverage',
    { timeout: CLI_TIMEOUT_MS },
    () => {
      // Without this the verdict reads broader than its evidence — the most
      // dangerous property a readiness report can have.
      expect(UNOBSERVABLE_INPUTS.length).toBeGreaterThanOrEqual(4);
      const joined = UNOBSERVABLE_INPUTS.join(' ');
      expect(joined).toMatch(/supabase/i);
      expect(joined).toMatch(/device|simulator/i);
      expect(joined).toMatch(/console/i);
      expect(joined).toMatch(/legal|trader/i);

      const result = runCli();
      expect(result.stdout).toMatch(/NOT evaluated by this script/);
    },
  );

  it('prints a machine-readable verdict for tooling', { timeout: CLI_TIMEOUT_MS }, () => {
    // The CLI exits 1 while BLOCKED, so a plain execFileSync would throw on the
    // correct behaviour. Capture stdout through the throwing path instead of
    // weakening the exit-code contract.
    const result = runCli();
    expect(result.stdout).toMatch(/release-readiness: BLOCKED/);

    let stdout = '';
    try {
      stdout = execFileSync(process.execPath, [scriptPath, '--json'], {
        cwd: repoRoot,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (error) {
      stdout = (error as { stdout?: string }).stdout ?? '';
    }
    const parsed = JSON.parse(stdout) as { verdict: string; blockerCount: number };
    expect(parsed.verdict).toBe('BLOCKED');
    expect(parsed.blockerCount).toBeGreaterThan(0);
  });

  it('FAILS CLOSED when the signing record disappears (never a silent pass)', () => {
    // An unreadable/missing input must be a BLOCKER, not a crash and not a pass.
    const target = resolve(repoRoot, 'docs', 'release', 'release-signing-posture.md');
    const original = readFileSync(target, 'utf8');
    const dir = mkdtempSync(join(tmpdir(), 'sh-readiness-signing-'));
    const backup = join(dir, 'posture.bak');
    copyFileSync(target, backup);
    try {
      // A record that CLAIMS a production-signed artifact cannot be true without
      // one, so it must be rejected rather than treated as progress.
      writeFileSync(
        target,
        original.replace(/UNPROVEN RELEASE POSTURE/gi, 'signed with the production keystore'),
      );
      const blockers = checkNativeSigning();
      expect(blockers).toHaveLength(1);
      expect(blockers[0].id).toBe('NATIVE-SIGNING');
      expect(blockers[0].detail).toMatch(/claims a production-signed artifact/);
    } finally {
      copyFileSync(backup, target);
      unlinkSync(backup);
      rmSync(dir, { recursive: true, force: true });
    }
    // Restored, so the suite cannot leak state into later tests.
    expect(checkNativeSigning()).toEqual([]);
  });

  it('FAILS CLOSED when the production hold is dropped or bypassed by a wildcard', () => {
    const target = resolve(repoRoot, 'vercel.json');
    const original = readFileSync(target, 'utf8');
    const dir = mkdtempSync(join(tmpdir(), 'sh-readiness-hold-'));
    const backup = join(dir, 'vercel.bak');
    copyFileSync(target, backup);
    try {
      // Vercel precedence: if a branch matches multiple rules and ANY is true, a
      // deployment occurs — so a wildcard `true` is a hold BYPASS, not an extra.
      const parsed = JSON.parse(original) as {
        git?: { deploymentEnabled?: Record<string, boolean> };
      };
      parsed.git = { deploymentEnabled: { main: false, '*': true } };
      writeFileSync(target, JSON.stringify(parsed, null, 2));
      const blockers = checkProductionHold();
      expect(blockers).toHaveLength(1);
      expect(blockers[0].detail).toMatch(/wildcard|pattern-shaped/);

      // And the plain removal case.
      parsed.git = { deploymentEnabled: {} };
      writeFileSync(target, JSON.stringify(parsed, null, 2));
      expect(checkProductionHold()[0].detail).toMatch(/not false/);
    } finally {
      copyFileSync(backup, target);
      unlinkSync(backup);
      rmSync(dir, { recursive: true, force: true });
    }
    expect(checkProductionHold()).toEqual([]);
  });

  it('is the single verdict, not a second source of truth', { timeout: CLI_TIMEOUT_MS }, () => {
    // The blocker ids are stable identifiers so a report can cite them; they are
    // not a parallel tracking system.
    const ids = new Set(evaluateReleaseReadiness().blockers.map((b) => b.id));
    for (const id of ids) {
      expect([
        'DEP-ADVISORY',
        'OWNER-ACTION-MARKERS',
        'OWNER-INVENTORY',
        'PROD-HOLD',
        'NATIVE-SIGNING',
        'SUBMIT-CREDENTIALS',
        'OWNER-ACTION-SCAN',
      ]).toContain(id);
    }
  });

  it('NC-1: a pattern-shaped deployment key with a truthy value is a hold bypass', () => {
    const target = resolve(repoRoot, 'vercel.json');
    const original = readFileSync(target, 'utf8');
    const dir = mkdtempSync(join(tmpdir(), 'sh-readiness-glob-'));
    const backup = join(dir, 'vercel.bak');
    copyFileSync(target, backup);
    try {
      // The old check only noticed literal `*`/`**` keys with strictly `true`,
      // so `"ma*": true` (or a string-truthy value) certified a possibly
      // bypassed hold as safe. Glob semantics are Vercel-side and unobservable
      // here; the conservative reading must block.
      const parsed = JSON.parse(original) as {
        git?: { deploymentEnabled?: Record<string, unknown> };
      };
      parsed.git = { deploymentEnabled: { main: false, 'ma*': true } };
      writeFileSync(target, JSON.stringify(parsed, null, 2));
      const blockers = checkProductionHold();
      expect(blockers).toHaveLength(1);
      expect(blockers[0].detail).toMatch(/pattern-shaped/);
    } finally {
      copyFileSync(backup, target);
      unlinkSync(backup);
      rmSync(dir, { recursive: true, force: true });
    }
    expect(checkProductionHold()).toEqual([]);
  });

  it('NC-2: an owner-action marker outside docs/release still counts', () => {
    const target = resolve(repoRoot, 'docs', 'testing', 'known-gaps.md');
    const original = readFileSync(target, 'utf8');
    const dir = mkdtempSync(join(tmpdir(), 'sh-readiness-marker-'));
    const backup = join(dir, 'known-gaps.bak');
    copyFileSync(target, backup);
    try {
      writeFileSync(target, `${original}\n- \`[OWNER ACTION]\` file the Play data-safety form\n`);
      // The marker contract has no dependency on registry/network latency.
      const markerBlocker = checkOwnerActions().find((b) => b.id === 'OWNER-ACTION-MARKERS');
      expect(markerBlocker).toBeDefined();
      expect(markerBlocker!.detail).toMatch(/known-gaps/);
    } finally {
      copyFileSync(backup, target);
      unlinkSync(backup);
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('NEVER reports release-ready from repository-local checks alone', () => {
    // The verdict is named for what it can prove. Even a hypothetical zero-
    // blocker state must not produce a release-readiness claim: the decisive
    // conditions (hosted certifications, device runs, store/legal actions,
    // release authorization) are external and unobservable from the repo.
    expect(computeVerdict(0)).toBe('REPO_CHECKS_CLEAR');
    expect(computeVerdict(0)).not.toMatch(/READY|RELEASE/i);
    expect(computeVerdict(3)).toBe('BLOCKED');
    // Even a successful external audit cannot authorize production. Isolate
    // this policy assertion from npm registry latency; real CLI/audit tests
    // above still execute the unchanged gate and assert its blocked result.
    vi.mocked(execFileSync).mockImplementationOnce(() => '');
    const result = evaluateReleaseReadiness();
    expect(execFileSync).toHaveBeenLastCalledWith(
      process.execPath,
      [resolve(repoRoot, 'scripts', 'audit-runtime-deps.mjs')],
      expect.any(Object),
    );
    expect(result.releaseAuthorized).toBe(false);
    expect(result.verdict).not.toMatch(/RELEASE_READY/i);
  });
});
