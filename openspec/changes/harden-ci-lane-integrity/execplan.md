# ExecPlan: Harden CI lane integrity

Plan-Version: 2
Status: COMPLETED

## Purpose / User Outcome

Apply the [harden-ci-lane-integrity OpenSpec change](proposal.md) and its
[tasks](tasks.md): the job that gates merges now runs every guard that protects
a lane it does not itself execute, a credential-gated lane can actually execute
and says so when it cannot, every step that claims to gate gates, a retried
strict assertion is never recorded as a clean pass, the browser calendar is
pinned, and the skip/quarantine register can detect its own rot in both
directions. Applying it makes a red lane visible as red for the first time.

## Context

- Starting HEAD `c1bc380ce330cda1e089fd79b49a12029defbb72` on `main`, with four
  earlier changes from this wave already applied on top of it.
- `.github/workflows/ci.yml` runs the journey-label parity guard and the
  quarantine-register parity guard only through `qa:fast` locally; the `quality`
  job that actually gates merges never ran either, so a label rename or an
  unregistered quarantine was invisible behind a green PR.
- The one CI step that could exercise the real remote Supabase boundary
  (disposable-backend lane) was conditioned on `env.SUPABASE_ACCESS_TOKEN`.
  GitHub Actions never populates a step-level `env:` for that step's own `if:`,
  so the lane could never run even with the secret configured, and nightly
  stayed permanently green with it "not configured".
- The `npm audit` step carried `continue-on-error: true` directly under a
  comment asserting "critical/high must be zero (the gate below enforces that)";
  the nightly job's header said "non-gating by design" while three of its steps
  hard-failed it; and the gating `e2e` job ran `npm run e2e:sync` as a hard step
  even though `simulation/matrix.ts` declares dist-sync `gates: false`.
- `playwright.config.ts` sets `retries: process.env.CI ? 2 : 0`, so a `≤ 800ms`
  section-switch ceiling or a "one row or zero, never two" oracle could fail its
  first attempt, pass its retry, and still leave the lane exit 0 with no record
  that a retry happened. The browser context also inherited the host OS
  timezone: Chromium ignores the shell `TZ` on Windows and macOS, and this
  repository's documented dev host is Windows.
- `scripts/quarantine-register-parity.mjs` collected gate stems only from
  `e2e/**/*.spec.ts`, only for `test.fixme(` / `test.skip(`, and reported a stem
  as registered when the register text merely contained it — so a gate mentioned
  in an unrelated caveat sentence counted as registered, and a register entry
  whose gate no longer existed could never be detected.

## Scope

The seven task groups in tasks.md: preflight baselines (1.1-1.2), wiring the
lane guards into the pull-request gate (2.1-2.2), making the credential-gated
lane executable and observable (3.1-3.4), making advisory and report-only steps
match their claims (4.1-4.4), pinning browser context and surfacing retries
(5.1-5.2), hardening the register and removing the dead mechanism (6.1-6.6), and
validation (7.1-7.6).

## Non-Goals

No change to `simulation/matrix.ts` or to which lanes run on PRs versus
main/nightly. No retry budget, per-test quarantine workflow, or report dashboard.
No journey gate semantics, threshold, or assertion change. No making the
`nightly` job gating. No product code, schema change, or Supabase query. No
archive into `openspec/specs/` and no commit — both are user-invoked steps.

## Current Checkpoint

- Current milestone: COMPLETE — all 26 tasks in tasks.md are checked, each backed
  by an edit in a workflow/script/config file or by executing coverage, with the
  validation gate recorded from the final tree.
- Completed: both lane-protection guards run in the `quality` job before the test
  step; 14 structured `**Gate site:**` register entries cover 13 gate files; the
  disposable-backend lane reads the `secrets` context with the token mapped into
  the step env; `tsx` is an explicit dev dependency; the audit step is a real
  gate (`scripts/audit-runtime-deps.mjs`, no `continue-on-error`); the three
  nightly report-only steps carry `continue-on-error: true`; the gating `e2e`
  job no longer runs the `gates: false` dist-sync lane;
  `.github/workflows/ios-native-e2e.yml` has a per-ref concurrency group;
  `playwright.config.ts` pins `timezoneId`/`locale` and emits a JSON report; and
  one retry-report gate now follows every Playwright invocation in `ci.yml`.
