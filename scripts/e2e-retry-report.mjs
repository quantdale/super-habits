/**
 * Retry-report gate for the E2E lanes (harden-ci-lane-integrity task 5.2).
 *
 * The rule it enforces: a test that failed its first attempt and passed a retry
 * is REPORTED, and it is a FAILURE when that test asserts a timing ceiling or a
 * row-level oracle. Retries stay configured (they absorb unrelated genuine
 * flakes); what changes is that a retried pass can no longer be read as a clean
 * pass for the assertions this suite treats as strict.
 *
 * Why: `retries: 2` on CI means a suite can be green while an assertion only
 * held on its second attempt. For a ceiling (`≤ 800ms` section switch, `≤ 500ms`
 * diary search) or a row oracle (`one row or zero, never two`), a first-attempt
 * failure is evidence about the product or the harness, not noise to absorb.
 *
 * Input: the Playwright JSON report written by the `json` reporter configured in
 * playwright.config.ts (gitignored output folder). Missing file is a hard error
 * — a lane that cannot prove what it ran must not claim a clean pass.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = process.cwd();
const DEFAULT_REPORT = resolve(ROOT, '.cursor/playwright-output/e2e-report/report.json');

/**
 * Titles/tags whose failure is a contract failure rather than a flake. Mirrors
 * the greps the workflows already use: the `@p0` prioritized subset, and the
 * named ceiling/oracle assertions.
 */
const STRICT_MARKERS = [
  '@p0',
  'ceiling',
  'oracle',
  'one row or zero, never two',
  '800ms',
  '500ms',
  '≤ 800',
  '≤ 500',
  'headroom',
];

function readReport(reportPath) {
  if (!existsSync(reportPath)) {
    console.error(`e2e-retry-report: no Playwright JSON report at ${reportPath}`);
    console.error('Run the lane with the configured json reporter, then re-run this gate.');
    process.exit(1);
  }
  try {
    return JSON.parse(readFileSync(reportPath, 'utf8'));
  } catch (error) {
    console.error(`e2e-retry-report: could not parse ${reportPath}: ${String(error)}`);
    process.exit(1);
  }
}

function walkSuites(suites, out = []) {
  for (const suite of suites ?? []) {
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) {
        out.push({
          title: [suite.title, spec.title, ...(test.titlePath ?? [])].filter(Boolean).join(' › '),
          tags: [...(spec.tags ?? []), ...(test.tags ?? [])],
          results: test.results ?? [],
          status: test.status,
          project: test.projectName ?? null,
        });
      }
    }
    walkSuites(suite.suites, out);
  }
  return out;
}

/** True when the test's tags or title name a strict assertion. */
function isStrict(entry) {
  const haystack = `${entry.title} ${(entry.tags ?? []).join(' ')}`.toLowerCase();
  return STRICT_MARKERS.some((marker) => haystack.includes(marker.toLowerCase()));
}

/** Attempts that failed before the final (passing) attempt. */
function failedAttempts(entry) {
  return entry.results.filter(
    (result) =>
      result.status === 'failed' || result.status === 'timedOut' || result.status === 'interrupted',
  );
}

const reportPath = process.argv[2] ? resolve(ROOT, process.argv[2]) : DEFAULT_REPORT;
const report = readReport(reportPath);
const entries = walkSuites(report.suites);

const retriedAndPassed = entries.filter(
  (entry) =>
    failedAttempts(entry).length > 0 &&
    (entry.status === 'expected' || entry.results.some((result) => result.status === 'passed')),
);
const strictRetried = retriedAndPassed.filter(isStrict);
const otherRetried = retriedAndPassed.filter((entry) => !isStrict(entry));

// Every retry is listed, so the lane's output states what actually happened.
for (const entry of retriedAndPassed) {
  const attempts = entry.results.map((result) => result.status).join(' → ');
  const tag = isStrict(entry) ? 'STRICT' : 'flake-class';
  console.log(`e2e-retry-report: [${tag}] ${entry.title} (attempts: ${attempts})`);
}

const summary = {
  report: reportPath,
  tests: entries.length,
  retriedThenPassed: retriedAndPassed.length,
  strictRetriedThenPassed: strictRetried.length,
  otherRetriedThenPassed: otherRetried.length,
};
console.log(`e2e-retry-report: ${JSON.stringify(summary)}`);

if (strictRetried.length > 0) {
  console.error(
    `\ne2e-retry-report: ${strictRetried.length} strict assertion(s) passed only on a retry.`,
  );
  console.error(
    'A timing-ceiling or row-oracle assertion that fails its first attempt is evidence, not a flake.',
  );
  console.error('Investigate the failing attempt (its trace is retained) before recording a pass.');
  process.exit(1);
}

console.log('e2e-retry-report: OK — no strict assertion depended on a retry.');
process.exit(0);
