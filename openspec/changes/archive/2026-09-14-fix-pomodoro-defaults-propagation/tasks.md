# Tasks — `fix-pomodoro-defaults-propagation`

## 1. Fix — re-read Pomodoro defaults on activation (`features/pomodoro/PomodoroScreen.tsx`)

- [x] 1.1 Added `loadSettings` in `PomodoroScreen` and wired it into the generation-aware activation/foreground refresh alongside history, so an already-mounted Focus section re-reads `app_meta.pomodoro_settings`.
- [x] 1.2 Applied fresh defaults to the idle timer only through the pure `applySettingsToTimerState` helper; running and paused sessions retain their duration, remaining time, and state.
- [x] 1.3 Left the persisted settings shape and Settings save path unchanged; no SQLite or migration impact.

## 2. Tests

- [x] 2.1 Added `applySettingsToTimerState` and 3 strict unit cases covering idle, running, and paused sessions; the Pomodoro domain suite passes 44/44.
- [x] 2.2 Added the unchanged-contract live idle `40:00` assertion to J10 step 5; J10 passes all 5 steps after the fix.
- [x] 2.3 Confirmed there is no Pomodoro quarantine entry; the live assertion remains unquarantined.

## 3. Verification

- [x] 3.1 `npm run typecheck` and `npm run lint` pass with 0 errors and warnings under the existing cap.
- [x] 3.2 `npm test` — the new `tests/pomodoro.domain.test.ts` cases plus the full Vitest suite pass (656 tests).
- [x] 3.3 Fresh `dist/` build and J10 settings-ripple journey pass in the standard lane, including the live-section assertion; no remote/sync boundary is involved.
