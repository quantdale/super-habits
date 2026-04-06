# fix

Fix any SuperHabits issue — data layer, UI layer, or both.
Auto-routes to the correct agent and skills based on what the
issue touches. Plan-first for all fixes.

---

Issue: {{issue}}

---

## Step 1 — Classify the issue

Before reading any files, classify which layer is affected:

**→ data-agent + db-and-sync-invariants** if the issue involves:
  - features/*/*.data.ts
  - core/db/ (client, types, schema, migrations)
  - core/sync/sync.engine.ts
  - core/auth/guestProfile.ts
  - lib/id.ts or lib/time.ts
  - SQLite queries, IDs, timestamps, migrations, sync enqueue

**→ feature-agent + feature-module-pattern + rn-expo-conventions** if the issue involves:
  - features/*/*Screen.tsx
  - features/*/*.domain.ts
  - core/ui/ components
  - app/ routing files
  - lib/notifications.ts
  - AppProviders.tsx

**→ both agents, data first** if the issue touches both layers
  (e.g. a new field that needs a migration AND a screen change).
  Complete the data-agent work and get approval before starting
  the feature-agent work.

**→ ask one clarifying question** if the issue description is
  ambiguous and classification is not clear from the description alone.

State your classification and routing decision before proceeding.

---

## Step 2 — Workflow (same for all routes)

1. Read all affected files completely.
   - **Feature-agent only:** Read the relevant `*.data.ts` for the data API (read-only contract); do not modify `*.data.ts` unless the issue is classified as data layer or both (replaces old “use /fix-ui only” scope — stay within the routed layer).
2. Identify root cause precisely (file + line).
3. Write plan: files to change, exact changes, migration number if needed.
4. **Wait for approval before implementing.**
5. Implement.
6. Run: npm run typecheck, npm test.
7. Report: root cause, fix applied, test count.

---

## Step 3 — Hard constraints (all routes)

**Data layer (always applies when data-agent is involved):**
- Soft delete only — never DELETE FROM main entities
- syncEngine.enqueue() on every applicable write
  (not on: pomodoro_sessions, workout_logs, habit_completions)
- All IDs via createId(prefix) — never raw random/uuid/Date.now()
- All timestamps via nowIso() — all date keys via toDateKey()
- New columns require a new migration
  (current stored version: 9 — next: new `if (version < 10) { ... }` block when schema changes)
- Never modify existing migration cases or bootstrap DDL
- schema.sql is reference only — never execute it
- habit_completions: SELECT + INSERT/UPDATE/DELETE pattern
  (hard delete allowed; not synced)
- All SELECT queries include WHERE deleted_at IS NULL

**UI / domain layer (always applies when feature-agent is involved):**
- No direct DB imports in Screen or domain files
- Screens import only from .data.ts, .domain.ts, and core/ui/
- Domain files are pure — no DB, no React, no side effects
- New domain functions need a Vitest test in tests/
- Use FlashList (not FlatList) for list rendering
- Use NativeWind className (not StyleSheet.create) for styling
- Use <Screen> from core/ui for screen wrappers
- Do not wire zustand or React Query without explicit instruction
- Do not fix toDateKey() UTC bug silently — flag it
- Do not revert mealType to hard-coded "snack"

---

## Notes

- For web-specific bugs (rendering, headers, SW, DB on web):
  run **/pre-pr** (use **deep mode** for the full SW transfer-size + `__dbReady` + per-tab checks — see pre-pr Phase 2) after fixing to verify in a live browser.
- For performance regressions: run /audit-performance after fixing.
- For pre-PR validation: run /pre-pr after all fixes are complete.
