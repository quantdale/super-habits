# ExecPlan: W11.5.1 — Timezone Determinism & Review Closure

Plan-Version: 2
Status: COMPLETED

## Purpose / User Outcome

Surgically close the two outstanding Codex P2 findings from PR #74:
(1) the W11.5 reliability spec's seeded Daily-Plan fixture derived its
date in Node's host timezone while Chromium runs `Asia/Manila`, so a
non-Manila host (UTC CI) between 16:00 and midnight UTC would seed the
committed plan for the wrong day and fail before exercising the intended
SQLite rejection; (2) the W11.5 ExecPlan closure-state finding, which is
already fixed on current `main` and only needs verification, a reply and
resolution. Deliver a browser-timezone-safe fixture, a deterministic
UTC→Manila crossover proof, both threads resolved with evidence, and a
minimal published PR — without reopening W11/W11.5 or starting W12.

## Context

- Baseline `origin/main` = `17553e6216a7263e0e74dbcd9c55e696f1f29973`
  (W11.5 closure record); W11.5 merged as `d8bb43a` (PR #74, final head
  `b3db181`); W11.5 ExecPlan COMPLETED; W12 is the next unstarted
  milestone.
- Host workstation TZ is `Asia/Manila` — the same value Chromium is
  pinned to in `playwright.config.ts` (`timezoneId: 'Asia/Manila'`), so
  the defect is locally masked and historically reproducible only under
  a different Node host TZ (e.g. CI's UTC) inside the 16:00–24:00 UTC
  crossover window.
- The app's date contract is `toDateKey()` (`lib/time.ts`): local-calendar
  getters (`getFullYear/getMonth/getDate`) — not UTC. DailyPlanView uses
  `dateKey ?? toDateKey()`, so the fixture must match the browser's local
  calendar date.
- Threads on PR #74: `PRRT_kwDORgzj086rvEQW` (timezone, unresolved) and
  `PRRT_kwDORgzj086rvEQc` (stale ExecPlan, already fixed on main).
- Harness rule (unchanged): DB-context navigation destroys React state,
  so the browser-side date must be derived while the page is still in app
  context — before `seedSql`.

## Scope

- Isolated branch `frontend-v3-w1151-timezone-review-closure` + worktree;
  this ExecPlan.
- `e2e/planning-w115-reliability.spec.ts`: replace the Node-local
  `localTodayKey()` with a browser-context helper, derive test B's seed
  date before DB-context navigation, and add date-key/fixture oracles
  proving the intended UPDATE rejection targeted the seeded row.
- New narrowly scoped deterministic regression
  `e2e/planning-w1151-timezone.spec.ts` proving the UTC→Manila crossover
  (fixed instant `2026-10-13T16:30:00.000Z` = Oct 13 UTC / Oct 14 Manila)
  under Playwright's clock control, plus browser-TZ and host-TZ
  independence evidence.
- Review-thread replies + verified resolutions; W11.5.1 closure record;
  minimal parent-campaign checkpoint touch (W11.5.1 noted, W12 still next).

## Non-Goals

- No production Planning/Goal/Project/Daily-Plan code or domain changes;
  no schema/migration/sync/dependency/security changes; no W11/W11.5
  documentation rewrites; no W12 work; no unrelated E2E refactoring; keep
  all eight W11.5 regressions and their assertions intact.

## Current Checkpoint

- Current milestone: M5 COMPLETE — W11.5.1 published through PR #75 (merge commit `ec53e1efcae8deb1531238409293d10b201170ec`, branch `frontend-v3-w1151-timezone-review-closure`, final head `8299339`); both PR #74 Codex P2 threads are resolved with verified `isResolved: true`; the parent campaign checkpoint names W12 as the next unstarted milestone.
- Completed: M1 preflight. M2 — `e2e/helpers/browserDate.ts` (new) derives the browser-local date key with the same local-calendar getters as `toDateKey()`; the completion journey derives its fixture date before any DB-harness navigation and proves fixture selection (`Plan for ${today}` + `date_key` row oracles + preserved table-wide exactly-one-row oracle); `e2e/planning-w1151-timezone.spec.ts` (new) proves the UTC→Manila crossover deterministically via the shared `installClock` helper at `2026-10-13T16:30:00.000Z` (UTC Oct 13 vs browser Oct 14), pins the browser timezone, and proves same-day agreement. M3 — lanes: default host 18/18 (4 planning-hub + 3 W11 + 8 W11.5 + 3 timezone); host-TZ independence 11/11 under `TZ=UTC` and 11/11 under `TZ=Pacific/Kiritimati`; P0 journeys 25/25 (one transient `a-tuesday.spec.ts` flake did not reproduce standalone or on re-run — FLAKY_TEST); deterministic simulation PASS; focused impact tests 35/35; typecheck 0; lint 0/0; themes 140/140; OpenSpec 80/80; plans PASS; parity + release-profile guards OK; full Vitest 2,679 passed / 2 skipped / 1 failed (the documented Windows-CRLF residual, identical on pristine main — ENVIRONMENT). M4 — adversarial review (no blockers) addressed: the date_key-filtered oracle narrowing fixed with restored table-wide exactly-one-row assertions; clock spec aligned to the shared `installClock`; sibling-spec Node-local date hazard documented as a follow-up. M5 — published, both threads replied to with full evidence (comments 4257073023 and 4257188665) and resolved with `isResolved: true` read back.
- In progress: None — campaign closed.
- Important modified files: `e2e/helpers/browserDate.ts` (new), `e2e/planning-w1151-timezone.spec.ts` (new), `e2e/planning-w115-reliability.spec.ts` (browser-timezone date derivation + date_key and total-row oracles), `docs/ui-ux/v3-audit/w11.5.1/README.md` (new), this plan.
- Last successful validation: see M3; hosted exact-head CI at final head `8299339` — push run [38379209565](https://github.com/quantdale/super-habits/actions/runs/38379209565) and PR run [38379215776](https://github.com/quantdale/super-habits/actions/runs/38379215776) pass every quality step (Typecheck, Supabase/Deno, Lint, themes, OpenSpec, parity, ExecPlans, unit + integration) and fail only the inherited `Audit runtime dependencies` gate (`braces` GHSA-vfj7-8cjw-p6xm, `node-forge` GHSA-86w9-cpqp-85rv), hosted e2e/nightly skipped behind it; the temporary branch-only targeted workflow [38378633411](https://github.com/quantdale/super-habits/actions/runs/38378633411) executed the planning lanes on hosted Chromium — SUCCESS — and was removed before merge; closure-commit CI recorded on main.
- Current failures: None for the W11.5.1 scope.
- Relevant quarantines: None.
- Blockers: None.
- Condition required to unblock: None.
- Exact resume action after unblock: None.
- Exact next action: None — task complete.
- Remaining definition of done: None — the timezone mismatch is corrected with deterministic crossover evidence, all focused and broader gates ran with results classified, both review threads are verified resolved, the focused PR is merged with exact-head CI evidence, and the parent campaign checkpoint preserves W12 as the next unstarted milestone.

## Progress

- [x] M1 — baseline + both threads verified, root cause confirmed
- [x] M2 — browser-timezone fixture fix + deterministic crossover spec
- [x] M3 — validation (focused lanes, host-TZ independence, static gates)
- [x] M4 — adversarial review of the fix; findings addressed and re-verified
- [x] M5 — publication: PR #75 merged (`ec53e1e`), both PR #74 threads resolved with verified `isResolved: true`, closure records and parent checkpoint updated

## Surprises & Discoveries

- The workstation TZ equals the pinned browser TZ (`Asia/Manila`), so the
  defect cannot be reproduced with the real wall clock today (08:50 UTC =
  16:50 Manila, same calendar day) — deterministic clock control is the
  only sound proof, exactly as the mission anticipates.

## Decision Log

- 2026-10-13 — Derive the fixture date with `page.evaluate` mirroring
  `toDateKey()`'s local-calendar getters; never `toISOString()` (UTC) and
  never a hard-coded date.
- 2026-10-13 — Prove the crossover with `page.clock.install` at a fixed
  instant in an isolated spec that does not touch the app/SQLite, and run
  the real journeys separately — the clock must never interact with app
  initialization or the OPFS worker.
- 2026-10-13 — Host-TZ independence is proven by executing the same lanes
  under `TZ=UTC` and `TZ=Pacific/Kiritimati` Node hosts; Chromium keeps
  `Asia/Manila` from `playwright.config.ts`.

## Validation Ledger

- 2026-10-13 — Repository/thread preflight — PASS (state matches the
  brief; both PR #74 threads unresolved).
- 2026-10-13 — W11.5 ExecPlan state verification — PASS: `Status:
COMPLETED`, M6 checked, validator PASS on `main` `17553e6` (finding #2
  already fixed).
- 2026-10-13 — Original-defect demonstration — the pre-fix Node-local
  computation at `2026-10-13T16:30:00.000Z` yields `2026-10-13` on a UTC
  host (and on an America/Los_Angeles host) while the browser (Manila)
  key is `2026-10-14`; the pre-fix fixture would therefore target the
  wrong day on a UTC host inside the 16:00–24:00 UTC window.
- 2026-10-13 — Focused lanes, default host (Asia/Manila) — 18/18 PASS
  (planning-hub 4/4, planning-w11 3/3, planning-w115-reliability 8/8,
  planning-w1151-timezone 3/3).
- 2026-10-13 — Host-TZ independence — `e2e/planning-w115-reliability.spec.ts`
  - `e2e/planning-w1151-timezone.spec.ts` 11/11 PASS under `TZ=UTC` and
    11/11 under `TZ=Pacific/Kiritimati` (Chromium keeps Asia/Manila from
    playwright.config.ts).
- 2026-10-13 — Broader gates — P0 journeys 25/25 (one transient
  `a-tuesday.spec.ts` flake did not reproduce standalone 8/8 or on
  re-run — FLAKY_TEST, unrelated); deterministic simulation PASS; focused
  impact tests 35/35; typecheck 0; lint 0/0; themes 140/140; OpenSpec
  80/80; plans PASS; parity + release-profile guards OK; full Vitest
  2,679 passed / 2 skipped / 1 failed (inherited Windows-CRLF residual,
  identical on pristine main).
- 2026-10-13 — Adversarial review (independent sub-agent) — no blockers;
  the oracle-narrowing should-fix fixed (table-wide exactly-one-row
  assertions restored), clock helper aligned with the shared
  `installClock`; sibling-spec date hazard recorded as a follow-up.
- 2026-10-13 — Publication — PR #75 merged as
  `ec53e1efcae8deb1531238409293d10b201170ec` (final head `8299339`).
  Hosted exact-head CI: push run
  [38379209565](https://github.com/quantdale/super-habits/actions/runs/38379209565)
  and PR run
  [38379215776](https://github.com/quantdale/super-habits/actions/runs/38379215776)
  pass every quality step and fail only the inherited
  `Audit runtime dependencies` gate; hosted e2e/nightly skipped. The
  temporary branch-only targeted workflow
  [38378633411](https://github.com/quantdale/super-habits/actions/runs/38378633411)
  ran the planning lanes on hosted Chromium — SUCCESS — removed before
  merge. Both PR #74 threads replied to (comments 4257073023, 4257188665) and resolved with `isResolved: true` verified.

## Changed Files / Areas

- `.agent/execplans/frontend-v3-w1151-timezone-review-closure.md` — this plan.
- `e2e/planning-w115-reliability.spec.ts` — browser-timezone-safe date
  derivation for the seeded Daily-Plan fixture + date-key oracles.
- `e2e/planning-w1151-timezone.spec.ts` (new) — deterministic UTC→Manila
  crossover and host-TZ independence regression.
- (planned) W11.5.1 closure record + parent campaign checkpoint touch.

## Recovery / Resume Instructions

1. Read AGENTS.md and `.agent/PLANS.md`, then this plan.
2. Reconcile with `git status --short` / `git log --oneline -3` in the
   worktree `D:/Documents/tryPython/superhabits-w1151` (branch
   `frontend-v3-w1151-timezone-review-closure`).
3. Run `npm run agent:resume -- --plan
.agent/execplans/frontend-v3-w1151-timezone-review-closure.md`.
4. Continue from `Exact next action`; rebuild `dist/` with
   `npm run build:e2e` before Playwright lanes if stale.

## Outcomes & Retrospective

- Status: COMPLETED. W11.5.1 closed both PR #74 Codex P2 findings surgically:
  the browser/Node timezone mismatch is fixed with a browser-context date
  helper shared by the fixture and a deterministic clock-controlled
  crossover spec (proven additionally under `TZ=UTC` and
  `TZ=Pacific/Kiritimati` hosts), and the stale-ExecPlan finding was
  verified as already corrected on `main` with validator evidence
  instead of reopening the completed W11.5 plan. Both threads are
  resolved with verified `isResolved: true`. Published through PR #75
  (`ec53e1e`) with exact-head CI evidence; inherited security/audit and
  native-qualification residuals remain visible and unwaived; W12 is the
  next wave.
- Lessons: date fixtures for browser-local daily state must be derived in
  the browser context even when the harness pins a timezone — a matching
  host TZ masks the defect locally, so a deterministic clock test plus
  host-TZ matrix runs is the sound proof; sibling specs sharing the
  Node-local pattern (`planning-hub`, `calories*`) are the known residual
  with `e2e/helpers/browserDate.ts` as the drop-in follow-up.
