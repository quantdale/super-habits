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
7. Known bugs still present:
   - toDateKey() UTC issue (lib/time.ts)
   - meal_type hard-coded to "snack" (calories.data.ts)
   - sync queue never flushed
8. Any new issues since the last audit

Output for each finding:
- File + line range
- Severity: Critical / High / Medium / Low
- Problem
- Recommended fix

Sort by severity. End with counts.
