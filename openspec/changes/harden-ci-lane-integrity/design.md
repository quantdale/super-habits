## Context

See proposal.md for the motivation. Current `main` is `c1bc380`. `.github/workflows/ci.yml` has three jobs: `quality` (`:31-115`), `e2e` (`needs: quality`), and `nightly` (`:291-…`), under one per-ref concurrency group with `cancel-in-progress: true` (`:26-28`). `playwright.config.ts:27` sets `retries: process.env.CI ? 2 : 0`, and `:132` already overrides `retries: 0` for one project, so a per-project retry policy is an established mechanism. `simulation/matrix.ts` is the declared lane table: it carries a `gates` boolean per lane (`:87,:98,:112,:124,:136,:160,:172,:190`), a `dist-sync-not-on-pr` rule (`:198-200`), and a header that says CI must not drift from it without changing both (`:9-13`). `scripts/quarantine-register-parity.mjs` collects gate stems only from `e2e/**/*.spec.ts` and only for `test.fixme(` / `test.skip(` (`:141-146`, `:168`), then reports a stem as registered when the register text merely contains it (`:154-156`).

## Goals / Non-Goals

**Goals:**

- Make the `quality` job run the same guard set as `qa:fast`, so main/nightly-only lanes cannot rot behind a green PR.
- Make a credential-gated lane's inability to run observable, and make its condition evaluate a context GitHub Actions actually populates.
- Make every "report-only" or "advisory" claim in the workflows true.
- Make the register capable of detecting both directions of rot, and widen its detection surface to the Vitest skip mechanisms.

**Non-Goals:**

- Redesigning the lane table or changing which lanes run on PRs versus main/nightly.
- Adding a flake-retry budget, a per-test quarantine workflow, or a test-report dashboard.
- Changing any journey's gate semantics, thresholds, or assertions.
- Making `nightly` gating. The job stays report-only; only its steps stop contradicting that.

## Decisions

### 1. Add the two guards to `quality` rather than replacing its body with `qa:fast`

Append `node scripts/journey-label-parity.mjs && node scripts/quarantine-register-parity.mjs` to the `quality` job, after the existing theme-token and openspec validations and before `npm run test`.

Alternative: replace the `quality` job body with `npm run qa:fast` plus the CI-only extras. Rejected. `qa:fast` re-runs `typecheck`, `lint`, and `test:unit`, which the job already runs as separately named steps with distinct failure attribution; collapsing them loses the per-check signal the job's structure exists to provide. The two added steps are the honest delta.

### 2. Fix the step condition to read the `secrets` context and map the token

Change the step condition to `if: ${{ secrets.SUPABASE_ACCESS_TOKEN != '' }}` and add `SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}` to the step's `env:` block, so `simulation/backend/provision.ts` receives it. Add `tsx` as an explicit dev dependency in `package.json` so `npx tsx` does not resolve from the network on a cold runner.

Alternative: shell out to the `supabase` CLI and rely on a runner-level login. Rejected. That hides the same "is it configured?" question behind a second credential with a different lifetime. Alternative: leave the condition and add a loud `else` echo. Rejected. The step would still never run, so the lane would still have never executed; the point is to make it executable.

### 3. Audit and nightly honesty is a per-step marker, not a workflow split

Add `continue-on-error: true` to the report-only steps inside `nightly` (`npm run e2e`, `sim:run -- --mode seeded`, `npm run e2e:sync`) and remove the hard `npm run e2e:sync` step from the gating `e2e` job, leaving that lane where the matrix already declares it. For the audit step, drop `continue-on-error` and keep `--audit-level=high`, so a new high or critical advisory actually fails `quality` as the comment already claims.

Alternative: split `nightly` into a separate non-gating workflow. Rejected. It is the same job on the same schedule; a marker is the smaller, truer change. Alternative: change the `nightly` header comment to admit it gates. Rejected. That makes the lie the contract, and the lane table is explicit that these lanes are `gates: false`.

### 4. Retry visibility is a post-run report gate, not a retry-count change

Keep `retries` as configured. Have each lane parse its own runner output for retried-then-passed tests and fail when a test tagged as a strict ceiling or row-oracle assertion is among them, using the existing `@p0` / journey-tag greps the workflows already use.

