# ACTIVE Campaign — Async Orchestration, Lifecycle & State-Adoption Determinism

Status: ACTIVE
Planned-From: c823ab3520da22caec6d5502d395dd296e589d58
Target-Branch: main
OpenSpec: `openspec/changes/harden-async-orchestration-lifecycle-v1/`
ExecPlan: `openspec/changes/harden-async-orchestration-lifecycle-v1/execplan.md`

## Mission

Run the next whole-repository hardening campaign for SuperHabits. The previous whole-system resilience campaign is COMPLETED. Do not reopen it or repeat its work. This campaign exists because the final two product bugs discovered on 2026-08-26 were both ordering/state-adoption defects rather than schema/domain defects:

1. Calories AsyncStorage view-mode hydration could settle after a manual user switch and overwrite the newer user choice.
2. Pomodoro used one shared async-refresh guard incorrectly: sibling loaders inside a single `Promise.all` each acquired a new generation, synchronously invalidating one another and silently discarding Focus history.

The repository now has a tested generation guard and monotonic account-task sequencing, but those guarantees are not yet systematic across every async state-adoption surface. Audit the entire tracked repository, prove where ordering is safe or unsafe, repair Critical/High defects, remove lifecycle smells that hide this class, and leave machine-enforced regression proof.

This is planning/specification handoff from the planner. Do not assume any finding below is already implemented merely because it is named here.

## Execution Window

Target an approximately 12-hour autonomous working window when the executor environment permits it. Do not stop after the first green fix or after merely running the existing suite. Continue through the exhaustive audit, implementation, race testing, documentation reconciliation, broad QA, native qualification where available, and final delivery gates.

Completion is evidence-based, not clock-based. If every acceptance gate is genuinely satisfied before 12 hours, do not invent churn merely to consume time; use remaining capacity for repeated race replays, exact-SHA verification, deeper read-only audit of low-risk surfaces, and documentation/coverage reconciliation. If the session/tool context is interrupted, the Version-2 ExecPlan is the recovery authority: checkpoint before every major phase and resume from its exact next action.

## Required Startup — no implementation before this is done

1. Read `AGENTS.md`, `.agent/PLANS.md`, `.agent/PLANNER_HANDOFF.md`, this prompt, the complete OpenSpec change, `docs/PROJECT_STRUCTURE_MAP.md`, `.cursorrules`, `.cursor/rules/superhabits-rules.mdc`, the relevant data/feature skills, `docs/testing/autonomous-qa.md`, `docs/testing/known-gaps.md`, `qa/impact-map.json`, and the completed predecessor `openspec/changes/harden-whole-system-resilience-v1/**`.
2. `git fetch origin`; reconcile local `main` with `origin/main` by normal fast-forward only. Never reset unrelated work.
3. Run `git status --short`, `git diff --stat`, `git diff --name-only`, `npm run agent:plans`, and `npm run agent:resume -- --plan openspec/changes/harden-async-orchestration-lifecycle-v1/execplan.md`.
4. If another genuinely ACTIVE plan now supersedes or conflicts with this campaign, record it in the ExecPlan and coordinate rather than overwriting its files. Historical text that merely mentions `Status: ACTIVE` does not count; use the repository plan tooling.
5. Record exact Node/npm/platform/native-emulator state and current HEAD in the checkpoint.
6. Run a cheap baseline: `npm run typecheck`, `npm run lint`, focused guard/provider tests, and `npm run openspec validate harden-async-orchestration-lifecycle-v1 --strict`. Preserve baseline warnings/failures exactly; do not classify them before reproduction.

## Exhaustive Repository Audit Requirement

The user explicitly asked for every file/system/logic path to be scoured. Make `git ls-files` the authoritative inventory. Every tracked path must be accounted for in the campaign audit coverage ledger before completion.

