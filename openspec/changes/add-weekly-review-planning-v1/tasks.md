# Tasks: Weekly Review & Planning V1

## 0. Repository reconciliation and baseline

- [ ] 0.1 Fetch `origin/main`, inspect actual starting SHA, remote branches, worktrees, and working tree.
- [ ] 0.2 Read `AGENTS.md`, `.agent/PLANS.md`, working rules, project structure map, and all relevant completed OpenSpec/ExecPlans.
- [ ] 0.3 Run baseline typecheck, lint, unit/integration tests, OpenSpec validation, ExecPlan validation, web build, sync build, and `git diff --check`.
- [ ] 0.4 Record exact baseline and any pre-existing warnings/advisories in the ExecPlan.

## 1. Confirm week semantics and architecture

- [ ] 1.1 Inspect sanctioned local date helpers and existing analytics date semantics.
- [ ] 1.2 Choose and document the canonical week-start rule; prefer the existing product convention if one exists.
- [ ] 1.3 Implement a versioned `ReviewWeek` domain helper with local date keys and next-week boundaries.
- [ ] 1.4 Add timezone matrix tests covering Manila, UTC, New York, Honolulu, Kiritimati, year boundaries, and DST transitions.
- [ ] 1.5 Confirm all new user-facing copy and documentation are English only.

## 2. Local persistence and migration

- [ ] 2.1 Design the authoritative weekly review persistence model after inspecting existing database conventions.
- [ ] 2.2 Add the next append-only SQLite migration for `weekly_reviews` and any narrowly required execution-receipt tables.
- [ ] 2.3 Add constraints/indexes for deterministic week lookup and one canonical completed review per week.
- [ ] 2.4 Add versioned runtime parsers for stored summary/plan payloads.
- [ ] 2.5 Test fresh database migration, current-version upgrade, migration failure behavior, and restart persistence.

## 3. Deterministic weekly summary

- [ ] 3.1 Implement bounded Todo summary queries for completed, incomplete, overdue, due-next-week, and carry-forward candidates.
- [ ] 3.2 Implement Habit scheduled-occurrence, completed-occurrence, consistency, streak, and attention calculations using existing Habit semantics.
- [ ] 3.3 Implement Focus session/minute summary and immediate-prior-week comparison.
- [ ] 3.4 Implement Workout session/routine-frequency summary and immediate-prior-week comparison.
- [ ] 3.5 Implement Calorie logged-day, average-on-logged-days, and configured-goal comparison.
- [ ] 3.6 Implement deterministic win/attention templates backed only by computed facts.
- [ ] 3.7 Add real-SQLite tests proving summary equivalence with existing selectors.
- [ ] 3.8 Add long-history performance coverage showing queries remain bounded to relevant weeks.

## 4. Review draft and validation

- [ ] 4.1 Define typed review draft, Todo decision, priority, new commitment, and reflection models.
- [ ] 4.2 Bound priorities to 1–5 and define text-length validation.
- [ ] 4.3 Bound new Todo commitments to a reasonable V1 maximum.
- [ ] 4.4 Implement deterministic draft validation with no writes.
- [ ] 4.5 Re-fetch/revalidate referenced Todos immediately before preview and confirmation.
- [ ] 4.6 Detect deleted/completed/stale/concurrently changed Todo conflicts and fail safely.

## 5. Todo planning semantics

- [ ] 5.1 Inspect canonical Todo update/create/recurrence APIs before implementation.
- [ ] 5.2 Implement `leave` as no mutation.
- [ ] 5.3 Implement safe one-off Todo rescheduling through canonical Todo mutation APIs.
- [ ] 5.4 Define and implement carry-forward semantics without breaking recurring Todo expansion/idempotency.
- [ ] 5.5 Explicitly constrain or disable carry-forward actions that are unsafe for recurring Todo instances.
- [ ] 5.6 Implement new commitment creation through the canonical Todo creation path.
- [ ] 5.7 Add recurrence and Linked Action regression tests for every Todo planning action.

## 6. Preview and exactly-once execution

- [ ] 6.1 Implement a final review preview showing priorities, Todo before/after changes, new commitments, reflection, and expected side effects.
- [ ] 6.2 Prove no local mutation occurs during summary, editing, or preview.
- [ ] 6.3 Design a durable review execution receipt/state machine rather than relying only on an in-memory token.
- [ ] 6.4 Implement crash-safe operation IDs/receipts for mutations that could otherwise duplicate on retry.
- [ ] 6.5 Apply canonical Todo effects and persist the weekly review without duplicate execution.
- [ ] 6.6 Add crash injection after each execution boundary and prove retry/resume exactly once.
- [ ] 6.7 Add duplicate-confirm/double-tap tests.

## 7. Guided Weekly Review UI

- [ ] 7.1 Build a focused Weekly Review screen/flow using repository UI conventions.
- [ ] 7.2 Step 1: week summary.
- [ ] 7.3 Step 2: wins and attention items.
- [ ] 7.4 Step 3: unfinished Todo decisions.
- [ ] 7.5 Step 4: next-week priorities.
- [ ] 7.6 Step 5: optional new commitments/rescheduling details.
- [ ] 7.7 Step 6: optional reflection.
- [ ] 7.8 Step 7: final preview.
- [ ] 7.9 Step 8: explicit confirm/save and completion state.
- [ ] 7.10 Add accessible labels, headings, focus order, error announcements, and touch targets.
- [ ] 7.11 Ensure complete flow works with remote mode disabled and no AI.

