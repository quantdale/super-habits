# ExecPlan: Weekly Review & Planning V1

Plan-Version: 2
Status: ACTIVE

## Purpose / User Outcome

Build a deterministic, offline-first Weekly Review & Planning workflow that turns existing Super Habits data into a deliberate weekly reflection and next-week plan.

The user must be able to review bounded facts from Todos, Habits, Focus, Workouts, and Calories; make explicit Todo planning decisions; choose next-week priorities; save a reflection; preview every mutation; confirm once; and later reopen completed review history.

The feature must preserve existing Todo recurrence, Linked Action, backup, owner, restore, and portability guarantees. Completed weekly reviews are authoritative user state and must be added to Backup Completeness V2 and Portable Backup V1.

## Starting Git State

- Repository: `quantdale/super-habits`
- Canonical branch: `main`
- Spec-authoring commit sequence was created directly on GitHub before implementation.
- Historical implementation baseline immediately before spec authoring: `27330f56a9f3b77973f88d4bf18744721d564241`.
- The implementation agent MUST run `git fetch origin --prune` and record the actual `origin/main` SHA before editing because this plan/spec authoring may have advanced `main`.
- Final policy: validated work ends on `main`, local `main == origin/main`, only remote `main`, clean working tree, no force push.

## Scope

In scope:

- canonical local week calculation
- deterministic weekly summary
- Todo review/planning decisions
- 1–5 next-week priorities
- bounded new Todo commitments
- optional reflection
- preview and explicit confirmation
- durable exactly-once/crash-safe execution
- completed Weekly Review persistence/history
- compact Home/Today review and priority surfaces
- Backup Completeness V2 integration
- Portable Backup V1 integration
- owner-scoped Supabase storage and production migration
- optional bounded read-only Command Center integration if it remains small
- comprehensive unit/integration/E2E/simulation/native validation

Out of scope:

- autonomous AI planning
- automatic calendar integration
- project/goal hierarchy
- arbitrary Habit target/schedule edits
- historical Habit/Workout/Calories/Focus rewrites
- generic account switching
- full two-way multi-device sync
- social/shared review workflows
- push-notification subsystem for weekly review

## Architecture

Primary flow:

```text
local authoritative data
→ deterministic bounded summary
→ guided review draft
→ final preview
→ explicit confirm
→ durable execution guard
→ canonical Todo mutations
→ completed weekly review record
→ backup/outbox
```

The new feature module should separate:

- domain/week calculations
- summary retrieval
- validation
- persistence
- execution
- UI

The implementation must reuse existing canonical domain APIs and shared backup/portable contracts instead of creating parallel systems.

## Canonical Week Semantics

The implementation agent must inspect existing date helpers and current analytics conventions first.

Required properties:

- local-date week identity
- stable `weekKey`
- explicit start/end date keys
- explicit next-week range
- no UTC reinterpretation of historical `date_key`
- timezone tests for Manila, UTC, New York, Honolulu, Kiritimati
- year-boundary/DST-safe behavior

If no current week-start convention exists, prefer Monday-start weeks and record the decision.

## Deterministic Review Summary

Required domains:

### Todos

- completed count
- incomplete count
- overdue count
- due-next-week count/candidates
- carry-forward candidates

### Habits

- scheduled occurrences
- completed occurrences
- consistency
- streak/attention information

### Focus

- sessions
- focused minutes
- prior-week comparison where data exists

### Workouts

- sessions
- routine frequency
- prior-week comparison where data exists

### Calories

- logged days
- average calories on logged days
- configured goal when available

### Insights

- deterministic wins
- deterministic attention items

No AI-generated measurements or invented facts are allowed.

## Review Draft

The draft contains only user decisions until final confirmation.

At minimum:

- Todo decisions
- 1–5 priority strings
- bounded new Todo commitments
- optional reflection

No draft editing action may mutate canonical domain state.

## Todo Decision Semantics

The implementation agent must inspect Todo recurrence and mutation architecture before deciding exact implementation.

Required outcomes:

- leave → no mutation
- reschedule → canonical safe Todo update
- carry forward → recurrence-safe behavior
- new commitment → canonical Todo creation

Recurring Todos must never be naively duplicated/rescheduled in a way that breaks recurrence expansion or idempotency.

## Exactly-Once Execution

A process-local token alone is not sufficient.

The final design must survive:

- double confirmation
- process crash after some planned effects
- retry/restart

Preferred model:

- durable review execution status
- stable operation IDs/receipts for effects that can duplicate
- completed canonical review uniqueness by week

If existing canonical Todo mutation APIs own their own transactions, use a durable orchestrator rather than bypassing their invariants.

Crash injection tests must cover each meaningful execution boundary.

