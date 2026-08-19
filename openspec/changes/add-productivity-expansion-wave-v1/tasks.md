# Tasks: Productivity Expansion Implementation Wave V1

Keep this checklist synchronized with `execplan.md`.

## 0. Fresh-session setup

- [ ] 0.1 Fetch/prune and reconcile latest `origin/main`; preserve legitimate work.
- [ ] 0.2 Read `AGENTS.md`, `.agent/PLANS.md`, this change's README/proposal/design/spec/tasks/execplan, and relevant feature/data/navigation files.
- [ ] 0.3 Reconcile the just-finished `fix-account-recovery-dist-sync-closure-audit` plan to COMPLETED using already-verified exact-SHA run `32269563521`; do not spend time rerunning its QA.
- [ ] 0.4 Confirm actual current local DB schema version before choosing the next migration number.
- [ ] 0.5 DO NOT run baseline tests/QA/builds before implementation.

## 1. Local schema and shared types

- [ ] 1.1 Add `Project`, `Goal`, and `DailyPlan` types with closed unions/bounds.
- [ ] 1.2 Add append-only local migration creating `projects`, `goals`, `daily_plans`.
- [ ] 1.3 Add optional `project_id` / `goal_id` columns to Todos and Habits if consistent with current data architecture.
- [ ] 1.4 Add useful local indexes without overengineering.
- [ ] 1.5 Add new authoritative tables to account local-user-data/emptiness inventory.
- [ ] 1.6 Keep new entities OUT of remote Backup/Sync/Portable contracts during this wave.

## 2. Projects V1

- [ ] 2.1 Implement `projects.data.ts` CRUD/list/reorder/status/soft-delete.
- [ ] 2.2 Implement project domain validation.
- [ ] 2.3 Implement Project list view.
- [ ] 2.4 Implement Project create/edit flow.
- [ ] 2.5 Implement Project detail with linked Todos/Habits/Goals counts/lists.
- [ ] 2.6 Implement basic status/filter behavior.

## 3. Goals V1

- [ ] 3.1 Implement `goals.data.ts` CRUD/list/status/soft-delete.
- [ ] 3.2 Implement goal domain validation and manual progress 0–100.
- [ ] 3.3 Implement Goal list view.
- [ ] 3.4 Implement Goal create/edit flow.
- [ ] 3.5 Implement Goal detail with Project association and linked Todo/Habit context.
- [ ] 3.6 Show target/horizon/status/progress clearly.

## 4. Existing Todo/Habit organization

- [ ] 4.1 Extend Todo read/write mappings for optional Project/Goal IDs.
- [ ] 4.2 Extend Habit read/write mappings for optional Project/Goal IDs.
- [ ] 4.3 Add lightweight Project/Goal association UI to Todo create/edit where practical.
- [ ] 4.4 Add lightweight Project/Goal association UI to Habit create/edit where practical.
- [ ] 4.5 Show compact association labels/badges in list/content surfaces where practical.
- [ ] 4.6 If legacy-form UI becomes a blocker, keep association editing fully available from Planning Hub and record polish debt rather than stopping the wave.

## 5. Daily Planning V1

- [ ] 5.1 Implement `dailyPlan.data.ts` get/create/update/list-recent/soft-delete.
- [ ] 5.2 Implement local-date plan-key/domain validation.
- [ ] 5.3 Implement Today planning view with intention.
- [ ] 5.4 Show ranked pending Todo candidates and support max-three top priority selection.
- [ ] 5.5 Show today's scheduled Habit summary using existing Habit schedule semantics.
- [ ] 5.6 Implement focus-minutes target and notes.
- [ ] 5.7 Implement reflection, energy score, and plan completion.
- [ ] 5.8 Ignore deleted/missing historical Todo references safely.

## 6. Planning Hub

- [ ] 6.1 Add navigation-provider modal/drawer state and initial-view targeting.
- [ ] 6.2 Add Planning Hub shell with Today / Projects / Goals / Progress / Timeline internal tabs.
- [ ] 6.3 Mount Planning Hub in app shell without adding a seventh primary tab.
- [ ] 6.4 Add Overview entry points for Plan Today and Progress while preserving Weekly Review.
- [ ] 6.5 Ensure modal close/back behavior follows existing Modal conventions.

## 7. Quick Capture V1

