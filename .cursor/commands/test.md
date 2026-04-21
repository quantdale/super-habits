# test

Run the full SuperHabits test suite — unit tests (Vitest) and
E2E tests (Playwright) — in one pass. Reports results for both.

**E2E prerequisites:** Run `npm run build:web` whenever React components or the web bundle change (Playwright does **not** build automatically). Playwright starts `node scripts/serve-e2e.js`, which serves `dist/` on `localhost:8081` with strict `require-corp` COEP for OPFS. Metro is **not** used for E2E. With `reuseExistingServer: true` locally, you may leave a static server running on 8081 instead of relying on `webServer` startup.

---

## Phase 1 — Unit tests (Vitest)

Run: `npm test`

Expected: **299** tests passing, 0 failing

Report:

- PASS / FAIL
- If FAIL: exact test name, file, line, and failure message
- If FAIL: stop here and do not proceed to E2E — fix unit tests first

**What unit tests cover:**

- `tests/habits.domain.test.ts` — calculateHabitProgress
- `tests/pomodoro.domain.test.ts` — nextPomodoroState
- `tests/calories.domain.test.ts` — caloriesTotal, kcalFromMacros
- `tests/workout.domain.test.ts` — timer, heatmap, `computeWorkoutStreakFromHeatmapDays`, etc.
- `tests/calories.data.test.ts` — mocked calories data-layer coverage
- `tests/sync.engine.test.ts` — `SyncEngine.flush` queue snapshot + error recovery

---

## Phase 2 — E2E tests (Playwright)

Run: `npm run e2e`

Expected: all tests passing across:
todos.spec.ts — add, complete, delete, empty state,
validation, persistence
habits.spec.ts — add, increment, decrement, delete,
empty state, validation, persistence
pomodoro.spec.ts — timer start, running state, reset,
empty history
workout.spec.ts — add routine, complete, delete,
empty state, validation, persistence
calories.spec.ts — add entry, meal type, daily total,
empty state, validation, persistence
settings.spec.ts — backup restore eligibility and restore guards
command.spec.ts — command shell parse, confirm, and warning flow
infrastructure.spec.ts — COEP/COOP headers, crossOriginIsolated,
SW cache name, no stale v1 cache,
localhost network-first, OPFS lock,
clean DB init
boundary.spec.ts — cross-feature boundary, volume, and no-NaN/no-undefined checks

Report:

- Total tests: passed / failed / skipped
- If FAIL: test name, file, line, and error message for each failure
- Screenshot path if failure screenshot was captured

---

## Phase 3 — Combined report

| Suite            | Tests | Passed | Failed | Skipped |
| ---------------- | ----- | ------ | ------ | ------- |
| Unit (Vitest)    | 299   | ?      | ?      | 0       |
| E2E (Playwright) | 67    | ?      | ?      | ?       |
| **Total**        | ?     | ?      | ?      | ?       |

**OVERALL: PASS or FAIL**

If any failures:

- List every failing test with root cause
- Recommend fix command:
  - Logic bug → /fix (routes to correct agent)
  - Selector mismatch in E2E → update selector in e2e/\*.spec.ts
  - Infrastructure failure → /fix (COEP, SW, DB issue)

---

## Known non-blocking items

- tests/calories.data.test.ts — mocked data-layer contract coverage,
  not a live SQLite integration suite
- Pomodoro E2E timer tests are time-sensitive — occasional
  flakiness on slow CI machines is acceptable (retries: 2 in CI)

---

## Prerequisites

- Fresh `dist/`: `npm run build:web` before E2E when app code changed
- `localhost:8081`: Playwright `webServer` runs `node scripts/serve-e2e.js` (or reuse existing server on that port)
- Only one browser context / tab hitting the app origin for DB-heavy flows (OPFS lock)
- Playwright MCP not required for this command (uses CLI directly)
- **Workers:** keep `workers: 1` locally in `playwright.config.ts` — do not raise for parallel speed
