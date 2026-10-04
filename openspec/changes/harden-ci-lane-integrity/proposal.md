## Why

The two guard scripts that exist specifically to stop main/nightly-only lanes from rotting are wired into `qa:fast` but not into CI, so the job that actually gates merges never runs them and a label rename or an unregistered quarantine is invisible to every green PR. The single CI step that could exercise the real remote Supabase boundary is conditioned on `env.SUPABASE_ACCESS_TOKEN`, which GitHub Actions never populates from a secret, so that lane has never executed in CI and nightly stays green with it permanently "not configured". Three further steps and comments assert gating behavior they do not implement, and the quarantine-register check is satisfiable by an incidental substring and cannot detect a register entry whose gate no longer exists.

## What Changes

- Run `node scripts/journey-label-parity.mjs && node scripts/quarantine-register-parity.mjs` in the `quality` job of `.github/workflows/ci.yml`, matching what `qa:fast` and `docs/testing/known-gaps.md` already promise.
- Rewrite the disposable-backend lane step so its condition reads the `secrets` context and the token is mapped into the step `env`, and add `tsx` as an explicit dev dependency so the step does not fetch it from the network.
- Make the `npm audit` step's gating behavior match its comment: either drop `continue-on-error` for high/critical, or relabel the step and job explicitly non-gating with a report-only job.
- Make the nightly job match its own "Non-gating by design" header by marking its report-only steps `continue-on-error: true`, and stop running `npm run e2e:sync` as a hard step in the gating `e2e` job for a lane `simulation/matrix.ts` declares `gates: false`.
- Add a `concurrency` group with `cancel-in-progress: true` to `.github/workflows/ios-native-e2e.yml`, matching `ci.yml`.
- Make Playwright retry usage visible instead of absorbing breaches: report retried-then-passed tests and fail a lane when a strict timing or row-oracle assertion only passes on a retry.
- Pin Playwright's `timezoneId` and `locale` in `use`, so the suite's date-key assertions do not depend on the host OS timezone when `TZ` is only set on the shell.
- Harden `scripts/quarantine-register-parity.mjs`: registration requires the gate stem to appear as a structured register entry rather than an incidental substring, and a reverse check fails when a register entry names a file with no gate. Extend the scan to `tests/**` and to `describe.skipIf` / `it.skipIf` / `it.fails`.
- Register the two `describe.skipIf` gates in `tests/integration/disposableCloudRoundTrip.test.ts`, each with its reason and lane.
- Either adopt the per-step `quarantine` field in `e2e/helpers/journey.ts` for the gates that would use it, or remove the dead field and its branch.

## Capabilities

### New Capabilities

- `ci-lane-integrity`: The pull-request gate runs every guard that protects a lane it does not itself execute; a lane that cannot run reports that it cannot run instead of passing by omission; every step and comment that claims to gate actually gates; and every skipped or quarantined test is registered with a reason in a register that detects both unregistered gates and stale entries.

### Modified Capabilities

None. `autonomous-qa-foundation` and `user-simulation-platform` own the QA loop and the simulation corpus, not the CI wiring or the register mechanics; this change introduces the CI-lane contract as its own capability rather than reopening theirs.

## Impact

Touches `.github/workflows/ci.yml`, `.github/workflows/ios-native-e2e.yml`, `playwright.config.ts`, `scripts/quarantine-register-parity.mjs`, `tests/integration/disposableCloudRoundTrip.test.ts`, `e2e/helpers/journey.ts`, `docs/testing/known-gaps.md`, and `package.json` (one dev dependency). No product code, no schema change, no Supabase query or mutation. Applying it makes a red lane visible as red for the first time and may therefore turn the nightly report red on the first run after apply; that is the intended behavior, not a regression to suppress.