- Read semantically: all TypeScript/TSX/JS/MJS/CJS, SQL, YAML/YML/JSON configuration, shell/PowerShell/batch scripts, Expo/Vercel/Metro/Babel/Tailwind/TypeScript/Vitest/Playwright config, Supabase functions/migrations/config, service-worker code, OpenSpec/agent/architecture/testing docs, test code, simulation scenarios, QA harnesses, and CI workflows.
- Inventory and sanity-check rather than pretend to semantically review binary assets: images/icons/fonts if any, lockfiles, patches, generated fixture blobs, and other non-source tracked artifacts. Verify they are expected, referenced, reproducible where applicable, and do not conceal stale/generated authority.
- Do not silently skip `app/`, `core/`, `features/`, `lib/`, `constants/`, `tests/`, `e2e/`, `simulation/`, `qa/`, `scripts/`, `supabase/`, `public/`, `.github/`, `.agent/`, `.cursor/`, `docs/`, configs, patches, or OpenSpec history.
- Add directory/path counts and audit status to the ExecPlan. Material findings need ID, severity, confidence, root cause, affected invariant, proof/reproduction, resolution/deferral, and regression-test link.
- Low-risk files may be marked reviewed/no finding, but only after they are actually accounted for.

Use targeted static sweeps to avoid relying on memory. At minimum inspect occurrences of: `useEffect`, `useFocusEffect` if present, `Promise.all`, `.then(`, `await`, `setTimeout`, `setInterval`, `addEventListener`, `AppState`, `NetInfo`, `AsyncStorage`, `getItem`, `setItem`, `withRemoteTimeout`, `beginRefresh`, `createAsyncRefreshGuard`, subscription creation/cleanup, notification response handling, mutation enqueue/flush, `test.fixme`, `test.skip`, `describe.skip`, `it.skip`, and stale schema/capability documentation claims.

## Planner-Seeding Audit Findings — verify, reproduce, then act

These are evidence-backed seeds, not permission to blindly refactor.

### F-01 — High-risk class: async UI adoption is not consistently generation-owned

`useGuardedAsyncRefresh` currently appears in the five main feature screens Todos, Habits, Pomodoro, Workout, and Calories. Other async views still adopt state from effect-started reads without the same latest-only contract, including at least:

- `features/daily-plan/DailyPlanView.tsx`
- `features/daily-plan/DailyPlanHistoryView.tsx`
- `features/goals/GoalListView.tsx`
- `features/projects/ProjectListView.tsx`
- `features/planning-hub/TodayBriefingView.tsx`
- `features/weekly-review/ReviewHistoryView.tsx`
- `features/habits/HabitDetailModal.tsx` (has a local cancellation flag; verify it is sufficient)

`DailyPlanView` is especially sensitive because its refresh writes editable fields (`intention`, notes, reflection, energy, focus target, selected priorities) after an async fan-out. Prove whether slow initial refresh or a competing refresh can overwrite user edits. If yes, treat as PRODUCT_BUG and fix with explicit user-interaction precedence, not an arbitrary delay.

### F-02 — Guard ownership contract must be made hard to misuse

`lib/useGuardedAsyncRefresh.ts` correctly documents one `begin()` per logical refresh unit. The Pomodoro regression proved documentation + unit tests alone did not prevent misuse. Audit every current/future caller shape, nested loader, standalone loader, fan-out, foreground/day-rollover trigger, and error/finally branch. Prefer a small API shape that makes correct ownership obvious and testable. Do not create a second competing refresh framework.

`features/overview/OverviewScreen.tsx` currently carries a bespoke `refreshRequestRef` + `mountedRef` latest-only guard. Decide whether it should converge on the shared primitive or remain intentionally separate; whichever decision is made, pin it with tests and remove semantic duplication where safe.

### F-03 — High candidate: restore-preview late settlements are not sequenced like account state

`core/providers/remotePhase.ts` explicitly leaves timed-out underlying promises running so callers can adopt late settlements. `AppProviders` now sequences account-state tasks with monotonic tokens, but restore-preview adoption still starts `previewTask`, attaches a late `.then(setRestorePreview/...)`, also awaits it through `withRemoteTimeout`, and may continue into backup maintenance / later post-flush preview refreshes. A slow older preview may therefore be able to settle after a newer preview and overwrite newer restore-prompt state.

Do not assume this is a bug: build deterministic deferred-promise tests around the provider/coordinator boundary and prove or exonerate it. If reproducible, add one explicit latest-only preview generation covering bootstrap, maintenance, post-flush refresh, dismissal/restore transitions as appropriate. Preserve restore eligibility and owner-safety semantics.

### F-04 — Effect/lifecycle lint debt aligns with the defect class

