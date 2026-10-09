# ExecPlan: Frontend V3 — W8.5 Focus timer-start safety convergence

Plan-Version: 2
Status: COMPLETED

## Purpose / User Outcome

Close the asynchronous timer-start race: a Focus session that has been accepted
for start must own its mode, duration, start timestamp, governing preset, and
durable intent before its end-notification promise resolves. This is a bounded
safety pass on the session-claim boundary, not a redesign of Focus.

## Context

- Baseline HEAD `c32685364cbe9c6d34a512c3b2bcef9b3a432e0b` (W8 closure merge,
  PR 62). W8 was published through PR 60 (`b47179b`, Focus reconstruction),
  PR 61 (`ce00e37`, visual-audit registration) and PR 62 (`c326853`, closure).
- The race window: `start()` claimed `startInFlightRef.current = true` and
  `sessionActiveRef.current = true` synchronously, then awaited
  `scheduleTimerEndNotification()`. `isRunning` became true only afterwards, so
  `activeSession = isRunning || isPaused` stayed false for the whole await — on
  native, the OS permission prompt window. The rendered configuration therefore
  stayed live while a session was already claimed, and the mode selector's
  `onChange` carried no synchronous guard. `handleSelectPreset` wrote
  `activePresetRef.current` _before_ its session check.
- Measured damage (reproduced deterministically in
  `tests/pomodoro.startup.test.ts`, "race diagnosis"): the accepted focus
  session runs the long-break clock it never selected, its start timestamp is
  reset so `planSessionCompletion()` logs nothing, `requestEndSession()` becomes
  a no-op because it is gated on a live start timestamp, and the durable intent
  still claims the focus session that never ran.
- No schema, sync, backup, timer-arithmetic, or preset-storage change is in
  scope. The existing session engine and the durable-intent contracts
  (`savePomodoroActiveTimer` / `getPomodoroActiveTimer` /
  `clearPomodoroActiveTimer` / `planActiveTimerReconcile`) are preserved.
- Backdrop residuals, unchanged by this pass: the two pre-existing undocumented
  HIGH advisories (`braces` GHSA-vfj7-8cjw-p6xm, `node-forge`
  GHSA-86w9-cpqp-85rv), hosted E2E/nightly skipping behind the audit gate,
  native Android API36/x86_64 unavailability (W16 pending), iOS owner-deferred,
  and the D14 host-load sensitivity on this Windows host.

## Scope

- `features/pomodoro/pomodoro.startup.ts` (new): the explicit phase authority
  (`IDLE → STARTING → RUNNING → PAUSED`), the synchronous configuration
  predicates, the end-notification tri-state classification, the pure startup
  plan, and the injectable async sequence with a recovery path.
- `features/pomodoro/PomodoroScreen.tsx`: wire the authority (`isStarting`
  state, guarded callbacks, frozen governing preset, failure recovery, concise
  failure notice, single disabled startup action).
- `features/pomodoro/pomodoro.domain.ts`: move the pure notification copy into
  the domain layer so the plan and the resume path share it.
- `features/pomodoro/pomodoroCommandBridgeContext.ts` /
  `pomodoroCommandBridge.tsx`: a startup is a session for the command bridge.
- `features/command/command.executor.ts`: surface a rejected startup truthfully.
- Tests: `tests/pomodoro.startup.test.ts`,
  `tests/integration/pomodoroStartupIntent.test.ts`, `e2e/pomodoro.spec.ts`
  additions, `e2e/pomodoro-w85-audit.spec.ts` (new rendered instrument).

## Non-Goals

- No redesign of the Focus surface, no timer-arithmetic or schema change, no
  migration, no second session authority, no production-only test switch.
- No relaxation of any assertion, ceiling, headroom floor, quarantine, or
  known-gap entry; no retries or skips to force a green.
- No W9 Workout work; no reopening of completed W8 tasks.

## Current Checkpoint

- Current milestone: W8.5 is complete. Starting main
  `c32685364cbe9c6d34a512c3b2bcef9b3a432e0b`; ending main is the W8.5 merge.
- Completed: source fix, deterministic race regression coverage, durable-intent
  integration coverage, Focus E2E additions, and the W8.5 rendered audit.
- In progress: none.
- Important modified files: `features/pomodoro/pomodoro.startup.ts` (new),
  `features/pomodoro/PomodoroScreen.tsx`, `features/pomodoro/pomodoro.domain.ts`,
  `features/pomodoro/pomodoroCommandBridgeContext.ts`,
  `features/pomodoro/pomodoroCommandBridge.tsx`,
  `features/command/command.executor.ts`, `tests/pomodoro.startup.test.ts` (new),
  `tests/integration/pomodoroStartupIntent.test.ts` (new),
  `e2e/pomodoro.spec.ts`, `e2e/pomodoro-w85-audit.spec.ts` (new),
  `docs/ui-ux/v3-audit/w8.5/` (13 inspected captures).
