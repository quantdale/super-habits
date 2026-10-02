import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { readFileSync, mkdtempSync, writeFileSync, chmodSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join, delimiter } from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  AuditExecutionError,
  evaluateAudit,
  findings,
  isDocumented,
  main,
  validateAuditCommandResult,
} from '../scripts/audit-runtime-deps.mjs';

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

// ---------------------------------------------------------------------------
// Executing seam fixtures (resolve-windows-dependency-security, tasks 5.1–5.3).
// These drive the REAL command/report seam (`validateAuditCommandResult` +
// `evaluateAudit`) with synthetic command results — the same functions the CLI
// runs — instead of asserting on script text.
// ---------------------------------------------------------------------------

type CommandResult = {
  status: number | null;
  stdout: string;
  stderr: string;
  error?: { message?: string } | Error;
  signal?: string | null;
};

type MutableFinding = { nodes: string[]; via: unknown[] };

const advisoryEntry = (over: Record<string, unknown> = {}) => ({
  source: 1240912,
  name: 'node-forge',
  dependency: 'node-forge',
  title:
    'node-forge RSA PKCS#1 v1.5 signature verification accepts extra nested DigestAlgorithm elements',
  url: 'https://github.com/advisories/GHSA-86w9-cpqp-85rv',
  severity: 'high',
  cwe: ['CWE-347'],
  cvss: { score: 7.5, vectorString: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:H/A:N' },
  range: '<=1.4.0',
  ...over,
});

const report = (
  vulnerabilities: Record<string, unknown>,
  counts: Record<string, number>,
  over: Record<string, unknown> = {},
) => ({
  auditReportVersion: 2,
  vulnerabilities,
  metadata: {
    vulnerabilities: { info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: 0, ...counts },
  },
  ...over,
});

const cleanReport = () => report({}, {});

const forgeHighReport = () =>
  report(
    {
      'node-forge': {
        name: 'node-forge',
        severity: 'high',
        isDirect: false,
        nodes: ['node_modules/node-forge'],
        range: '*',
        via: [advisoryEntry()],
        fixAvailable: { name: 'expo', version: '44.0.6', isSemVerMajor: true },
      },
    },
    { high: 1, total: 1 },
  );

const documentedBraceReport = () =>
  report(
    {
      'brace-expansion': {
        name: 'brace-expansion',
        severity: 'high',
        isDirect: false,
        nodes: [
          'node_modules/glob/node_modules/brace-expansion',
          'node_modules/test-exclude/node_modules/brace-expansion',
        ],
        range: '<=1.1.20 || 2.0.0 - 2.1.6',
        via: [
          advisoryEntry({
            name: 'brace-expansion',
            dependency: 'brace-expansion',
            title:
              'brace-expansion: Quadratic-time expansion of the `{a},b}` rewrite causes CPU denial of service',
            url: 'https://github.com/advisories/GHSA-q2hr-2g5m-vwhr',
            range: '<=1.1.20 || 2.0.0 - 2.1.6',
          }),
        ],
        fixAvailable: false,
      },
    },
    { high: 1, total: 1 },
  );

const ok = (result: CommandResult) => validateAuditCommandResult(result);
const asResult = (payload: unknown, status = 1): CommandResult => ({
  status,
  stdout: typeof payload === 'string' ? payload : JSON.stringify(payload),
  stderr: '',
});

describe('audit command/report seam (fail closed)', () => {
  it('matches documentation only on advisory id + package + full path coverage', () => {
    const documentedFinding = {
      advisory: 'GHSA-q2hr-2g5m-vwhr',
      name: 'brace-expansion',
      nodes: [
        'node_modules/glob/node_modules/brace-expansion',
        'node_modules/test-exclude/node_modules/brace-expansion',
      ],
    };
    expect(isDocumented(documentedFinding)).toBeTruthy();
    // A subset of the documented paths stays documented…
    expect(
      isDocumented({ ...documentedFinding, nodes: [documentedFinding.nodes[0]] }),
    ).toBeTruthy();
    // …but a new path, a new advisory id, or a new package never is.
    expect(
      isDocumented({
        ...documentedFinding,
        nodes: [...documentedFinding.nodes, 'node_modules/new/brace-expansion'],
      }),
    ).toBeNull();
    expect(isDocumented({ ...documentedFinding, advisory: 'GHSA-aaaa-bbbb-cccc' })).toBeNull();
    expect(isDocumented({ ...documentedFinding, name: 'other-package' })).toBeNull();
  });

  it('accepts a valid clean report and evaluates it as zero high/critical', () => {
    const audit = ok(asResult(cleanReport(), 0));
    const verdict = evaluateAudit(audit);
    expect(verdict.exitCode).toBe(0);
    expect(verdict.lines.join('\n')).toContain('OK — 0 high/critical in the production tree');
  });

  it('accepts a valid report with documented findings and keeps them visible', () => {
    const audit = ok(asResult(documentedBraceReport(), 1));
    const verdict = evaluateAudit(audit);
    expect(verdict.exitCode).toBe(0);
    expect(verdict.lines.join('\n')).toContain('[DOCUMENTED 2026-09-29');
    expect(verdict.lines.join('\n')).toContain('brace-expansion');
    expect(verdict.undocumented).toHaveLength(0);
  });

  it('keeps report-only lower severities below the gate', () => {
    const moderateOnly = report(
      {
        'some-package': {
          name: 'some-package',
          severity: 'moderate',
          nodes: ['node_modules/some-package'],
          range: '*',
          via: [
            advisoryEntry({ name: 'some-package', severity: 'moderate', title: 'moderate thing' }),
          ],
        },
      },
      { moderate: 1, total: 1 },
    );
    const audit = ok(asResult(moderateOnly, 1));
    const verdict = evaluateAudit(audit);
    expect(verdict.exitCode).toBe(0);
    expect(verdict.lines.join('\n')).toContain('0 high/critical');
    expect(verdict.lines.join('\n')).toContain('1 moderate');
  });

  it('fails an undocumented node-forge high exactly like the live gate', () => {
    const audit = ok(asResult(forgeHighReport(), 1));
    const verdict = evaluateAudit(audit);
    expect(verdict.exitCode).toBe(1);
    const text = [...verdict.lines, ...verdict.errorLines].join('\n');
    expect(text).toContain('[UNDOCUMENTED] high node-forge GHSA-86w9-cpqp-85rv');
    expect(text).toContain('undocumented high/critical advisory(ies)');
  });

  it('fails a future critical advisory the same way', () => {
    const critical = report(
      {
        'future-package': {
          name: 'future-package',
          severity: 'critical',
          nodes: ['node_modules/future-package'],
          range: '<1.0.0',
          via: [
            advisoryEntry({
              name: 'future-package',
              title: 'future critical',
              url: 'https://github.com/advisories/GHSA-future-0000-crit',
            }),
          ],
        },
      },
      { critical: 1, total: 1 },
    );
    const audit = ok(asResult(critical, 1));
    expect(evaluateAudit(audit).exitCode).toBe(1);
  });

  it('fails a known advisory at an uncovered dependency path', () => {
    const uncovered = documentedBraceReport();
    (uncovered.vulnerabilities as Record<string, MutableFinding>)['brace-expansion'].nodes = [
      'node_modules/somewhere-else/brace-expansion',
    ];
    const audit = ok(asResult(uncovered, 1));
    const verdict = evaluateAudit(audit);
    expect(verdict.exitCode).toBe(1);
    expect(verdict.undocumented).toHaveLength(1);
  });

  it('fails a new advisory id on a known package at known paths', () => {
    const newAdvisory = documentedBraceReport();
    (newAdvisory.vulnerabilities as Record<string, MutableFinding>)['brace-expansion'].via = [
      advisoryEntry({
        name: 'brace-expansion',
        title: 'brand new advisory',
        url: 'https://github.com/advisories/GHSA-aaaa-bbbb-cccc',
      }),
    ];
    const audit = ok(asResult(newAdvisory, 1));
    const verdict = evaluateAudit(audit);
    expect(verdict.exitCode).toBe(1);
    expect(verdict.undocumented).toHaveLength(1);
  });

  it('rejects parseable npm error JSON instead of reporting a clean tree', () => {
    const errorJson = {
      error: {
        code: 'EAI_AGAIN',
        summary: 'request to https://registry.npmjs.org/ failed',
        detail: 'getaddrinfo EAI_AGAIN registry.npmjs.org',
      },
    };
    expect(() => ok(asResult(errorJson, 1))).toThrowError(AuditExecutionError);
    try {
      ok(asResult(errorJson, 1));
    } catch (error) {
      expect((error as Error).message).toContain('error object');
      expect((error as Error).message).toContain('EAI_AGAIN');
    }
  });

  it('rejects empty failed output instead of substituting an empty clean report', () => {
    expect(() => ok({ status: 1, stdout: '', stderr: 'npm ERR! network' })).toThrowError(
      /empty output/,
    );
  });

  it('rejects malformed JSON output', () => {
    expect(() => ok({ status: 1, stdout: 'this is not json', stderr: '' })).toThrowError(
      /could not parse/,
    );
  });

  it('rejects unsupported report shapes', () => {
    expect(() => ok(asResult({ vulnerabilities: {} }, 1))).toThrowError(/auditReportVersion/);
    expect(() =>
      ok(asResult({ auditReportVersion: 2, vulnerabilities: {}, metadata: {} }, 1)),
    ).toThrowError(/metadata\.vulnerabilities/);
    expect(() =>
      ok(asResult({ auditReportVersion: 2, metadata: { vulnerabilities: {} } }, 1)),
    ).toThrowError(/vulnerabilities object/);
    expect(() => ok(asResult([], 1))).toThrowError(/not a JSON object/);
  });

  it('rejects invalid finding shapes', () => {
    const badSeverity = report(
      {
        'broken-package': {
          name: 'broken-package',
          severity: 7,
          nodes: ['node_modules/broken-package'],
          via: [advisoryEntry()],
        },
      },
      { total: 1 },
    );
    expect(() => ok(asResult(badSeverity, 1))).toThrowError(/invalid finding shape/);

    const badVia = report(
      {
        'broken-package': {
          name: 'broken-package',
          severity: 'high',
          nodes: ['node_modules/broken-package'],
          via: [42],
        },
      },
      { high: 1, total: 1 },
    );
    expect(() => ok(asResult(badVia, 1))).toThrowError(/invalid advisory entry shape/);

    const badNodes = report(
      {
        'broken-package': {
          name: 'broken-package',
          severity: 'high',
          via: [advisoryEntry()],
        },
      },
      { high: 1, total: 1 },
    );
    expect(() => ok(asResult(badNodes, 1))).toThrowError(/dependency paths/);
  });

  it('rejects spawn/transport failure and signal termination', () => {
    expect(() =>
      ok({ status: null, stdout: '', stderr: '', error: new Error('spawnSync npm ENOENT') }),
    ).toThrowError(/failed to run/);
    expect(() => ok({ status: null, stdout: '', stderr: '', signal: 'SIGTERM' })).toThrowError(
      /terminated by signal/,
    );
  });

  it('rejects unexpected exit statuses', () => {
    expect(() => ok(asResult(cleanReport(), 2))).toThrowError(/unexpected status 2/);
    expect(() => ok({ status: null, stdout: '{}', stderr: '' })).toThrowError(/no exit status/);
  });

  it('rejects results whose exit status contradicts the report', () => {
    expect(() => ok(asResult(forgeHighReport(), 0))).toThrowError(/exited 0 while reporting/);
    expect(() => ok(asResult(cleanReport(), 1))).toThrowError(/exited 1 without reporting/);
  });

  it('main() fails closed on an invalid result and never prints a clean verdict', () => {
    const outLines: string[] = [];
    const errLines: string[] = [];
    const exitCode = main({
      runCommand: () => ({ status: 1, stdout: '{"error":{"code":"EAI_AGAIN"}}', stderr: '' }),
      out: (line: string) => outLines.push(line),
      err: (line: string) => errLines.push(line),
    });
    expect(exitCode).toBe(1);
    expect(outLines.join('\n')).not.toContain('OK — 0 high/critical');
    expect(errLines.join('\n')).toContain('audit execution failed');
    expect(errLines.join('\n')).toContain('refusing to report a clean production tree');
  });
});

// ---------------------------------------------------------------------------
// The demonstrated false green of the ORIGINAL seam, pinned at the same
// fixtures (task 5.1): the pre-repair evaluation was
// `findings(JSON.parse(result.stdout || '{}'))` — parseable npm error JSON and
// empty failed output both produced "no findings" and exited 0. This shows the
// new tests are red-capable against that behavior: the original evaluation
// returns clean for both fixtures while the repaired seam rejects them.
// ---------------------------------------------------------------------------

describe('original seam false-green demonstration', () => {
  const originalEvaluationClean = (result: CommandResult) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(result.stdout || '{}');
    } catch {
      return 'parse-failure-exit-1';
    }
    return findings(parsed).length === 0 ? 'clean-exit-0' : 'findings-exit-1';
  };

  it('the original gate wrongly passed npm error JSON and empty failed output', () => {
    const errorFixture = asResult({ error: { code: 'EAI_AGAIN' } }, 1);
    const emptyFixture: CommandResult = { status: 1, stdout: '', stderr: 'npm ERR!' };
    expect(originalEvaluationClean(errorFixture)).toBe('clean-exit-0');
    expect(originalEvaluationClean(emptyFixture)).toBe('clean-exit-0');
    // The repaired seam rejects the exact same fixtures.
    expect(() => validateAuditCommandResult(errorFixture)).toThrowError(AuditExecutionError);
    expect(() => validateAuditCommandResult(emptyFixture)).toThrowError(AuditExecutionError);
    // ...and still fails an undocumented high (the live forge shape) exactly
    // as the original did, so no policy strength was lost.
    expect(originalEvaluationClean(asResult(forgeHighReport(), 1))).toBe('findings-exit-1');
  });
});

