# ExecPlan: weekly-summary-datekey-local-v1

Plan-Version: 2
Status: COMPLETED

## Purpose / User Outcome

Close Audit F5 (P1) weekly-summary UTC dateKey correctness for real: prove the
`new Date("YYYY-MM-DD")` UTC-midnight defect class with evidence, verify
production weekly-review code uses local-calendar helpers, and make any
UTC-parse regression unmissable under west-of-UTC timezones by covering
weekly-review date-key arithmetic in the timezone matrix.

## Context

- Audit F5 (`.agent/hardening-evidence/audit-reports.md` §F5): weekly summary
  parsed date keys as UTC via `new Date("YYYY-MM-DD")`, shifting habit windows
  a day west of UTC. Intended fix: `dateKeyToLocalDate` /
  `listWeekDateKeys` / `shiftDateKeyByDays`.
- Production state (verified 2026-09-19): `weeklyReview.domain.ts` uses
  `dateKeyToLocalDate` + `new Date(Date)` clones (safe);
  `weeklyReview.summary.ts` uses `listWeekDateKeys`/`shiftDateKeyByDays`.
  No residual date-only `new Date(<dateKey>)` in weekly-review production code.
- Gap: `scripts/qa-timezones.mjs` runs only `tests/time.test.ts`,
  `tests/integration/dateKeys.test.ts`, `tests/habitReminders.domain.test.ts` —
  weekly-review date-key arithmetic is NOT exercised under America/New_York,
  Pacific/Honolulu, etc. East-of-UTC CI (Asia/Manila) hides UTC-parse regressions.
- Host Node is fnm 22.23.2 on PATH (`node -v` = v22.23.2 verified).
- HEAD: d768708 (clean main, ahead of origin/main by 20, no reset/rebase).

## Scope

- Grep weekly-review + summary consumers for residual UTC date-only parsing.
- Add timezone-sensitive regression coverage for `listWeekDateKeys` /
  `shiftDateKeyByDays` / review-week bounds that FAILS on UTC-parse regression
  west of UTC (including explicit red/green proof of why `new Date(dateKey)`
  is wrong).
- Wire `tests/weeklyReview.domain.test.ts` (and any new focused file) into
  `scripts/qa-timezones.mjs` matrix, keeping existing zones:
  Asia/Manila, UTC, America/New_York, Pacific/Honolulu, Pacific/Kiritimati.
- Verify under Node 22.23.2: focused tests + timezone matrix + typecheck/lint
  on touched surface. Commit locally (no push/tags).

## Non-Goals

- Habit pause/archive durability, workout skip dispositions, PR dead UI, diary
  copy-day, planning outbox, native lanes, push/CI billing.
- No alternate calendars; no new migrations; no native-only work.
- No weakening of existing tests; no invented secrets/PII.

## Current Checkpoint

- Current milestone: Plan created; production grep complete — no residual
  date-only `new Date(<dateKey>)` in weekly-review production code.
- Completed: AGENTS.md + PLANS.md read; `npm run agent:plans` inspected; git
  status/HEAD verified (clean, ahead 20, HEAD d768708); `lib/time.ts`,
  `weeklyReview.domain.ts`, `weeklyReview.summary.ts`, `weeklyReview.executor.ts`,
  `weeklyReview.data.ts`, `ReviewHistoryView.tsx`,
  `weeklyReviewReminder.domain.ts`, `tests/weeklyReview.domain.test.ts`,
  `scripts/qa-timezones.mjs` read; cross-repo `new Date(` grep triaged.
- In progress: None — work complete.
- Important modified files: `tests/weeklyReview.domain.test.ts` (new F5 west-of-UTC block, 5 tests), `scripts/qa-timezones.mjs` (matrix now includes weekly-review file).
- Last successful validation: `npm run qa:timezones` PASS all 5 zones (85 tests/file-set each, incl. 42 weekly-review); focused weekly-review 42/42 in all 5 zones; `npm run typecheck` 0 errors; eslint + prettier clean on touched files (Node v22.23.2).
- Current failures: None.
- Relevant quarantines: None.
- Blockers: None.
- Condition required to unblock: None.
- Exact resume action after unblock: None.
- Exact next action: None — task complete.
- Remaining definition of done: Complete — all seven conditions satisfied and evidenced in the Validation Ledger (defect proof, clean prod grep, regression tests, matrix wiring, green gates, validated plan, local commit).