- In progress: none.
- Important modified files: `.github/workflows/ci.yml`,
  `.github/workflows/ios-native-e2e.yml`, `playwright.config.ts`,
  `package.json`, `scripts/quarantine-register-parity.mjs`, `e2e/helpers/journey.ts`,
  `docs/testing/known-gaps.md`, plus four scripts/tests.
- Last successful validation: pinned Node `v22.23.2` — `npm run qa:fast` green
  (typecheck 0 errors; lint 0 errors / 0 warnings; unit 164 files / 1996 tests;
  both parity scripts OK with 13 gate files and 14 structured entries); the five
  focused unit files 32/32; `npm run openspec:validate --all` 68/68;
  `openspec validate harden-ci-lane-integrity --type change --strict` valid;
  `node scripts/audit-runtime-deps.mjs` exit 0; `npx playwright test --list`
  336 tests in 32 files — up from the 334 at the wave's start because
  `harden-interaction-idempotency` added exactly two steps to the fat-fingers
  journey, not because this change moved the inventory; `prettier --check` clean
  on all 14 changed files.
- Current failures: none. A green run of the corrected workflows is the
  acceptance evidence and can only happen on a push, which is a user-invoked
  step.
- Relevant quarantines: none — no test weakened, skipped, or relaxed, no ceiling
  or floor moved, and the register grew by one honest entry (entry 22, the
  disposable-cloud integration suite) rather than losing one.
- Blockers: none.
- Condition required to unblock: not applicable.
- Exact resume action after unblock: not applicable.
- Exact next action: none — the change is fully applied. Archiving into
  `openspec/specs/` and committing the tree are separate, user-invoked steps.
- Remaining definition of done: complete.

## Progress

- [x] Wave 0 — both parity guards run on the pre-change tree and their exact
      output recorded; every gating claim in both workflows, `playwright.config.ts`,
      `simulation/matrix.ts`, and the register script read and listed (1.1-1.2).
- [x] Wave 1 — both guards added to the `quality` job between the openspec
      validation and the test step (2.1), and every gate stem they report
      registered with a structured `**Gate site:**` line plus one new entry for
      the disposable-cloud integration suite (2.2).
- [x] Wave 2 — the disposable-backend lane reads `${{ secrets.SUPABASE_ACCESS_TOKEN
!= '' }}` with the token mapped into the step `env:` (3.1-3.2), `tsx`
      declared as a dev dependency at the lockfile's version (3.3), and the step
      comment states the corrected condition and the "not configured" outcome (3.4).
- [x] Wave 3 — the audit step became a real gate through
      `scripts/audit-runtime-deps.mjs` with a dated allowlist (4.1); the three
      nightly report-only steps are marked `continue-on-error: true` (4.2); the
      hard `e2e:sync` step was removed from the gating `e2e` job while its build
      stayed (4.3); the iOS workflow gained the per-ref concurrency group (4.4).
- [x] Wave 4 — `playwright.config.ts` pins `timezoneId` and `locale` (5.1), and
      `scripts/e2e-retry-report.mjs` plus a `json` reporter makes a
      retried-then-passed test visible and fails the lane when a strict
      ceiling/oracle assertion is among them (5.2).
- [x] Wave 5 — one retry-report gate wired immediately after each of the five
      Playwright invocations in `ci.yml`, conditional on that invocation having
      actually run, blocking in the gating `e2e` job and reporting in the
      report-only nightly job (5.2, CI half).
- [x] Wave 6 — `findUnregistered` now requires a structured entry (6.1),
      `findStaleEntries` fails when an entry names a file with no gate (6.2),
      `findGateFiles` widened to `describe.skipIf` / `it.skipIf` / `it.fails` with
      a `tests/**` collection pass (6.3), the two Vitest gates registered (6.4),
      entry 13 re-pointed at the file the gate moved to (6.5), and the dead
      per-step `quarantine` field removed with both `e2e/README.md` references
      updated (6.6).
