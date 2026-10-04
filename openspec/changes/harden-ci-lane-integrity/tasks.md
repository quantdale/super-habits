## 1. Preflight

- [x] 1.1 Run `node scripts/journey-label-parity.mjs` and `node scripts/quarantine-register-parity.mjs` on `main` at `c1bc380` and record the exact output before any edit
- [x] 1.2 Read `.github/workflows/ci.yml`, `.github/workflows/ios-native-e2e.yml`, `playwright.config.ts`, `simulation/matrix.ts`, and `scripts/quarantine-register-parity.mjs` and record every gating claim each file makes about itself

## 2. Wire the lane-protection guards into the pull-request gate

- [x] 2.1 Add `node scripts/journey-label-parity.mjs && node scripts/quarantine-register-parity.mjs` to the `quality` job of `.github/workflows/ci.yml`, positioned after the openspec validation and before the test step
- [x] 2.2 Register every gate stem the local runs report as unregistered, each with a structured `**Gate site:**` entry naming the file and the gate's reason and lane

## 3. Make the credential-gated lane executable and observable

- [x] 3.1 Change the disposable-backend lane step condition in `.github/workflows/ci.yml` from `env.SUPABASE_ACCESS_TOKEN` to `${{ secrets.SUPABASE_ACCESS_TOKEN != '' }}`
- [x] 3.2 Map `SUPABASE_ACCESS_TOKEN` from the `secrets` context into that step's `env:` block so `simulation/backend/provision.ts` receives it
- [x] 3.3 Add `tsx` as an explicit dev dependency in `package.json` at the version already resolved in `package-lock.json`
- [x] 3.4 Update the step comment so it states the corrected condition and what a "not configured" outcome looks like

## 4. Make advisory and report-only steps match their claims

- [x] 4.1 Remove `continue-on-error: true` from the `npm audit` step and keep `--audit-level=high`, or relabel the step and its comment as advisory for that severity
- [x] 4.2 Add `continue-on-error: true` to the report-only steps in the `nightly` job (`npm run e2e`, `sim:run -- --mode seeded`, `npm run e2e:sync`)
- [x] 4.3 Remove the hard `npm run e2e:sync` step from the gating `e2e` job, leaving that lane only where `simulation/matrix.ts` declares `gates: false`
- [x] 4.4 Add a `concurrency` group with `cancel-in-progress: true` to `.github/workflows/ios-native-e2e.yml` matching the `ci.yml` pattern

## 5. Pin browser context and surface retries

- [x] 5.1 Add `timezoneId` and `locale` to the `use` block of `playwright.config.ts`, using the timezone the workflows already set
- [x] 5.2 Add a retry-report gate so a test that fails its first attempt and passes a retry is reported distinctly, and a strict timing-ceiling or row-oracle assertion that only passes on a retry is not recorded as a clean pass

## 6. Harden the register and remove dead mechanism

- [x] 6.1 Rework `findUnregistered` in `scripts/quarantine-register-parity.mjs` so a stem counts as registered only when it appears in a structured register entry naming the gate site
- [x] 6.2 Add a reverse check that fails when a register entry names a file containing no gate call
- [x] 6.3 Widen `findGateFiles` to detect `describe.skipIf`, `it.skipIf`, and `it.fails`, and add a `tests/**` collection pass alongside the existing `e2e/**` pass
- [x] 6.4 Register the two `describe.skipIf` gates in `tests/integration/disposableCloudRoundTrip.test.ts` with their reason and lane
- [x] 6.5 Rewrite register entry 13 so it names the gate site that actually exists rather than the file it moved out of
- [x] 6.6 Remove the unused per-step `quarantine` field from `e2e/helpers/journey.ts` and its runner branch, and update the two references in `e2e/README.md`

## 7. Validate

- [x] 7.1 Run `node scripts/journey-label-parity.mjs` and `node scripts/quarantine-register-parity.mjs` and confirm both report the expected inventory with zero unregistered and zero stale entries
- [x] 7.2 Run `npx vitest run tests/quarantineRegisterParity.test.ts tests/journeyLabelParity.test.ts` and record the exact result
- [x] 7.3 Run `npm run qa:fast` on pinned Node `v22.23.2` and record the exact result
- [x] 7.4 Run `npx playwright test --list` and confirm the project and test counts are unchanged, so no gate silently disappeared
- [x] 7.5 Run `npm run openspec:validate --all` and confirm this change still validates
- [x] 7.6 Review the full workflow and script diff for accidental lane removal, and confirm no `app/`, `core/`, `features/`, or `lib/` product file changed
