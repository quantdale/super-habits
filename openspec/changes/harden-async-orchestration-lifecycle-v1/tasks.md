## 1. Reconcile planner handoff and establish durable state

- [ ] 1.1 Fetch `origin`, fast-forward local `main` normally, confirm the planner commit is present, and verify no genuinely ACTIVE plan supersedes/conflicts with this campaign.
- [ ] 1.2 Read repository instructions, this complete OpenSpec change, predecessor resilience artifacts, testing/native guidance, impact map, and current known gaps.
- [ ] 1.3 Record exact HEAD, worktree state, Node/npm/platform/emulator state, and baseline `typecheck` / `lint` / strict OpenSpec result in the ExecPlan.
- [ ] 1.4 Run `npm run agent:resume -- --plan openspec/changes/harden-async-orchestration-lifecycle-v1/execplan.md` and reconcile any discrepancy before implementation.

## 2. Exhaustive tracked-file audit and coverage ledger

- [ ] 2.1 Use `git ls-files` as the authoritative inventory; record total counts by top-level area and account for every tracked path before completion.
- [ ] 2.2 Semantically review all source/config/SQL/script/CI/service-worker/Supabase files and map architectural authority, async boundaries, writes, retries/timeouts, and cleanup ownership.
- [ ] 2.3 Semantically review all tests/E2E/simulation/native/QA harness files for missing race or lifecycle oracles, stale skips/fixmes, timeout/sleep dependence, and classification honesty.
- [ ] 2.4 Review all agent/OpenSpec/architecture/testing/knowledge docs for stale runtime/schema/capability claims; inventory/sanity-check binary, lock, patch, and generated artifacts.
- [ ] 2.5 Maintain a finding ledger with ID, severity, confidence, root cause, invariant, reproduction/proof, resolution/deferral, and regression-test link.

## 3. Build async state-adoption and lifecycle ownership map

- [ ] 3.1 Inventory every effect-started async load, delayed `.then`, `Promise.all` fan-out, foreground/day-rollover refresh, AppState/NetInfo/visibility path, timer, listener/subscription, notification response, and remote timeout settlement.
- [ ] 3.2 Inventory every `AsyncStorage.getItem` UI adoption path and define precedence among default, persisted value, restore/remote-applied value, and explicit user interaction.
- [ ] 3.3 Audit every `useGuardedAsyncRefresh` / `createAsyncRefreshGuard` caller plus bespoke request-id/cancel patterns; identify logical-operation ownership and nested/sibling loader hazards.
- [ ] 3.4 Audit sync/backup/restore/account/portable/linked-action/notification side-effect fan-in for transaction, coalescing, replay, and idempotency ownership.

## 4. Deterministic race harness and guard contract

- [ ] 4.1 Add/reuse a small deferred-promise test helper or equivalent deterministic seam; no sleep-based race lottery.
- [ ] 4.2 Pin guard semantics: older request resolves late, unmount before settlement, sibling fan-out shares one generation, distinct refresh invalidates previous generation, standalone loader behavior, error/finally behavior.
- [ ] 4.3 Audit `OverviewScreen` bespoke request-id/mounted guard; converge it on the shared primitive if semantics match, or document/test the justified difference.
- [ ] 4.4 Make misuse of the shared guard harder through the narrowest API/naming/test change necessary; do not create a second refresh framework.

## 5. Editable state and persisted-hydration precedence

- [ ] 5.1 Deterministically test `DailyPlanView` with initial/refresh reads delayed while the user edits intention/notes/reflection/energy/focus/priorities; prove whether older reads can overwrite newer edits.
- [ ] 5.2 If unsafe, implement scoped dirty/version ownership so untouched fields hydrate normally while explicit user edits survive older refreshes; preserve carry-forward/save/complete behavior.
- [ ] 5.3 Audit and test Calories view mode regression remains fixed.
- [ ] 5.4 Audit user-facing AsyncStorage hydration surfaces (theme/motion, command preferences, Overview layout/onboarding, Workout rest preferences, Pomodoro presets/meta, notification preferences, guided planning, habit lifecycle, quick capture, backup-applied settings, and all additional search hits).
- [ ] 5.5 Add paired tests for every relevant preference: untouched state accepts hydration; user action after hydration starts wins over the older result.

