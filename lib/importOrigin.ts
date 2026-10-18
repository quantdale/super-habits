/**
 * Imported-origin ownership precondition (`AUD-SH01-A`/`B`/`C`).
 *
 * ## The audited defect
 *
 * A dataset imported from another device's portable backup records the SOURCE
 * owner's fingerprint (`app_meta portable.last_import_owner_fingerprint`). Only
 * the account whose verified UID hashes to that fingerprint may claim it.
 * `decideAccountState` enforced that — but only on the branch that saw a
 * POPULATED, unbound dataset with zero pending work. Adding a single unowned
 * outbox row (which any local edit produces while remote work is paused) moved
 * the decision into the `!local.ownerBinding && local.unownedOutboxCount > 0`
 * branch, which returned `anonymous_ready` and `bindCurrentUserId = <current
 * session>` WITHOUT the fingerprint check. The coordinator then persisted that
 * unrelated temporary account as the dataset owner and adopted the imported
 * work under it.
 *
 * ## The rule this module encodes
 *
 * The fingerprint restriction is a PRECONDITION on every path that can bind,
 * seed, adopt, or replace the dataset owner — not a rule of one branch. It is
 * evaluated inside the durable write as well, so a stale decision computed
 * before another writer changed the device cannot be committed.
 *
 * Local use stays possible: a blocked decision yields no binding and no upload,
 * while the user's rows and their (unowned) pending work remain untouched.
 *
 * A local-only source file with no recorded fingerprint keeps its documented
 * adoption behavior — there is no protected origin to defend.
 */

import {
  isPortableOwnerFingerprint,
  portableOwnerFingerprint,
} from '@/lib/portableOwnerFingerprint';

/** The recorded portable-import owner fingerprint, or `null` when absent. */
export type ImportOriginFingerprint = string | null;

/**
 * Why a binding attempt was refused because of the recorded import origin.
 *
 * - `unrelated_account` — the verified account does not hash to the recorded
 *   fingerprint, and it is not a temporary anonymous session.
 * - `temporary_session` — a temporary/anonymous session tried to claim a
 *   protected imported dataset. It can never be the source owner.
 * - `malformed_fingerprint` — an origin was recorded but is not a well-formed
 *   fingerprint, so no account may be treated as its source.
 */
export type ImportOriginRefusal =
  'unrelated_account' | 'temporary_session' | 'malformed_fingerprint';

export type ImportOriginDecision =
  /** No protected origin: ordinary adoption rules apply. */
  | { allowed: true; reason: 'no_recorded_origin' | 'source_owner' }
  /** A protected origin exists and this attempt may not claim the dataset. */
  | { allowed: false; reason: ImportOriginRefusal };

/**
 * Evaluate whether `candidateUserId` may claim a dataset with the given
 * recorded import origin.
 *
 * The rules, in order:
 * 1. No recorded origin → allowed (`no_recorded_origin`). A local-only import
 *    has no protected source, and its documented behavior is unchanged.
 * 2. A recorded value that is not a well-formed fingerprint → refused
 *    (`malformed_fingerprint`). Fail closed: an unreadable origin must not be
 *    read as permission.
 * 3. The candidate's fingerprint matches → allowed (`source_owner`).
 * 4. A temporary/anonymous candidate → refused (`temporary_session`). The
 *    source owner is a real account; a throwaway session cannot be it.
 * 5. Otherwise → refused (`unrelated_account`).
 *
 * @param params.importOrigin the recorded `portable.last_import_owner_fingerprint`
 * @param params.candidateUserId the account attempting to claim the dataset
 * @param params.candidateIsAnonymous whether that account is a temporary session
 */
export function decideImportOriginClaim(params: {
  importOrigin: ImportOriginFingerprint;
  candidateUserId: string | null;
  candidateIsAnonymous: boolean;
}): ImportOriginDecision {
  const { importOrigin, candidateUserId, candidateIsAnonymous } = params;
  if (importOrigin === null || importOrigin === '') {
    return { allowed: true, reason: 'no_recorded_origin' };
  }
  if (!isPortableOwnerFingerprint(importOrigin)) {
    return { allowed: false, reason: 'malformed_fingerprint' };
  }
  if (candidateUserId === null || candidateUserId === '') {
    // Nothing is being claimed; nothing to refuse. (A binding attempt with no
    // candidate is handled by the ordinary decision, not by this guard.)
    return { allowed: true, reason: 'no_recorded_origin' };
  }
  if (portableOwnerFingerprint(candidateUserId) === importOrigin) {
    return { allowed: true, reason: 'source_owner' };
  }
  return {
    allowed: false,
    reason: candidateIsAnonymous ? 'temporary_session' : 'unrelated_account',
  };
}

/** Human-facing explanation for a refused claim. */
export function importOriginRefusalMessage(reason: ImportOriginRefusal): string {
  switch (reason) {
    case 'temporary_session':
      return 'This device’s dataset was imported from another backup account, and a temporary session cannot claim it. Sign in with the account that created it.';
    case 'malformed_fingerprint':
      return 'This device records an unreadable import origin, so remote backup is paused until the account that created the dataset is identified.';
    case 'unrelated_account':
      return 'This device’s dataset was imported from another backup account. Only the account that created it can claim it.';
  }
}
