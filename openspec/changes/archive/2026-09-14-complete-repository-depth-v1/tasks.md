# Tasks: Complete Repository Depth & Truth V1

## 1. Durability and consolidation

- [x] 1.1 Bootstrap: run `migrateLegacySessionMeta` after sync hydrate, best-effort, before account/restore/backup cycles.
- [x] 1.2 Integration coverage: real-SQLite promotion (apply-once, no-clobber, orphans, idempotent re-run, outbox intent); verify bootstrap wiring.
- [x] 1.3 Consolidate `cancelTodoReminderSafely` into the todos data layer (delete the private duplicate).
- [x] 1.4 Use `WEEKLY_REVIEW_REMINDER_DATA_VERSION` in the weekly-review reminder scheduler.
- [x] 1.5 Remove the dead `getBackfillStatus` export; keep the correct live implementation as the single source.
- [x] 1.6 Adopt `createPreferencePrecedenceGuard` where an ad-hoc equivalent exists (Calories view mode); evaluate other persisted preferences.

## 2. Daily plan deletion

- [x] 2.1 UI: confirmed danger delete in expanded plan-history rows wired to `softDeleteDailyPlan`; refresh list and counters.
- [x] 2.2 Integration coverage for the delete contract (row soft-deleted, counters exclude it, no other entity touched, one coalesced intent).
- [x] 2.3 E2E journey: seeded past plan → history → delete → row/intent oracles + list absence.

## 3. Test floor

- [x] 3.1 Integration: Todo bulk operations (complete/remove/priority/project) with real SQL + coalesced intents.
- [x] 3.2 Integration: planning detail/history queries (`listRecentDailyPlans`, `listDailyPlansInRange`, `getDailyPlanAdherence`, `setGoalProgress`, `listTodosForGoal`, `listHabitsForProject`, `listGoalsForProject`, `getProject`, `getWeeklyReviewById`).
- [x] 3.3 Integration: Workout Gym V2 mutators/queries (body weight update/delete, reschedule + overrides, exercise order, session totals, last-performed, performance rows, logged-set reads).
- [x] 3.4 Integration: Pomodoro active timer get/set/clear + started-at; habit unarchive + linked-rule persistence.
- [x] 3.5 E2E oracles: added data-layer oracles to `todos.spec.ts`, `calories.spec.ts`, `workout-gym-v2.spec.ts`, `settings.spec.ts`.
- [x] 3.6 E2E: direct Overview spec (next best action + customize cards persistence); planning history journey (2.3).
- [x] 3.7 Unit: motion preference get/set contract (including the late-hydration precedence race).

## 4. Documentation truth

- [x] 4.1 AGENTS.md: tab labels, Settings buckets, lint gate, E2E projects, version pins, Vitest projects, schema snapshot version, EAS profiles, module exceptions, createId prefixes.
- [x] 4.2 README.md: section labels/deep-link wording.
- [x] 4.3 `docs/PROJECT_STRUCTURE_MAP.md` + `docs/knowledge-base/PROJECT_STRUCTURE_MAP.md`: test inventory, synced-writer scope, backup status, launcher claim, module exceptions, prefixes.
- [x] 4.4 `docs/testing/known-gaps.md`: archived path, gap counts.
- [x] 4.5 `docs/ui-ux/README.md`: document ledger + first-tab label; also fixed the active agent rule/skill copies (`.cursor/rules/superhabits-rules.mdc`, `rn-expo-conventions`, `feature-agent`, `db-and-sync-invariants`) and `docs/master-context.md`.
- [x] 4.6 Verify all corrected claims against code and the final test inventory.

## 5. Bounded dead-code removal

- [x] 5.1 Removed zero-reference, zero-test UI components and exports (Badge/ProgressBar/SectionTitle, unused weekly-review barrel, momentum alias/growth helper, timeline filter, habit grid/streak helpers, FOCUS_SECONDS, isDraftReady, isHabitReminderResponse, sameOwnerIds, getSupabaseAuthUser, backup diagnostics, clearWeeklyPlanEntry/listScheduleOverrides, getOrCreateDailyPlan, isDailyPlanStatus, countCompletedTodos).
- [x] 5.2 Record intentionally retained test-covered dead APIs with rationale (no test weakening).

## 6. Regression ladder and delivery

- [x] 6.1 Fast gates: typecheck, lint, unit+integration, label parity, openspec validate, theme/schema/impact validators.
- [x] 6.2 Web: fresh `build:web`, focused specs, full `npm run e2e`, simulation deterministic, `web:verify`/`web:hygiene`.
- [x] 6.3 Native: Android smoke + persistence on the canonical API-36 target when available; classify honestly otherwise.
- [ ] 6.4 ExecPlan close-out (validation ledger, outcomes) + commit + push + CI verification — close-out/commit/push done; CI verification externally BLOCKED (GitHub Actions billing; jobs never start).
