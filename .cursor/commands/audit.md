# audit

Read-only audit of the SuperHabits codebase. No code changes.

---

Read-only audit — do not modify any file.

Read every file in features/, core/, lib/, app/, and tests/.

Audit for:
1. Invariant violations:
   - Hard deletes instead of soft deletes
   - Missing syncEngine.enqueue() after writes
   - IDs not using createId()
   - Timestamps not using nowIso() / toDateKey()
   - DB access before getDatabase()
2. Missing migrations for schema changes
3. domain.ts files that import from DB (purity violation)
4. Screen files that import from DB directly (bypassing data layer)
5. New domain functions without tests
6. Unused imports or dead code (beyond known: App.tsx, index.ts, nextPomodoroState)
7. Known product / infra tradeoffs to verify (not assumed bugs — confirm against current code):
   - Sync: in-memory queue + **`SupabaseSyncAdapter`** on exported `syncEngine`; `flush()` on interval/visibility/NetInfo when `isRemoteEnabled()` (default enabled). Queue growth when `setRemoteMode("disabled")` is intentional (see project rules).
   - `schema.sql` may lag runtime DDL in `core/db/client.ts` (reference only).
   - Any regressions called out in `.cursor/rules/superhabits-rules.mdc` (e.g. PomodoroScreen vs `nextPomodoroState` wiring).
8. Any new issues since the last audit

Output for each finding:
- File + line range
- Severity: Critical / High / Medium / Low
- Problem
- Recommended fix

Sort by severity. End with counts.