- Last successful validation: `npx tsc --noEmit` 0 errors; `npx eslint .
--max-warnings 0` 0 errors / 0 warnings; `npm test` 2613 passed / 2 skipped
  with one pre-existing environmental failure (`tests/agentDocConsistency.test.ts`
  — git `core.autocrlf=true` checks `docs/testing/known-gaps.md` out as CRLF on
  this Windows host so the register parser sees zero entries; unaffected in CI's
  LF checkout). New lanes: `tests/pomodoro.startup.test.ts` 33/33,
  `tests/integration/pomodoroStartupIntent.test.ts` 4/4.
  `e2e/pomodoro.spec.ts` 16/16; W8.5 rendered audit 2/2 with 13 inspected
  captures; `npm run sim:validate` 23 scenarios / apiLeg guards clean;
  `qa:simulation --mode deterministic` passed; the `pwa` Playwright project
  5/5; the full `chromium`+`journeys` battery recorded below in Validation.
- Current failures: one pre-existing environmental Vitest failure (CRLF
  `known-gaps.md`) and one pre-existing D14 diagnostic-floor miss in
  `e2e/journeys/three-months-in.spec.ts` — both also reproduce on the
  unmodified baseline `c326853` (see Validation).
- Relevant quarantines: none added.
- Blockers: none for web continuation.
- Exact next action: none — W8.5 is complete. The parent wave continues at W9
  Workout planning only; do not implement W9 from this plan.
- Remaining definition of done: all tasks in `tasks.md` complete — the explicit starting authority, the synchronously guarded configuration paths, the frozen governing preset, the honest notification tri-state, the rejected-startup recovery, the deterministic deferred-scheduling race regression, the real-SQLite durable-intent coverage, the Focus E2E additions, and the 13 inspected W8.5 rendered captures — with the applicable gate ladder green and no threshold, assertion, floor, or quarantine changed. Native qualification and hosted CI remain unclaimed.

## Progress

- [x] 1.1 W8.5 ExecPlan authored as the only living W8.5 plan; parent checkpoint
      repointed here
- [x] 2.1 Add the explicit `IDLE → STARTING → RUNNING → PAUSED` authority with
      the synchronous configuration predicates and the end-notification
      tri-state classification
- [x] 3.1 Wire the authority into `PomodoroScreen` (`isStarting`, guarded
      mode/preset/duration callbacks, command bridge, launcher suppression)
- [x] 4.1 Freeze the governing preset with the accepted session; a mid-session
      selection governs the next timer
- [x] 5.1 Add the rejected-startup recovery path, the concise failure notice,
      and the truthful command-layer `failed` outcome
- [x] 6.1 Add the deterministic deferred-scheduling race regression
      (`tests/pomodoro.startup.test.ts`) including the reproduced pre-fix
      corruption
- [x] 6.2 Add durable-intent integration coverage against real SQLite
      (`tests/integration/pomodoroStartupIntent.test.ts`)
- [x] 6.3 Add Focus E2E coverage for repeated Start and idle mode selection
- [x] 7.1 Capture and inspect the W8.5 rendered surfaces under
      `docs/ui-ux/v3-audit/w8.5/`
- [x] 8.1 Run the applicable gate ladder and record the D14 baseline comparison

## Surprises & Discoveries

- The pre-existing `e2e/command.spec.ts` "keeps the single Add launcher …"
  test already carried a defensive retry (`try { pause enabled } catch { click
Start again }`), i.e. the startup window had already produced observable
  flakiness in the suite before this pass characterized it.
- On web the race is a single microtask, so it is invisible in E2E: the visible
  STARTING state is a native permission-prompt concern. Reproducing it
  deterministically requires a deferred promise, which the E2E harness cannot
  inject without a production-only switch, so the regression lives in the unit
  and integration lanes with E2E retaining the public interaction.
- `normalizeActiveTimerIntent()` always materializes
  `pausedRemainingSeconds: null` on read, so intent assertions against real
  SQLite must include that key even for a running intent.

## Decision Log