Latest final-tree evidence was lint 0 errors / 13 warnings. The stored lint evidence shows nine `react-hooks/set-state-in-effect` warnings concentrated in Calories, DailyPlanHistory, DailyPlanView, GoalListView, HabitDetailModal, TodayBriefingView, Pomodoro, ProjectListView, and ReviewHistoryView, plus a fast-refresh export warning, a duplicate import, and a test `console` warning. Treat the warning cluster as an audit map, not cosmetic cleanup.

Goal: reach zero lint warnings without disabling rules, weakening lint config, adding blanket suppressions, or changing behavior merely to appease the rule. Where a rule is genuinely inapplicable, document a narrow rationale and prefer code structure that makes lifecycle ownership explicit.

### F-05 — AsyncStorage/user-preference hydration requires user-choice precedence audit

The Calories regression establishes the invariant: persisted hydration is older than any explicit interaction made after mount. Audit all AsyncStorage-backed UI/preferences and cross-store settings application, including command mode/history/rollout, Overview onboarding/card layout, ThemeProvider/motion, Workout rest preferences, Pomodoro presets/session metadata, notification preferences, guided-planning storage, habit lifecycle storage, quick-capture recent state, backup settings, and any additional `AsyncStorage.getItem` callers found by exhaustive search.

Not every storage helper needs a guard. For every UI hydration path, explicitly decide and test precedence among persisted value, default, remote/restore-applied value, and user action.

### F-06 — Timer/listener/subscription ownership is finite and auditable

Exhaustively inspect the current listener/interval surfaces. Static inventory already identifies event-listener usage around `public/sw.js`, `lib/useForegroundRefresh.ts`, `core/ui/ConnectivityIndicator.tsx`, `core/pwa/registerServiceWorker.ts`, `core/providers/DayRolloverProvider.tsx`, `core/theme/motion.ts`, `core/providers/AppProviders.tsx`, and `features/pomodoro/PomodoroScreen.tsx`; interval usage includes AppProviders, Pomodoro, Settings backup/status, Workout session timing, and Settings. Verify cleanup, duplicate registration, foreground/reconnect fan-in, re-render stability, stale closure behavior, and no post-unmount adoption.

`SyncEngine.flush()` already coalesces concurrent callers. Verify the work surrounding a shared flush (backup maintenance and restore-preview refresh) is also safe under interval + visibility + NetInfo trigger fan-in.

### F-07 — Promise fan-out is widespread; ownership must be per logical operation

Audit every `Promise.all`/parallel read in core and features, including account/backup/restore/sync, Overview, planning, goals/projects, command retrieval, habits lifecycle, momentum/progress, weekly review, Daily Plan, Quick Capture, Settings, Workout, Calories, and Pomodoro. Concurrent read performance is desirable; do not serialize safe reads just to avoid races. Instead ensure state/result adoption has one owner and writes/side effects obey transaction/idempotency contracts.

### F-08 — Repository truth has small but real drift

`docs/PROJECT_STRUCTURE_MAP.md` correctly says schema v24 in its current-schema section but still contains a `current v23` claim in its database/sync authority table. Reconcile all schema-version claims from runtime `core/db/client.ts` outward.

`docs/testing/known-gaps.md` still carries older load/stress wording even though the completed resilience campaign added a deterministic long-session soak scenario (`simulation/scenarios/soakSustainedUse.ts`). Narrow the gap honestly: retain any real DevTools/heap/native/load capability still absent, but do not claim the soak lane does not exist.

Audit all current `test.fixme`/skip markers against known gaps. Do not delete legitimate environment/capability skips merely to make counts look better.

### F-09 — CI/native truth must remain evidence-based

The planner found no workflow-run record attached to planned-from HEAD through the available GitHub query at planning time. This is not itself a product failure. After implementation/push, inspect exact-SHA CI/status checks where configured. Preserve the previous environment classification for dummy Supabase DNS only if it reproduces independently of this campaign.

Native Android lanes must run sequentially when a verified target is available. Do not claim iOS or notification delivery as green when the environment cannot prove it.

## Workstreams

### A — Exhaustive file/system audit and state-adoption map

