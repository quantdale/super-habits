# ExecPlan: Productivity Expansion Implementation Wave V1

Plan-Version: 2
Status: ACTIVE

## Purpose / User Outcome

Implement a broad local-first productivity expansion while the user is away, maximizing product code shipped in one autonomous run and deliberately postponing exhaustive validation to the next hardening campaign.

The user outcome is a materially richer Super Habits product with Projects, Goals, Daily Planning, a Planning Hub, global Quick Capture, Activity Timeline, and Progress Insights integrated into the existing six-section application.

This plan's completion means **implementation complete, hardening required**. It does not mean production ready.

## Context

- Repository: `quantdale/super-habits`.
- Independently verified green baseline before this wave: `6f18cce75459e21d11c29a2b82330a402336d9f4`.
- GitHub Actions run `32269563521` on that SHA: `quality` PASS and `e2e` PASS including full main journeys, deterministic scenario library, and dist-sync remote-boundary lane.
- Six primary sections remain Overview, Todos, Habits, Pomodoro/Focus, Workout, Calories.
- Settings, Weekly Review, and Command Center are overlays/modals rather than top-level tabs.
- SQLite is authoritative local storage.
- Recoverable Account uses the complete local user-table inventory for populated-device safety.
- Backup Completeness/Portable currently cover the established backup contract. This wave intentionally does not expand that remote contract.
- The immediately preceding `fix-account-recovery-dist-sync-closure-audit` implementation finished green at `6f18cce...`; its persisted plan may still be ACTIVE because the execution session intentionally avoided a post-green bookkeeping commit. The fresh implementation session should reconcile that plan to COMPLETED using already-verified run `32269563521` without rerunning its QA.

Authoritative artifacts:

- `openspec/changes/add-productivity-expansion-wave-v1/proposal.md`
- `openspec/changes/add-productivity-expansion-wave-v1/design.md`
- `openspec/changes/add-productivity-expansion-wave-v1/specs/productivity-expansion/spec.md`
- `openspec/changes/add-productivity-expansion-wave-v1/tasks.md`
- this ExecPlan

## Scope

1. Add local Projects and Goals.
2. Add optional Project/Goal organization for Todos and Habits.
3. Add local Daily Plans.
4. Add a Planning Hub modal with Today / Projects / Goals / Progress / Timeline.
5. Add global Quick Capture.
6. Add derived Activity Timeline.
7. Add deterministic 7-day Progress Insights.
8. Add compact Overview entry points.
9. Add new authoritative local tables to account ownership/emptiness safety.
10. Keep new planning entities local-only during this wave.
11. Use only minimal end-of-wave sanity validation.
12. Push the implementation to `main` and leave a precise hardening handoff.

## Non-Goals

- No full regression/hardening campaign in this session.
- No Supabase production migration/deployment for Projects/Goals/Daily Plans.
- No Backup/Restore/Portable integration for those new entities yet.
- No new account model or RLS changes.
- No seventh primary navigation tab.
- No AI planner/autonomous mutation engine.
- No collaboration, team sharing, full calendar scheduling, or notification expansion.
- No native-device validation requirement tonight.
- No requirement to wait for or repair broad GitHub Actions failures after the final implementation push.

## Current Checkpoint

- Current milestone: SPEC_READY_FOR_IMPLEMENTATION_WAVE
- Completed: Current green baseline `6f18cce...` and GitHub run `32269563521` independently verified; implementation-wave scope selected; proposal/design/spec/tasks/short prompt/ExecPlan authored for repository-persisted execution.
- In progress: Source implementation has not begun.
- Important modified files: `openspec/changes/add-productivity-expansion-wave-v1/` only at authoring time.
- Last successful validation: Baseline GitHub run `32269563521` — `quality` PASS, `e2e` PASS, nightly skipped as expected.
- Current failures: None known on baseline. The new implementation is intentionally unvalidated beyond minimal end gates until the next hardening campaign.
- Relevant quarantines: None.
- Blockers: None.
- Condition required to unblock: None.
- Exact resume action after unblock: None.
- Exact next action: Fetch/prune latest `origin/main`; read repository guidance and this entire change; reconcile the previous account-recovery audit plan to COMPLETED using existing verified evidence; inspect the actual current DB schema version; then begin local schema/types/data implementation WITHOUT running baseline tests.
- Remaining definition of done: Material implementation of all major feature slices or explicit partial/blocker notes; new local tables included in account ownership/emptiness safety; no remote backup registration for new entities; minimal end gates pass; coherent commits pushed to main; working tree clean; final report lists hardening debt and uses the required implementation-complete/hardening-required verdict.

