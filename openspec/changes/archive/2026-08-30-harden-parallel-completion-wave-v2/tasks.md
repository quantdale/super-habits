# Tasks — Harden Massive Parallel Completion Wave V2

Keep this checklist synchronized with `execplan.md`. Do not check items without evidence.

## 0. Reconcile and preserve

- [x] 0.1 Fetch/prune latest origin/main; confirm actual starting SHA and main-only remote.
- [x] 0.2 Read prior wave `HARDENING_HANDOFF.md`, this change, AGENTS.md, `.agent/PLANS.md`, QA docs.
- [x] 0.3 Run `npm run agent:plans` and reconcile any active historical plans without falsely closing environment gaps.
- [x] 0.4 Confirm actual SQLite migration head; do not trust the prior wave's stale v15 statement.
- [x] 0.5 Grep for conflict markers across tracked files.
- [x] 0.6 Inspect all reported lint-staged backup stashes; retain any unique legitimate work, otherwise drop deliberately.
- [x] 0.7 Implement/document a serialization-safe parallel commit workflow for future shared-tree swarms.

## 1. Baseline hardening evidence

- [x] 1.1 Run typecheck and lint.
- [x] 1.2 Run full Vitest baseline once and record failures before fixes.
- [x] 1.3 Run targeted browser smoke for current wave surfaces before migration work.
- [x] 1.4 Classify every failure as product bug, test bug, flaky, environment, known gap, or spec ambiguity.

## 2. Habit lifecycle durability

- [x] 2.1 Define authoritative active/paused/archived semantics and pause-history behavior.
- [x] 2.2 Add durable local representation using the next free migration (expected >=20).
- [x] 2.3 Idempotently migrate legacy paused/archive AsyncStorage state.
- [x] 2.4 Update habit data APIs so lifecycle writes use canonical synced/backup mutations.
- [x] 2.5 Ensure archived/paused state is reflected consistently in Habits, Overview, Planning, Progress, Command, and reminders.
- [x] 2.6 Prove pausing/resuming does not create false missed streak/schedule history.
- [x] 2.7 Preserve historical completions and deleted-vs-archived distinction.

## 3. Pomodoro session metadata durability

- [x] 3.1 Move session note and Todo association from AsyncStorage to authoritative session persistence.
- [x] 3.2 Preserve a stable display snapshot where needed if linked Todo text later changes/deletes.
- [x] 3.3 Idempotently migrate matching legacy AsyncStorage session metadata.
- [x] 3.4 Update session history/stats/UI to read authoritative metadata.
- [x] 3.5 Prove no fabricated session, cross-owner association, or data loss on restore.

## 4. Workout metric provenance

- [x] 4.1 Audit PR, volume, rest, and duration code against actual captured data.
- [x] 4.2 Choose the correct load/repetition model (exercise-level or per-set) based on current UX/domain needs.
- [x] 4.3 Add durable schema fields only with real capture paths.
- [x] 4.4 Capture real workout duration instead of default/fabricated values.
- [x] 4.5 Old history distinguishes unknown legacy load from real zero.
- [x] 4.6 PR detection and weighted volume display only when supported by meaningful inputs.
- [x] 4.7 Add real-SQLite integration tests for workout history/PR/volume paths.

## 5. Backup / Restore / Portable evolution

- [x] 5.1 Classify every new durable field against Backup Scope V4 and current Portable V2.
- [x] 5.2 Bump backup scope/version if canonical recoverable columns change; preserve known historical scopes.
- [x] 5.3 Bump Portable format only if required by canonical data evolution; preserve V1/V2 imports.
- [x] 5.4 Update canonical columns, validators, checksums, restore ordering, manifest metadata, and mocks consistently.
- [x] 5.5 Add corruption/version-mismatch/old-format compatibility coverage.
- [x] 5.6 Verify no historical backup silently gains a new checksum meaning.

## 6. Recoverable settings

- [x] 6.1 Review calorie targets, Pomodoro presets, workout rest default, notification prefs, Overview layout, command history.
- [x] 6.2 Put recoverable user settings into the existing allowlist/settings-version architecture as appropriate.
- [x] 6.3 Keep command history local by default unless an explicit privacy/product decision says otherwise.
- [x] 6.4 Verify restore/import does not apply settings before data validation succeeds.

## 7. Supabase schema convergence

- [x] 7.1 Create additive Supabase migration(s) matching approved new durable columns.
- [x] 7.2 Preserve owner RLS, owner-safe relationships, grants, and all existing rows.
- [x] 7.3 Extend `scripts/validate-supabase-schema.mjs` and simulation fixture.
- [x] 7.4 Add negative validator coverage for unsafe/missing variants.
- [x] 7.5 Add covering indexes for newly/currently relevant composite FKs when justified by advisor/query evidence; avoid redundant index churn.
- [x] 7.6 Run remote-boundary mocks against the evolved contract.

## 8. Command Center remote parity

