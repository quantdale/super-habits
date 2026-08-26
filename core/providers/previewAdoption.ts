/**
 * Monotonic adoption authority for restore-preview state.
 *
 * Mirrors the account-task sequencing used elsewhere in `AppProviders`: a
 * remote restore-preview read may keep running after its bounded await timed
 * out (`withRemoteTimeout` never cancels the underlying task), and backup
 * maintenance or a post-flush cycle may obtain a *newer* preview. Without
 * sequencing, a slow older preview that settles last can overwrite the newer
 * restore-prompt state (stale-async overwrite class, F-03).
 *
 * Each logical preview operation acquires an id via `begin()`; only the newest
 * id may adopt. Framework-free so the contract is unit-testable without React.
 */
export function createPreviewAdoptionGuard() {
  let latestId = 0;
  return {
    begin(): number {
      return ++latestId;
    },
    isCurrent(id: number): boolean {
      return id === latestId;
    },
  };
}

export type PreviewAdoptionGuard = ReturnType<typeof createPreviewAdoptionGuard>;