// ---------------------------------------------------------------------------
// CLI-level contract (task 5.3 "CLI output/exit semantics"): run the real
// script as a child process against a stub `npm` that replays fixture command
// results, proving the spawn → validate → evaluate wiring and real exit codes.
// ---------------------------------------------------------------------------

describe('audit-runtime-deps CLI contract', () => {
  let shimDir = '';
  let pathKey = 'PATH';

  beforeAll(() => {
    shimDir = mkdtempSync(join(tmpdir(), 'audit-gate-shim-'));
    writeFileSync(
      join(shimDir, 'npm-fixture.js'),
      [
        "const fs = require('node:fs');",
        "const fixture = JSON.parse(fs.readFileSync(process.env.AUDIT_FIXTURE_FILE, 'utf8'));",
        'if (fixture.stdout) process.stdout.write(fixture.stdout);',
        'if (fixture.stderr) process.stderr.write(fixture.stderr);',
        'process.exit(Number.isInteger(fixture.status) ? fixture.status : 0);',
      ].join('\n'),
    );
    writeFileSync(
      join(shimDir, 'npm.cmd'),
      '@echo off\r\nnode "%~dp0npm-fixture.js" %*\r\nexit /b %ERRORLEVEL%\r\n',
    );
    const sh = join(shimDir, 'npm');
    writeFileSync(sh, '#!/bin/sh\nexec node "$(dirname "$0")/npm-fixture.js" "$@"\n');
    chmodSync(sh, 0o755);
    pathKey = Object.keys(process.env).find((key) => key.toLowerCase() === 'path') ?? 'PATH';
  });

  afterAll(() => {
    if (shimDir) rmSync(shimDir, { recursive: true, force: true });
  });

  const runCli = (fixture: unknown) => {
    const fixtureFile = join(shimDir, `fixture-${Math.random().toString(36).slice(2)}.json`);
    writeFileSync(fixtureFile, JSON.stringify(fixture));
    return spawnSync(process.execPath, [scriptPath], {
      encoding: 'utf8',
      env: {
        ...process.env,
        [pathKey]: `${shimDir}${delimiter}${process.env[pathKey] ?? ''}`,
        AUDIT_FIXTURE_FILE: fixtureFile,
      },
    });
  };

  it('exits 0 with a clean-verdict line for a valid clean report', () => {
    const result = runCli({ status: 0, stdout: JSON.stringify(cleanReport()) });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('OK — 0 high/critical in the production tree');
  });

  it('exits 1 and names the advisory for an undocumented high', () => {
    const result = runCli({ status: 1, stdout: JSON.stringify(forgeHighReport()) });
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('[UNDOCUMENTED] high node-forge GHSA-86w9-cpqp-85rv');
    expect(result.stderr).toContain('undocumented high/critical advisory(ies)');
  });

  it('exits 1 on npm error JSON without printing a clean verdict', () => {
    const result = runCli({
      status: 1,
      stdout: JSON.stringify({ error: { code: 'EAI_AGAIN', summary: 'registry unreachable' } }),
    });
    expect(result.status).toBe(1);
    expect(result.stdout).not.toContain('OK — 0 high/critical');
    expect(result.stderr).toContain('audit execution failed');
    expect(result.stderr).toContain('EAI_AGAIN');
  });

  it('exits 1 on empty failed output without printing a clean verdict', () => {
    const result = runCli({ status: 1, stdout: '', stderr: 'npm ERR! code EAI_AGAIN' });
    expect(result.status).toBe(1);
    expect(result.stdout).not.toContain('OK — 0 high/critical');
    expect(result.stderr).toContain('empty output');
    expect(result.stderr).toContain('refusing to report a clean production tree');
  });

  it('still surfaces documented findings visibly and passes them', () => {
    const result = runCli({ status: 1, stdout: JSON.stringify(documentedBraceReport()) });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('[DOCUMENTED 2026-09-29');
    expect(result.stdout).toContain('brace-expansion');
  });
});
