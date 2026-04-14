# E2E Tests — SuperHabits

Playwright E2E tests for the SuperHabits web app.

## Prerequisites

Build static web output first with `npm run build:web`.
`npm run e2e` starts `node scripts/serve-e2e.js` automatically (serves `dist/` on localhost:8081).
Only one tab of localhost:8081 should be open (OPFS lock).

## Running tests

  npm run e2e              — run all tests headless
  npm run e2e:report       — open the last HTML report
  npm run e2e:headed       — run with visible browser (debug)
  npm run e2e:debug        — run with Playwright inspector

## Output

  .cursor/playwright-output/e2e-report/   — HTML report
  .cursor/playwright-output/e2e-failures/ — failure screenshots

## Test files

  helpers/forms.ts       — Shared helpers: `fillCaloriesMacros`, `fillRoutineName` (RN Web controlled `TextInput` needs click + `type` with delay, not `fill` alone)

  todos.spec.ts          — Todos feature (add, complete, delete, empty state, validation, persistence)
  habits.spec.ts         — Habits feature (add, increment, edit/delete tap — Alert is no-op on web so full delete cannot be E2E’d without app changes)
  pomodoro.spec.ts       — Pomodoro (start timer, session log, empty history)
  workout.spec.ts        — Workout (add routine, complete, delete, empty state, validation, persistence)
  calories.spec.ts       — Calories (add entry, meal type, daily total, empty state, validation, persistence)
  infrastructure.spec.ts — Cross-cutting: COEP/COOP headers, SW cache, OPFS lock, crossOriginIsolated

## Audit and Failure Handling
- E2E failures are logged; see test output for artifacts.
- Known flaky tests or infrastructure issues are documented in the knowledge base.
- Skipped tests are marked with reasons in the codebase and knowledge base.

## Notes

- Playwright uses `workers: 1` (see `playwright.config.ts`): parallel workers hit the same OPFS SQLite lock on `localhost:8081` and time out.
- Prefer `getByText` for `Button` / `Pressable` labels — RN Web often does not expose `role=button` + accessible name the way Playwright expects.
- Use `load` instead of `networkidle` for navigation — Metro keeps a live connection open so `networkidle` may never fire.
- Failure screenshots and traces go to `outputDir` in `playwright.config.ts` (`.cursor/playwright-output/e2e-failures/`).
- Tests run against the static web export (`dist/`) served by `scripts/serve-e2e.js`.
- OPFS lock: infrastructure.spec.ts opens two contexts to test the lock
- Data isolation: each test file clears relevant state via page reload
  or direct SQLite state reset where possible