- [x] Wave 7 — validation gate: both parity guards, the focused unit files,
      `qa:fast`, the Playwright inventory, `openspec validate --all`, the strict
      per-change validate, prettier on the changed files, and a full-diff review
      confirming no lane removal and no product file (7.1-7.6).

## Surprises & Discoveries

- The audit step could not simply drop `continue-on-error`: `npm audit
--omit=dev` reports one genuine high advisory in the live tree
  (`brace-expansion` 1.x/2.x reached through `test-exclude` for coverage and
  `glob@9` → `minimatch@8`), and npm's only offered resolution is
  `react-native@0.87.1`. The honest shape is therefore a gate that fails on
  anything not in a dated, path-scoped allowlist, plus an `overrides` entry that
  actually fixes the 5.x copy (`^5.0.0` → `^5.0.12`). A bare
  `continue-on-error: false` would have turned `quality` permanently red on a
  finding no one can fix without a framework major.
- The registered-gate count did not grow by the number of newly detected files.
  Widening the scan to `tests/**` surfaced exactly one new gate file
  (`disposableCloudRoundTrip`, registered as entry 22); the other newly detected
  stems were already registered, which is the evidence that the register was
  maintained by hand all along and only the detector was weak.
- One Playwright JSON report per run means a single gate at the end of a job can
  only ever see the LAST invocation. The `e2e` job runs two Playwright
  invocations on PRs and one on main; `nightly` runs two. Wiring one gate per
  invocation, immediately after it, is the only placement that keeps every
  lane's retries from being overwritten unread.
- `steps.<id>.outcome` is the correct conditional for "this lane actually ran":
  `always()` alone would run the gate after a cancelled job or a failed web
  build, where no report exists and the gate's deliberate hard error on a
  missing report would add a second, redundant red.
- `js-yaml` is present in `node_modules` only transitively (it is not a declared
  dependency and has no bundled types). A workflow-parsing test therefore uses a
  small purpose-built reader instead of importing it, so the quality gate does
  not gain an undeclared dependency.
- The dead `quarantine` field could not be adopted as the spec's alternative
  option suggests: all four real gates are conditional on a runtime detection
  (`remoteBoundaryDetected`, `supabaseRequestsSeen`) that a static per-step
  string cannot express, so removal was the only honest option (design
  decision 7).
- **This change's own credential-gate fix broke the whole workflow, and CI caught
  it (2026-10-01).** The step was re-gated on `if: ${{ secrets.SUPABASE_ACCESS_TOKEN
!= '' }}`, reasoning that the old `env.SUPABASE_ACCESS_TOKEN` condition was never
  populated. The reasoning was right; the construct was not. GitHub's
  context-availability table allows only github, needs, strategy, matrix, job,
  runner, env, vars, steps and inputs in `jobs.<job_id>.steps.if` — `secrets` is
  not among them — so the expression is invalid and the ENTIRE workflow fails at
  parse time. Push run `36807888273` on `a019e21` reported zero jobs and "This run
  likely failed because of a workflow file issue", while every earlier push run on
  this repository is green. A vacuous condition is a latent no-op; an invalid one
  takes the whole pipeline down, which is strictly worse. Fixed with a
  configuration-probe step (`id: disposable-credentials`) that maps the secret
  into its own `env`, tests it in the shell, and publishes `configured=true|false`,
  with the lane conditioned on
  `steps.disposable-credentials.outputs.configured == 'true'` — a construct every
  entry of which the availability table permits. The token stays scoped to the
  probe and the lane.
- **The regression guard had pinned the invalid construct.**
  `tests/ciLaneIntegrity.test.ts` asserted
  `expect(step?.if).toContain("secrets.SUPABASE_ACCESS_TOKEN != ''")`, so the guard
  was enforcing a workflow GitHub rejects. It now pins the valid step-output gate,
  the probe's `run`, the token's `env` mapping, and adds a class-level assertion
  that no `if:` anywhere in the workflow references the `secrets` context —
  strictly stronger than what it replaced.

## Decision Log

- Add the two guards as their own named step rather than collapsing the
  `quality` job into `qa:fast`: the job's separately named steps are its
  failure-attribution structure, and the guard step is the honest delta.