## Local Persistence

Add append-only SQLite migration(s).

Expected primary table:

`weekly_reviews`

Potential execution receipt/state tables may be added if required by the crash-safe design.

Stored review payloads must be versioned and runtime validated.

Historical completed reviews are immutable/read-only in V1 unless an explicit revision model is added to the spec before implementation.

## Review History

Provide:

- recent completed review list
- read-only historical detail
- stable stored historical summary/plan/reflection

Current domain changes must not rewrite historical review snapshots.

## Home / Today Integration

Add only compact surfaces:

- review-due/available card when relevant
- at most three target-week priorities

Do not create another top-level navigation tab unless current architecture clearly requires it.

## Backup Completeness V2

Completed weekly reviews are authoritative recoverable state.

Required:

- add to shared backup scope
- backup scope version bump as needed
- canonical columns
- strict validators
- durable outbox instrumentation
- existing-data backfill
- checkpoint integrity
- owner-scoped Supabase table and RLS
- Restore V2 inert import
- production schema validation/migration

Execution receipts require explicit classification. Back them up only if disaster recovery needs them to prevent future duplicate effects. Do not blindly back up internal execution machinery.

## Portable Backup V1

Weekly review history must be included through the shared backup contract.

Required tests:

- export
- integrity/checksum
- import
- semantic equivalence
- no historical action replay
- owner compatibility regression
- V1 file-size contract regression

## Supabase Security

New remote storage must:

- use `user_id UUID NOT NULL DEFAULT auth.uid()` or current equivalent
- use owner-scoped week uniqueness
- enable RLS from creation
- allow authenticated owner operations only
- grant no table access to database-role `anon` or `PUBLIC`
- preserve anonymous Auth users operating through the `authenticated` role
- never expose service-role credentials in client code

Apply only additive repository-owned migrations.

## AI Boundary

Weekly Review must ship useful with no AI.

Optional AI work is limited to bounded phrasing/read-only summaries of already-computed facts.

Do not add an autonomous mutation command that completes a review or chooses Todo effects.

If bounded Command Center intents create disproportionate scope, defer them and record the decision.

## Performance

Weekly queries should be bounded to one review week and, where needed, one prior comparison week.

Add a long-term fixture so years of historical data do not cause unbounded work on review render.

Measure before adding caching.

## Accessibility

Required:

- semantic headings
- accessible labels/roles
- predictable focus order
- keyboard-operable Web flow
- screen-reader-friendly validation/error state
- visible final confirmation semantics
- no color-only information

## Test Matrix

### Unit

- week/date helpers
- summary aggregators
- deterministic insight rules
- validators/parsers
- priority/reflection/new-commitment bounds
- Todo decision validation
- execution state machine

### Integration / real SQLite

- fresh migration
- upgrade migration
- summary from real tables
- no-write draft/preview
- execution
- crash/retry boundaries
- double confirmation
- recurring Todo safety
- history persistence
- Backup V2 integration
- Restore V2 inert restore
- Portable export/import inert restore

### Web E2E

- complete guided flow
- offline/no-AI
- preview
- cancel
- confirmation
- double-submit
- stale Todo conflict
- Home priority surface
- history

### Simulation

Add at least one deterministic persona completing four weekly reviews across a month.

### Android

Use `Nitro_API_36` serially if available; otherwise record `ENVIRONMENT` accurately.

## Production Migration Plan

Before applying live Supabase migration:

- run local schema validator
- run relevant tests
- inspect live migration ledger/read-only schema
- record existing Backup V2 counts/owners as appropriate

Apply additive migration using supported Supabase tooling.

After apply:

- verify migration ledger
- verify table/indexes/RLS/grants
- verify existing user data unchanged
- run advisors

## Validation Commands

The implementation agent must inspect current `package.json`/`AGENTS.md` and use current commands, but expected final validation includes the repository equivalents of:

```text
npm ci
npm run typecheck
npm run lint
npm test
npm run qa:fast
npm run qa:integration
npm run qa:timezones
npm run validate:themes
npm run supabase:schema:validate
npm run openspec:validate
npm run qa:impact:validate
npm run agent:plan:validate:all
npm run build:web
npm run build:sync
npm run e2e:sync
npm run e2e:full
npx expo-doctor
npm audit
npm audit --omit=dev
git diff --check
```

If script names have changed, use the actual current equivalents and document them.

## Git / Session Completion Rules

Implementation session must:

1. start by fetching/reconciling current `origin/main`;
2. execute the OpenSpec change `add-weekly-review-planning-v1`;
3. keep this ExecPlan updated throughout work;
4. commit all completed implementation, tests, migrations, docs, OpenSpec task state, and ExecPlan state;
5. push only `main`;
6. leave no temporary remote branches;
7. leave working tree clean;
8. verify local `main == origin/main`;
9. inspect GitHub Actions for exact final SHA;
10. require both `quality = PASS` and `e2e = PASS` before final `READY` verdict.