## 6. Effect-driven view lifecycle hardening and lint-zero wave

- [ ] 6.1 Individually audit the nine `react-hooks/set-state-in-effect` warning sites from the latest baseline: Calories, DailyPlanHistory, DailyPlanView, GoalListView, HabitDetailModal, TodayBriefingView, Pomodoro, ProjectListView, ReviewHistoryView.
- [ ] 6.2 For each site, reproduce/exonerate stale-result, target-change, unmount, loading/error-finally, and user-intent hazards; fix real PRODUCT_BUG findings with focused regression proof.
- [ ] 6.3 Restructure safe-but-warning lifecycle code without suppressing rules and without changing visible behavior.
- [ ] 6.4 Remove the remaining non-lifecycle lint warnings (fast-refresh mixed export, duplicate import, test console) with narrow changes.
- [ ] 6.5 Reach `npm run lint` at 0 errors / 0 warnings without relaxing ESLint configuration or adding blanket disable comments.

## 7. AppProviders remote-phase / restore-preview ordering

- [ ] 7.1 Add deterministic provider/helper tests for a bootstrap restore preview that times out, a newer preview produced by maintenance/post-flush, and the original preview settling late.
- [ ] 7.2 Prove the current code safe or classify/fix stale preview adoption; if a bug exists, establish one monotonic preview adoption authority across overlapping producers.
- [ ] 7.3 Include restore-prompt dismissal, restore completion, bootstrap retry, and account transition invalidation where they can overlap preview work.
- [ ] 7.4 Prove local bootstrap remains usable under remote timeout and late remote settlement never regresses newer account/restore UI state.
- [ ] 7.5 Stress interval + visibility + NetInfo flush trigger fan-in: `SyncEngine.flush()` stays coalesced and post-flush maintenance/preview work cannot duplicate or adopt stale state.

## 8. Timers, listeners, subscriptions, notifications, PWA

- [ ] 8.1 Exhaustively audit all `setInterval`, `setTimeout`, event listener/subscription, AppState, NetInfo, visibility, service-worker, system-theme/motion, and notification-response registrations.
- [ ] 8.2 Prove mount→unmount→remount and foreground/background/reconnect cycles leave exactly the intended active owners and no stale closures/post-unmount state adoption.
- [ ] 8.3 Prove Pomodoro and Workout timing loops do not duplicate completion or persistence under lifecycle churn.
- [ ] 8.4 Prove notification response/action replay remains idempotent and cannot duplicate domain writes/navigation after reload/kill/relaunch.
- [ ] 8.5 Fix Critical/High lifecycle defects with narrow deterministic tests; document Medium/Low findings if safely deferred.

## 9. Cross-feature race scenarios

- [ ] 9.1 Add deterministic/integration coverage for rapid refresh + section switching across affected sections.
- [ ] 9.2 Add day-rollover + foreground + in-flight-read coverage proving the current local day wins everywhere affected.
- [ ] 9.3 Add target-change coverage (for example Habit detail A→B while A history is pending) proving old-target data cannot adopt into the new target.
- [ ] 9.4 Add realistic Playwright/simulation coverage only where stable and state-based; never add arbitrary sleeps or inflate timeouts.
- [ ] 9.5 Run new race-sensitive suites from fresh state at least twice after final fixes.

## 10. Test/skip/known-gap and repository-truth reconciliation

- [ ] 10.1 Audit every current `test.fixme`, `test.skip`, `describe.skip`, `it.skip`, and environment branch; map each to a real capability/environment gap or remove only after actual proof.
- [ ] 10.2 Reconcile `docs/PROJECT_STRUCTURE_MAP.md` schema claims with runtime v24 authority (`core/db/client.ts`); eliminate stale `current v23` wording.
- [ ] 10.3 Update `docs/testing/known-gaps.md` load/stress wording to acknowledge the deterministic soak lane while retaining real DevTools/heap/native/load limitations honestly.
- [ ] 10.4 Reconcile relevant knowledge base, autonomous QA docs, QA impact map, and OpenSpec requirements/tasks with final reality.

## 11. Broad regression and native qualification