- [ ] 7.1 Add global Quick Capture launcher that respects safe areas and does not obstruct primary navigation.
- [ ] 7.2 Add Todo capture using canonical Todo API.
- [ ] 7.3 Add Habit capture using canonical Habit API.
- [ ] 7.4 Add Calorie entry capture using canonical Calories API.
- [ ] 7.5 Add Project capture using new local Project API.
- [ ] 7.6 Add Goal capture using new local Goal API.
- [ ] 7.7 Add Start Focus shortcut that navigates to existing Focus section.
- [ ] 7.8 Support optional Project/Goal selection in relevant capture modes when straightforward.

## 8. Activity Timeline V1

- [ ] 8.1 Implement bounded cross-domain timeline query/assembler.
- [ ] 8.2 Include Todo completion facts conservatively using available timestamps.
- [ ] 8.3 Include Habit completion facts.
- [ ] 8.4 Include Focus sessions.
- [ ] 8.5 Include Workout logs.
- [ ] 8.6 Include bounded/aggregated Calorie activity.
- [ ] 8.7 Include Weekly Review and Daily Plan completion.
- [ ] 8.8 Include deterministic Project/Goal creation/completion facts where timestamps support them.
- [ ] 8.9 Implement grouped Timeline UI with All / Productivity / Health / Planning filters.

## 9. Progress Insights V1

- [ ] 9.1 Implement current-7-day and prior-7-day range utilities using sanctioned local-date helpers.
- [ ] 9.2 Implement Todo completion summary.
- [ ] 9.3 Implement Habit progress/consistency summary using existing semantics rather than inventing a second formula.
- [ ] 9.4 Implement Focus minutes/session summary.
- [ ] 9.5 Implement Workout session summary.
- [ ] 9.6 Implement calorie-tracking-days + configured-goal context.
- [ ] 9.7 Include Weekly Review completion, active Projects, active Goals, and manual Goal progress.
- [ ] 9.8 Implement Progress UI cards with simple prior-period comparison; no opaque composite score.

## 10. Overview cohesion

- [ ] 10.1 Add compact Today-plan/top-priority surface if it fits cleanly.
- [ ] 10.2 Keep existing Overview metric cards functional.
- [ ] 10.3 Keep Weekly Review entry available.
- [ ] 10.4 Avoid adding heavy unbounded queries to every Overview render when a Planning Hub load is sufficient.

## 11. Implementation-wave hardening-debt notes

- [ ] 11.1 Record that Projects/Goals/Daily Plans are local-only until the next hardening campaign.
- [ ] 11.2 Record required future Backup/Restore/Portable/Supabase work.
- [ ] 11.3 Record migration/upgrade paths that were implemented but not torture-tested.
- [ ] 11.4 Record UI/accessibility/performance/native areas that need hardening.
- [ ] 11.5 Do not falsely label the wave production-ready.

## 12. Minimal end-of-wave sanity gates only

Do NOT run broad regression unless needed to unblock compilation.

- [ ] 12.1 `npm run typecheck`
- [ ] 12.2 `npm run lint`
- [ ] 12.3 `npm run openspec:validate`
- [ ] 12.4 `npm run agent:plan:validate:all`
- [ ] 12.5 `git diff --check`
- [ ] 12.6 Optional only if cheap/time remains: tiny focused new pure-domain tests.

Explicitly deferred:

- `npm test`
- `qa:fast`
- `qa:integration`
- `qa:timezones`
- web E2E / dist-sync E2E
- simulation
- Android/iOS
- full builds
- live Supabase
- backup/portable integration validation

## 13. Commit and push

- [ ] 13.1 Update ExecPlan with implemented slices and precise hardening debt.
- [ ] 13.2 Use coherent English commits; avoid tiny commit spam.
- [ ] 13.3 Prefer one final push after implementation to minimize redundant CI runs.
- [ ] 13.4 Fetch/reconcile `origin/main` immediately before push.
- [ ] 13.5 Push `main` without force.
- [ ] 13.6 Verify local `main == origin/main` and working tree clean.
- [ ] 13.7 Do not wait for GitHub Actions or begin fixing broad CI regressions; record immediate status if convenient and defer to hardening.

## 14. Completion state

- [ ] 14.1 Mark this ExecPlan COMPLETED when implementation scope + minimal sanity gates + push are complete, even though hardening remains intentionally deferred.
- [ ] 14.2 Final report enumerates implemented/partial slices and all known hardening debt.
- [ ] 14.3 Final verdict uses exactly: `PRODUCTIVITY EXPANSION WAVE V1: IMPLEMENTATION COMPLETE — HARDENING REQUIRED` unless a major blocker prevented implementation completion.
