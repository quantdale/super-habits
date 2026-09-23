import { describe, expect, it } from 'vitest';
import {
  ASK_SAFETY_CORPUS,
  COMMAND_EVAL_CORPUS,
  type AskSafetyExpectation,
} from '@/e2e/helpers/commandEvalCorpus';

/**
 * Shape + contract validation for the phase-1 eval corpus (successor
 * ai-command-center-production-v1). Runs in every credential-free lane, so the
 * corpus itself is proven before any provider credential exists. Expectations
 * are only checked for VALIDITY and coverage here — scoring happens in the
 * env-gated live lanes — so this test can never fake a provider result.
 */

const OUTCOME_CLASSES = new Set(['ready', 'needs_input', 'unsupported', 'unavailable']);
const ASK_CLASSES = new Set<AskSafetyExpectation>([
  'no_local_mutation',
  'self_tracking_boundary_only',
  'no_pii_echo',
  'confirm_before_write',
]);

describe('command eval corpus (phase 1)', () => {
  it('every corpus row is structurally valid with a unique label', () => {
    expect(COMMAND_EVAL_CORPUS.length).toBeGreaterThanOrEqual(8);
    const labels = new Set<string>();
    for (const row of COMMAND_EVAL_CORPUS) {
      expect(row.label.length, row.label).toBeGreaterThan(0);
      expect(labels.has(row.label), `duplicate label ${row.label}`).toBe(false);
      labels.add(row.label);
      expect(row.rawCommand.trim().length, row.label).toBeGreaterThan(0);
      expect(OUTCOME_CLASSES.has(row.expectation.outcomeClass), row.label).toBe(true);
      expect(['classification', 'semantic']).toContain(row.evaluationKind);
      expect(row.expectation.effectivePath, row.label).toBeDefined();
      for (const code of row.expectation.warningCodes ?? []) {
        expect(typeof code, row.label).toBe('string');
      }
      for (const field of row.expectation.missingFields ?? []) {
        expect(typeof field, row.label).toBe('string');
      }
    }
  });

  it('covers both draft intents, every outcome class, and the forced-failure path', () => {
    const draftKinds = new Set(
      COMMAND_EVAL_CORPUS.map((row) => row.expectation.draftKind).filter(Boolean),
    );
    expect(draftKinds).toEqual(new Set(['create_todo', 'create_habit']));

    const outcomeClasses = new Set(COMMAND_EVAL_CORPUS.map((row) => row.expectation.outcomeClass));
    expect(outcomeClasses).toEqual(new Set(['ready', 'needs_input', 'unsupported', 'unavailable']));

    const forced = COMMAND_EVAL_CORPUS.filter((row) => row.forceFetchFailureOnce === true);
    expect(forced.length).toBeGreaterThanOrEqual(1);
    expect(forced.every((row) => row.expectation.outcomeClass === 'unavailable')).toBe(true);
  });

  it('needs_input rows declare their missing fields instead of guessing defaults', () => {
    const needsInput = COMMAND_EVAL_CORPUS.filter(
      (row) => row.expectation.outcomeClass === 'needs_input',
    );
    expect(needsInput.length).toBeGreaterThanOrEqual(2);
    for (const row of needsInput) {
      expect((row.expectation.missingFields ?? []).length, row.label).toBeGreaterThan(0);
    }
  });

  it('every row carries a synthetic-persona note for provenance', () => {
    for (const row of COMMAND_EVAL_CORPUS) {
      expect(row.note, row.label).toBeTruthy();
    }
  });

  it('ask-safety corpus rows are unique, class-valid, and mutation-aware', () => {
    expect(ASK_SAFETY_CORPUS.length).toBeGreaterThanOrEqual(4);
    const ids = new Set<string>();
    for (const row of ASK_SAFETY_CORPUS) {
      expect(ids.has(row.id), `duplicate id ${row.id}`).toBe(false);
      ids.add(row.id);
      expect(row.prompt.trim().length, row.id).toBeGreaterThan(0);
      expect(row.expected.length, row.id).toBeGreaterThan(0);
      expect(row.expected, row.id).toContainEqual(
        expect.stringMatching(
          /^(no_local_mutation|self_tracking_boundary_only|no_pii_echo|confirm_before_write)$/,
        ),
      );
      for (const cls of row.expected) expect(ASK_CLASSES.has(cls), row.id).toBe(true);
    }
    // Every row must at minimum prevent or defer writes — safety posture.
    expect(
      ASK_SAFETY_CORPUS.every(
        (r) =>
          r.expected.includes('no_local_mutation') || r.expected.includes('confirm_before_write'),
      ),
    ).toBe(true);
  });
});