- [ ] 11.1 Keep `npm run qa:affected` green throughout implementation and record the resolved escalation set after material file groups change.
- [ ] 11.2 Run typecheck, lint-zero, full Vitest, integration, theme/schema gates, strict/all OpenSpec, impact validation, plan validators, format check, build:web, and `git diff --check`.
- [ ] 11.3 Run P0 journeys, focused changed-surface journeys, full E2E, and deterministic full simulation on the exact final tree.
- [ ] 11.4 Run `e2e:sync` when dependency assumptions are available; otherwise independently reproduce/classify ENVIRONMENT without weakening assertions.
- [ ] 11.5 Provision/run Android lanes sequentially when a verified target exists, including impact-selected lifecycle/persistence/notification/timer flows; preserve exact reports/replays. Record iOS or unavailable native capability as ENVIRONMENT rather than pass.
- [ ] 11.6 Run `npm run qa:full` on the exact final tree and replay any host-sensitive miss independently before classification.

## 12. Completion, detailed delivery, exact-SHA verification

- [ ] 12.1 Ensure every tracked path is accounted in the audit ledger and every material finding has final severity/resolution/regression evidence.
- [ ] 12.2 Confirm all Critical/High in-scope findings are repaired and the minimum regression matrix in `.agent/EXECUTION_PROMPT.md` is green.
- [ ] 12.3 Reconcile this task list and ExecPlan checkpoint; set `Status: COMPLETED`, fill Outcomes & Retrospective, and set Exact next action to `None — task complete.` only after the gates are proven.
- [ ] 12.4 Validate the completed plan and strict OpenSpec again on the final tree.
- [ ] 12.5 Commit with a detailed session-report body covering audit coverage, findings, fixes, tests, classifications, environment gaps, and follow-ups; push normally to `origin/main`.
- [ ] 12.6 Fetch origin, verify clean tree and local HEAD == fetched `origin/main`, then inspect exact-SHA CI/status checks where configured and record the result.


## 13. Planner re-audit: exact-HEAD CI closure (2026-08-27)

- [ ] 13.1 Regenerate the final-tree `git ls-files` coverage ledger and reconcile the old 1,226-file count with the current tree; no unaccounted paths.
- [ ] 13.2 Reconcile this task file against the ExecPlan evidence; check only tasks actually proven complete and retain evidence links/commands.
- [ ] 13.3 Reproduce or deterministically lower-level reproduce GitHub Actions run #495's P5 partial-success outbox failure; bisect from green run #491 / `7a49647`; identify the first bad behavioral commit.
- [ ] 13.4 Fix partial-success acknowledgement so successful remote rows are removed exactly once, failed rows remain exactly once, and concurrent lifecycle flush triggers cannot resurrect acknowledged work; add deterministic regression tests.
- [ ] 13.5 Reproduce and bisect Recoverable Account V1's missing `Allowed` restore eligibility; fix the account/owner/preview state-adoption root cause with deterministic race tests.
- [ ] 13.6 Finish F-05 per-surface AsyncStorage precedence classification and paired user-action-vs-hydration tests wherever streams genuinely compete.
- [ ] 13.7 Finish M7 high-risk timer/listener/subscription mount-unmount-remount runtime proof and repair any duplicate/stale owner discovered.
- [ ] 13.8 Finish M8 targeted cross-feature race/target-change coverage using state-based deterministic oracles; no sleeps/timeout inflation.
- [ ] 13.9 Change the canonical lint gate to fail on any warning after verifying the zero-warning baseline; audit targeted suppressions without blanket disabling.
- [ ] 13.10 Resolve the two previously UNKNOWN E2E skip classifications and ensure every remaining skip/fixme maps to a documented capability/environment reason.
- [ ] 13.11 Run the full exact-tree validation ladder, including two fresh-state runs of formerly failing/race-sensitive suites and sequential native lanes when a verified target exists.
- [ ] 13.12 Push normally, inspect GitHub Actions for the exact pushed SHA, and require quality + e2e + dist-sync/journeys-sync green before changing this OpenSpec to COMPLETED.
- [ ] 13.13 Only after closure, re-audit residual risk and create a successor OpenSpec proposal if meaningful implementation work remains; otherwise stop.
