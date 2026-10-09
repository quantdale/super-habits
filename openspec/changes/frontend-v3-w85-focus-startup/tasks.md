## 1. Bookkeeping

- [x] 1.1 Author `openspec/changes/frontend-v3-w85-focus-startup/execplan.md` as the only living W8.5 plan, and point the parent checkpoint at it
- [x] 1.2 Record the W8.5 baseline (`c32685364cbe9c6d34a512c3b2bcef9b3a432e0b`) and preserve the stash, temporary iOS evidence, W1–W8 captures, and unrelated worktrees

## 2. Startup authority

- [x] 2.1 Add the explicit `IDLE → STARTING → RUNNING → PAUSED` phase authority with the synchronous configuration predicates
- [x] 2.2 Classify the end-notification result into scheduled / unsupported-web / permission-denied before deciding the session's fate
- [x] 2.3 Build one coherent startup plan so the clock, the notification, and the durable intent cannot disagree about mode, duration, or start timestamp

## 3. Screen wiring

- [x] 3.1 Wire the authority into `PomodoroScreen`: `isStarting`, the withdrawn configuration surfaces, one disabled startup action, and truthful pending copy
- [x] 3.2 Suppress the command launcher and register the startup with the command bridge so a command start conflicts
- [x] 3.3 Close the inline duration editor synchronously when a start is accepted
- [x] 3.4 Freeze the governing preset with the accepted session; a selection made while a session is active governs the next timer

## 4. Failure recovery

- [x] 4.1 Return to idle on a rejected scheduling call with no session, no durable intent, no orphan notification, and a startable timer
- [x] 4.2 Surface a rejected startup with concise, actionable copy instead of an unhandled rejection
- [x] 4.3 Return a truthful `failed` outcome to the command layer for a rejected startup

## 5. Regression coverage

- [x] 5.1 Add the deterministic deferred-scheduling race regression: accepted start, unresolved scheduling, queued mode change, queued preset/duration change, a second Start, released promise, and the resulting mode/duration/remaining/start-timestamp/intent assertions
- [x] 5.2 Pin the reproduced pre-fix corruption so it cannot silently return
- [x] 5.3 Cover permission denied, web null, scheduling exception, rapid double Start, and the exact-once / never-logged completion paths
- [x] 5.4 Add real-SQLite durable-intent coverage for the started, permission-denied, and rejected-startup paths
- [x] 5.5 Retain E2E coverage for the public interaction: repeated Start starts one session, and an idle mode selection still governs the next start

## 6. Evidence and gates

- [x] 6.1 Capture and inspect the W8.5 rendered surfaces under `docs/ui-ux/v3-audit/w8.5/` at 390px, 360px, dark theme, and large text
- [x] 6.2 Verify the shared confirmation behaviour is unregressed (focus entry, Tab containment, cancel focus restoration, confirm handling, stale-confirmation safety)
- [x] 6.3 Run typecheck, lint, unit and integration tests, Focus E2E, the rendered audit, the affected cross-surface journeys, and the D14 baseline comparison without changing any threshold, floor, or quarantine
