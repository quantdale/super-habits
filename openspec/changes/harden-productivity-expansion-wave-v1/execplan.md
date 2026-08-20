# ExecPlan: Productivity Expansion Wave V1 Hardening

Plan-Version: 2
Status: ACTIVE

## Purpose / User Outcome

Turn the completed implementation-only Productivity Expansion Wave V1 into production-grade Super Habits behavior through a dedicated correctness, durability, security, backup/portable, migration, and regression campaign.

Observable success is not merely that Projects, Goals, Daily Planning, Planning Hub, Quick Capture, Activity Timeline, and Progress Insights compile. The entire wave must preserve historical truth, remain owner-safe, survive device loss, remain portable across compatible releases, and finish on a fully green exact GitHub SHA.

## Context

- Repository: `quantdale/super-habits`.
- Audit-time `main`: `64a76f73b7ec30d732be5feb01ee46f93cf81b84`.
- Last independently verified pre-wave green product baseline: `6f18cce75459e21d11c29a2b82330a402336d9f4`.
- GitHub Actions run `32269563521` on `6f18cce...`: `quality` PASS, `e2e` PASS including main journeys, deterministic scenarios, and dist-sync.
- Productivity Expansion Wave V1 intentionally skipped broad QA and finished as `IMPLEMENTATION COMPLETE — HARDENING REQUIRED`.
- Current local SQLite schema is v17.
- Projects, Goals, and Daily Plans currently participate in local account emptiness/owner safety but intentionally do not yet participate in Supabase Backup/Restore/Portable.
- Cloud backup currently has `BACKUP_SCHEMA_VERSION = 2`, `BACKUP_SCOPE_VERSION = 3`, and includes Weekly Reviews but not Projects/Goals/Daily Plans.
- Portable envelope is currently format v1 and derives its exact entity set from the current Backup entity constant without its own explicit backup-scope field.

Authoritative artifacts:

- `openspec/changes/harden-productivity-expansion-wave-v1/proposal.md`
- `openspec/changes/harden-productivity-expansion-wave-v1/design.md`
- `openspec/changes/harden-productivity-expansion-wave-v1/specs/productivity-expansion-hardening/spec.md`
- `openspec/changes/harden-productivity-expansion-wave-v1/tasks.md`
- this ExecPlan

Historical implementation artifacts to read but not mutate dishonestly:

- `openspec/changes/add-productivity-expansion-wave-v1/`
- Backup Completeness V2 + closure artifacts
- Portable Data Export & Import V1 + closure artifacts
- Recoverable Account V1 + closure artifacts
- Weekly Review & Planning V1 artifacts
- account-recovery dist-sync closure artifacts

## Audited Defects That Must Be Reproduced

1. Opening Today planning creates a row through create-on-read and can promote a pristine provisional owner.
2. `daily_plans.date_key` has global uniqueness despite soft-delete semantics, preventing delete/recreate for one date.
3. Progress timestamp windows preserve current clock time and use fixed 24-hour arithmetic rather than true local-midnight calendar boundaries.
4. Progress infers focus-session count from total minutes instead of counting focus rows.
5. Completed task history uses mutable `updated_at`, so later edits can move completion into another period.
6. Calorie Timeline fabricates noon UTC from a local date key and can shift the displayed day in UTC+14.
7. Project/Goal/Daily Plan completion history uses mutable `updated_at`.
8. Project/Goal target-date validation accepts impossible calendar dates because it checks only string shape.
9. Project/Goal/item association setters accept dangling/contradictory references and parent soft-delete does not reconcile children.
10. Daily Plan priority controls identify selected records by title in UI paths and lack a durable historical title snapshot.
11. Backup/Portable scope evolution lacks an explicit prospective compatibility design; blindly expanding current entity constants risks invalidating historical files/manifests.

## Scope

1. Full baseline QA and inherited-failure classification.
2. Local schema/migration repair.
3. Read-only Planning Hub behavior on pristine devices.
4. Stable completion timestamps/history.
5. Real calendar/date and timezone correctness.
6. Referentially coherent Project/Goal/item relationships.
7. Daily Plan stable priority identity/history.
8. Correct Activity Timeline and Progress calculations.
9. Owner-scoped Supabase schema/RLS for planning data.
10. Durable outbox/backfill for Projects/Goals/DailyPlans.
11. Backup manifest scope/version evolution with historical compatibility.
12. Portable format/scope evolution with historical V1 compatibility.
13. Restore/Portable semantic equivalence.
14. Quick Capture/UI/accessibility/performance hardening.
15. Full unit/integration/timezone/E2E/dist-sync/simulation/native-as-available regression.
16. Live Supabase migration/advisors/owner isolation when safe and authorized.
17. Exact-final-SHA GitHub `quality` + `e2e` closure.

