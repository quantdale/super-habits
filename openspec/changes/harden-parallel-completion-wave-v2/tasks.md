# Tasks — Harden Massive Parallel Completion Wave V2

Keep this checklist synchronized with `execplan.md`. Do not check items without evidence.

## 0. Reconcile and preserve
- [ ] 0.1 Fetch/prune latest origin/main; confirm actual starting SHA and main-only remote.
- [ ] 0.2 Read prior wave `HARDENING_HANDOFF.md`, this change, AGENTS.md, `.agent/PLANS.md`, QA docs.
- [ ] 0.3 Run `npm run agent:plans` and reconcile any active historical plans without falsely closing environment gaps.
- [ ] 0.4 Confirm actual SQLite migration head; do not trust the prior wave's stale v15 statement.
- [ ] 0.5 Grep for conflict markers across tracked files.
- [ ] 0.6 Inspect all reported lint-staged backup stashes; retain any unique legitimate work, otherwise drop deliberately.
- [ ] 0.7 Implement/document a serialization-safe parallel commit workflow for future shared-tree swarms.

## 1. Baseline hardening evidence
- [ ] 1.1 Run typecheck and lint.
- [ ] 1.2 Run full Vitest baseline once and record failures before fixes.
- [ ] 1.3 Run targeted browser smoke for current wave surfaces before migration work.
- [ ] 1.4 Classify every failure as product bug, test bug, flaky, environment, known gap, or spec ambiguity.

## 2. Habit lifecycle durability
- [ ] 2.1 Define authoritative active/paused/archived semantics and pause-history behavior.
- [ ] 2.2 Add durable local representation using the next free migration (expected >=20).
- [ ] 2.3 Idempotently migrate legacy paused/archive AsyncStorage state.
- [ ] 2.4 Update habit data APIs so lifecycle writes use canonical synced/backup mutations.
- [ ] 2.5 Ensure archived/paused state is reflected consistently in Habits, Overview, Planning, Progress, Command, and reminders.
- [ ] 2.6 Prove pausing/resuming does not create false missed streak/schedule history.
- [ ] 2.7 Preserve historical completions and deleted-vs-archived distinction.

## 3. Pomodoro session metadata durability
- [ ] 3.1 Move session note and Todo association from AsyncStorage to authoritative session persistence.
- [ ] 3.2 Preserve a stable display snapshot where needed if linked Todo text later changes/deletes.
- [ ] 3.3 Idempotently migrate matching legacy AsyncStorage session metadata.
- [ ] 3.4 Update session history/stats/UI to read authoritative metadata.
- [ ] 3.5 Prove no fabricated session, cross-owner association, or data loss on restore.

## 4. Workout metric provenance
- [ ] 4.1 Audit PR, volume, rest, and duration code against actual captured data.
- [ ] 4.2 Choose the correct load/repetition model (exercise-level or per-set) based on current UX/domain needs.
- [ ] 4.3 Add durable schema fields only with real capture paths.
- [ ] 4.4 Capture real workout duration instead of default/fabricated values.
- [ ] 4.5 Old history distinguishes unknown legacy load from real zero.
- [ ] 4.6 PR detection and weighted volume display only when supported by meaningful inputs.
- [ ] 4.7 Add real-SQLite integration tests for workout history/PR/volume paths.

## 5. Backup / Restore / Portable evolution
- [ ] 5.1 Classify every new durable field against Backup Scope V4 and current Portable V2.
- [ ] 5.2 Bump backup scope/version if canonical recoverable columns change; preserve known historical scopes.
- [ ] 5.3 Bump Portable format only if required by canonical data evolution; preserve V1/V2 imports.
- [ ] 5.4 Update canonical columns, validators, checksums, restore ordering, manifest metadata, and mocks consistently.
- [ ] 5.5 Add corruption/version-mismatch/old-format compatibility coverage.
- [ ] 5.6 Verify no historical backup silently gains a new checksum meaning.

## 6. Recoverable settings
- [ ] 6.1 Review calorie targets, Pomodoro presets, workout rest default, notification prefs, Overview layout, command history.
- [ ] 6.2 Put recoverable user settings into the existing allowlist/settings-version architecture as appropriate.
- [ ] 6.3 Keep command history local by default unless an explicit privacy/product decision says otherwise.
- [ ] 6.4 Verify restore/import does not apply settings before data validation succeeds.

## 7. Supabase schema convergence
- [ ] 7.1 Create additive Supabase migration(s) matching approved new durable columns.
- [ ] 7.2 Preserve owner RLS, owner-safe relationships, grants, and all existing rows.
- [ ] 7.3 Extend `scripts/validate-supabase-schema.mjs` and simulation fixture.
- [ ] 7.4 Add negative validator coverage for unsafe/missing variants.
- [ ] 7.5 Add covering indexes for newly/currently relevant composite FKs when justified by advisor/query evidence; avoid redundant index churn.
- [ ] 7.6 Run remote-boundary mocks against the evolved contract.

