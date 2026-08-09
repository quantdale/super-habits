/**
 * Structured failure triage shared by simulation reports and agent guidance.
 *
 * This module deliberately does not infer FLAKY_TEST from a retry or silently
 * convert an untriaged failure into a known gap. Classification is an evidence-
 * backed decision recorded after reproduction.
 */

export const FAILURE_CLASSIFICATIONS = [
  'PRODUCT_BUG',
  'TEST_BUG',
  'FLAKY_TEST',
  'ENVIRONMENT',
  'EXPECTED_KNOWN_GAP',
  'SPEC_AMBIGUITY',
] as const;

export type FailureClassification = (typeof FAILURE_CLASSIFICATIONS)[number];

export interface FailureTriage {
  classification: FailureClassification;
  rationale: string;
  evidence: string[];
  /** Required when the classification is EXPECTED_KNOWN_GAP. */
  knownGapId?: string;
  /** Optional owner or follow-up change reference. */
  followUp?: string;
}

export interface FailureTriageValidationIssue {
  path: string;
  message: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function isFailureClassification(value: unknown): value is FailureClassification {
  return (
    typeof value === 'string' && (FAILURE_CLASSIFICATIONS as readonly string[]).includes(value)
  );
}

/** Validate a triage record; an empty result means it is actionable. */
export function validateFailureTriage(value: unknown): FailureTriageValidationIssue[] {
  const issues: FailureTriageValidationIssue[] = [];
  if (!isRecord(value)) return [{ path: 'triage', message: 'must be an object' }];

  if (!isFailureClassification(value.classification)) {
    issues.push({
      path: 'classification',
      message: `must be one of ${FAILURE_CLASSIFICATIONS.join(', ')}`,
    });
  }
  if (!isNonEmptyString(value.rationale)) {
    issues.push({ path: 'rationale', message: 'must be a non-empty string' });
  }
  if (!Array.isArray(value.evidence) || value.evidence.length === 0) {
    issues.push({ path: 'evidence', message: 'must contain at least one evidence reference' });
  } else {
    value.evidence.forEach((entry, index) => {
      if (!isNonEmptyString(entry)) {
        issues.push({ path: `evidence[${index}]`, message: 'must be a non-empty string' });
      }
    });
  }
  if (value.classification === 'EXPECTED_KNOWN_GAP' && !isNonEmptyString(value.knownGapId)) {
    issues.push({
      path: 'knownGapId',
      message: 'is required for EXPECTED_KNOWN_GAP',
    });
  }
  if (value.followUp !== undefined && !isNonEmptyString(value.followUp)) {
    issues.push({ path: 'followUp', message: 'must be a non-empty string when provided' });
  }
  return issues;
}

export function isValidFailureTriage(value: unknown): value is FailureTriage {
  return validateFailureTriage(value).length === 0;
}