## Non-Goals

- No new broad product feature wave.
- No AI planner or autonomous planning mutation.
- No collaboration/sharing.
- No calendar integration.
- No seventh top-level tab.
- No generalized multi-master synchronization.
- No account merge or weakened owner recovery.
- No weakening RLS, restore validation, portable integrity, or fail-closed behavior to make tests pass.
- No force push or persistent temporary remote branches.

## Current Checkpoint

- Current milestone: HARDENING_HANDOFF_READY
- Completed: Independent GitHub audit of the implementation-wave head and targeted source audit of local mutation, Project/Goal/Daily Plan persistence, Progress, Timeline, task completion, Backup, Portable, account inventory, and migration v17. Audited defects H1-H11 are recorded in proposal/design/spec/tasks. Full hardening OpenSpec package authored for a fresh implementation session.
- In progress: Repository handoff publication and fresh-session execution have not started yet.
- Important modified files: `openspec/changes/harden-productivity-expansion-wave-v1/proposal.md`, `design.md`, `tasks.md`, `specs/productivity-expansion-hardening/spec.md`, `execplan.md`, `README.md`, `IMPLEMENTATION_PROMPT.md`.
- Last successful validation: Pre-wave baseline GitHub run `32269563521` at `6f18cce...` had quality/e2e green. Implementation wave reported only typecheck/lint/OpenSpec/plan/diff-check minimal gates at `64a76f7...`; broad post-wave QA has NOT yet been independently established and is an explicit first task of this hardening campaign.
- Current failures: None yet classified by a fresh full baseline run. Source audit has identified correctness defects that require focused reproduction tests.
- Relevant quarantines: None accepted for this campaign. Existing repository skips/quarantines must be reviewed if they intersect changed behavior; no new skip/fixme/quarantine may replace a real fix.
- Blockers: None known for repository hardening. Android/iOS runtime or live Supabase credentials may be environment-dependent and must be classified only after attempted discovery.
- Condition required to unblock: None for local hardening work.
- Exact resume action after unblock: Not applicable at handoff.
- Exact next action: Fresh session fetches/prunes latest `origin/main`, reads all authoritative artifacts, validates OpenSpec/ExecPlan, runs the full baseline QA stack, then writes focused failing tests for H1 (read-only planner owner safety) and H2 (Daily Plan soft-delete/recreate) before implementing fixes.
- Remaining definition of done: Every task in `tasks.md` reconciled to evidence; audited defects fixed; new planning state fully owner-scoped/recoverable/portable with historical compatibility; live migration verified if safe/authorized; full QA green; clean main-only Git state; exact final pushed SHA GitHub `quality` and `e2e` PASS.

## Progress

- [x] 0. Implementation-only wave audited independently at GitHub `main`.
- [x] 1. Concrete correctness and durability defects identified from source.
- [x] 2. Backup/Portable compatibility risk identified and given explicit prospective-version design.
- [x] 3. Hardening proposal/design/spec/tasks/ExecPlan authored.
- [ ] 4. Fresh execution session reconciles latest main and validates handoff.
- [ ] 5. Full baseline QA executed and inherited failures classified.
- [ ] 6. Audited defects reproduced with focused tests.
- [ ] 7. Local migrations and semantic fixes implemented.
- [ ] 8. Project/Goal/Daily Plan references/completion/history hardened.
- [ ] 9. Progress and Activity Timeline corrected/timezone-tested.
- [ ] 10. Supabase owner schema/RLS implemented and validated.
- [ ] 11. Durable planning outbox/backfill integrated.
- [ ] 12. Backup/Restore scope/version compatibility implemented.
- [ ] 13. Portable prospective version + historical V1 compatibility implemented.
- [ ] 14. Current source→cloud/portable→fresh semantic equivalence green.
- [ ] 15. Planning Hub/Quick Capture full E2E green.
- [ ] 16. Full repository regression + simulation green.
- [ ] 17. Native status established and runtime QA executed when environment exists.
- [ ] 18. Live Supabase migration/isolation/advisors verified when safe/authorized.
- [ ] 19. Documentation and historical implementation-wave hardening handoff reconciled.
- [ ] 20. Final clean main pushed and exact-SHA GitHub quality/e2e green.

## Surprises & Discoveries

- The implementation-wave decision to use `runLocalMutation` correctly avoided dangling outbox records before the remote schema existed, but create-on-read Daily Planning turns that same primitive into an account-state mutation simply by viewing Today.
- A table-level UNIQUE constraint conflicts with the product's own soft-delete lifecycle. Partial unique indexes must express active-row uniqueness where recreation is supported.
- Compile-safe derived analytics can still be semantically false: focus session count was inferred from minutes and completion events from mutable edit timestamps.
- Date-key domains must not be converted through fabricated UTC timestamps; doing so can change authoritative local dates.
- Backup scope already evolved when Weekly Reviews were added without a separate portable scope field, so this hardening must preserve known old portable files instead of compounding the compatibility problem.

