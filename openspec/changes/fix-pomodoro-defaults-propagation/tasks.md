# Tasks — `fix-pomodoro-defaults-propagation`

## 1. Fix — re-read Pomodoro defaults on activation (`features/pomodoro/PomodoroScreen.tsx`)

- [ ] 1.1 Add a `loadSettings` callback in `PomodoroScreen` that calls `getPomodoroSettings()` (`features/pomodoro/pomodoro.data.ts`) and `setSettings(s)`, and wire it into the existing `useActiveForegroundRefresh(isActive, …)` path (`lib/useForegroundRefresh.ts`) alongside `loadHistory` (line ~112), so every activation of the already-mounted Focus section re-reads `app_meta.pomodoro_settings`.
- [ ] 1.2 In that callback, apply the fresh defaults to the idle timer only: when `!isRunning && !isPaused`, also recompute and set `totalSeconds`/`remaining` via `getModeDuration('focus', s)` (the same derivation as the mount-time loader at lines ~89–97); when a session is running or paused, update `settings` state alone and leave `remaining`, `isPaused`, and `startedAt` untouched (J10 step 5's paused-session invariants).
- [ ] 1.3 Do not change the persisted shape or the Settings save path: confirm `getPomodoroSettings()`/`setPomodoroSettings` in `features/pomodoro/pomodoro.data.ts` and the Settings drawer (`features/settings/SettingsScreen.tsx`, "Save timer defaults") already read/write `app_meta.pomodoro_settings` correctly — only the section's read-back timing changes; no SQLite/migration impact.

## 2. Tests

- [ ] 2.1 Extract the idle-vs-session application decision into a pure helper in `features/pomodoro/pomodoro.domain.ts` (e.g. `applySettingsToIdleTimer(settings, isRunning, isPaused)`) and add Vitest coverage in `tests/pomodoro.domain.test.ts`: fresh defaults replace the idle timer duration, and a running or paused session keeps its retained state (remaining/paused flags) while only the settings value updates.
- [ ] 2.2 Add the live-section regression assertion to J10 step 5 in `e2e/journeys/settings-ripple.spec.ts` (the step ending at line ~349): after `Reset` and before `returnToApp`, assert the already-mounted Focus section's idle `.text-5xl` timer shows the new default `40:00` (the stale `35:00` assertion the parent change dropped is restored as a passing test — unweakened; the reload-survival half at lines ~344–348 must keep passing).
- [ ] 2.3 Confirm no quarantine to release: the J10 finding was filed with the live assertion dropped, not as `test.fixme()`/`it.fails()` — verify `docs/testing/known-gaps.md` and the spec contain no `fix-pomodoro-defaults-propagation` quarantine entry, and add none; 2.2 lands un-quarantined. (If a `test.fixme()` marker is found while implementing, remove it in this change per the D13 protocol, never by weakening an assertion.)

## 3. Verification

- [ ] 3.1 `npm run typecheck` and `npm run lint` clean (0 errors; warnings under the existing cap).
- [ ] 3.2 `npm test` — the new `tests/pomodoro.domain.test.ts` cases plus the full Vitest suite pass.
- [ ] 3.3 `npm run build:web` (dist/ must be current), then the J10 journey passes in the standard lane: `npx playwright test --project=journeys e2e/journeys/settings-ripple.spec.ts` — all 5 steps, including the new live-section assertion (no `@sync`/dist-sync boundary involved; J10 asserts local SQLite rows only).