## 8. Review history and Home integration

- [ ] 8.1 Implement recent weekly review history newest first.
- [ ] 8.2 Implement read-only historical review detail.
- [ ] 8.3 Add a compact Home/Today review-due/available card without permanently consuming large space.
- [ ] 8.4 Add current target-week priorities to Home/Today, showing at most three compact priorities.
- [ ] 8.5 Hide priority surface automatically outside its target week.
- [ ] 8.6 Add bounded late-review behavior if justified, with explicit reviewed-week labeling.

## 9. Backup Completeness V2 integration

- [ ] 9.1 Add `weekly_reviews` to the authoritative backup scope and bump backup scope version as required.
- [ ] 9.2 Add canonical backup columns and strict runtime validators.
- [ ] 9.3 Add an additive Supabase migration for owner-scoped `weekly_reviews` storage.
- [ ] 9.4 Add secure authenticated-only owner RLS and indexes/owner-scoped week uniqueness.
- [ ] 9.5 Extend schema validation so missing/permissive weekly review schema fails CI.
- [ ] 9.6 Instrument weekly review persistence through the durable owner-scoped outbox.
- [ ] 9.7 Extend existing-user Backup V2 backfill to include historical weekly reviews.
- [ ] 9.8 Include weekly reviews in manifest integrity metadata/checkpointing.
- [ ] 9.9 Extend Restore V2 fetch, validation, graph validation, and atomic import.
- [ ] 9.10 Prove Restore V2 imports historical reviews inertly and never replays Todo plan mutations.

## 10. Portable Backup V1 integration

- [ ] 10.1 Verify shared Backup V2 scope automatically includes `weekly_reviews` in portable export/import; refactor only if necessary.
- [ ] 10.2 Add portable checksum/integrity coverage for weekly reviews.
- [ ] 10.3 Add source→export→import tests preserving weekly review history and priorities.
- [ ] 10.4 Prove portable import never replays historical Todo plan effects.
- [ ] 10.5 Re-run owner compatibility and 100 MB size-contract regressions.

## 11. Optional Command Center integration

- [ ] 11.1 Evaluate bounded read-only Ask intents `weekly_review_summary` and `next_week_plan`.
- [ ] 11.2 Implement only if it fits cleanly without expanding the mutation scope.
- [ ] 11.3 Keep local deterministic retrieval authoritative and remote phrasing optional.
- [ ] 11.4 Do not add an autonomous `complete weekly review` mutation command in V1.
- [ ] 11.5 If deferred, record the decision explicitly; deferral does not block V1.

## 12. Production Supabase rollout

- [ ] 12.1 Inspect live migration ledger, relevant row counts, policies, grants, and advisors read-only.
- [ ] 12.2 Run local schema/OpenSpec/tests before production apply.
- [ ] 12.3 Apply the additive weekly-review Supabase migration using supported tooling.
- [ ] 12.4 Verify migration ledger, table schema, indexes, owner RLS, grants, and no changes to existing user rows.
- [ ] 12.5 Run security/performance advisors and classify findings accurately.

## 13. QA and simulations

- [ ] 13.1 Add unit tests for domain calculations, parsers, validators, and execution receipts.
- [ ] 13.2 Add real-SQLite integration tests for full review execution and crash/retry.
- [ ] 13.3 Add Web E2E for full guided flow, no-write preview, double submit, history, Home priorities, stale Todo conflict, and offline path.
- [ ] 13.4 Add deterministic simulation persona executing at least four weekly reviews across a month.
- [ ] 13.5 Re-run Todo recurrence, Linked Actions, Habits, Focus, Workout, Calories, Backup V2, Recoverable Account, Portable V1, and Command Center regression suites.
- [ ] 13.6 Run full repository QA commands required by `AGENTS.md` and current package scripts.
- [ ] 13.7 Run Android serialized validation on `Nitro_API_36` if available; otherwise record exact `ENVIRONMENT` blocker.

## 14. Documentation and completion

- [ ] 14.1 Update authoritative project/module documentation for Weekly Review behavior and persistence.
- [ ] 14.2 Keep all documentation, user-facing strings, progress output, and final report English only.
- [ ] 14.3 Complete the Weekly Review ExecPlan validation ledger and decision log.
- [ ] 14.4 Fetch/reconcile any new `origin/main` changes before final push.
- [ ] 14.5 Commit all completed work to `main`; do not leave documentation/plan state uncommitted.
- [ ] 14.6 Push only `main`, verify local `main == origin/main`, and verify only remote `main` remains.
- [ ] 14.7 Inspect GitHub Actions for the exact final SHA and require `quality = PASS` and `e2e = PASS`.
- [ ] 14.8 Fix any repository-caused final CI failures and repeat until final SHA is green.
- [ ] 14.9 Mark ExecPlan `COMPLETED` only when its schema, validation evidence, final Git state, and final CI evidence are valid.