## Progress

- [x] Read AGENTS.md, .agent/PLANS.md; inspect plans + git state.
- [x] Create ACTIVE ExecPlan.
- [x] Prove defect class with TZ evidence.
- [x] Confirm production code uses local helpers (grep clean).
- [x] Add timezone-pinned regression tests.
- [x] Wire weekly-review tests into qa-timezones matrix.
- [x] Verify: focused tests + matrix + typecheck/lint (Node 22.23.2).
- [x] Mark COMPLETED; validate plan; commit locally.

## Surprises & Discoveries

- Production weekly-review code is already migrated: no residual
  `new Date(<dateKey>)` in `weeklyReview.domain.ts` / `weeklyReview.summary.ts`.
  `new Date(refDate)` occurrences are `new Date(Date)` clones — safe. So the
  remaining gap is purely QA-infrastructure (matrix does not run weekly-review
  arithmetic west of UTC).

## Decision Log

- 2026-09-19 — Keep fix on existing local-calendar primitives
  (`dateKeyToLocalDate` / `listWeekDateKeys` / `shiftDateKeyByDays`); do not
  invent alternate calendars.
- 2026-09-19 — Close the gap via regression-unmissable timezone coverage
  rather than a production rewrite, since grep shows prod already local-safe.

## Validation Ledger

- 2026-09-19 — TZ evidence: `new Date("2026-08-17")` round-trips east of UTC (Manila/Kiritimati/UTC) but localizes to 08-16 west of UTC (New_York/Honolulu); local-midnight construction stays 08-17 everywhere — PASS (defect class proven).
- 2026-09-19 — residual grep: no date-only `new Date(<dateKey>)` in `features/weekly-review/` prod code; `new Date(Date)` clones only — PASS.
- 2026-09-19 — RED proof: UTC-parse `utcShift` impl yields 08-16..08-22 vs expected 08-17..08-23 under America/New_York (FAIL = caught) and matches under Asia/Manila (hidden) — PASS as detection demo.
- 2026-09-19 — `npx vitest run tests/weeklyReview.domain.test.ts` — PASS 42/42 under each of Asia/Manila, UTC, America/New_York, Pacific/Honolulu, Pacific/Kiritimati.
- 2026-09-19 — `npm run qa:timezones` — PASS all 5 zones, 4 files / 85 tests per zone.
- 2026-09-19 — `npm run typecheck` — PASS 0 errors; `eslint tests/weeklyReview.domain.test.ts` PASS; `prettier --check` on both touched files PASS (Node v22.23.2).

## Changed Files / Areas

- `.agent/execplans/weekly-summary-datekey-local-v1.md` — this plan.
- `tests/weeklyReview.domain.test.ts` — pending: west-of-UTC regression block.
- `scripts/qa-timezones.mjs` — pending: add weekly-review test file to matrix.

## Recovery / Resume Instructions

1. Read AGENTS.md, `.agent/PLANS.md`, and this plan completely.
2. Run `git status --short`, `git diff --stat`, `git log --oneline -3`; confirm
   HEAD d768708 baseline + plan-file changes only (until implementation lands).
3. Verify `node -v` is v22.23.2.
4. Continue from `Exact next action` above; update this checkpoint at every
   milestone/failure/decision/validation.
5. Before finishing: focused tests + `npm run qa:timezones` + typecheck/lint,
   then `npm run agent:plan:validate -- --plan .agent/execplans/weekly-summary-datekey-local-v1.md`,
   then local commit (no push/tags).

## Outcomes & Retrospective

- Status: Complete.
- Summary: F5 closed for real — prod already local-safe (verified by grep); added 5 timezone-pinned regression tests (round-trip, Monday-start bounds, DST spring-forward/fall-back weeks, prior-week bounds) with red/green proof comment, wired `tests/weeklyReview.domain.test.ts` into the qa-timezones matrix; all gates green under Node 22.23.2.
- Follow-up: successor should audit workout skipped-phase dispositions OR next highest box-executable P1 (see final message).
