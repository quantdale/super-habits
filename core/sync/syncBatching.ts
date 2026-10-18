/**
 * Request batching and read-back verification limits (`AUD-SH08-A`/`B`).
 *
 * ## The audited defect
 *
 * The adapter upserted every id for an entity in ONE statement and then verified
 * by ONE unpaged `select ... in (ids)`. PostgREST enforces `max_rows`
 * (`supabase/config.toml` sets 1000) as a hard response cap that TRUNCATES, not
 * errors. With 1,001 pushed rows the remote stored all 1,001, the single
 * read-back returned 1,000 ids, and the adapter failed all 1,001 records as
 * "incompletely stored" — a false failure that would also have blocked the
 * outbox. The same unpaged `.in()` would eventually exceed the URL/parameter
 * budget for long ids.
 *
 * ## The rules encoded here
 *
 * - Writes are split into bounded batches below the supported cap, so a payload
 *   never approaches the request-size limit and a partial failure only affects
 *   its own batch.
 * - Read-back is PAGINATED with a deterministic order and an explicit `range`,
 *   and the complete expected id set is compared.
 * - A page that comes back at the page size when more rows were requested, or a
 *   page count that cannot account for the expected ids, is treated as a
 *   TRUNCATION — a visible failure, never a silent success.
 * - A smaller configured cap is honoured (the batch writer stays under it), so a
 *   project with `max_rows = 100` is correct too.
 *
 * The pure pieces live here so the policy is unit-testable without a network;
 * the adapter supplies the actual reads/writes.
 */

/**
 * Rows written per upsert statement.
 *
 * Conservative on purpose: below the 1,000-row default `max_rows`, and small
 * enough that the projected column payload of wide entities (workout rows carry
 * many columns) stays well inside a sane request body. Not derived from the
 * server cap at runtime — a client that trusted a larger advertised cap would
 * still have to survive a proxy that enforces a smaller one.
 */
export const SYNC_WRITE_BATCH_ROWS = 250;

/**
 * Ids per read-back page. Also the `.in()` list size, which is what keeps the
 * request URL/parameter budget bounded for long ids.
 */
export const SYNC_VERIFY_PAGE_ROWS = 200;

/**
 * Lowest supported server cap the batcher will respect when a caller declares
 * one. A configured cap below this would make batching useless; treat it as a
 * misconfiguration rather than silently looping one row at a time.
 */
export const SYNC_MIN_SUPPORTED_CAP = 10;

/** Split `items` into fixed-size chunks (order preserved). */
export function chunk<T>(items: readonly T[], size: number): T[][] {
  if (size <= 0) throw new Error(`chunk size must be positive (received ${size})`);
  const out: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    out.push(items.slice(index, index + size));
  }
  return out;
}

/**
 * The effective write-batch size.
 *
 * @param serverCap optional advertised `max_rows`; when given, the batch stays
 *   strictly below it so a single statement can never be truncated.
 */
export function writeBatchRows(serverCap?: number): number {
  if (serverCap === undefined) return SYNC_WRITE_BATCH_ROWS;
  if (!Number.isFinite(serverCap) || serverCap < SYNC_MIN_SUPPORTED_CAP) {
    throw new Error(
      `Declared server row cap ${String(serverCap)} is below the supported minimum ${SYNC_MIN_SUPPORTED_CAP}.`,
    );
  }
  return Math.max(1, Math.min(SYNC_WRITE_BATCH_ROWS, Math.floor(serverCap) - 1));
}

/** The effective verification page size, bounded by the declared cap. */
export function verifyPageRows(serverCap?: number): number {
  if (serverCap === undefined) return SYNC_VERIFY_PAGE_ROWS;
  if (!Number.isFinite(serverCap) || serverCap < SYNC_MIN_SUPPORTED_CAP) {
    throw new Error(
      `Declared server row cap ${String(serverCap)} is below the supported minimum ${SYNC_MIN_SUPPORTED_CAP}.`,
    );
  }
  return Math.max(1, Math.min(SYNC_VERIFY_PAGE_ROWS, Math.floor(serverCap)));
}

/** The outcome of comparing accumulated read-back ids against the expectation. */
export type VerificationOutcome =
  /** Every expected id was confirmed stored for this owner. */
  | { ok: true }
  /** Some ids were never stored; `missing` names them (bounded for readability). */
  | { ok: false; reason: 'incomplete'; missing: string[] }
  /** A page was truncated by the server cap, so the result is untrustworthy. */
  | { ok: false; reason: 'truncated'; detail: string };

/**
 * Evaluate one verification page.
 *
 * @param params.expectedRows how many rows the page asked for
 * @param params.receivedIds the ids the page actually returned
 * @param params.pageSize the page's requested `range` size
 */
export function evaluateVerificationPage(params: {
  expectedRows: number;
  receivedIds: string[];
  pageSize: number;
}): VerificationOutcome {
  const { expectedRows, receivedIds, pageSize } = params;
  if (receivedIds.length > pageSize) {
    return {
      ok: false,
      reason: 'truncated',
      detail: `a page of at most ${pageSize} row(s) returned ${receivedIds.length}`,
    };
  }
  // Fewer rows than requested is legitimate only when the server genuinely has
  // fewer matching rows — which the final id-set comparison detects. What must
  // never pass silently is a FULL page when the caller asked for fewer than the
  // page size (that is the truncation signal).
  if (expectedRows < pageSize && receivedIds.length > expectedRows) {
    return {
      ok: false,
      reason: 'truncated',
      detail: `asked for ${expectedRows} row(s) of a ${pageSize}-row page and received ${receivedIds.length}`,
    };
  }
  return { ok: true };
}

/**
 * Compare the accumulated confirmed ids with the expected set.
 *
 * `AUD-SH08-B` also requires distinguishing two very different failures:
 *
 *  - a row really was not stored (a genuine data problem to report), and
 *  - the read-back was CAPPED, so absence is unproven.
 *
 * When the caller declares the server's row cap and the read-back returned
 * exactly that many ids while more were expected, the correct verdict is
 * truncation. This is the audited shape (1,001 pushed, 1,000 returned, cap
 * 1,000) generalized: reporting it as "1 row was not stored" would be a false
 * claim about user data.
 *
 * @param expected the ids that were written
 * @param confirmed every id the read-back observed for this owner
 * @param options.serverCap the declared backend row cap, when known
 */
export function compareVerifiedIds(
  expected: readonly string[],
  confirmed: Iterable<string>,
  options: { serverCap?: number } = {},
): VerificationOutcome {
  const confirmedSet = new Set(confirmed);
  const missing = expected.filter((id) => !confirmedSet.has(id));
  if (missing.length === 0) return { ok: true };
  const cap = options.serverCap;
  if (cap !== undefined && expected.length > cap && confirmedSet.size >= cap) {
    return {
      ok: false,
      reason: 'truncated',
      detail: `the read-back returned exactly the declared ${cap}-row cap while ${expected.length} row(s) were expected`,
    };
  }
  return { ok: false, reason: 'incomplete', missing };
}

/**
 * Bounded, readable rendering of missing ids for an error message.
 *
 * @param missing the missing ids
 * @param limit how many to name inline
 */
export function describeMissingIds(missing: readonly string[], limit = 5): string {
  const named = missing.slice(0, limit).join(', ');
  return missing.length > limit ? `${named}, … (${missing.length} total)` : named;
}