## 8. Command Center remote parity
- [ ] 8.1 Update `parse-ai-command` source for planning create intents.
- [ ] 8.2 Update ask classification for project/goal/today-focus queries.
- [ ] 8.3 Preserve parse -> review -> explicit confirm -> canonical executor.
- [ ] 8.4 Add source-level parser/classifier contract tests.
- [ ] 8.5 Deploy Edge Function if live access is available and verify real remote mode against safe test inputs.

## 9. Notification actions
- [ ] 9.1 Wire Todo mark-done action through `notificationResponseDispatcher` and canonical Todo mutation.
- [ ] 9.2 Wire snooze with bounded delay and correct pending-notification replacement/cancellation.
- [ ] 9.3 Use processed-action dedupe for duplicate OS responses.
- [ ] 9.4 Handle missing/deleted/already-completed Todo safely.
- [ ] 9.5 Add mocks/tests for permission denial, unsupported platform, scheduling/cancellation, and duplicate responses.
- [ ] 9.6 Run native reminder journey if a native environment exists.

## 10. Multi-record correctness
- [ ] 10.1 Make Todo bulk operations atomic or return explicit structured per-item outcomes with deterministic retry semantics.
- [ ] 10.2 Make Calories copy-day duplicate-safe and failure-safe.
- [ ] 10.3 Make Weekly Review next-week apply idempotent and duplicate-safe.
- [ ] 10.4 Audit Daily Plan carry-forward/batch writes for the same guarantees.
- [ ] 10.5 Add failure-injection integration tests for each multi-record path.

## 11. Cross-feature consistency
- [ ] 11.1 Real-SQLite Project/Goal rollup tests.
- [ ] 11.2 Paused/archived habits excluded from current actionable aggregates without erasing history.
- [ ] 11.3 Focus stats/history use durable association/note state.
- [ ] 11.4 Workout metrics handle legacy unknowns honestly.
- [ ] 11.5 Activity/Progress local-calendar boundaries pass timezone matrix.
- [ ] 11.6 Overview cards and Planning Hub render coherent empty/loading/error states.

## 12. PWA/browser hardening
- [ ] 12.1 Test offline/online indicator in a real browser.
- [ ] 12.2 Test waiting-worker update banner and apply-update lifecycle.
- [ ] 12.3 Prove no reload loop and ignored updates are eventually surfaced again.
- [ ] 12.4 Exercise Calories day navigation/copy/targets/trends in Playwright.
- [ ] 12.5 Exercise Todos filters/bulk, Habits lifecycle, Overview customization, Planning continuity, Pomodoro presets/notes, Workout history/PR surfaces.

## 13. Full regression
- [ ] 13.1 `npm run typecheck` PASS.
- [ ] 13.2 `npm run lint` PASS under repository warning policy.
- [ ] 13.3 Full Vitest suite PASS.
- [ ] 13.4 Timezone matrix PASS.
- [ ] 13.5 `npm run openspec:validate` PASS.
- [ ] 13.6 `npm run agent:plan:validate:all` PASS.
- [ ] 13.7 `npm run supabase:schema:validate` PASS when applicable.
- [ ] 13.8 Full main Playwright E2E PASS.
- [ ] 13.9 dist-sync / remote-boundary E2E PASS.
- [ ] 13.10 deterministic simulation library PASS.
- [ ] 13.11 Native Android/iOS validation PASS if environment available; otherwise record ENVIRONMENT precisely.

## 14. Live verification
- [ ] 14.1 Snapshot live Supabase ledger/schema/row counts before apply.
- [ ] 14.2 Apply reviewed pending migrations in order if access is available.
- [ ] 14.3 Verify rows/owners/RLS/grants/indexes/remote payloads after apply.
- [ ] 14.4 Deploy parser Edge Function if changed and verify deployed behavior.
- [ ] 14.5 Run Supabase security/performance advisors and classify findings.

## 15. Final closure
- [ ] 15.1 Reconcile prior wave hardening handoff against actual fixes/deferred items.
- [ ] 15.2 Reconcile this plan/tasks to evidence; no false passes.
- [ ] 15.3 All accepted work committed to main; working tree clean.
- [ ] 15.4 Local main == origin/main; remote branches main only.
- [ ] 15.5 Exact final pushed SHA has GitHub Actions `quality` PASS.
- [ ] 15.6 Exact final pushed SHA has GitHub Actions `e2e` PASS.
- [ ] 15.7 Mark ExecPlan COMPLETED only after all non-environment definition-of-done items are satisfied.