- 2026-10-09 — The startup authority lives in a new
  `features/pomodoro/pomodoro.startup.ts` rather than inside
  `pomodoro.domain.ts`: the safety predicates and the startup plan are pure
  (domain-shaped), but the sequence needs injected scheduling side effects.
  `PomodoroScreen` mirrors the phase into `startInFlightRef` (synchronous) and
  `isStarting` (rendered) — the same ref/state mirror pattern the screen already
  uses for its other seven mirrored values — so there is one authority, not two.
- 2026-10-09 — The safety predicates read claims the screen owns in refs
  (`starting`, `active`) rather than `isRunning`/`isPaused` state: a callback
  preserved in a `useCallback` would otherwise see a stale closure and could
  read a claimed session as idle. Render-time copy uses the rendered booleans.
- 2026-10-09 — The mode selector's `onChange` keeps its existing behaviour and
  gains a synchronous guard at the top; it is not disabled-and-hidden only,
  because the requirement is that the callback is safe from a stale render or a
  queued press.
- 2026-10-09 — A rejected startup returns to idle rather than starting the
  countdown without a notification: the countdown would then have no end alert
  AND no coherent durable intent, so recovering is the smaller failure.
- 2026-10-09 — No production-only delay switch was added to make the web E2E
  harness hold the startup open; the deferred-scheduling regression lives in
  the unit/integration lanes instead, and the web-rendered STARTING surface is
  pinned by assertions on the exact copy and the withdrawn configuration.

## Validation

- 2026-10-09 — `npx tsc --noEmit`: 0 errors.
- 2026-10-09 — `npx eslint . --max-warnings 0`: 0 errors, 0 warnings.
- 2026-10-09 — `npm test` (unit + integration): 2613 passed / 2 skipped;
  1 failure, `tests/agentDocConsistency.test.ts`, classified ENVIRONMENT (CRLF
  checkout of `docs/testing/known-gaps.md` on this Windows host) and
  pre-existing at `c326853`. `tests/pomodoro.startup.test.ts` 33/33 including
  the deferred-scheduling race, the reproduced pre-fix corruption, permission
  denial, web null, scheduling exception, and the long-break cadence.
  `tests/integration/pomodoroStartupIntent.test.ts` 4/4 against real SQLite.
  Existing pomodoro/command lanes unaffected (131/131 across pomodoro, active
  timer, correction, session-meta, command executor, notifications).
- 2026-10-09 — `e2e/pomodoro.spec.ts` (chromium, fresh hermetic `dist/`): 16/16,
  including the new repeated-Start and idle-mode-selection tests and the
  pre-existing W8 stale-confirmation tests.
- 2026-10-09 — W8.5 rendered audit
  (`VISUAL_AUDIT=1 VISUAL_AUDIT_OUTPUT_DIR=docs/ui-ux/v3-audit/w8.5 npx
playwright test e2e/pomodoro-w85-audit.spec.ts`): 2/2 pass; 13 captures
  inspected pixel-by-pixel. No clipping, no duplicate start action, no obsolete
  configuration control reachable, no misleading running animation.
- 2026-10-09 — Shared confirmation behaviour unregressed:
  `e2e/boundary.spec.ts`, `e2e/gamification.spec.ts`, `e2e/command.spec.ts`,
  `e2e/todos.spec.ts`, `e2e/habits.spec.ts` all pass (55 passed / 1 skipped),
  covering keyboard focus entering the confirmation, Tab containment, cancel
  focus restoration, confirm handling, and the Focus stale-confirmation safety.
