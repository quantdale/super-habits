## Context

See proposal.md for why. The timing authority already lives in `features/pomodoro/pomodoro.domain.ts`: `planSessionCompletion()` logs focus once with `ended_at = started_at + duration_seconds`, breaks are not logged, and `planActiveTimerReconcile()` refuses to complete a paused deadline. `PomodoroScreen` is one ~1,200-line component that paints every phase through the same tinted card. `reset()`, paused mode changes, and inline duration saves currently discard an active session immediately. Preset application and command start already refuse to replace an in-flight clock. `useConfirmationDialog` is the existing confirm primitive. Requirements are in the three delta specs.

## Goals / Non-Goals

**Goals:**

- Six presentation hierarchies on the unchanged session engine.
- A completion frame that shows the finished duration until advance or the existing auto-start beat.
- Confirmed end, with cancel preserving deadline, notification, and durable intent.
- Tick updates that do not recompute history, garden, or heatmap.

**Non-Goals:**

- Rewriting deadline math, pause accounting, notification scheduling, reconcile kinds, or gamification attribution.
- A preset-domain rewrite, a new dialog system, or a second ExecPlan under `.agent/execplans/`.
- Relaxing the D14 800ms ceiling or 15% headroom floor. Closing braces or node-forge. Starting W9.

## Decisions

### 1. Split presentation from the session engine

Keep `planSessionCompletion`, `planActiveTimerReconcile`, `recordCompletedPomodoroSession`, notification schedule/cancel, and active-timer intent as they are. Move phase chrome into presentational children or a pure view-model that reads phase, remaining, and association. The screen keeps orchestration.

Alternative: rewrite the screen as a reducer that also owns deadline math. Rejected. The persistence bugs this campaign must not introduce live in that arithmetic.

### 2. Completion is a frame, not a delayed mode commit

`start()` reads React `currentMode`, which `runCompletionEffects()` already advances before the 800ms auto-start beat. Do not delay that state update or auto-start will relaunch the mode that just finished. Hide the next duration while `completionSummary` is visible and paint the completed duration as the dominant time. `start()` already clears the summary when the next session actually starts. Classic stays manual; Deep Work and Sprint keep their preset flags and the 800ms beat.

Alternative: delay `setCurrentMode` until the beat ends and teach `start()` to read a ref. Rejected. It couples a visual fix to the start path and can double-start or start the wrong mode.

### 3. End is the only discard

Use `useConfirmationDialog`. Focus copy: "End this focus session?" / "This unfinished session won't be logged." / "Keep focusing" / "End session" (danger). Break copy is the same shape with break wording. Idle, untouched timers do not confirm.

Hide mode segments, preset application, and duration editing while running or paused. Do not confirm-then-abandon those actions. Align them with preset select, which already keeps the in-flight duration. `handleSaveSettings` must not clear an active intent if it can still be reached; it applies to the next idle timer only. Command start stays a conflict. Settings defaults propagation stays as specified by `pomodoro-defaults-propagation`.

Alternative: keep mode-switch and duration-save as confirmed abandons because the old comments call them intentional. Rejected. The paused-clock requirement says configuration must not discard progress. Explicit End preserves the "never log an abandon" outcome.

### 4. One cycle sentence, no idle dots

Show one accessible sentence only when it changes the next step, including "Session 2 of 4" during an active cycle. Show nothing at idle when the cycle index is 0. Do not keep the dot row beside that sentence.

### 5. Sprout leaves the clock

Do not mount `FocusSprout` on running, paused, or the completion frame. Keep `GardenGrid` behind history. No per-second stem growth. Reduced Motion already exists; completion must not add a looping transition. Garden identity stays in history, which is the research-backed place for it.

Alternative: a static 16px sprout beside the digits. Rejected for the running state. The 390 running capture reads that mark as debris, and any progress-tied prop still invites per-tick updates.

### 6. History is a secondary disclosure

Idle may show one quiet summary line and one History entry. Recent sessions, garden, heatmap, and detailed stats render only when that entry is open. Session note and metadata editing stay on that path. Running and paused do not mount them.

The countdown tick must not `setState` on the screen that computes those models. Own the displayed second in a child, or keep remaining in a ref and publish minute/phase changes to the parent. Pause and resume keep reading the authoritative remaining ref. Do not change the delta calculation.

### 7. Announcements follow phase, not seconds

Digits are visual. A polite status updates on start, pause, resume, complete, and end, not every second. Requesting the timer reports phase and remaining time. Background copy says the session was backgrounded or kept running. It must not mention a dying plant. Interrupted, recovered-complete, and storage-failure notices stay separate and truthful.

### 8. Identity for tests moves off the doc subtitle

Idle uses a compact "Focus" heading and no subtitle. Every state exposes an accessible timer region named so section-switch oracles can replace `Classic sequence: focus → short breaks → long break — durations saved on device.` Update that marker in the same change. Do not keep the sentence to protect `three-months-in`. Leave Workout and Calories doc markers for later waves. Navigation labels stay unchanged.

### 9. One living plan

The slice ExecPlan lives at `openspec/changes/frontend-v3-w8-focus/execplan.md`. Update the parent checkpoint to point there. Do not also create `.agent/execplans/frontend-v3-w8-focus-v1.md`.

### 10. Refero lock

Adopt FocusPomo's single dominant countdown and TIDE's configure-then-immerse-then-summary sequence. Adopt Mindllama's explicit "End session?" versus resume. Reject full-bleed gradients, hold-to-stop as the only control, soundscape galleries, and illustrated focus cards.

## Risks / Trade-offs

- [Completion frame hides next duration while state has already advanced] → The frame must clear on `start()` and on dismiss, or the user can see a stale "Focused N min" over a running break. Cover both with a UI test.
- [Hiding mode-switch removes an old silent abandon] → Domain outcome of an explicit end is unchanged. Add a regression that paused mode and duration controls are absent and the frozen remaining time survives.
- [Confirmation labels clip in the existing horizontal dialog row] → Verify at 360px. Shorten call-site labels before changing `Modal`. Do not add a second dialog.
- [`start()` closure can relaunch the finished mode if mode state is delayed] → Decision 2 forbids that delay. A unit or screen test should start the next mode once under Deep Work / Sprint flags.
- [Selector churn in E2E, Maestro, and simulation] → Update strict names (`End session`, confirmation buttons, timer region). Do not loosen assertions or delete the reset/lifecycle flows.
- [Deferring heatmap work until History opens] → First open can be slower. Acceptable. Do not change query semantics or drop metadata editing.
- [Parent W7 checkboxes and CI ids are stale] → Reconcile from the slice tasks, defect ledger, and runs `37825722260` / `37848841434`. Do not reopen Habits.

## Migration Plan

1. Add the slice ExecPlan and reconcile parent W7 bookkeeping before UI edits.
2. Ship presentation and confirmation behind the existing engine, with selector updates in the same change.
3. Capture `docs/ui-ux/v3-audit/w8/` and close SYS-08, SYS-09, and SUR-09 only after inspected renders.
4. Rollback is a normal revert of the slice branch. No schema or backup migration.

## Open Questions

- History can be an inline disclosure or the existing sheet pattern. Either satisfies the specs if it stays off the running and paused path and keeps metadata editing.
- A static completion mark inside history is optional. It must not appear on the running clock.