Alternative: set `retries: 0` in CI. Rejected. It would turn the suite red on unrelated genuine flakes and is a coverage decision, not a reporting one. Alternative: `--fail-on-flaky-tests`. Not available for the installed Playwright version, and it would fail on any flake rather than the ones that matter.

### 5. Pin timezone and locale in the browser context, keep the shell `TZ`

Add `timezoneId` and `locale` to `playwright.config.ts`'s `use` block, using the same zone the workflows already set (`Asia/Manila`), and leave the shell `TZ` assignments in place because the Node-side date helpers honor them on Linux.

Alternative: rely on `TZ` alone. Rejected. Chromium uses the OS timezone on Windows and macOS, and this repository's documented dev host is Windows throughout `docs/testing/known-gaps.md`. Alternative: derive the zone from a single shared constant. Better long-term, but it is a config-refactor that touches both `ci.yml` and `playwright.config.ts`; noted as a follow-up rather than bundled here.

### 6. Structured registration plus a reverse check

Change `findUnregistered` to require the stem to appear inside a structured entry — a `**Gate site:**` (or equivalent) line in the register — rather than anywhere in the text. Add a reverse pass that parses every structured entry's named file and fails when that file contains no gate call. Widen `findGateFiles` to `describe.skipIf` / `it.skipIf` / `it.fails` and add a `tests/**` collection pass alongside the existing `e2e/**` pass.

Alternative: keep substring matching and only add the reverse check. Rejected. The incidental-mention case (`recoverable-account-v1` at `docs/testing/known-gaps.md:213`) is already live and would stay green. Alternative: move the register to a machine-readable file. Rejected. The register is deliberately human-readable prose by design, and a structured marker inside prose keeps that property.

### 7. The dead quarantine field is removed unless adopted

Remove `quarantine?: string` from the journey step type and the `test.fixme(true, step.quarantine)` branch in `e2e/helpers/journey.ts`, and update `e2e/README.md`'s two references to it.

Alternative: adopt it for the four inline gates that would express it. Rejected. Each of those gates is conditional on a runtime detection (`remoteBoundaryDetected`, `supabaseRequestsSeen`), which the static per-step field cannot express; adopting it would mean writing a second, weaker mechanism next to the one in use.

## Risks / Trade-offs

- [Adding the guards to `quality` turns PRs red on first run] → Run both guards locally before committing the workflow change; if a real unregistered gate exists, register it in the same change rather than suppressing the guard.
- [Making the audit step gate exposes a high advisory the snapshot does not list] → Apply order runs `npm audit --omit=dev` first and records the live result; a genuine high advisory is then either fixed or explicitly reclassified with a dated policy note, not silenced.
- [Removing `e2e:sync` from the gating `e2e` job reduces gated coverage on main pushes] → The lane still runs on the nightly report-only job and on schedule; the lane table already declares it `gates: false`, so this removes a contradiction rather than coverage.
- [The disposable lane now runs when the secret exists, and could provision a project] → The lane's own hard-isolation guard runs before any build or network call and aborts non-zero on a rule violation; this change only makes the step reachable, and its `--no-teardown` semantics are unchanged.
- [A structured-marker register is more work to author] → The marker is one line per gate; the register's existing entries already name their gate sites in prose, so most entries need a reformat rather than new writing.

## Migration Plan

No data or schema migration. Apply order: (1) run both parity guards locally and register whatever they report; (2) add the two guards and the corrected audit step to `ci.yml`; (3) fix the disposable-lane condition and step env, and add the `tsx` dev dependency; (4) mark the nightly report-only steps and remove the gated `e2e:sync` step; (5) add the `concurrency` group to `ios-native-e2e.yml`; (6) pin `timezoneId` and `locale` in `playwright.config.ts` and add the retry-report gate; (7) rework `scripts/quarantine-register-parity.mjs` and register the two Vitest gates; (8) remove the dead per-step quarantine field; (9) run `node scripts/quarantine-register-parity.mjs` and `node scripts/journey-label-parity.mjs`, then `npm run qa:fast` on pinned Node `v22.23.2`. Rollback is a revert of the single commit. A green run of the corrected workflows is the acceptance evidence.

## Open Questions

None that change the specs or the task split. Whether the disposable lane is configured in this repository's secrets is an execution observation with specified behavior for both answers.
