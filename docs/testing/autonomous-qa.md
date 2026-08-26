# Autonomous QA workflow

SuperHabits has two deliberately separate testing modes:

- **Verification** is deterministic and gates correctness: Vitest unit/integration tests, hand-written journeys, and deterministic simulation scenarios.
- **Exploration** is seeded or agent-driven discovery: seeded simulations preserve their seed and action log; AI missions are opt-in and never gate a change.

## Recommended agent loop

After understanding the changed architecture and invariants:

1. Run `npm run qa:fast`.
2. Run `npm run qa:affected` (or `npm run qa:impact -- --base origin/main`) and use its resolved gates/tests.
3. Run `npm run qa:integration` for persistence, sync, restore, or cross-feature data changes.
4. Run `npm run qa:journeys` for focused user-level PR journeys.
5. Run `npm run qa:simulation` for the deterministic P0 scenario subset. Use `npm run qa:simulation -- --mode seeded --seed <seed>` only for report-only exploration.
   For long-session/resource qualification run the deterministic soak scenario: `npm run sim:run -- --mode deterministic --scenario soak-sustained-use` (HEAVY fixture; twelve day-long cycles of full section tours, CRUD churn, focus starts, hard reloads, and midnight crossings with strict final integrity oracles). Acceptance requires two clean fresh-state runs with all oracles green and no late-sequence latency growth; per-step `durationMs` distributions live in each run's `simulation-output/run_*/run-report.json`.
6. Run `npm run qa:full` when the impact plan marks broad regression, or when changing shared E2E/simulation/DB/time infrastructure.
7. Run `npm run qa:native:smoke` when native UI/navigation, settings persistence, or EAS/native build configuration changes. On an Android-capable host, use `npm run qa:native:android`; use `npm run qa:native:ios` or the EAS workflow for iOS.
8. Run `npm run qa:native:lifecycle` and the notification-path flow when changing Pomodoro timing, `AppState`, `expo-notifications`, or native lifecycle code. A missing device is an explicit `ENVIRONMENT` blocker, not a native pass.

`npm run qa:timezones` is required for `lib/time.ts`, date-key, clock, rollover, or timezone-sensitive changes. It runs the existing unit and real-SQLite date-key tests under Asia/Manila, UTC, America/New_York, Pacific/Honolulu, and Pacific/Kiritimati.

## Failure handling

Unexpected standard E2E failures attach `qa-diagnostics.json` and a focused screenshot. Playwright retains the failure trace in `.cursor/playwright-output/e2e-failures/`. Simulation failures additionally produce `run-report.json`, a failure digest, a seed/action log, and—when the runner failure hook is enabled—a repro bundle under `simulation-output/bundles/`.

Use exactly one classification after reproducing the failure:

| Classification       | Meaning                                                                                                          |
| -------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `PRODUCT_BUG`        | The intended contract is established and the implementation violates it.                                         |
| `TEST_BUG`           | The implementation satisfies the contract and the test is wrong, with evidence.                                  |
| `FLAKY_TEST`         | The result changes without a meaningful product-state difference; investigate synchronization/environment first. |
| `ENVIRONMENT`        | Browser, build, server, port, OPFS lock, dependency, or external-service failure.                                |
| `EXPECTED_KNOWN_GAP` | An intentional quarantine registered in `docs/testing/known-gaps.md`.                                            |
| `SPEC_AMBIGUITY`     | Repository evidence does not establish the expected behavior.                                                    |

An untriaged failure stays untriaged. A passing retry is evidence to investigate, not permission to label a test flaky. Preserve the original assertion, seed, persona, scenario, timezone, action order, database evidence, and artifact paths while classifying it.

## Impact map

`qa/impact-map.json` is the machine-readable changed-file map. `scripts/qa-impact.mjs` accepts `--base <git-ref>`, `--files <paths...>`, and `--json`; unmatched paths conservatively include `qa:fast` and `qa:full`. Add a rule when a new shared feature or test boundary is introduced.

For local E2E, build the static export first. The standard Playwright projects
serve it on `http://localhost:8081` by default. If another development server
already owns that port, use an isolated port; reuse is opt-in:

```bash
E2E_PORT=8091 npm run e2e:journeys:p0
E2E_PORT=8091 npm run e2e -- --project=chromium
E2E_REUSE_SERVER=1 npm run e2e:journeys:p0 # only for an intentionally prepared server
```

The sync lane uses the repository's `dist-sync/` build on `:8082`.

Native flows are in `.maestro/` and are run against the credential-free
current-source `e2e-test` equivalent, not Expo Go. On the supported Windows
Android lane, the repository runner auto-provisions the APK when the verified
API-36 x86_64 target is missing the package or has stale provenance; use
`npm run qa:native:provision -- --serial <serial>` for an explicit build/install
step. Local commands perform preflight and write focused reports under
`simulation-output/native/` (gitignored). A missing toolchain, target, or build
is an `ENVIRONMENT` blocker, never a native pass. The cost-conscious cloud path
is `.eas/workflows/native-e2e.yml`; it runs only by manual dispatch or the
explicit `native-e2e` pull-request label.

The standard feature project blocks service workers so they cannot bypass the
Playwright-routed OPFS harness between tests. `e2e/infrastructure.spec.ts`
opts back into service-worker control and remains the explicit verification
lane for registration, cache, and control behavior.

## Intentional waits

Fixed waits are not general synchronization. Remaining waits are retained only where the test models a real contract or lacks a browser-observable completion event:

- `e2e/boundary.spec.ts` recurring-todo loop: synthetic checkbox events exercise repeated expansion; the existing 600 ms settle is bounded pacing for the app write/expansion path.
- `e2e/helpers/dbHarness.ts` readiness settle: the database marker proves migrations are complete; the short post-bootstrap settle lets the first mounted section render before the harness handoff.
- `e2e/helpers/gestures.ts`: synthetic RN Web touch gestures do not expose a completion event; the 500 ms settle models gesture-end processing.
- `e2e/journeys/bad-backend.spec.ts`: `settleMs` and the 35-second wait model injected request deadlines and the fixed sync backoff interval, not UI readiness.
- `e2e/journeys/fat-fingers.spec.ts`: waits occur while a timer/workout is intentionally running before reload, exercising lifecycle abandonment.
- `e2e/journeys/three-months-in.spec.ts`: the 40 ms wheel cadence models browser scroll event delivery while virtualized rows settle.
- `simulation/runner/actions.ts`: the bounded launcher retry and pointer-sequence settle model semantic interaction delivery; `simulation/runner/execute.ts`'s `thinkTimeMs` is seeded persona pacing, not readiness synchronization.

When a new observable row, DOM marker, request, outbox transition, or clock event becomes available, replace the corresponding wait rather than increasing its duration.

## Scope boundaries

Known quarantines remain explicit in `docs/testing/known-gaps.md`. The existing simulation platform's AI mission execution and disposable Supabase round-trip remain external blockers; no result is fabricated for either. Native notification delivery, long-running background timers, `Alert.alert`, and system offline toggling remain capability gaps even though the focused Maestro lane now covers native launch, persistence, lifecycle-path, and scheduling behavior.