Account for every tracked file. Build an async/state-adoption matrix with producer, adopter, generation owner, cancellation semantics, user-interaction precedence, retry/timeout behavior, cleanup owner, and tests. Cover UI, core providers, sync/backup/restore/account, storage hydration, notification dispatch, timers/listeners, PWA lifecycle, command overlay, linked actions, and QA harnesses.

### B — Standardize latest-only operation ownership

Use the existing `createAsyncRefreshGuard`/`useGuardedAsyncRefresh` as the starting point. Improve naming/API/tests if needed so one logical operation cannot accidentally self-invalidate. Migrate only callers that need the contract. Preserve parallelism. Add deterministic tests for older-request-late-settlement, unmount, sibling fan-out, error/finally, standalone loader, foreground/day rollover, and rapid repeated refresh.

### C — Editable hydration/user-intent precedence

Prove and fix races where initial/persisted reads can overwrite edits made after the read started. Daily Plan and AsyncStorage-backed UI are priority targets. Prefer explicit dirty/version tokens or state machines with clear ownership; no sleeps. Test both “hydration wins when untouched” and “user action wins after interaction.”

### D — AppProviders remote-phase ordering

Test and harden account/restore-preview/bootstrap/maintenance/flush fan-in. The local app must remain usable under remote timeout. Late remote settlements may be adopted only if still current. Restore prompt eligibility/dismissal must never regress to an older snapshot. Reconnect/visibility/interval triggers must not duplicate side effects.

### E — Timers, listeners, notification response lifecycle

Verify every registration has a stable owner and cleanup path. Repeated mount/unmount, foreground/background, reconnect, notification replay, timer completion, and kill/relaunch must not duplicate callbacks, writes, reminders, or navigation. Fix defects and pin them at the narrowest layer.

### F — Lint/lifecycle cleanup as correctness work

Eliminate the 13-warning baseline by restructuring lifecycle ownership and trivial hygiene. No rule disabling. Run focused tests after each behavioral refactor. If a warning reveals a product race, classify it accordingly and add regression proof.

### G — QA and race harness expansion

Create deterministic deferred-promise / controllable-clock seams where necessary; do not make tests timing-lottery based. Add focused unit/integration tests first, then one or more realistic Playwright/simulation journeys for rapid section switching, foreground/day rollover, editable-state interaction during slow hydration, and provider remote-phase late settlement where the platform makes it stable.

### H — Repository truth, docs, OpenSpec, QA impact

Update structure map, known gaps, relevant knowledge-base claims, QA impact mapping, test docs, OpenSpec tasks/spec, and ExecPlan. Generated/derived claims must match runtime authority. Avoid broad unrelated documentation rewrites.

### I — Final broad qualification and delivery

Run affected QA continuously, then full validation on the exact final tree. Re-run race-sensitive lanes from fresh state at least twice after final fixes. Run native sequentially if available. Commit with a detailed session report, push normally, verify clean local/fetched origin parity, and inspect exact-SHA CI/status.

## Non-Negotiable Constraints

- No new product features or UI redesign.
- No Redux/Zustand/React Query/new state framework solely for this campaign.
- No second sync/backup/timer/refresh engine.
- SQLite remains authoritative local state; preserve owner binding, outbox durability, restore atomicity, and append-only migration rules.
- Do not add a schema migration unless a proven data-correctness defect actually requires one.
- No live Supabase mutation without an explicitly authorized disposable target; use deterministic mocks/local seams otherwise.
- Never weaken/delete assertions, convert failures to skips, inflate timeouts, add arbitrary sleeps, or swallow errors to obtain green.
- Do not serialize safe independent reads just because `Promise.all` appears in an audit.
- Do not blindly wrap everything in guards. State the stale-result hazard and operation ownership first.
- No blanket ESLint disable comments/config relaxation.
- Preserve accessibility semantics and current product behavior unless correcting a proven bug.
- Critical/High findings in campaign scope must be repaired and regression-tested before completion. Medium findings may be fixed when low-risk and coherent; otherwise record an explicit follow-up. Low findings may be documented.
- Keep the ExecPlan checkpoint current at every meaningful milestone/failure/decision/delegation boundary.

## Minimum Regression Matrix

Before completion there must be deterministic proof for, at minimum:

