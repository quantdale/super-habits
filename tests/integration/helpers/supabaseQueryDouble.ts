/**
 * Shared test double for a PostgREST `select()` read-back chain.
 *
 * The production adapter's verification read is
 * `select('id').in('id', ids).eq('user_id', owner).order('id').range(from, to)`
 * (`AUD-SH08-A`): paginated, deterministic, bounded. A hand-written double that
 * stops at `.eq()` no longer models the real chain, so the double is shared and
 * supports `.order()` and `.range()` as well as being directly awaitable.
 *
 * `range()` slices the rows the handler produced, which is what a real capped
 * server does — so a double that returns more rows than the page asked for
 * reproduces postgrest truncation rather than hiding it.
 */

export interface QueryResult {
  data: Record<string, unknown>[] | null;
  error: { message: string } | null;
}

/**
 * Build the object `.eq()` must return: awaitable AND chainable.
 *
 * @param rows the rows the handler decided match, in the handler's own order
 */
export function chainableQuery(rows: Record<string, unknown>[]): QueryResult & {
  order: (column: string, options?: { ascending?: boolean }) => typeof chain;
  range: (from: number, to: number) => Promise<QueryResult>;
} {
  let current = [...rows];
  const chain = {
    data: current,
    error: null as { message: string } | null,
    order(column: string, options?: { ascending?: boolean }) {
      const ascending = options?.ascending !== false;
      current = [...current].sort((a, b) => {
        const left = String(a[column] ?? '');
        const right = String(b[column] ?? '');
        return ascending ? left.localeCompare(right) : right.localeCompare(left);
      });
      chain.data = current;
      return chain;
    },
    async range(from: number, to: number): Promise<QueryResult> {
      // Inclusive `to`, exactly like PostgREST.
      return { data: current.slice(from, to + 1), error: null };
    },
    // Awaiting the chain without `.range()` returns everything the handler
    // matched (the pre-pagination shape), so existing expectations still work.
    then<TResult1 = QueryResult, TResult2 = never>(
      onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ): Promise<TResult1 | TResult2> {
      return Promise.resolve<QueryResult>({ data: current, error: null }).then(
        onfulfilled,
        onrejected,
      );
    },
  };
  return chain;
}