- Gate the dependency audit through a dedicated script with a dated allowlist
  rather than either relabelling the step advisory or leaving it red on an
  unfixable transitive finding.
- Keep `retries: 2` and make retries visible instead of setting `retries: 0`:
  disabling retries is a coverage decision, not a reporting one, and would turn
  the suite red on unrelated genuine flakes.
- Fail on retried strict assertions by title/tag markers (`@p0`, ceiling, oracle,
  the named `≤ 800` / `≤ 500` thresholds, headroom) rather than per-test
  annotations, so no existing journey had to be edited to become auditable.
- One retry-report gate per Playwright invocation, placed immediately after it,
  with `if: always() && steps.<id>.outcome != 'skipped'`.
- Block the gating `e2e` job on the retry verdict and mark the nightly copies
  `continue-on-error`, matching each job's declared posture rather than making
  the nightly header a lie.
- Keep the shell `TZ` assignments in the workflows alongside the new
  `timezoneId`, because the Node-side date helpers honour `TZ` on Linux while
  Chromium does not; deriving one shared constant for both is a follow-up
  config refactor, deliberately not bundled here.
- Keep the register as human-readable prose with a structured `**Gate site:**`
  marker rather than moving it to a machine-readable file.
- Exclude `tests/quarantineRegisterParity.test.ts` from the register scan: it
  holds the guard's own fixtures, and `stripComments` deliberately preserves
  gate syntax inside string literals.

## Adversarial Review and Dispositions

- **Does the retry gate actually gate?** It runs with no `continue-on-error` in
  the `e2e` job, so a `≤ 800ms` ceiling that only held on attempt 2 fails the
  job; the nightly copies report under the same rules but cannot turn a job the
  lane table declares `gates: false` red. Proven against a synthetic report that
  fails and then passes a ceiling step (exit 1) and one that fails and then
  passes an unrelated helper assertion (exit 0, listed).
- **Is a lane able to pass by omission?** No: a missing JSON report is a hard
  error, and each gate is bound to the invocation that produced the report it
  reads. Removing a gate is detected by `tests/ciLaneIntegrity.test.ts`, which
  asserts every Playwright invocation is immediately followed by its own gate
  whose `if` references that invocation's step id.
- **Did the change remove coverage or weaken an assertion?** No assertion, gate,
  threshold, ceiling, or journey was edited. The only removed mechanism was the
  unused per-step `quarantine` field (6.6), which no journey set.
- **Could the register still pass while lying?** Registration now requires a
  structured entry, and a reverse pass fails on an entry whose named file has no
  gate. Both directions are proven non-vacuous by the focused unit tests, and
  the live counts (13 gate files, 14 structured entries, none stale, none
  unregistered) come from the same script CI now runs.
- **Product-file blast radius.** The full diff for this change is workflow,
  script, config, E2E-helper, register-doc, and test files only; the
  `app/`, `core/`, `features/`, and `lib/` modifications in the working tree
  belong to the three preceding changes and were left untouched here.

## Validation Ledger

