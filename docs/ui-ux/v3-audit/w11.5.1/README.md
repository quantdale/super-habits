# W11.5.1 closure — timezone determinism & review closure

Branch: `frontend-v3-w1151-timezone-review-closure`, PR #75.
Baseline `origin/main` = `17553e6216a7263e0e74dbcd9c55e696f1f29973`
(W11.5 closure record). ExecPlan:
`.agent/execplans/frontend-v3-w1151-timezone-review-closure.md`.
This is a test-reliability closure: no new visual campaign; W11's 82
captures and W11.5's evidence stand untouched.

## 1. Root cause

`e2e/planning-w115-reliability.spec.ts` derived its Daily-Plan fixture date
with a Node-side `localTodayKey()`, while `playwright.config.ts` pins
Chromium to `Asia/Manila` (`timezoneId: 'Asia/Manila'`). On a host whose
calendar date differs from Manila's — a UTC host between 16:00 and midnight
UTC — the completed-plan seed landed on the wrong `date_key`, so the
rejected-Complete journey failed at its initial `Committed` assertion
before the intended SQLite `UPDATE` rejection was exercised. The defect
was locally masked because the workstation TZ is also `Asia/Manila`.

Executable demonstration of the original defect at the crossover instant
`2026-10-13T16:30:00.000Z`:

```
pre-fix Node-local key on host TZ=UTC:                2026-10-13   ← wrong day
pre-fix Node-local key on host TZ=Pacific/Kiritimati: 2026-10-14
pre-fix Node-local key on host TZ=America/Los_Angeles: 2026-10-13   ← wrong day
browser (Asia/Manila) key used by the fixed helper:   2026-10-14
```

## 2. Correction

- `e2e/helpers/browserDate.ts` (new): `browserLocalTodayKey(page)` evaluates
  inside Chromium with the same local-calendar getters as the app's
  `toDateKey()` (`lib/time.ts`). No `toISOString()` (UTC), no hard-coded
  date, no production date-logic change, no schema/sync/dependency change.
- `e2e/planning-w115-reliability.spec.ts`: derives the fixture date before
  any DB-harness navigation (React state is still app context) and proves
  fixture selection — `Plan for ${today}` visible plus `date_key` row
  oracles — with the table-wide exactly-one-row oracle preserved. All
  eight W11.5 scenarios, trigger names, and row/outbox/retry assertions
  otherwise unchanged.
- `e2e/planning-w1151-timezone.spec.ts` (new): deterministic crossover
  proof via the repo's shared `installClock` helper at
  `2026-10-13T16:30:00.000Z`: the browser context's timezone is
  `Asia/Manila`; the helper's key is `2026-10-14` (cross-checked against an
  independent `Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' })`
  oracle) and differs from the UTC date `2026-10-13` the pre-fix code
  produced on a UTC host; at a same-calendar-day instant (`08:00Z`) the key
  equals the UTC date. The clock test is isolated (no app, no SQLite, no
  OPFS), so it cannot interact with app initialization or worker lifecycle.

## 3. Executed results

| Lane                                                                          | Result                                                                                                                                           |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `planning-w1151-timezone.spec.ts`                                             | 3/3 PASS                                                                                                                                         |
| `planning-w115-reliability.spec.ts` (8 W11.5 scenarios)                       | 8/8 PASS                                                                                                                                         |
| `planning-w11.spec.ts` + `planning-hub.spec.ts` (legacy journeys)             | 3/3 + 4/4 PASS                                                                                                                                   |
| Same 11 planning lanes under `TZ=UTC` host                                    | 11/11 PASS                                                                                                                                       |
| Same 11 planning lanes under `TZ=Pacific/Kiritimati` host                     | 11/11 PASS                                                                                                                                       |
| `e2e:journeys:p0`                                                             | 25/25 PASS (one transient `a-tuesday.spec.ts` flake did not reproduce standalone 8/8 or on re-run — FLAKY_TEST, unrelated)                       |
| Deterministic simulation                                                      | PASS                                                                                                                                             |
| Focused impact tests (`simulation.behavior`, `repeat`, `agent-execplan`)      | 35/35 PASS                                                                                                                                       |
| typecheck / lint / themes / OpenSpec / plans / parity / release-profile guard | 0 / 0 / 140 / 80 / PASS / OK / OK                                                                                                                |
| Full Vitest (unit + integration)                                              | 2,679 passed / 2 skipped / **1 failed** — the documented Windows-CRLF `agentDocConsistency` residual (identical on pristine `main`, ENVIRONMENT) |

Hosted CI: recorded in the ExecPlan's Validation Ledger at closure (same
inherited braces/node-forge audit-only red; hosted e2e/nightly skipped).

## 4. Review threads (both verified resolved)

- `PRRT_kwDORgzj086rvEQW` (timezone) — reply posted with the correction,
  the deterministic crossover evidence, the host-TZ independence runs and
  the executed lane results; resolved after publication. `isResolved:
true` read back from GraphQL.
- `PRRT_kwDORgzj086rvEQc` (stale ExecPlan) — the finding applied to an
  earlier PR #74 commit; current `main` `17553e6` has the plan
  `Status: COMPLETED`, M6 checked, completed validation ledger,
  `Exact next action: None — task complete.`, and validator PASS. Reply
  cites the corrected file/commit and validator evidence; no change made to
  the completed plan. `isResolved: true` read back from GraphQL.

## 5. Remaining residual (documented follow-up, not fixed here)

The same Node-local `date_key` / `consumed_on` pattern remains in sibling
specs — `e2e/planning-hub.spec.ts` (daily_plans seeds), `e2e/calories.spec.ts`,
`e2e/calories-w10*.spec.ts`, `e2e/calories-day-navigation.spec.ts` — and
would mis-seed on a UTC host inside the crossover window. It is outside this
surgical change; the new `e2e/helpers/browserDate.ts` is the drop-in for a
follow-up pass. Standard hosted E2E is currently audit-blocked, so the
residual is latent rather than active.
