## 1. One refresh per foreground

- [x] 1.1 Add failing coverage that a single web foreground triggers exactly one refresh call per mounted consumer of `lib/useForegroundRefresh.ts`
- [x] 1.2 Change the hook's listener registration so the `visibilitychange` listener is registered only when the platform's `AppState` is not already derived from that DOM event
- [x] 1.3 Add coverage that a native foreground triggers exactly one refresh call per consumer
- [x] 1.4 Add coverage that a day-generation bump still refreshes every mounted section exactly once, with no additional refresh

## 2. Memoize Habits derived state

- [x] 2.1 Add failing coverage that a Habits re-render with unchanged habit list and completion counts performs no additional rule-history parse
- [x] 2.2 Memoize `activeHabits` in `features/habits/HabitsScreen.tsx:691-699` on its source list
- [x] 2.3 Compute `scheduledTodayCount` and `completedTodayCount` from the memoized value so the existing `stripDays` memo's dependency is referentially stable
- [x] 2.4 Build a per-habit parsed rule-history map alongside the memoized list and read it inside the day loop at `features/habits/HabitsScreen.tsx:707-730`, leaving `isHabitScheduledOn` and `getHabitTargetForDate` unchanged
- [x] 2.5 Add coverage that the scheduled and completed counts, the day strip, and the hero subtitle are unchanged for the same data

## 3. Validate

- [x] 3.1 Run the affected unit tests and the real-SQLite integration project on pinned Node `v22.23.2` and record the exact result
- [x] 3.2 Run `npm run qa:timezones` and record the exact result
- [x] 3.3 Run `npm run qa:fast` and record the exact result
- [x] 3.4 Run `npm run typecheck` and `npm run lint --max-warnings 0` and record the exact results
- [x] 3.5 Run the J8 journey against a fresh hermetic `dist/` and record the exact per-switch and diary numbers with the ceiling and floor unchanged; if host memory is not credible, record that classification instead and change no threshold
- [x] 3.6 Run `npm run openspec:validate --all` and confirm this change still validates
- [x] 3.7 Review the full diff and confirm no benchmark harness, fixture, ceiling, headroom floor, or timing boundary was changed