| Date       | Command / source                                                                                                                                                                   | Outcome                                                                                                                                                                                                                                                            |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-09-30 | `node scripts/journey-label-parity.mjs`                                                                                                                                            | PASS — rail parity OK for all six sections and every E2E label map                                                                                                                                                                                                 |
| 2026-09-30 | `node scripts/quarantine-register-parity.mjs`                                                                                                                                      | PASS — 13 gate files registered, 14 structured entries, none stale, none unregistered                                                                                                                                                                              |
| 2026-09-30 | `npx vitest run tests/ciLaneIntegrity.test.ts tests/e2eRetryReport.test.ts tests/auditRuntimeDeps.test.ts tests/quarantineRegisterParity.test.ts tests/journeyLabelParity.test.ts` | PASS — 32/32 across 5 files (10 wiring + 5 retry gate + 4 audit policy + 10 register + 3 label parity)                                                                                                                                                             |
| 2026-09-30 | Non-vacuity replay against mutated `ci.yml` (gate step deleted, audit `continue-on-error` restored, `e2e:sync` re-added as a hard step)                                            | PASS — exactly the 3 matching assertions failed (`gates each Playwright invocation`, `gates the dependency audit step`, `does not run the dist-sync lane`); tree restored byte-for-byte                                                                            |
| 2026-09-30 | `npm run qa:fast` (pinned Node v22.23.2)                                                                                                                                           | PASS — typecheck 0 errors; lint 0 errors / 0 warnings; unit 164 files / 1996 tests; both parity scripts OK                                                                                                                                                         |
| 2026-09-30 | `npm run openspec:validate --all`                                                                                                                                                  | PASS — 68 passed / 0 failed                                                                                                                                                                                                                                        |
| 2026-09-30 | `openspec validate harden-ci-lane-integrity --type change --strict`                                                                                                                | PASS — change is valid                                                                                                                                                                                                                                             |
| 2026-09-30 | `node scripts/audit-runtime-deps.mjs`                                                                                                                                              | PASS — exit 0; 3 dated, build-time-only `brace-expansion` advisories documented, the 5.x copy fixed by the `overrides` entry                                                                                                                                       |
| 2026-09-30 | `npx playwright test --list`                                                                                                                                                       | PASS — 336 tests in 32 files. The count is not "unchanged": the pre-wave tree was 334, and the +2 is `harden-interaction-idempotency`'s two new fat-fingers steps. No gate silently disappeared.                                                                   |
| 2026-09-30 | `npx prettier --check` on all 14 changed files                                                                                                                                     | PASS — all clean                                                                                                                                                                                                                                                   |
| 2026-09-30 | Full workflow/script diff review (task 7.6)                                                                                                                                        | PASS — every lane from `simulation/matrix.ts` still runs on its declared trigger; no `app/`, `core/`, `features/`, or `lib/` product file in this change's diff                                                                                                    |
| 2026-10-01 | `gh run list` after the wave push                                                                                                                                                  | **FAILURE — run `36807888273` on `a019e21`**: zero jobs, "This run likely failed because of a workflow file issue". Every earlier push run on this repository is green (`36524473229`, `36518073584`), so this change's `ci.yml` edit is the cause.                |
| 2026-10-01 | `git show c1bc380:.github/workflows/ci.yml` + GitHub context-availability table                                                                                                    | ROOT CAUSE — the step's `if` was changed to `${{ secrets.SUPABASE_ACCESS_TOKEN != '' }}`; `secrets` is not an allowed context in `jobs.<job_id>.steps.if`, and an invalid expression fails the workflow at parse time. The old `env.…` form was vacuous but valid. |
| 2026-10-01 | `node -e "require('js-yaml').load(ci.yml)"` after the fix                                                                                                                          | PASS — YAML parses; jobs `quality,e2e,nightly`; lane `if` = `steps.disposable-credentials.outputs.configured == 'true'`; probe carries the token in `env`; **no `if:` line in the file references `secrets.`**                                                     |
| 2026-10-01 | `npx vitest run tests/ciLaneIntegrity.test.ts`                                                                                                                                     | PASS — 10/10 with the corrected guard                                                                                                                                                                                                                              |
| 2026-10-01 | `npm run typecheck`, `npx eslint . --max-warnings 0`, `npm run qa:fast`                                                                                                            | PASS — 0 errors; 0 errors / 0 warnings; unit 169 files / 2052 tests plus all three parity guards                                                                                                                                                                   |

## Changed Files / Areas

- `.github/workflows/ci.yml` — `quality` job: the two parity guards after the
  openspec validation; the audit step replaced by the gate script with no
  `continue-on-error`. `e2e` job: step ids on all three Playwright invocations, a
  retry-report gate after each, the hard `e2e:sync` step removed (build kept).
  `nightly` job: `continue-on-error: true` on the three report-only steps, the
  retry-report gate after each Playwright invocation, and the disposable-backend
  lane's condition reading the `secrets` context with the token mapped into the
  step `env:`.
- `.github/workflows/ios-native-e2e.yml` — per-ref `concurrency` group with
  `cancel-in-progress: true`.
