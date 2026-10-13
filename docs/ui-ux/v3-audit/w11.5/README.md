# W11.5 rendered + failure-injection evidence — Planning Reliability Closure

Branch: `frontend-v3-w115-planning-reliability`.
Baseline `origin/main` = `2cfe168631e206faf355a55ad0e271a39a284b89`
(W11 closure record); W11 code merged as `ffb02f2` (PR #73).
W11.5 ExecPlan: `.agent/execplans/frontend-v3-w115-planning-reliability.md`.
W11 audit (untouched): `../w11/README.md`; W11's 82 historical captures are
preserved exactly as captured.

## 1. Outstanding PR #73 Codex review thread — verified and resolved

Thread: `PRRT_kwDORgzj086rkJjX` (root comment `PRRC_kwDORgzj0879XnXt`,
file `features/planning-hub/PlanningSummaryRow.tsx:47`, P2):

> "The `Pressable` now covers only the title/status column, while the
> percentage and full-width progress bar are siblings outside it. On
> mobile, tapping those visible portions of the card therefore does
> nothing, regressing the previous card-wide detail action; make the
> non-action card surface pressable while keeping the reorder controls
> independent."

**Code inspection:** the shipped `PlanningSummaryRow` already satisfies the
request — the `Pressable` (with `accessibilityRole="button"` and the row's
accessible name) wraps the title, the status/context line, the percentage
Text and the progress-bar View; only the optional `actions` slot (project
reorder arrows) renders outside it (`PlanningSummaryRow.tsx:37-90`).

**Executable evidence (added in W11.5, `e2e/planning-w11.spec.ts`):** on
both the Project row and the Goal row, each of these opens the detail view:

- the objective title (`W11 Project` / `W11 Run`),
- the quiet context line (`Active · No linked work yet`),
- the percentage (`0%` / `10%`),
- the rendered 10% progress bar itself (scoped style selector on the bar
  child of the press target),

and the reorder control does **not** activate the detail target: pressing
`Move W11 Project down` leaves the list mounted with the row intact and
no `Back to projects` affordance. These assertions run inside the existing
W11 journeys (`projects show objective first…`, `goals share the row
grammar…`), which pass 3/3 together with the four legacy
`planning-hub.spec.ts` journeys.

The thread was answered with this evidence and resolved via the GitHub
API; the resolved state was read back from GraphQL after the mutation
(see §6 for the exact reply and verification).

## 2. Original W11 D10 claim and the reassessment

W11's register recorded:

> **D10 — Browser failed-write injection NOT STAGEABLE** … data-layer
> rejection oracles live in the unit/integration suites, matching the
> calibrated W9.5/W10 approach.

**Verdict: the claim was too pessimistic.** The repository's existing
mechanism — `CREATE TRIGGER … RAISE(ABORT, …)` installed through the
same-origin DB harness (`e2e/helpers/dbHarness.ts` + `seedSql`, the exact
pattern `e2e/calories.spec.ts` uses for app_meta/sync_outbox) — works
unchanged for Planning mutations. Technique and constraints:

- `seedSql(page, 'CREATE TRIGGER …')` runs in DB context; the app's
  `withTransactionAsync` (web path of `core/db/transactions.ts`) rolls the
  whole transaction back when the statement aborts, so the entity row, its
  `sync_outbox` intent and the `backup.dirty` marker roll back together.
- Harness rule honored: DB-context steps (seed trigger, row/outbox
  oracles, `DROP TRIGGER`) happen only at interaction boundaries;
  navigating to the harness destroys React state, so all UI assertions
  run in app context and the retry always follows a fresh mount.
- Trigger names are unique per test (`w115_reject_*`), and each test's
  `clearDatabase` wipes the OPFS pool, so nothing leaks between tests or
  into the standard lanes.

## 3. Coverage matrix — rejected operations (all executed, all PASS)

| Case                    | Injected rejection                                                                 | UI must show                                                                                   | Durable must hold                                                                                                                                 | Retry                         |
| ----------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| A — Daily Plan save     | `BEFORE INSERT ON daily_plans WHEN NEW.intention='Blocked intention'`              | `Could not save the plan. Please try again.`, status stays `Not yet saved`, intention retained | 0 `daily_plans` rows, 0 `daily_plans` outbox intents; then exactly 1 row + 1 intent; fresh mount still `Committed`                                | after `DROP TRIGGER` + reload |
| B — Daily Plan complete | `BEFORE UPDATE ON daily_plans WHEN NEW.status='completed'` (seeded committed plan) | error visible, `Plan completed.` absent, still `Committed`, reflection + energy 4 retained     | `status='committed'`, `completed_at` NULL, `reflection=''`, 0 intents; then `completed` + timestamp + `reflection` + energy, 1 intent             | same                          |
| C — Goal create         | `BEFORE INSERT ON goals WHEN NEW.title='Blocked goal'`                             | error visible, editor stays `New Goal`, title + `Progress: 10%` retained                       | 0 goals, 0 intents; then exactly 1 goal (10%) + 1 intent                                                                                          | same                          |
| C2 — Goal delete        | `BEFORE UPDATE ON goals WHEN NEW.deleted_at IS NOT NULL`                           | error beside Delete, detail stays open                                                         | goal live, linked todo's `goal_id` unchanged, 0 intents; then tombstone + child unlink + 2 intents (goals delete, todos update)                   | same                          |
| F — Goal rename         | `BEFORE UPDATE ON goals WHEN NEW.title='Renamed goal'`                             | error visible, editor stays, title + progress retained                                         | title/progress unchanged, 0 intents; then updated row + 1 intent                                                                                  | same                          |
| D — Project lifecycle   | `BEFORE UPDATE ON projects WHEN NEW.status='completed'`                            | error visible, Confirm closes, list row still reads `Active` (no false status)                 | `status='active'`, `completed_at` NULL, links intact, 0 intents; then `completed` + timestamp + 1 intent                                          | same                          |
| E — Project delete      | `BEFORE UPDATE ON projects WHEN NEW.deleted_at IS NOT NULL`                        | error beside Delete, detail stays open                                                         | project live, todo/habit/goal links unchanged, 0 intents; then tombstone + child unlink + 4 intents (project delete + goals/todos/habits updates) | same                          |
| G — Backup intent only  | `BEFORE INSERT ON sync_outbox WHEN NEW.entity='goals'`                             | error visible, editor stays                                                                    | 0 goal rows AND 0 intents (atomic pair); then 1 row + 1 intent                                                                                    | same                          |

Rendered UI states were observed during every failure (error text visible,
editor/detail still mounted, draft values retained) and the retry paths
were executed to durable success with row-level verification.

## 4. Production reliability findings fixed in W11.5

1. **Raw engine leakage (the reason D10 looked unmapped).** W11's failure
   surfaces printed the engine's own message — a rejected write renders as
   `Error: Error finalizing statement` in wa-sqlite — so a user would see
   `Error: Error finalizing statement` under the editor. Added
   `features/planning-hub/planningWriteError.ts`: a pure mapper that keeps
   validation copy written for users (`Goal title is required…`) and
   replaces engine/storage noise (finalizing statement, locked, disk full,
   readonly, CANTOPEN, constraint failures) with the caller's curated
   sentence. Wired into Daily Plan save + carry-forward, Guided Planning
   save + carry-forward, Goal save/delete and Project save/delete/status.
   Unit tests: `tests/planningWriteError.test.ts` 3/3.
2. No other production defect was reproduced: every remaining assertion
   about UI truthfulness (no navigation on failed delete, no optimistic
   project status, draft retention) already held on the W11 code.

## 5. Reproduction

```bash
# from the W11.5 worktree (dist/ built with the hermetic export)
npm run build:e2e
npx playwright test --project=chromium \
  e2e/planning-w115-reliability.spec.ts \
  e2e/planning-w11.spec.ts e2e/planning-hub.spec.ts
```

## 6. Regression results

- `e2e/planning-w115-reliability.spec.ts` — **8/8 PASS** (matrix A, B, C,
  C2, F, D, G, E).
- `e2e/planning-w11.spec.ts` — **3/3 PASS** (now including the P2
  full-card press-target evidence).
- `e2e/planning-hub.spec.ts` — **4/4 PASS** (legacy journeys unchanged).
- Full Vitest (unit + integration projects): 2,679 passed / 2 skipped /
  1 failed — the single failure is the documented Windows-CRLF
  `agentDocConsistency` register-parse residual, proven to fail
  identically on pristine `main` (`core.autocrlf=true`, no
  `.gitattributes`); it is an ENVIRONMENT residual, not a W11.5 defect.
- `validate:themes` 140/140; `openspec validate --all` 80/80;
  `agent:plan:validate:all` PASS; journey-label-parity OK;
  quarantine-register-parity OK; release-profile-guard OK;
  `e2e:journeys:p0` 25/25; deterministic simulation PASS.
- Hosted exact-head CI evidence is recorded in the ExecPlan's Validation
  Ledger and the closure commit (same inherited braces/node-forge
  audit-only red, hosted e2e/nightly skipped behind it — unchanged).

## 7. Remaining gaps (accurately classified)

- **NOT RUN (ENVIRONMENT / out of scope):** native Android/iOS lanes —
  W16 Android qualification and owner-deferred iOS remain the campaign's
  standing residuals; no device evidence is claimed here.
- **NOT COVERED (documented, accepted):** daily-plan history-delete and
  project create/rename write failures (same trigger shape as the covered
  cases; deferred rather than claimed); a genuinely in-session retry
  without an intervening reload (the harness's React-state rule makes the
  DB round-trip mandatory before retrying); concurrent double-submit under
  an in-flight delete (the soft-delete path is idempotent — a second
  `UPDATE … WHERE deleted_at IS NULL` changes 0 rows and enqueues nothing
  — so no duplicate tombstone or intent is possible).
- **Inherited CI residuals (unchanged, not waived):** `braces`
  GHSA-vfj7-8cjw-p6xm, `node-forge` GHSA-86w9-cpqp-85rv keep standard
  hosted E2E/nightly skipped; Windows-CRLF register parse; D14 host-load
  headroom; Focus notification timestamp.
