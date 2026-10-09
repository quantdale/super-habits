# W8.5 Focus timer-start safety — rendered audit

Captured with `VISUAL_AUDIT=1 VISUAL_AUDIT_OUTPUT_DIR=docs/ui-ux/v3-audit/w8.5 npx playwright test e2e/pomodoro-w85-audit.spec.ts` against the static web export (390×844 unless noted). Every capture was inspected pixel-by-pixel.

## W8.5 change under inspection

`features/pomodoro/pomodoro.startup.ts` (new) plus the `PomodoroScreen` wiring: an explicit `IDLE → STARTING → RUNNING → PAUSED` phase authority. A start that has been accepted claims its session synchronously, before the end-notification promise resolves, so mode selection, preset application, duration editing, and a second Start all conflict for the whole asynchronous window instead of rewriting a half-started session.

## Captures

- `390-focus-idle` — idle: exactly one primary start action, compact configuration (mode segments, presets, edit/manage), one "Up next" sentence, "Link a todo". Baseline for what a claimed session must withdraw.
- `390-focus-running` — after the press is accepted: one `Pause`/`End` action pair only. No mode selector, no preset selector, no duration entry, no "Link a todo", no History entry, no duplicate Start button. Phase headline `FOCUS`, announcement `Focus started — 25 minutes`.
- `390-focus-paused` — frozen clock, explicit `Paused · Focus` headline, Resume dominant.
- `390-focus-end-confirmation` — safe action first (`Keep focusing`), destructive action danger (`End session`).
- `390-focus-idle-ended` — confirmed End returns to idle with the configuration restored and nothing logged.
- `390-focus-completed` — finished duration dominant, no next-duration digits.
- `390-focus-idle-cycle-text` — one meaningful cycle sentence (`Session 2 of 4 next`), no dot row.
- `390-dark-focus-idle` — dark theme idle, configuration present.
- `390-dark-focus-running` — dark theme running, configuration withdrawn, one clock.
- `360-focus-idle` / `360-focus-running` — narrowest supported layout, same contract.
- `360-focus-large-text` — large-text proxy (every text node doubled) at 360px: `Pause` and `End` render fully with no ellipsis clipping and no duplicate action; no obsolete configuration control is reachable.
- `390-focus-end-confirmation` / `360-focus-end-confirmation` — confirmation at both widths.

## Defect findings

None. No clipping, no duplicate start action, no obsolete configuration control reachable after a press, no misleading running animation, and no keyboard focus left in a withdrawn control (the withdrawn surfaces unmount; the section's own tab order still reaches `Pause`/`End`).

## The STARTING phase on web

`scheduleTimerEndNotification()` returns `null` immediately on web (`lib/notifications.ts`), so a start resolves within one microtask and the visible STARTING state cannot be screenshotted from the static web export without adding a production-only delay switch, which this pass deliberately does not add. It IS a real, user-visible state on native, where the OS permission prompt holds the promise open.

Its rendered surface is pinned exactly by unit assertions in `tests/pomodoro.startup.test.ts`:

- `resolvePhaseHeadline({ isStarting: true, … }, 'Focus')` → `Starting · Focus`
- `resolvePhaseAnnouncement({ isStarting: true, … }, 'focus', 1500)` → `Focus starting — 25 minutes`
- `resolveTimerStatus({ isStarting: true, … }, 'Focus', '25:00')` → `Starting — 25:00 selected`
- `mayOfferConfiguration({ starting: true, active: true }, false)` → `false` (configuration withdrawn)
- `mayMutateConfiguration({ starting: true, active: true })` → `false` (every mutation path guarded)

The screen renders exactly one disabled `Starting…` action in that phase and no configuration surface, so there is never a duplicate Start button and the clock never counts before its startup operations complete.