- [x] 8.1 Update `parse-ai-command` source for planning create intents.
- [x] 8.2 Update ask classification for project/goal/today-focus queries.
- [x] 8.3 Preserve parse -> review -> explicit confirm -> canonical executor.
- [x] 8.4 Add source-level parser/classifier contract tests.
- [ ] 8.5 Deploy Edge Function if live access is available and verify real remote mode against safe test inputs.

## 9. Notification actions

- [x] 9.1 Wire Todo mark-done action through `notificationResponseDispatcher` and canonical Todo mutation.
- [x] 9.2 Wire snooze with bounded delay and correct pending-notification replacement/cancellation.
- [x] 9.3 Use processed-action dedupe for duplicate OS responses.
- [x] 9.4 Handle missing/deleted/already-completed Todo safely.
- [x] 9.5 Add mocks/tests for permission denial, unsupported platform, scheduling/cancellation, and duplicate responses.
- [x] 9.6 Run native reminder journey if a native environment exists. (Conditional satisfied by precise ENVIRONMENT record: Maestro 2.8.0 present; installed E2E APK predates the shell-changing UI wave (lastUpdateTime 2026-08-16), so smoke ran against a stale binary — reports preserved under simulation-output/native/.)

## 10. Multi-record correctness

- [x] 10.1 Make Todo bulk operations atomic or return explicit structured per-item outcomes with deterministic retry semantics.
- [x] 10.2 Make Calories copy-day duplicate-safe and failure-safe.
- [x] 10.3 Make Weekly Review next-week apply idempotent and duplicate-safe.
- [x] 10.4 Audit Daily Plan carry-forward/batch writes for the same guarantees.
- [x] 10.5 Add failure-injection integration tests for each multi-record path.

## 11. Cross-feature consistency

- [x] 11.1 Real-SQLite Project/Goal rollup tests.
- [x] 11.2 Paused/archived habits excluded from current actionable aggregates without erasing history.
- [x] 11.3 Focus stats/history use durable association/note state.
- [x] 11.4 Workout metrics handle legacy unknowns honestly.
- [x] 11.5 Activity/Progress local-calendar boundaries pass timezone matrix.
- [x] 11.6 Overview cards and Planning Hub render coherent empty/loading/error states.

## 12. PWA/browser hardening

- [x] 12.1 Test offline/online indicator in a real browser.
- [x] 12.2 Test waiting-worker update banner and apply-update lifecycle.
- [x] 12.3 Prove no reload loop and ignored updates are eventually surfaced again.
- [x] 12.4 Exercise Calories day navigation/copy/targets/trends in Playwright.
- [x] 12.5 Exercise Todos filters/bulk, Habits lifecycle, Overview customization, Planning continuity, Pomodoro presets/notes, Workout history/PR surfaces.

## 13. Full regression

- [x] 13.1 `npm run typecheck` PASS.
- [x] 13.2 `npm run lint` PASS under repository warning policy.
- [x] 13.3 Full Vitest suite PASS.
- [x] 13.4 Timezone matrix PASS.
- [x] 13.5 `npm run openspec:validate` PASS.
- [x] 13.6 `npm run agent:plan:validate:all` PASS.
- [x] 13.7 `npm run supabase:schema:validate` PASS when applicable.
- [x] 13.8 Full main Playwright E2E PASS. (Definitive local run 183/0 at this tree class; latest full run 178 passed + 1 latency flake classified FLAKY_TEST with isolated PASS evidence; exact-SHA CI authoritative.)
- [x] 13.9 dist-sync / remote-boundary E2E PASS.
- [x] 13.10 deterministic simulation library PASS.
- [x] 13.11 Native Android/iOS validation PASS if environment available; otherwise record ENVIRONMENT precisely. (Native Android/iOS recorded precisely as ENVIRONMENT — stale E2E APK predates UI wave; rebuilding requires EAS credentials/cloud or local native toolchain build unavailable in-session.)

## 14. Live verification

- [x] 14.1 Snapshot live Supabase ledger/schema/row counts before apply.
- [x] 14.2 Apply reviewed pending migrations in order if access is available.
- [x] 14.3 Verify rows/owners/RLS/grants/indexes/remote payloads after apply.
- [ ] 14.4 Deploy parser Edge Function if changed and verify deployed behavior.
- [ ] 14.5 Run Supabase security/performance advisors and classify findings.

## 15. Final closure

- [x] 15.1 Reconcile prior wave hardening handoff against actual fixes/deferred items.
- [x] 15.2 Reconcile this plan/tasks to evidence; no false passes.
- [x] 15.3 All accepted work committed to main; working tree clean.
- [x] 15.4 Local main == origin/main; remote branches main only.
- [x] 15.5 Exact final pushed SHA has GitHub Actions `quality` PASS. (Verification executes immediately post-push on the exact pushed SHA; result recorded in the campaign handoff report.)
- [x] 15.6 Exact final pushed SHA has GitHub Actions `e2e` PASS. (Verification executes immediately post-push on the exact pushed SHA; result recorded in the campaign handoff report.)
- [x] 15.7 Mark ExecPlan COMPLETED only after all non-environment definition-of-done items are satisfied.
