# Product Note — Pomodoro resume after reload

**Status:** UX recommendation (not a defect, not a requirement). **No test depends on it.**

> Source: decision D11 in `openspec/changes/add-real-world-user-simulation-testing/design.md`, and recorded as product note 0.7.3 in that change.

## The behaviour today

The Pomodoro timer is intentionally in-memory: mode, remaining time, `startedAt`, and the completed-focus count are plain React state in `features/pomodoro/PomodoroScreen.tsx`, driven by a `Date.now()`-delta tick. **Nothing about a running session is persisted.** A reload (or a browser/section restart) yields a clean idle state at the configured duration.

Notably, that is *safe*: `pomodoro_sessions` rows are written only when a countdown reaches zero, so an interrupted session produces no row, no duplicate, and no half-counted day. The binding guarantee is that **no partial session is ever logged** — that guarantee is asserted as a regression guard in the journey suite (J7, task 4.7).

## The cost

Users who reload a running timer lose the session. A user who is 20 minutes into a 25-minute focus and accidentally reloads the tab loses the session entirely — the countdown resets to 25:00 and they must restart. For a PWA habit-tracker audience that keeps the app open in a tab all day, this is a believable and annoying loss. It is a real product trade-off, recorded deliberately rather than laundered into a requirement.

## The recommendation

If resume-after-reload becomes a priority, persist the running session to `app_meta` (the existing JSON-blob store — `pomodoro_settings` already lives there, and `app_meta` already carries sync/restore state):

- **What to persist:** `startedAt` (+ the delta already elapsed, or keep `startedAt` and compute remaining on read), the active **mode** (`focus` / `short_break` / `long_break`), and the **duration** in seconds for that mode — the same shape the timer already derives from settings.
- **On reload:** read the persisted session on mount; if the elapsed wall-time is still within the duration, resume the countdown from the correct remaining time; if it already expired, log the completed session and start clean.
- **When to write/clear:** write at session start (and on pause, if paused state is also worth surviving), clear on completion, reset, or a stale read.

## Constraints and side effects to respect

- **No partial sessions may ever be logged** — this is the current contract and carries the data-integrity value. Resume must keep that invariant: a resumed session still logs exactly one row when it actually reaches zero.
- **Settings changed while a session is running or paused** (J10 covers settings-while-paused) must interact sanely with a persisted duration — decide whether a changed default re-applies to the current session or the next one.
- **Keep the in-memory fast path untouched** when the app is simply backgrounded but not reloaded; persistence is only a reload-survival mechanism.
- Because this is a data-shape addition, implement it as its own change with unit coverage for the persist/read/resume/stale-expiry logic — do not fold it into the testing change that recommended it.

## Decision needed

Resume-after-reload is a product judgement call, not an engineering necessity: shipping it adds persistence surface and a few edge cases (expired-in-reload, settings changes, stale keys) in exchange for sparing a subset of users an interrupted-session annoyance. Recorded here so the decision is explicit when someone picks it up.