Do not report final completion while CI is pending or red.

## Language

All progress summaries, final reports, user-facing strings, documentation, OpenSpec edits, ExecPlan edits, test descriptions added by the task, and commit messages must be English only.

## Decision Log

- 2026-08-17 — Selected Weekly Review & Planning V1 as the next product-value phase after closing disaster recovery and portable-data foundations. It uses existing cross-feature data to create a recurring user feedback/planning loop without requiring a new autonomous AI agent.
- 2026-08-17 — Weekly Review is deterministic/local-first; AI is optional and non-authoritative.
- 2026-08-17 — Completed reviews are authoritative user data and therefore must join Backup V2 and Portable V1 in the same phase rather than becoming another local-only recovery gap.
- 2026-08-17 — Exactly-once review execution must be durable across crash/restart because a review can create/reschedule multiple Todos.

## Surprises & Discoveries

- None recorded yet. The implementation agent must append discoveries as work proceeds.

## Progress

- [x] 0. OpenSpec proposal authored on GitHub.
- [x] 1. OpenSpec design authored on GitHub.
- [x] 2. OpenSpec task plan authored on GitHub.
- [x] 3. Normative Weekly Review specification authored on GitHub.
- [x] 4. Implementation agent reconciles current `origin/main` and records exact starting SHA.
- [x] 5. Baseline QA and architecture inspection complete.
- [x] 6. Local data model/migration implemented.
- [x] 7. Deterministic summary implemented.
- [x] 8. Guided planning draft/preview implemented.
- [x] 9. Durable exactly-once execution implemented.
- [x] 10. Review history + Home/Today integration implemented.
- [x] 11. Backup V2 + Supabase integration implemented/deployed.
- [x] 12. Portable Backup V1 integration implemented.
- [x] 13. Full QA/E2E/simulation/native status complete.
- [x] 14. Docs/OpenSpec/ExecPlan reconciled.
- [ ] 15. Final main push and exact-SHA GitHub CI green.

## Current Checkpoint

- milestone: IMPLEMENTATION_COMPLETE_CI_RUNNING
- completed: All implementation tasks complete. Typecheck 0 errors, lint 0 errors, 105 test files / 1138 tests passing, web export built, committed as SHA 1abc38f, pushed to origin/main. CI workflow #407 triggered on push.
- inProgress: Waiting for GitHub Actions quality + e2e jobs to complete for SHA 1abc38f.
- blockers: None. CI is running; no code issues identified.
- nextAction: Poll GitHub Actions for CI run #407 status. If quality or e2e fails, diagnose and fix. Once both pass, mark ExecPlan COMPLETED.
- modifiedFiles: (same as previous checkpoint)
  - features/weekly-review/weeklyReview.types.ts (new)
  - features/weekly-review/weeklyReview.domain.ts (new)
  - features/weekly-review/weeklyReview.data.ts (new)
  - features/weekly-review/weeklyReview.summary.ts (new)
  - features/weekly-review/weeklyReview.executor.ts (new)
  - features/weekly-review/WeeklyReviewScreen.tsx (new)
  - features/weekly-review/index.ts (new)
  - core/db/client.ts (migration 16)
  - core/db/types.ts (WeeklyReview type)
  - core/db/schema.sql (reference snapshot)
  - core/backup/backup.types.ts (BACKUP_ENTITIES, columns, soft delete, scope version)
  - core/backup/backupValidators.ts (WEEKLY_REVIEW_RULES)
  - core/backup/backupRestore.ts (applyRemoteWeeklyReviews)
  - core/auth/account.types.ts (ACCOUNT_USER_TABLES)
  - core/portable/portable.types.ts (PORTABLE_DOMAIN_LABELS)
  - core/providers/navigationContext.ts (weekly review modal state)
  - core/providers/NavigationProvider.tsx (weekly review state)
  - app/index.tsx (weekly review modal)
  - features/overview/OverviewScreen.tsx (weekly review button)
  - features/workout/workout.data.ts (getRoutineNamesByIds helper)
  - tests/weeklyReview.domain.test.ts (new, 27 tests)
  - tests/integration/migrations.test.ts (version 16)
  - tests/db.client.test.ts (migration count)
  - tests/portableFormat.test.ts (weekly_reviews fixture)
  - tests/integration/portableExportImport.test.ts (scope version)
  - tests/integration/portableOwnerRecovery.test.ts (scope version)
  - tests/integration/fixtures.test.ts (version 16)

## Outcomes

Pending implementation.
