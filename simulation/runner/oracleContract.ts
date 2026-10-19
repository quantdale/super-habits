/**
 * Oracle contract (`AUD-SH18-A` / `AUD-SH18-B`).
 *
 * The audited defect: a simulation oracle that carries no expectation was
 * reported as `passed`, and a failed read could be swallowed. Both turned
 * "the scenario ran" into "the behavior is correct", which is not evidence.
 *
 * This module is the single pure place that decides:
 *   - which oracles a step actually asserts (attached vs standalone),
 *   - whether a read outcome passes, fails, or is only recorded,
 *   - how a standalone oracle is labelled in the action log.
 *
 * It is deliberately browser-free so the contract is unit-testable without a
 * page, and so the runner cannot grow a second, divergent interpretation.
 */

import type { Oracle, SemanticStep } from '../model/types';

/** The three outcomes an evaluated oracle can have. */
export type OracleOutcome = 'passed' | 'failed' | 'skipped';

export interface OracleEvaluation {
  kind: Oracle['kind'];
  result: OracleOutcome;
  detail?: string;
}

/**
 * A `{ key: value }` partial expectation. Scenario authors never know generated
 * ids or revisions, so an outbox assertion pins the columns it can know
 * (`entity`, `operation`) and leaves the rest unconstrained.
 */
export type PartialExpectation = Record<string, unknown>;

/** True when the expectation asks for no particular column values at all. */
function isEmptyExpectation(expectation: PartialExpectation): boolean {
  return Object.keys(expectation).length === 0;
}

/** True when `row` satisfies every `key: value` pair in `expectation`. */
function rowMatches(row: Record<string, unknown>, expectation: PartialExpectation): boolean {
  return Object.entries(expectation).every(([key, value]) => row[key] === value);
}

/**
 * Match a set of expectations against actual rows.
 *
 * Each expectation must claim a distinct row, and every row must be claimed by
 * some expectation: an unexpected extra record therefore fails, which is what
 * makes "exactly these pending intents" expressible without ids.
 */
export function matchExpectations(
  expectations: PartialExpectation[],
  rows: Record<string, unknown>[],
): { unmatched: PartialExpectation[]; unclaimed: Record<string, unknown>[] } {
  const claimed = new Set<number>();
  const unmatched: PartialExpectation[] = [];
  for (const expectation of expectations) {
    const index = rows.findIndex((row, i) => !claimed.has(i) && rowMatches(row, expectation));
    if (index === -1) unmatched.push(expectation);
    else claimed.add(index);
  }
  return { unmatched, unclaimed: rows.filter((_, i) => !claimed.has(i)) };
}

/** The expectation payload of an oracle, when it has one. */
function oracleExpectation(oracle: Oracle): PartialExpectation[] | null {
  switch (oracle.kind) {
    case 'rows':
    case 'outbox':
      return oracle.expected as PartialExpectation[];
    case 'unchanged':
      // `unchanged` compares a snapshot before/after; it is its own assertion.
      return null;
    case 'across-surfaces':
      return null;
    case 'diagnostic':
      return null;
  }
}

/**
 * Decide the outcome of an oracle from the read result.
 *
 * `read` is either the rows the query returned or the error it threw. An error
 * is ALWAYS a failure — swallowing it was the second half of the defect — and a
 * nonempty expectation against an empty result is a failure, not a pass.
 *
 * @param oracle the declared oracle
 * @param read the query result or the thrown error
 */
export function markAssertionOutcome(oracle: Oracle, read: unknown): OracleEvaluation {
  if (read instanceof Error) {
    return { kind: oracle.kind, result: 'failed', detail: read.message };
  }
  if (oracle.kind === 'diagnostic') {
    const rows = Array.isArray(read) ? read.length : 0;
    return {
      kind: 'diagnostic',
      result: 'skipped',
      detail: `${rows} row(s) read (diagnostic only — not an assertion)`,
    };
  }
  if (!Array.isArray(read)) {
    return {
      kind: oracle.kind,
      result: 'failed',
      detail: `expected a row array, received ${typeof read}`,
    };
  }
  const rows = read as Record<string, unknown>[];
  const expectations = oracleExpectation(oracle);
  if (expectations === null) {
    // `unchanged` / `across-surfaces` are evaluated by their own helpers; when
    // they reach here the read already succeeded without throwing.
    return { kind: oracle.kind, result: 'passed' };
  }
  if (expectations.length === 0) {
    // An explicitly empty expectation asserts "no rows": the read must be empty.
    if (rows.length === 0) return { kind: oracle.kind, result: 'passed', detail: '0 row(s)' };
    return {
      kind: oracle.kind,
      result: 'failed',
      detail: `expected 0 row(s), received ${rows.length}`,
    };
  }
  if (expectations.every(isEmptyExpectation)) {
    return {
      kind: oracle.kind,
      result: 'failed',
      detail: 'expectation has no constrained columns; it cannot discriminate a result',
    };
  }
  const { unmatched, unclaimed } = matchExpectations(expectations, rows);
  if (unmatched.length > 0) {
    return {
      kind: oracle.kind,
      result: 'failed',
      detail: `${unmatched.length} of ${expectations.length} expectation(s) matched no row (received ${rows.length} row(s)): ${JSON.stringify(
        unmatched,
      )}; actual rows: ${JSON.stringify(rows)}`,
    };
  }
  if (unclaimed.length > 0) {
    return {
      kind: oracle.kind,
      result: 'failed',
      detail: `${unclaimed.length} unclaimed row(s) beyond the declared expectation: ${JSON.stringify(
        unclaimed,
      )}`,
    };
  }
  return {
    kind: oracle.kind,
    result: 'passed',
    detail: `${expectations.length} row(s) matched`,
  };
}

/**
 * True when every oracle in the list passes. A diagnostic read is `skipped` and
 * never blocks — it is also never evidence, so a caller must not treat an
 * all-diagnostic list as proof of a mutation (model validation enforces that).
 */
export function oraclePasses(evaluations: OracleEvaluation[]): boolean {
  return evaluations.every((evaluation) => evaluation.result !== 'failed');
}

/** Every oracle attached to a step, in declaration order. */
export function selectAttachedOracles(step: SemanticStep): Oracle[] {
  return step.oracles ?? [];
}

/**
 * Action-log label for a standalone `expectOracle` step. A diagnostic read says
 * so explicitly so a report reader cannot mistake it for an assertion.
 */
export function standaloneOracleLabel(oracle: Oracle): string {
  switch (oracle.kind) {
    case 'rows':
      return 'expectOracle rows';
    case 'outbox':
      return 'expectOracle outbox';
    case 'across-surfaces':
      return 'expectOracle across-surfaces';
    case 'unchanged':
      return 'expectOracle unchanged';
    case 'diagnostic':
      return 'expectOracle diagnostic (recorded read, not an assertion)';
  }
}
