/**
 * Release-facts guard — the two load-bearing properties the test-suite triage
 * deliberately kept after deleting the 29 script/harness self-tests
 * (audit C §4.2 / §4 HIGH-4).
 *
 * Only the LOGIC is tested here, not the repository's current values: a test
 * that re-states today's `public/sw.js` bytes is the slop this triage removed.
 * Each case feeds the parser a tampered input and asserts it is rejected, so
 * the guard cannot pass vacuously.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  checkCiLaneIndependence,
  checkLanesInjection,
  checkWorkerTemplate,
  INDEPENDENT_JOBS,
  SHELL_REVISION_LANES,
  splitJobs,
} from '../scripts/release-facts-guard.mjs';

const ROOT = resolve(__dirname, '..');

describe('PWA worker cache version is generated, never hand-maintained', () => {
  it('accepts the tracked template', () => {
    const worker = readFileSync(resolve(ROOT, 'public', 'sw.js'), 'utf8');
    expect(checkWorkerTemplate(worker)).toEqual([]);
  });

  it('rejects a hand-maintained numeric version (AUD-SH05-A)', () => {
    const problems = checkWorkerTemplate("const CACHE_VERSION = 'v10';");
    expect(problems.some((problem) => /hand-maintained/.test(problem))).toBe(true);
  });

  it('rejects a worker that lost the generated token', () => {
    expect(checkWorkerTemplate("const CACHE_VERSION = 'v11';").length).toBeGreaterThan(0);
    expect(checkWorkerTemplate('const CACHE_VERSION = process.env.X;').length).toBeGreaterThan(0);
  });
});

describe('every export lane injects AND verifies the shell revision', () => {
  it('accepts the real lanes', () => {
    const lanes: Record<string, string> = {};
    for (const lane of SHELL_REVISION_LANES) {
      lanes[lane] = readFileSync(resolve(ROOT, lane), 'utf8');
    }
    expect(checkLanesInjection(lanes)).toEqual([]);
  });

  it('rejects a lane that injects but never verifies', () => {
    const problems = checkLanesInjection({ 'lane.mjs': 'applyShellRevision({ distDir })' });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/assertRevisionIsContentDerived/);
  });

  it('rejects a lane that verifies but never injects', () => {
    const problems = checkLanesInjection({ 'lane.mjs': 'assertRevisionIsContentDerived(dist)' });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/applyShellRevision/);
  });

  it('covers production, hermetic E2E, and dist-sync', () => {
    // A lane that produces an installable export and is not listed here would
    // ship a worker with no revision at all.
    expect(SHELL_REVISION_LANES).toEqual(
      expect.arrayContaining([
        'scripts/build-dist-web.mjs',
        'scripts/build-dist-e2e.mjs',
        'scripts/build-dist-sync.mjs',
      ]),
    );
  });
});

describe('workflow job splitter', () => {
  const fixture = [
    'name: CI',
    'jobs:',
    '  quality:',
    '    runs-on: ubuntu-latest',
    '    steps:',
    '      - run: echo quality',
    '  e2e:',
    '    runs-on: ubuntu-latest',
    '    steps:',
    '      - run: echo e2e',
    '',
  ].join('\n');

  it('keys each job by its two-space name and stops at the next job', () => {
    const jobs = splitJobs(fixture);
    expect([...jobs.keys()]).toEqual(['quality', 'e2e']);
    expect(jobs.get('quality')).toContain('echo quality');
    expect(jobs.get('quality')).not.toContain('echo e2e');
    expect(jobs.get('e2e')).toContain('echo e2e');
  });

  it('ignores everything before the jobs: key', () => {
    const withPreamble = `name: CI\nconcurrency:\n  group: x\n${fixture}`;
    expect([...splitJobs(withPreamble).keys()]).toEqual(['quality', 'e2e']);
  });
});

describe('gating lanes stay independent of the quality job', () => {
  it('accepts the real workflow', () => {
    const ci = readFileSync(resolve(ROOT, '.github', 'workflows', 'ci.yml'), 'utf8');
    expect(checkCiLaneIndependence(ci)).toEqual([]);
  });

  it('rejects a scalar needs: quality edge on either lane', () => {
    for (const name of INDEPENDENT_JOBS) {
      const tampered = `jobs:\n  quality:\n    runs-on: x\n  ${name}:\n    needs: quality\n    runs-on: x\n`;
      const problems = checkCiLaneIndependence(tampered);
      expect(problems.some((problem) => problem.includes(`"${name}" job depends`))).toBe(true);
    }
  });

  it('rejects a block-sequence needs: edge, which parses as an empty scalar', () => {
    // The scalar check alone misses `needs:\n  - quality`; the job-level key
    // check is what catches it.
    const tampered = [
      'jobs:',
      '  quality:',
      '    runs-on: x',
      '  nightly:',
      '    needs:',
      '      - quality',
      '    runs-on: x',
    ].join('\n');
    const problems = checkCiLaneIndependence(tampered);
    expect(problems.some((problem) => problem.includes('"nightly" job depends'))).toBe(true);
  });

  it('rejects moving the dependency audit into a test lane', () => {
    const tampered = [
      'jobs:',
      '  quality:',
      '    runs-on: x',
      '  e2e:',
      '    runs-on: x',
      '    steps:',
      '      - run: node scripts/audit-runtime-deps.mjs',
    ].join('\n');
    const problems = checkCiLaneIndependence(tampered);
    expect(problems.some((problem) => problem.includes('dependency audit'))).toBe(true);
  });

  it('rejects promoting the report-only dist-sync lane into the gating e2e job', () => {
    const tampered = [
      'jobs:',
      '  quality:',
      '    runs-on: x',
      '  e2e:',
      '    runs-on: x',
      '    steps:',
      '      - run: npm run e2e:sync',
      '  nightly:',
      '    runs-on: x',
    ].join('\n');
    const problems = checkCiLaneIndependence(tampered);
    expect(problems.some((problem) => problem.includes('dist-sync lane'))).toBe(true);
  });

  it('rejects a workflow that lost a lane job entirely', () => {
    const problems = checkCiLaneIndependence('jobs:\n  quality:\n    runs-on: x\n');
    for (const name of INDEPENDENT_JOBS) {
      expect(problems.some((problem) => problem.includes(`no "${name}" job`))).toBe(true);
    }
  });
});