Add discoveries only when repository/test/live evidence changes the implementation approach.

## Decision Log

- 2026-08-20 — Perform a dedicated hardening campaign before any further feature expansion, as explicitly requested after the overnight implementation wave.
- 2026-08-20 — Treat read-only Planning Hub use as non-authoritative; no create-on-read persistence.
- 2026-08-20 — Prefer stable completion timestamps for mutable entities used in historical metrics.
- 2026-08-20 — Enforce owner-scoped Project/Goal references remotely; do not rely on globally unique IDs alone for relationship security.
- 2026-08-20 — Introduce explicit prospective backup-scope semantics and a new portable format if needed; preserve known historical contracts explicitly.
- 2026-08-20 — Do not accept permissive "missing entity means empty" compatibility.
- 2026-08-20 — Projects/Goals/DailyPlans cease being intentionally local-only by the end of hardening.
- 2026-08-20 — Full QA and exact-final-SHA GitHub CI are completion gates; minimal implementation-wave checks are insufficient.

## Validation Ledger

Authoring/audit evidence:

- GitHub `main` at hardening authoring: `64a76f73b7ec30d732be5feb01ee46f93cf81b84`.
- Pre-wave accepted run: `32269563521` on `6f18cce75459e21d11c29a2b82330a402336d9f4`, `quality` PASS + `e2e` PASS.
- Source audit: `core/db/localMutation.ts` promotes owner after local planning mutation.
- Source audit: `DailyPlanView` mount refresh calls `getOrCreateDailyPlan`; the data method inserts through `runLocalMutation` when absent.
- Source audit: migration 17 uses table-level `UNIQUE` on Daily Plan date plus soft delete.
- Source audit: Progress estimates focus-session count from focus minutes.
- Source audit: Progress/task Timeline use mutable `updated_at` as completion fact.
- Source audit: Progress local-day bounds preserve clock time and use fixed 24-hour arithmetic.
- Source audit: calorie Timeline converts authoritative local `consumed_on` to fabricated noon UTC before deriving local date.
- Source audit: Project/Goal setters do not validate referenced parents or reconcile soft-delete/move children.
- Source audit: Daily Plan UI removes selected priority records by title lookup.
- Source audit: Backup entity scope currently excludes Projects/Goals/DailyPlans while account local-data scope includes them.
- Source audit: Portable V1 exact entity validation depends on current `BACKUP_ENTITIES` and lacks an explicit backup scope field.

Fresh-session validation and all implementation/live evidence must be appended here as it runs. Do not invent results.

## Changed Files / Areas

- `openspec/changes/harden-productivity-expansion-wave-v1/proposal.md` — hardening scope and audited defects.
- `openspec/changes/harden-productivity-expansion-wave-v1/design.md` — target architecture and invariants.
- `openspec/changes/harden-productivity-expansion-wave-v1/specs/productivity-expansion-hardening/spec.md` — normative hardening requirements.
- `openspec/changes/harden-productivity-expansion-wave-v1/tasks.md` — executable checklist.
- `openspec/changes/harden-productivity-expansion-wave-v1/execplan.md` — durable plan for this campaign.
- `core/db/client.ts` — local schema and append-only migrations.
- `core/db/types.ts` — entity shapes for planning and completion fields.
- `core/db/localMutation.ts` — owner promotion helper.
- `features/planning/` — Planning Hub views and domain logic (to be hardened).
- `features/progress/` and `features/overview/` — progress and timeline derived views.
- `core/backup/` and `core/portable/` — backup/restore/portable scope and manifest compatibility.
- `core/sync/` — durable outbox and Supabase adapter.
- `supabase/migrations/` — owner-scoped remote schema.

Git remains authoritative for the actual working-tree diff.

## Recovery / Resume Instructions

1. Fetch/prune and reconcile latest `origin/main` without discarding legitimate work.
2. Read `AGENTS.md` and `.agent/PLANS.md`.
3. Read this entire hardening OpenSpec change.
4. Read the completed implementation-wave change and durable Backup/Portable/Account/Weekly Review plans referenced above.
5. Run OpenSpec/ExecPlan validators.
6. Run the full baseline QA stack and record exact inherited failures.
7. Continue from `Exact next action` in Current Checkpoint.
8. Keep this plan and `tasks.md` synchronized at major milestones.
9. Fix defects rather than merely reporting them.
10. If one external live/native gate is unavailable, continue all independent repository work and record an honest environment limitation.

## Outcomes & Retrospective

Not yet complete. Populate only with verified final implementation, migration, QA, GitHub CI, and genuine external limitations.
