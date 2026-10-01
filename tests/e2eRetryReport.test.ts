import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * The retry-report gate must fail when a strict assertion (timing ceiling or row
 * oracle) passed only on a retry, and must not fail on a retried flake-class
 * test. It reads the Playwright JSON report, so these tests drive the script
 * against synthetic reports.
 */
const SCRIPT = join(process.cwd(), 'scripts', 'e2e-retry-report.mjs');

function runGate(report: unknown) {
  const dir = mkdtempSync(join(tmpdir(), 'e2e-retry-'));
  const file = join(dir, 'report.json');
  writeFileSync(file, JSON.stringify(report));
  const result = spawnSync(process.execPath, [SCRIPT, file], { encoding: 'utf8' });
  return { status: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
}

function spec(title: string, attempts: string[], tags: string[] = []) {
  return {
    title: 'suite',
    specs: [
      {
        title,
        tags,
        tests: [
          {
            status: attempts[attempts.length - 1] === 'passed' ? 'expected' : 'unexpected',
            projectName: 'journeys',
            titlePath: [],
            results: attempts.map((status) => ({ status })),
          },
        ],
      },
    ],
  };
}

describe('e2e-retry-report gate', () => {
  it('fails when a timing-ceiling step passed only on a retry', () => {
    const { status, stdout, stderr } = runGate({
      suites: [spec('3. section-switch latency ≤ 800ms', ['failed', 'passed'], ['@p2'])],
    });

    expect(status).toBe(1);
    expect(stdout).toContain('[STRICT]');
    expect(stdout).toContain('strictRetriedThenPassed":1');
    expect(stderr).toContain('passed only on a retry');
  });
  it('fails when a row-oracle step passed only on a retry', () => {
    const { status } = runGate({
      suites: [spec('11. one row or zero, never two', ['failed', 'passed'])],
    });

    expect(status).toBe(1);
  });

  it('reports but does not fail on a retried flake-class test', () => {
    const { status, stdout } = runGate({
      suites: [spec('12. generic helper assertion', ['failed', 'passed'])],
    });

    expect(status).toBe(0);
    expect(stdout).toContain('[flake-class]');
    expect(stdout).toContain('OK — no strict assertion depended on a retry');
  });

  it('passes a clean run with no retries at all', () => {
    const { status, stdout } = runGate({ suites: [spec('3. section-switch ceiling', ['passed'])] });

    expect(status).toBe(0);
    expect(stdout).toContain('"retriedThenPassed":0');
  });

  it('fails when the report is missing, so a lane cannot claim a clean pass silently', () => {
    const result = spawnSync(
      process.execPath,
      [SCRIPT, join(tmpdir(), 'definitely-missing.json')],
      {
        encoding: 'utf8',
      },
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('no Playwright JSON report');
  });
});