## Progress

- [x] 0. Independently verify green pre-wave baseline.
- [x] 1. Define implementation-wave scope and intentional hardening boundary.
- [x] 2. Author repository-persisted proposal/design/spec/tasks/prompt/ExecPlan.
- [ ] 3. Fresh session reconcile latest main and prior closure plan.
- [ ] 4. Implement local schema, types, ownership inventory.
- [ ] 5. Implement Projects.
- [ ] 6. Implement Goals and Todo/Habit associations.
- [ ] 7. Implement Daily Planning.
- [ ] 8. Implement Planning Hub shell/navigation.
- [ ] 9. Implement Quick Capture.
- [ ] 10. Implement Activity Timeline.
- [ ] 11. Implement Progress Insights.
- [ ] 12. Integrate compact Overview entry points.
- [ ] 13. Record hardening debt and partial slices.
- [ ] 14. Run minimal end gates only.
- [ ] 15. Commit coherently, reconcile/push main once, verify clean local/remote state.
- [ ] 16. Mark implementation wave COMPLETED with explicit HARDENING REQUIRED outcome.

## Surprises & Discoveries

- None yet. Record only implementation findings that materially change scope or architecture.

## Decision Log

- 2026-08-20 — Use one broad implementation wave because the user explicitly prioritizes overnight feature throughput and wants a separate hardening campaign afterward.
- 2026-08-20 — Skip baseline QA and broad regression during this run.
- 2026-08-20 — Keep Projects/Goals/Daily Plans local-only until hardening so the client cannot enqueue records for undeployed Supabase tables.
- 2026-08-20 — New local planning tables still participate immediately in account populated-device safety.
- 2026-08-20 — Preserve six primary tabs; add Planning Hub as a modal/drawer.
- 2026-08-20 — Quick Capture must reuse canonical existing-domain mutation APIs.
- 2026-08-20 — Final implementation run does not wait for or chase GitHub CI; subsequent hardening owns CI/test repair.

## Validation Ledger

Authoring evidence:

- GitHub `main` independently verified at `6f18cce75459e21d11c29a2b82330a402336d9f4` before spec publication.
- GitHub Actions run `32269563521`: `quality` success; `e2e` success; full main journeys, full deterministic scenarios, build-dist-sync, and remote-boundary dist-sync step all success.

Implementation-wave minimal required validation at the end:

- `npm run typecheck`
- `npm run lint`
- `npm run openspec:validate`
- `npm run agent:plan:validate:all`
- `git diff --check`

Explicitly deferred to hardening unless required to resolve a compile blocker:

- baseline test sweep;
- `npm test`;
- `qa:fast`, `qa:integration`, `qa:timezones`;
- Playwright E2E / dist-sync;
- simulation;
- Android/iOS runtime QA;
- full build matrix;
- live Supabase migration/advisors;
- Backup/Restore/Portable integration validation;
- migration torture/rollback testing;
- performance/accessibility deep audit.

Record actual minimal-gate outcomes here during execution. Do not invent broad validation results.

## Changed Files / Areas

Expected implementation areas:

- `core/db/client.ts`
- `core/db/types.ts`
- `core/auth/account.types.ts`
- `core/providers/navigationContext.ts`
- `core/providers/NavigationProvider.tsx`
- `app/index.tsx`
- `features/overview/OverviewScreen.tsx`
- `features/todos/`
- `features/habits/`
- `features/projects/` (new)
- `features/goals/` (new)
- `features/daily-plan/` (new)
- `features/planning-hub/` (new)
- `features/quick-capture/` (new)
- `features/activity/` (new)
- `features/progress/` (new)

Do not add new planning entities to remote Backup/Portable/Supabase areas during this wave.

## Recovery / Resume Instructions

1. Read `AGENTS.md`.
2. Read `.agent/PLANS.md`.
3. Read this entire OpenSpec change.
4. Fetch/prune and reconcile `origin/main`.
5. Inspect `git status --short`, `git diff --stat`, recent commits, and this plan's checkpoint.
6. Do not run baseline tests merely because this is a fresh session.
7. Continue from `Exact next action` and keep implementing independent slices if one non-critical slice is blocked.
8. Update this plan at major milestones and before final push.

## Outcomes & Retrospective

Not yet complete.

At completion, record:

- implemented feature slices;
- partial/blocker slices;
- local schema version/migration;
- minimal validation results;
- final pushed SHA;
- immediate CI state only if conveniently visible;
- exhaustive hardening debt.

Required final status text:

`PRODUCTIVITY EXPANSION WAVE V1: IMPLEMENTATION COMPLETE — HARDENING REQUIRED`
