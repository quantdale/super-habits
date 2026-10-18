import { linkedActionsEngine } from '@/core/linked-actions/linkedActions.engine';
import { listPendingRecoveryLinkedActionEvents } from '@/core/linked-actions/linkedActions.data';
import type { LinkedActionEventRecord } from '@/core/linked-actions/linkedActions.types';

/**
 * Startup recovery for linked-action dispatch crashes.
 *
 * Every dispatch path now persists its source event row inside the SAME
 * SQLite transaction as the authoritative source write (the "durable dispatch
 * handoff"). A process crash between that commit and the post-commit dispatch
 * — or between two rule iterations of one dispatch — therefore leaves the
 * event row on disk with the full normalized payload and one or more rules
 * still unsettled. This sweeper replays exactly those events after a
 * restart:
 *
 * - bounded to a 7-day lookback window (never an unbounded table scan);
 * - completion is decided per RULE, not per event: an event stays pending
 *   while any eligible rule lacks a terminal (`applied`/`skipped`) execution,
 *   so a crash after rule A finished never hides rule B's missing effect;
 * - rule eligibility is historical: only active, undeleted rules that
 *   already existed when the event was recorded may fire. Rules authored
 *   after the event never gain retroactive effects; paused/deleted rules
 *   never resurrect; a still-matching rule that was edited fires with its
 *   current configuration (rule history is not snapshotted);
 * - replays run through the normal `processSourceAction` pipeline, so the
 *   existing exactly-once machinery holds: duplicate guards, claim leases
 *   (a fresh `running` execution is skipped as in-progress, a stale one is
 *   reclaimed with its stable execution identity), chain fingerprints, and
 *   idempotent effect adapters;
 * - one failing event never blocks the remaining replay passes.
 *
 * Lease timing: an execution abandoned mid-run by a crash is protected by
 * its claim lease for `EXECUTION_STALE_AFTER_MS` (5 minutes). A sweep that
 * meets a fresh lease leaves that rule untouched and reports the event as
 * skipped; the rule is retried by a later startup sweep once the lease is
 * stale. The sweep itself runs once per launch (AppProviders, after sync
 * hydration), so "later" means the next launch.
 *
 * Events older than the window with unsettled rules are intentionally left
 * as-is: they are historical residue whose user-facing moment has passed,
 * and sweeping them would replay arbitrarily stale effects. Events are local
 * operational state outside the backup scope, so no sync intent is involved.
 */
export const LINKED_ACTION_RECOVERY_LOOKBACK_DAYS = 7;

export const LINKED_ACTION_RECOVERY_LOOKBACK_MS =
  LINKED_ACTION_RECOVERY_LOOKBACK_DAYS * 24 * 60 * 60 * 1000;

export type LinkedActionRecoveryReport = {
  /** Events whose dispatch was replayed (at least one effect applied/planned). */
  replayedEvents: number;
  /** Events skipped: already terminal, in-progress elsewhere, or no matching rules. */
  skippedEvents: number;
  /** Events whose replay raised an error (left for the next startup attempt). */
  failedEvents: number;
};

async function processRecoveryEvent(event: LinkedActionEventRecord) {
  const result = await linkedActionsEngine.processSourceAction(event);
  if (result.effects.some((effect) => effect.status === 'failed')) {
    return 'failed' as const;
  }
  const settledWork = result.effects.some(
    (effect) =>
      effect.status !== 'duplicate' &&
      effect.reason !== 'unsupported_rule' &&
      effect.reason !== 'self_target_noop',
  );
  if (!settledWork) {
    return 'skipped' as const;
  }
  return 'replayed' as const;
}

export async function recoverPendingLinkedActions(
  now: Date = new Date(),
): Promise<LinkedActionRecoveryReport> {
  const cutoff = new Date(now.getTime() - LINKED_ACTION_RECOVERY_LOOKBACK_MS).toISOString();
  const events = await listPendingRecoveryLinkedActionEvents(cutoff);

  const report: LinkedActionRecoveryReport = {
    replayedEvents: 0,
    skippedEvents: 0,
    failedEvents: 0,
  };

  for (const event of events) {
    try {
      const outcome = await processRecoveryEvent(event);
      if (outcome === 'failed') {
        report.failedEvents += 1;
        continue;
      }
      if (outcome === 'skipped') {
        // Nothing settled this pass: every eligible rule is already terminal
        // or duplicate (e.g. an in-flight lease owned elsewhere — NOT
        // consumed; a later sweep retries once the lease is stale), no rule
        // matches anymore (paused/deleted/authored after the event), or the
        // remaining rules are unsupported/self-noop and produce no durable
        // work.
        report.skippedEvents += 1;
        continue;
      }
      report.replayedEvents += 1;
    } catch (error) {
      report.failedEvents += 1;
      console.error('[linked-actions] recovery replay failed for event', event.eventId, error);
    }
  }

  return report;
}
