## 1. Fix the window arithmetic

- [x] 1.1 Confirm `lib/time.ts:64-72` `buildDateRangeOldestFirst` (or the equivalent sanctioned `setDate` walk) can express a single inclusive window start, and extend it additively if not
- [x] 1.2 Replace the fixed-millisecond window start at `features/goals/goals.data.ts:332` with local-calendar arithmetic
- [x] 1.3 Replace the fixed-millisecond window start at `features/daily-plan/dailyPlan.data.ts:294` with local-calendar arithmetic
- [x] 1.4 Replace the fixed-millisecond window starts at `features/projects/projects.data.ts:342` and `:389` with local-calendar arithmetic
- [x] 1.5 Replace the three direct `Date.now()` calls in these read paths with the injectable `nowIso()` seam from `lib/time.ts`

## 2. Regression coverage at the DST boundaries

- [x] 2.1 Add unit coverage pinning the goals rollup window start at a spring-forward and a fall-back instant in a DST-observing timezone
- [x] 2.2 Add unit coverage pinning the daily-plan listing window start at both boundaries
- [x] 2.3 Add unit coverage pinning both project habit-window starts at both boundaries
- [x] 2.4 Add one real-SQLite integration assertion that an inclusive N-day window spans exactly N local days across a spring-forward boundary
- [x] 2.5 Add coverage asserting that a window computed on an ordinary-length day is unchanged from the previous arithmetic, so the fix is provably boundary-only

## 3. Validate

- [x] 3.1 Run the affected unit tests and the real-SQLite integration project on pinned Node `v22.23.2` and record the exact result
- [x] 3.2 Run `npm run qa:timezones` and record the exact result
- [x] 3.3 Run `npm run test:unit` and `npm run qa:fast` and record the exact results
- [x] 3.4 Run `npm run typecheck` and `npm run lint --max-warnings 0` and record the exact results
- [x] 3.5 Run `npm run openspec:validate --all` and confirm this change still validates
- [x] 3.6 Review the full diff and confirm only the four window-start expressions, the three clock calls, and their tests changed
