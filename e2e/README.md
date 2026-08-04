# E2E Tests — SuperHabits

Playwright E2E tests for the SuperHabits web app.

## Prerequisites

Build static web output first with `npm run build:web`.
`npm run e2e` starts `node scripts/serve-e2e.js` automatically (serves `dist/` on localhost:8081).
Only one tab of localhost:8081 should be open (OPFS lock).

## Running tests

npm run e2e — run all tests headless (feature E2E specs)
npm run e2e:report — open the last HTML report
npm run e2e:headed — run with visible browser (debug)
npm run e2e:debug — run with Playwright inspector
npm run e2e:journeys — run the journey suite (`e2e/journeys/`) headless
npm run e2e:journeys:p0 — run only the P0 journeys (PR-lane subset)
npm run e2e:sync — run the remote-boundary journeys against `dist-sync/` (see [Dummy-Supabase build](#dummy-supabase-build))

Journey caveats:

- Journeys run against a `dist/` built with `npm run build:web`. Playwright does not build.
- Journeys are **session-scoped**: state is seeded once per journey and carried across steps — do not run the suite in random order.
- Sync/restore journeys additionally need the `dist-sync/` build described under [Dummy-Supabase build](#dummy-supabase-build).

## Output

.cursor/playwright-output/e2e-report/ — HTML report
.cursor/playwright-output/e2e-failures/ — failure screenshots

## Test files

### Feature E2E (default project, `e2e/*.spec.ts`)

helpers/forms.ts — Shared helpers: `fillCaloriesMacros`, `fillRoutineName` (RN Web controlled `TextInput` needs click + `type` with delay, not `fill` alone)
helpers/commandEvaluation.ts / helpers/commandObservation.ts — Shared command-center evaluation helpers

todos.spec.ts — Todos feature (add, complete, delete, empty state, validation, persistence)
habits.spec.ts — Habits feature (add, increment, edit/delete tap — Alert is no-op on web so full delete cannot be E2E’d without app changes)
pomodoro.spec.ts — Pomodoro (start timer, session log, empty history)
workout.spec.ts — Workout (add routine, complete, delete, empty state, validation, persistence)
calories.spec.ts — Calories (add entry, meal type, Form/Diary persistence, daily total, empty state, validation)
settings.spec.ts — Settings backup/restore eligibility and disclosures
command.spec.ts — Command-center launcher, overlay, parse/edit/confirm flow
command.eval.mock.spec.ts / command.eval.internal.spec.ts — Command draft quality/evaluation suites
command.observation.mock.spec.ts / command.observation.internal.spec.ts — Command observation/fallback suites
boundary.spec.ts — Cross-feature boundary and regression cases
infrastructure.spec.ts — Cross-cutting: COEP/COOP headers, SW cache, OPFS lock, crossOriginIsolated

### Journeys (`e2e/journeys/`)

The journey suite is a second Playwright project (serial, longer per-test timeout, `workers: 1`). Each journey is a single continuous, multi-step session driven by a persona — see the [Journey model](#journey-model) below. Journeys are written against real-world, day-spanning, interrupted use, and every mutating step asserts the persisted SQLite state, not only rendered text.

## Journey model

The journeys layer simulates how a real person uses the app over time — create → use → modify → leave → return → fail → recover → continue — with state deliberately carried between steps instead of reset per test. It runs on top of the feature E2E suite, which stays as the fast per-feature smoke layer.

- **Personas.** Six behavioural personas generate the ten journeys: P1 Maya (daily driver), P2 Tom (weekend returner), P3 Priya (power user), P4 Sam (error-prone), P5 Alex (commuter/offline), P6 Jordan (new-device migrator). A journey names its persona because the persona determines what the "realistic" behaviour is.
- **Session scoping.** One `test.describe.serial` block per journey file, one shared `page`, a single `clearDatabase()` + seed at the start, then ordered steps. A failed step aborts the rest of that journey file only. Do not `clearDatabase()` inside a journey that must accumulate state.
- **Fixtures.** Named volumes shared with the integration level: `SMALL` (empty/1–3 rows), `TYPICAL` (~14 days), `HEAVY` (~90 days, ≥200 todos, ≥600 calorie entries). Heavy fixtures are seeded via `page.evaluate()` through the real data layers, not clicked.
- **Oracles.** Mutating steps assert a triple: the acting surface's UI, an independent surface (Overview aggregate, Settings eligibility, heatmap), and persisted state after a reload — plus a **negative oracle** for what must _not_ have changed.
- **Quarantined steps.** Two decided contracts the application does not yet satisfy run as `test.fixme()` and are tracked in `docs/testing/known-gaps.md` (CG-1 day-rollover freshness → `fix-day-rollover-refresh`; CG-2 restore emptiness → `fix-restore-emptiness-counts-deleted-rows`). They are released by those companion changes, never weakened here.

See `docs/testing/known-gaps.md` and the change's `design.md` for the full model.

## Two-persistence-store reset caveat

The app persists to **two different stores with different clear semantics**:

1. **OPFS SQLite** — `superhabits.db{,-wal,-shm}`. `clearDatabase()` removes these and reloads.
2. **AsyncStorage** — user preferences: `superhabits.theme.mode`, `superhabits.theme.slots.v2`, `superhabits.calories.viewMode`, `superhabits.command.last-used-mode`, `superhabits.command.internal-rollout.remote-enabled`.

**`clearDatabase()` alone leaves AsyncStorage intact**, so theme, calories view mode and command-mode preferences leak between tests and journeys unless cleared explicitly. The journey reset helper (`e2e/helpers/reset.ts`) clears both stores; feature specs that care about preferences must clear the relevant AsyncStorage keys themselves (e.g. `e2e/calories.spec.ts` removes `superhabits.calories.viewMode`). A genuinely clean journey start also needs a fresh service-worker cache if a stale shell is suspected — see the assumptions in the change's `design.md`.

## Clock helper

Day-rollover journeys cross midnight without sleeping, using Playwright's clock API installed **before the app's first render** (bootstrap already captures the real time otherwise):

- `e2e/helpers/clock.ts` — installs `page.clock`, plus `advanceToNextDay()` and `setLocalTime()`.
- Rows written _before_ a clock jump keep their real timestamps — that is intentional (the past is the past); only writes issued after the jump land on the new day.
- The clock works because `toDateKey()` reads `new Date()` at call time and the Pomodoro tick uses `Date.now()` deltas — no application hook is required.

## Failure injectors

Remote behaviour is never exercised against a live Supabase project; failures are injected at the network boundary via `e2e/helpers/failure.ts` using `page.route()` against the Supabase origin:

| Injected condition    | How                                          | Typical use                          |
| --------------------- | -------------------------------------------- | ------------------------------------ |
| Offline               | `context.setOffline(true)`                   | Outbox accumulation, reconnect flush |
| 5xx                   | `route.fulfill({ status: 503 })`             | Backoff, partial-failure requeue     |
| Timeout               | delayed fulfil past the client's abort       | `unavailable` parser branches        |
| Malformed body        | `route.fulfill({ body: '{' })`               | Parser/adapter robustness            |
| Partial batch failure | fulfil per-entity: `todos` 200, `habits` 500 | Per-entity requeue scope             |

Sync journeys therefore require a build that has the Supabase env baked in — see below.

## Dummy-Supabase build

Sync/restore journeys need a `dist/` that was exported with a configuration where `isRemoteEnabled()` is true yet nothing is reachable. Because Expo public env vars are **bundled at export time**, those journeys cannot share the regular `dist/`:

- A second export, `dist-sync/`, is built with **dummy** `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` values pointing at a **non-routable host** (e.g. a `localhost`-style or obviously-fake origin), and is consumed by a dedicated Playwright project.
- **Never pass real credentials.** `EXPO_PUBLIC_*` values are public to the client bundle by design; real project credentials must never appear anywhere in a build, a fixture, or CI.
- The `dist-sync/` lane runs on `main` and nightly only — never on pull requests.

### The `journeys-sync` project (`npm run e2e:sync`)

The dedicated project selects exactly the remote-boundary journey steps (J3 reconnect-push, J4 backend failures, J5 restore round-trip — all tagged `@sync`) via per-project `grep: /@sync/`, runs them against `dist-sync/` on `localhost:8082`, and is **opt-in** — the default `npm run e2e` script lists the three standard projects explicitly, so PRs never wait on (or require) the `dist-sync/` build.

```bash
# Build the dummy-env export FIRST (--clear avoids a Metro transform cache that
# can carry the previous build's non-Supabase env into the bundle):
EXPO_NO_DOTENV=1 EXPO_PUBLIC_SUPABASE_URL=https://dummy.supabase.co \
EXPO_PUBLIC_SUPABASE_ANON_KEY=dummy-anon-key \
npx expo export -p web --output-dir dist-sync --clear

# Then run the dedicated lane:
npm run e2e:sync              # playwright test --project=journeys-sync
```

`npm run e2e:sync` sets `E2E_BASE_URL=http://localhost:8082` and
`E2E_DIST_DIR=dist-sync`; the DB harness (`APP_BASE_URL` in
`e2e/helpers/dbHarness.ts`), its wa-sqlite WASM discovery, the config's
`webServer`, and `globalSetup` all read the same env (defaults stay on
`:8081`/`dist`, so every other project is unaffected). The static server
(`scripts/serve-e2e.js`) gained `--port`/`-p` and `--dist`/`-d` arguments —
defaults unchanged (`8081` → `dist/`), the sync lane passes
`--port 8082 --dist dist-sync`.

On a standard `dist/` build the remote-boundary steps stay runtime-gated
(`test.fixme(!<boundaryDetected>, …)` — J4/J5 already were; J3's reconnect-push
step is now gated the same way) and show as skipped there; J5's CG-2 branch
remains quarantined pending `fix-restore-emptiness-counts-deleted-rows`.

## Audit and Failure Handling

- E2E failures are logged; see test output for artifacts.
- Known flaky tests or infrastructure issues are documented in the knowledge base.
- Skipped tests are marked with reasons in the codebase and knowledge base.
- Any skipped or quarantined test is registered in `docs/testing/known-gaps.md` with its reason — reduced coverage is never silently presented as passing coverage, and an assertion is never weakened to make a test pass.

## Notes

- Playwright uses `workers: 1` (see `playwright.config.ts`): parallel workers hit the same OPFS SQLite lock on `localhost:8081` and time out.
- Prefer `getByText` for `Button` / `Pressable` labels — RN Web often does not expose `role=button` + accessible name the way Playwright expects.
- Use `load` instead of `networkidle` for navigation — Metro keeps a live connection open so `networkidle` may never fire.
- Failure screenshots and traces go to `outputDir` in `playwright.config.ts` (`.cursor/playwright-output/e2e-failures/`).
- Tests run against the static web export (`dist/`) served by `scripts/serve-e2e.js`.
- OPFS lock: infrastructure.spec.ts opens two contexts to test the lock
- Data isolation: each test file clears relevant state via page reload
  or direct SQLite state reset where possible; journeys clear once per file at the start instead.
