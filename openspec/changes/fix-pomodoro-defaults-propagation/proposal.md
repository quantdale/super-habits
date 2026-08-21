## Why

`add-real-world-user-simulation-testing` defines the settings→feature propagation contract (risk **R11**): a change made in Settings must reach the owning section, not just survive a reload. Journey **J10 — "Settings ripple"** (step 5) exercises the specific case that surfaces the defect: changing the Pomodoro defaults while a Focus session is **paused**.

`PomodoroScreen` reads `pomodoro_settings` from `app_meta` **only on mount** (its `useEffect` loader runs once). Because all six sections are permanently mounted and never unmounted (the single-page shell in `app/index.tsx`), the Focus section is already mounted when the user changes the defaults in Settings. The save writes `app_meta.pomodoro_settings` correctly, but the already-mounted section has no path to re-read it — the new defaults land only after a **reload**. J10 step 5 observes the ripple failing for the already-mounted section (the new 40:00 default appears only after `returnToApp`, not on the live section), which is the R11 risk made concrete.

## What Changes

- **Propagate a pomodoro-defaults change to an already-mounted Focus section** without unmounting: re-read `pomodoro_settings` when the section becomes active (its `isActive` foreground-refresh path), or subscribe to a settings/app_meta change signal that `PomodoroScreen` already consumes, so a save in Settings bumps the value the section holds.
- **Do not disturb a running or paused session**: J10 step 5 asserts that a paused session's remaining time and paused state are untouched by a defaults change, and that no session is logged from the interruption. The propagation must update the _default_ durations (what a fresh idle timer shows) while leaving the in-flight session's retained state alone.
- **Persist unchanged**: the save path in Settings already writes `app_meta.pomodoro_settings` correctly; that is not the defect. Only the live-section propagation is missing.

## Capabilities

### New Capabilities

- `pomodoro-defaults-propagation`: a Pomodoro defaults change in Settings reaches the already-mounted Focus section deterministically (not only after reload), while a running/paused session is left untouched.

### Modified Capabilities

- None. The persisted `pomodoro_settings` shape and the Settings save path are unchanged; only the section's read-back timing (and the reload-survival assertion, which already holds) is extended to cover the live section.

## Impact

- **Modified files**: `features/pomodoro/PomodoroScreen.tsx` (re-read defaults on activation / settings-change signal), possibly a shared settings-change event in `core/providers` or `SettingsScreen` if the propagation is wired through a context.
- **Behaviour change**: changing focus/break defaults in Settings now updates the open Focus section immediately (next activation) instead of requiring a reload; a paused session is not affected.
- **No schema/migration impact**: no SQLite or `app_meta` changes.
- **Testing**: J10 step 5's live-section assertion becomes a passing regression test (the reload-survival half already passes and must not regress).
- **Follow-up changes**: none anticipated; this closes the J10 finding.
