# ExecPlan: timeline-decrement-label-v1

Plan-Version: 2
Status: COMPLETED

## Purpose / User Outcome

Fix Activity Timeline habit events that mislabel decrement touches as
`Completed`. After the fix, habit timeline items use the neutral log
operation label (`Logged "name"`) so increments, decrements,
backdated corrections, and below-target counts are never presented as
completions. Todo/project/goal completion labels stay unchanged.

## Context

- Timeline read model: `features/activity/activityTimeline.data.ts`
  (`buildActivityTimeline`) + pure helpers in
  `features/activity/activityTimeline.domain.ts`, rendered by
  `features/activity/ActivityTimelineView.tsx`, types in
  `features/activity/activityTimeline.types.ts`.
- Habit state: `habit_completions` is one row per `(habit_id, date_key)`
  with a mutable `count`. `incrementHabit` upserts count+1 (outbox
  `create`); `decrementHabit` (`features/habits/habits.data.ts:474-524`)
  does count-1 with `updated_at = now`, hard-deleting the row at 0
  (outbox `update` / `delete`). There is no per-operation event table.
- Current habit branch (`activityTimeline.data.ts:99-113`) queries
  `hc.updated_at >= ?`, orders by `updated_at DESC`, buckets by
  authoritative `hc.date_key` (F5 partial fix), but titles every row
  `Completed "<name>"` with `occurredAt = hc.updated_at`. A decrement
  (or backdated correction) therefore surfaces as a fresh "Completed"
  event; the in-code comment claims "label neutrally" but the code does
  not.
- Audit reference: `.agent/hardening-evidence/audit-reports.md` F5
  ("labels every completion-row update as Completed") suggested
  neutral `Habit logged` wording or an operation marker; prior plan
  `command-review-paused-habit-guard-v1` deferred this as "needs
  operation marker".
- Layering: title formatting is pure → belongs in
  `activityTimeline.domain.ts`; data layer keeps SQL + calls the helper.
  No migration, no sync/outbox change, no new entity, no PII.
- Node engine: `package.json` requires Node `>=22.22.1 <23`; verified
  `v22.23.2` in this session.

## Scope

- Add pure `formatHabitTimelineTitle(name)` in
  `activityTimeline.domain.ts` returning the neutral log label
  `Logged "<truncated name>"` (shared truncation, 60 chars).
- Use it in `activityTimeline.data.ts` habit branch for live + deleted
  (fallback `a deleted habit`) rows; keep subtitle
  `Habit · <date_key>[ · <count>×]` and `dateKey = hc.date_key` bucketing.
- Update/extend unit tests (`tests/activityTimeline.test.ts`) + real-DB
  integration tests (`tests/integration/activityTimelineData.test.ts`)
  to pin: no habit item says `Completed`; decrement-then-read still
  says `Logged`; increment-then-read says `Logged`; orphan fallback is
  `Logged "a deleted habit"`.
- Validate: `qa:affected` impact, `typecheck`, `lint`, unit + timeline
  integration tests, `agent:plan:validate`. Commit locally (no push/tag/EAS).

## Non-Goals

- No new `habit_completions` event/operation column or migration 26.
- No change to todo/project/goal/daily-plan/review/focus/workout/
  calorie timeline labels (stable `completed_at` completions stay
  `Completed`).
- No sync/outbox, backup, portable, restore, or gamification changes.
- No E2E suite run (static `dist/` rebuild out of scope for a label-only
  change; unit + real-SQLite integration is the sufficient gate).
- No push, tag, EAS build, or PII fixtures.

## Current Checkpoint

- Current milestone: complete — fix landed, all gates green, ready to commit.
- Completed: root-cause fix (`formatHabitTimelineTitle` + habit branch
  wiring); unit + integration timeline tests updated/extended; typecheck +
  focused lint + full unit + timeline integration + parity/hygiene green.
- In progress: none.
- Important modified files: `features/activity/activityTimeline.domain.ts`,
  `features/activity/activityTimeline.data.ts`, `tests/activityTimeline.test.ts`,
  `tests/integration/activityTimelineData.test.ts`.
- Last successful validation: full unit 142 files / 1840 tests PASS;
  timeline integration 4/4 PASS; typecheck exit 0; focused eslint LINT_OK
  (2026-09-20).
- Current failures: None.
- Relevant quarantines: None.
- Blockers: None.
- Condition required to unblock: None.
- Exact resume action after unblock: None.
- Exact next action: None — task complete.
- Remaining definition of done: complete (all items proven).

