import { describe, expect, it } from 'vitest';
import {
  FAILURE_CLASSIFICATIONS,
  isFailureClassification,
  isValidFailureTriage,
  validateFailureTriage,
} from '../simulation/observe/failure';

describe('failure triage contract', () => {
  it('keeps the six classifications explicit', () => {
    expect(FAILURE_CLASSIFICATIONS).toEqual([
      'PRODUCT_BUG',
      'TEST_BUG',
      'FLAKY_TEST',
      'ENVIRONMENT',
      'EXPECTED_KNOWN_GAP',
      'SPEC_AMBIGUITY',
    ]);
    expect(isFailureClassification('FLAKY_TEST')).toBe(true);
    expect(isFailureClassification('RETRY_PASSED')).toBe(false);
  });

  it('requires rationale and evidence for a classified failure', () => {
    expect(
      isValidFailureTriage({
        classification: 'PRODUCT_BUG',
        rationale: 'The expected row oracle is correct and the app wrote the wrong value.',
        evidence: ['simulation-output/run-123/run-report.json', 'seed=7340193'],
      }),
    ).toBe(true);
    expect(
      validateFailureTriage({ classification: 'PRODUCT_BUG', rationale: '', evidence: [] }),
    ).toEqual([
      { path: 'rationale', message: 'must be a non-empty string' },
      { path: 'evidence', message: 'must contain at least one evidence reference' },
    ]);
  });

  it('requires a known-gap reference for quarantined behavior', () => {
    expect(
      validateFailureTriage({
        classification: 'EXPECTED_KNOWN_GAP',
        rationale: 'The scenario is explicitly quarantined under CG-1.',
        evidence: ['docs/testing/known-gaps.md'],
      }),
    ).toEqual([{ path: 'knownGapId', message: 'is required for EXPECTED_KNOWN_GAP' }]);
  });
});