- `playwright.config.ts` — `timezoneId: 'Asia/Manila'` and `locale: 'en-US'` in
  `use`; a `json` reporter writing
  `.cursor/playwright-output/e2e-report/report.json` (gitignored output folder).
- `package.json` — `tsx` added as an explicit dev dependency at the lockfile's
  version; the `brace-expansion@^5.0.0` → `^5.0.12` `overrides` entry.
- `scripts/audit-runtime-deps.mjs` (new) — reads `npm audit --omit=dev --json`,
  prints every high/critical finding, and fails on anything outside a dated,
  path-scoped allowlist.
- `scripts/e2e-retry-report.mjs` (new) — walks the Playwright JSON report, lists
  every retried-then-passed test, and exits 1 when a strict ceiling/row-oracle
  assertion is among them or when the report is missing.
- `scripts/quarantine-register-parity.mjs` — `stripComments` lexer,
  `findGateFiles` widened to the Vitest skip mechanisms with a `tests/**` pass,
  `parseRegisterEntries` for structured `**Gate site:**` lines, `findUnregistered`
  now structure-based, and a new `findStaleEntries` reverse pass.
- `e2e/helpers/journey.ts` — the unused per-step `quarantine` field and its
  `test.fixme` branch removed, with the reason recorded in the type's doc comment.
- `e2e/README.md` — both `quarantine` references rewritten; the standing
  register rule now names the structured-entry requirement and the two-way check.
- `docs/testing/known-gaps.md` — structured `**Gate site:**` lines on entries
  8, 9, 10, 11, 12, 14, 20; entry 13 re-pointed; new entry 22 for the
  disposable-cloud integration suite.
- `tests/ciLaneIntegrity.test.ts` (new) — the CI wiring contract (guard order,
  audit gating, credential condition and token mapping, nightly report-only
  markers, no `gates: false` lane in a gating job, per-ref concurrency in both
  workflows, and one retry-report gate per Playwright invocation with the right
  gating posture).
- `tests/e2eRetryReport.test.ts` (new), `tests/auditRuntimeDeps.test.ts` (new) —
  the retry gate's and the audit gate's policy behaviour.
- `tests/quarantineRegisterParity.test.ts` — fixtures and cases for the lexer,
  the widened scan, structured registration, and the reverse check.
- `openspec/changes/harden-ci-lane-integrity/tasks.md` — all 26 tasks checked.

## Recovery / Resume Instructions

1. Read `AGENTS.md`, `.agent/PLANS.md`, this plan, and the change's
   `proposal.md` / `design.md` / `specs/` / `tasks.md`.
2. `git status --short` and `git diff --stat`; reconcile this checkpoint against
   the real tree.
3. Re-run `npx vitest run tests/ciLaneIntegrity.test.ts tests/e2eRetryReport.test.ts
tests/auditRuntimeDeps.test.ts tests/quarantineRegisterParity.test.ts` and both
   parity scripts.
4. No implementation action remains. Archiving the change into `openspec/specs/`
   and committing the tree are separate, user-invoked steps.

## Outcomes & Retrospective

- Status: Completed.
- Summary: the merge gate now executes the guards that protect the lanes it does
  not run; the one credential-gated lane became reachable instead of permanently
  "not configured"; three steps and their comments stopped contradicting their
  declared gating posture; a strict assertion that only held on a retry fails the
  lane instead of being recorded as a clean pass, in every Playwright invocation
  rather than only the last; the browser calendar is pinned so date-key
  assertions no longer follow the host OS; and the skip/quarantine register can
  now fail for an unregistered gate, an incidental mention, or an entry whose
  gate no longer exists.
- Follow-up: archive this change into `openspec/specs/` when the user invokes the
  OpenSpec archive step. Two pending changes remain in `openspec/changes/`
  (`harden-native-evidence-and-release-posture`, `harden-silent-failure-certification`),
  each needing its own apply pass. A green run of the corrected workflows is the
  acceptance evidence and requires a push the user has not requested. Two small
  follow-ups are recorded rather than bundled: derive the E2E timezone from one
  shared constant across `ci.yml` and `playwright.config.ts`, and revisit the
  allowlisted `brace-expansion` copies when npm offers a non-breaking fix.
