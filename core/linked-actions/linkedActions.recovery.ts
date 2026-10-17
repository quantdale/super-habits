import { linkedActionsEngine } from '@/core/linked-actions/linkedActions.engine';
import { listPendingRecoveryLinkedActionEvents } from '@/core/linked-actions/linkedActions.data';
import type { LinkedActionEventRecord } from '@/core/linked-actions/linkedActions.types';

/**
 * Startup recovery for linked-action dispatch crashes.
 *
 * Every dispatch path now persists its source event row inside the SAME
 * SQLite transaction as the authoritative source write (the "durable dispatch
 * handoff"). A process crash between that commit and the post-commit dispatch
 * therefore leaves the event row on disk with the full normalized payload but
 * no terminal execution. This sweeper replays exactly those events after a
 * restart:
 *
 * - bounded to a 7-day lookback window (never an unbounded table scan);
 * - an event with ANY terminal execution (`applied`/`skipped`) is excluded;
 * - replays run through the normal `processSourceAction` pipeline, so the
 *   existing exactly-once machinery holds: duplicate guards, claim leases
 *   (a fresh `running` execution is skipped as in-progress, a stale one is
 *   reclaimed), chain fingerprints, and idempotent effect adapters;
 * - one failing event never blocks the remaining replay passes.
 *
 * Events older than the window with no terminal execution are intentionally
 * left as-is: they are historical residue whose user-facing moment has passed,
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
  if (
    result.effects.length === 0 ||
    result.effects.every((effect) => effect.status === 'duplicate')
  ) {
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
        // Either no rule matched anymore (e.g. the rule was disabled/deleted
        // since the crash — nothing to dispatch, and no execution record will
        // ever mark this event terminal), or the dispatch was already owned
        // by another in-flight/terminal execution. Count as consumed.
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