- 2026-10-09 — Cross-surface journeys (`settings-ripple`, `a-tuesday`,
  `fat-fingers`, `three-months-in`, `linked-actions-log`): 32 passed / 1
  failed / 1 did not run. The failure is the `three-months-in` D14 diary-search
  **diagnostic headroom floor** (434ms / 451ms of the 500ms ceiling; the ceiling
  failed / 1 did not run. The failure is the `three-months-in` D14 diary-search
  **diagnostic headroom floor** (434ms / 451ms of the 500ms ceiling; the ceiling
  itself held on every run).
- 2026-10-09 — Full chromium+journeys battery (`npx playwright test
--project=chromium --project=journeys --workers=1`, fresh hermetic `dist/`,
  325 tests): **253 passed / 67 skipped / 1 failed / 4 did not run**. The single
  failure is the `three-months-in` section-switch **diagnostic headroom floor**
  (702ms of the 800ms ceiling — the ceiling itself held), a load-sensitive
  measurement that passes on an isolated run and reproduces on the baseline
  (see the D14 note below). The Focus-critical journey (`a-tuesday` steps 5–8:
  "a focus timer surviving every section switch", "Timer survives a detour
  through Todos; complete a todo mid-focus", "exactly one session is logged",
  "Reload: every aggregate survives") passed 8/8. `npm run sim:validate`
  reports 23 scenarios with apiLeg guards clean, `qa:simulation --mode
deterministic` passes, and the `pwa` Playwright project passes 5/5.
  unmodified baseline tree at `c326853` (changes stashed, dist rebuilt) fails
  the same floor at 439ms (12.2% headroom), against 434ms (13.2%), 451ms
  (9.8%), and 453ms (9.4%) on the W8.5 tree. The section-switch step
  (`maxSwitch ≤ 800ms`) PASSES on an isolated W8.5 run and only misses the 15%
  floor under full-battery CPU load (702ms, 12.3% headroom — the 800ms ceiling
  itself held). Every measured figure keeps both hard ceilings (500ms diary /
  800ms switch) intact. The assertion flips on unchanged product code and on
  the baseline itself, so it is the recorded host-load class, not a regression.
  No ceiling, floor, assertion, or quarantine was changed.
  regression. No ceiling, floor, assertion, or quarantine was changed.

## Changed files / areas

Feature:

- `features/pomodoro/pomodoro.startup.ts` — new phase authority, synchronous
  configuration predicates, end-notification tri-state classification, pure
  startup plan, injectable async sequence with recovery.
- `features/pomodoro/PomodoroScreen.tsx` — `isStarting` state, guarded
  mode/preset/duration callbacks, synchronous editor close, frozen governing
  preset, failure recovery and concise notice, one disabled startup action,
  launcher suppression and command bridge including starting.
- `features/pomodoro/pomodoro.domain.ts` — `timerEndNotificationCopy()` moved
  into the pure domain layer.
- `features/pomodoro/pomodoroCommandBridgeContext.ts`,
  `features/pomodoro/pomodoroCommandBridge.tsx` — `isStarting` registration;
  a startup conflicts with a command start.

Command layer:

- `features/command/command.executor.ts` — `FocusStartResult` gains `failed`;
  a rejected startup reports an error instead of a success.

Tests / selectors:

- `tests/pomodoro.startup.test.ts` — new unit lane.
- `tests/integration/pomodoroStartupIntent.test.ts` — new integration lane.
- `e2e/pomodoro.spec.ts` — repeated-Start and idle-mode-selection coverage.
- `e2e/pomodoro-w85-audit.spec.ts` — new rendered-truth instrument.

Docs / planning:

- `docs/ui-ux/v3-audit/w8.5/` — 13 inspected captures plus README.
- `openspec/changes/frontend-v3-w85-focus-startup/` — proposal, tasks, specs
  delta, and this plan.
- `openspec/changes/frontend-v3-w8-focus/execplan.md` — checkpoint reconciled
  to the closure merge `c326853`.
- `openspec/changes/frontend-v3-calm-momentum/execplan.md` — parent checkpoint
  reconciled and repointed here.

## Recovery / Resume Instructions

- Fresh session: `npm run agent:resume -- --plan
openspec/changes/frontend-v3-w85-focus-startup/execplan.md`, then
  `git status --short` / `git log --oneline -5` and reconcile against the
  checkpoint above before editing. Parent wave context:
  `openspec/changes/frontend-v3-calm-momentum/execplan.md`.
- Focus E2E lane: `npx playwright test e2e/pomodoro.spec.ts` (the journeys
  project owns `e2e/journeys/**`; run settings-ripple/a-tuesday/
  three-months-in there when a shell or selector change touches them).
- Render lane: `npm run build:e2e` then
  `VISUAL_AUDIT=1 VISUAL_AUDIT_OUTPUT_DIR=docs/ui-ux/v3-audit/w8.5 npx
playwright test e2e/pomodoro-w85-audit.spec.ts` (isolate the port with
  `E2E_PORT=8083` and inspect port owners first; never kill unrelated
  processes). The hermetic build refuses ambient `EXPO_PUBLIC_SUPABASE_*`.

## Outcomes & Retrospective

- The asynchronous window is closed: a session accepted for start claims its
  mode, duration, start timestamp, governing preset, and durable intent from
  the press onward, and every configuration path re-checks the live claims
  instead of trusting the render.
- The reproduced pre-fix corruption is pinned as a regression in the
  "race diagnosis" block, so the failure mode cannot silently return.
- What worked: extracting the authority and the sequence into a module with
  injected side effects, which made the deferred-scheduling race exactly
  reproducible without any production test switch, and keeping the durable
  intent written from the same plan object the clock and notification use, so
  the three cannot disagree.
- What to keep doing: treating a "render-derived" safety property as a defect
  class — every guard in this screen family should read live claims, not the
  rendering closure.