1. older refresh resolves after newer refresh → older result cannot adopt;
2. component unmounts before async resolution → no state adoption;
3. one refresh fans out to sibling reads → siblings do not invalidate each other;
4. user edits Daily Plan while initial/refresh read is pending → explicit user edit survives;
5. persisted preference hydrates after user choice → user choice survives;
6. untouched preference hydrates normally → persisted value is applied;
7. timed-out remote preview settles after a newer preview → newest eligible state wins;
8. interval + visibility/reconnect flush triggers overlap → one sync push and no stale post-flush preview adoption;
9. day rollover + foreground + rapid section switch → current local-day state wins;
10. habit detail/list/modal target changes while history request is pending → old target cannot adopt into new target;
11. timer/listener mount-unmount-remount → exactly one active callback/subscription;
12. notification action/replay → idempotent, no duplicate domain write/navigation;
13. all existing Pomodoro guard-ownership tests remain green;
14. all current skips/fixmes are reconciled with a named environment/capability gap or removed only after real proof.

## Validation Ladder

Run cheapest-to-broadest and record every result in the ExecPlan. At minimum:

- `npm run typecheck`
- `npm run lint` — target 0 errors / 0 warnings without config weakening
- focused Vitest for every touched subsystem
- `npm test`
- `npm run test:integration`
- `npm run validate:themes`
- `npm run supabase:schema:validate`
- `npm run openspec validate harden-async-orchestration-lifecycle-v1 --strict`
- `npm run openspec:validate`
- `npm run qa:impact:validate`
- `npm run agent:plan:validate -- --plan openspec/changes/harden-async-orchestration-lifecycle-v1/execplan.md`
- `npm run agent:plan:validate:all`
- `npm run format:check`
- `npm run build:web`
- `npm run qa:affected` using the correct base
- `npm run e2e:journeys:p0`
- focused journeys for changed surfaces, then `npm run e2e:full`
- `npm run qa:simulation -- --all --mode deterministic`
- `npm run e2e:sync` when the host can execute its dependency assumptions; otherwise independently prove ENVIRONMENT and preserve the replay
- `npm run qa:native:android` and impact-selected native lifecycle/persistence lanes sequentially when a verified Android target exists
- `npm run qa:full` on the exact final tree
- `git diff --check`

For race-sensitive new suites, require at least two clean fresh-state post-fix runs. A flaky first pass followed by one pass is not sufficient; investigate and classify.

## Completion Gates

Do not mark this campaign COMPLETED until all are true:

- Every tracked file is accounted for in the audit coverage ledger.
- All Critical/High in-scope audit findings are fixed with regression proof or, only when genuinely external/unfixable, explicitly BLOCKED with a precise condition; do not call a blocked high-risk campaign completed.
- Async state adoption has an explicit owner/precedence contract on every high-risk surface found by the audit.
- The AppProviders restore-preview late-settlement candidate is deterministically proven safe or fixed.
- Daily Plan editable refresh/hydration precedence is deterministically proven safe or fixed.
- AsyncStorage-backed UI hydration has explicit tested user-choice precedence where relevant.
- Listener/timer/subscription inventory has no unexplained duplicate-registration or cleanup gaps.
- Lint reaches 0 errors / 0 warnings without disabling rules.
- Existing Pomodoro/Calories regressions remain fixed.
- OpenSpec strict validation and Version-2 plan validation pass.
- Applicable browser, simulation, sync, and native gates are green or honestly classified with reproducible external evidence; no assertion is weakened.
- Structure/schema/known-gap documentation matches actual runtime/test capability.
- Exact final-tree QA evidence is recorded in the ExecPlan.
- The ExecPlan is switched to `Status: COMPLETED`, its checkbox/progress state is reconciled, Outcomes & Retrospective is filled, and Exact next action is `None — task complete.`
- Final commit contains a detailed session report (findings, fixes, tests, classifications, remaining known gaps), is pushed normally to `origin/main`, fetched origin equals local HEAD, and exact-SHA CI/status is inspected where configured.

## Executor Handoff

After pulling this planner commit, the shortest correct instruction is:

`Read AGENTS.md, .agent/PLANS.md, .agent/EXECUTION_PROMPT.md, then resume openspec/changes/harden-async-orchestration-lifecycle-v1/execplan.md and continue autonomously from its Exact next action until every completion gate is proven.`
