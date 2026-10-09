## Why

Focus still answers "here is the Pomodoro manual" instead of "am I focusing right now, and what is the one action I need?" Rendered truth at `4d7167c` shows a doc subtitle, a tinted timer card, mode segments, a decorative sprout, meaningless idle dots, and a clipped abandon label competing with the countdown. Running, paused, break, and completed states are the same layout with different buttons. The timer engine is already correct and must not be rewritten to fix the screen.

## What Changes

- Rebuild Focus as six distinct hierarchies — idle, running, paused, break, completed, and interrupted — on the existing session engine. The countdown is the visual center while a session is active. Presets, duration editing, history, garden, and heatmap leave the running and paused path.
- Replace `Reset (not logged)` / `Abandon (not logged)` with concise Pause, Resume, and End actions. Discarding a running or paused session requires confirmation. Cancelling that confirmation preserves the clock, notification, and durable intent exactly. Abandoned sessions are never logged. Idle reset of an untouched timer stays immediate.
- Remove silent discards: mode switching and inline duration edits are unreachable while a session is running or paused. Ending is the only discard. Settings defaults propagation must still leave an in-flight session untouched.
- Show cycle progress only when it means something ("Session 2 of 4", "Long break after this one"). Do not render placeholder dots at idle. Do not duplicate the count.
- Keep garden identity in history and a restrained completion acknowledgment. The sprout must not grow or animate on every tick. Reduced Motion disables decorative transitions. Completion keeps the finished duration on screen until the user advances or the existing auto-start beat fires. Digits must not jump to the next duration underneath the summary.
- Make background, interruption, recovery, and storage-failure copy concise and true. Do not claim the plant dies on background, and do not hide a real save or notification failure.
- Announce phase changes to assistive tech, not every countdown second. Keep 44pt targets, visible web focus, and unclipped labels at 360px and under large text.
- Reconcile parent W7 task checkboxes and hosted-CI ids with published evidence. Do not reopen Habits behavior.

No timer-arithmetic, schema, sync, backup, or preset-domain rewrite. No dependency waiver. No W9 work.

## Capabilities

### New Capabilities

- `focus-timer-states`: observable Focus hierarchies, timer prominence, contextual progress, restrained motion, secondary history, and interruption copy.
- `focus-session-safety`: confirmation, cancel-preserves-session, single completion log, no logged abandon, unchanged auto-start / notes / linked todos / reconciliation, and no silent discard from mode or duration edits.

### Modified Capabilities

- `ui-ux-interaction-density-a11y`: an active Focus timer must not keep historical statistics in the reading order; idle still announces the timer and primary action before history. Focus End/Resume labels must not clip, and the Focus section marker must not depend on documentation copy.

## Impact

- `features/pomodoro/PomodoroScreen.tsx` and presentational siblings (`FocusSprout`, `BackgroundWarning`, preset/settings/history entry points). Domain functions in `pomodoro.domain.ts` stay the timing authority; presentation copy may move, arithmetic may not.
- `useConfirmationDialog` is the confirm primitive. Command-center start remains a conflict when a session is active.
- Selectors in `e2e/pomodoro.spec.ts`, command and settings-ripple journeys, `e2e/journeys/three-months-in.spec.ts` section markers, Maestro pomodoro lifecycle, and simulation steps that click the old reset label. Assertions stay strict.
- Ledgers and captures: `docs/ui-ux/14-v3-reference-ledger.md`, `docs/ui-ux/15-v3-defect-ledger.md`, `docs/ui-ux/v3-audit/w8/`. Parent `openspec/changes/frontend-v3-calm-momentum` stays the wave tracker.
- Preserve D14 known-gap 15, braces/node-forge audit red, stash `pre-recovery-local-changes`, and `.tmp-ios36423379932/`.