## Progress

- [x] 2026-09-20 — Root-caused decrement-mislabeled-as-Completed to the
      unconditional habit `Completed` title in `buildActivityTimeline`.
- [x] 2026-09-20 — Landed neutral `Logged` operation label + tests.
- [x] 2026-09-20 — Validated gates (typecheck/lint/unit/integration).

## Surprises & Discoveries

- The F5 code comment already promises "label neutrally" while the
  title literal still says `Completed` — comment/code drift is the
  proximate defect, not just the missing operation marker.

## Decision Log

- 2026-09-20 — Use neutral `Logged "name"` for ALL habit timeline rows
  instead of decrement-specific `Decremented` or count-vs-target
  `Completed` gating. Why: `habit_completions` is mutable state with no
  operation history; any `Completed` claim is unsound for decrements,
  backdated edits, and below-target counts. Neutral matches the audit's
  suggested fix, the calories `Logged …` vocabulary, and needs no
  migration/sync change.
- 2026-09-20 — Put title formatting in `activityTimeline.domain.ts`
  (pure, unit-testable) per feature-module pattern; data layer only
  calls it. Why: keeps DB/React separation and enables direct label
  tests without DB mocks.

## Validation Ledger

- 2026-09-20 — `node --version` → v22.23.2 — PASS (engine constraint met).
- 2026-09-20 — `node scripts/qa-impact.mjs --files
features/activity/activityTimeline.data.ts
features/activity/activityTimeline.domain.ts
tests/activityTimeline.test.ts` → default `qa:fast → qa:full` — INFO.
- 2026-09-20 — `npm run typecheck` — PASS (exit 0).
- 2026-09-20 — `npx eslint <4 timeline files> --max-warnings 0` — PASS (LINT_OK).
- 2026-09-20 — `npm run test:unit -- tests/activityTimeline.test.ts` —
  PASS (18/18).
- 2026-09-20 — `npm run test:integration --
tests/integration/activityTimelineData.test.ts` — PASS (4/4, includes
  new decrement Logged-vs-Completed oracle).
- 2026-09-20 — `npm run test:unit` — PASS (142 files / 1840 tests).
- 2026-09-20 — `node scripts/journey-label-parity.mjs` — PASS (OK).
- 2026-09-20 — `node scripts/quarantine-register-parity.mjs` — PASS (OK).
- 2026-09-20 — `npm run web:hygiene` — PASS (8081/8082 free).
- 2026-09-20 — `npm run agent:plan:validate -- --plan
.agent/execplans/timeline-decrement-label-v1.md` — PASS (valid, ACTIVE;
  re-run at COMPLETED before commit).

## Changed Files / Areas

- `.agent/execplans/timeline-decrement-label-v1.md` — this plan.
- `features/activity/activityTimeline.domain.ts` — add
  `formatHabitTimelineTitle` (pending).
- `features/activity/activityTimeline.data.ts` — habit branch uses the
  helper (pending).
- `tests/activityTimeline.test.ts` — pin neutral labels (pending).
- `tests/integration/activityTimelineData.test.ts` — pin real-DB
  increment/decrement labels (pending).

## Recovery / Resume Instructions

1. Read `AGENTS.md`, then `.agent/PLANS.md`, then this plan.
2. Run `git status --short`, `git diff --stat`, `git diff --name-only`.
3. Run `npm run agent:resume -- --plan
.agent/execplans/timeline-decrement-label-v1.md` and reconcile warnings.
4. Continue from `Exact next action` above; keep this checkpoint current.
5. Before finishing: `npm run agent:plan:validate -- --plan
.agent/execplans/timeline-decrement-label-v1.md`, plus typecheck/lint/
   timeline tests; commit locally without push/tag/EAS.

## Outcomes & Retrospective

- Status: Complete.
- Summary: habit timeline items now render `Logged "name"` via pure
  `formatHabitTimelineTitle`; decrement touches (updated_at bumps with
  count > 0) no longer surface as `Completed`. Task/project/goal labels
  unchanged. Unit (18) + real-SQLite integration (4) pin the label,
  including a 2-increment/1-decrement oracle and the orphan fallback.
- Follow-up: none. If product later wants true per-operation history
  (increment vs decrement events), that needs a new event table +
  migration + backup scope change — explicitly out of scope here.
