# ExecPlan: Pop Frontend Redesign V1 — Recovery & Completion

Plan-Version: 2
Status: ACTIVE

## Purpose / User Outcome

Complete the interrupted aggressive frontend redesign of SuperHabits so the
entire app ships one cohesive "Pop" visual/interaction identity (Duolingo /
Brilliant / Mindllama-class polish) instead of the previous dashboard look.
The redesign was implemented by the interrupted `omp` session
`01a08ee5-3952-77de-b650-f4ff22f0f601` and left uncommitted in the working
tree; three parallel screen-redesign subagents (Todos, Habits, Calories) were
killed mid-edit, and no ExecPlan/commit ever recorded the campaign.

Observable success: every section and overlay renders the Pop language, the
app shell (bottom tab bar / desktop rail / capture FAB) works on web and
Android, gamification (XP/levels/quests/badges/celebration) is wired to real
actions, all existing strings/accessibility labels and tests are preserved,
the full local ladder is green, and the campaign is committed and pushed.

## Context

- Interrupted session evidence lives at
  `C:\Users\palac\.omp\agent\sessions\--D--Documents-tryPython-superhabits--\2026-09-11T05-16-22-226Z_01a08ee5-3952-77de-b650-f4ff22f0f601\`
  (audits + per-screen assignments + `local/pop-design-system.md`). The design
  contract must be promoted into the repo under `docs/ui-ux/`.
- Working tree at recovery: ~140 modified files + ~25 new files
  (design tokens/14 themes, ~60 UI components, app shell, gamification
  feature + migration 25, release docs, native verification screenshots).
- Recovered assignments (verbatim intent): Todos/Habits/Calories sections must
  be redesigned to Pop with `Screen`+`PageHeader` heroes, tinted `Card`
  tiles, chunky check/ring controls, `StatBlock` rows, `EmptyStateCard` +
  `SparkIllustration` empty states, and every existing label/copy preserved.
- Pop identity: Nunito type via `core/ui/Text`; rounded/fat geometry; section
  hue on every surface; chunky gradient buttons; physical motion; one obvious
  action per screen. See `docs/ui-ux/12-pop-design-system.md`.
- Repo invariants (AGENTS.md): soft delete, data-layer-only DB access, no
  weakened tests, no `data-testid`, append-only migrations (25 is gamification
  local-only ledger), single-page shell, six sections, one global Add.
- Env: Windows, PowerShell shell; Node 22/24 both load better-sqlite3.
  Persistent dev servers are forbidden as validation gates; use finite
  `build:web` + `serve-e2e`/Playwright + `web:verify`/`web:hygiene`.

## Scope

1. **Recovery repair** — fix breakage left by killed subagents (done:
   stray `+`/`COLOR` in `MacroTrendChart.tsx`; typecheck clean) and re-verify.
2. **Finish partial screen redesigns** — Todos, Habits, Calories, per the
   recovered assignments, preserving copy/tests.
3. **Screen audit pass** — Focus/Pomodoro, Workout, Settings, Overview cards,
   Planning Hub, Weekly Review, Command overlay, Quick Capture, Achievements,
   empty/loading/error states: bring any remaining pre-Pop surface up to the
   contract.
4. **Gamification completeness** — provider wiring, migration 25, reward
   ledger semantics, celebration overlay, sounds/haptics, tests, docs.
5. **Docs truth** — Pop design system doc, gamification knowledge doc,
   AGENTS.md/README/product-structure-map shell facts, `docs/release`.
6. **Validation ladder** — typecheck, lint, unit+integration, themes,
   OpenSpec, plan validation, `build:web`, Chromium E2E + journey P0,
   deterministic simulation, `web:verify` + `web:hygiene`; native Android
   smoke/persistence when a device lane is available.
7. **Commit/push** — coherent commits per scope, push, exact-head check.

## Non-Goals

- No domain/data/sync behavior changes beyond the already-landed local
  gamification ledger; no schema edits beyond migration 25 (no past-block
  edits).
- No route-model change (single-page shell; six sections; Achievements is a
  modal, not a seventh tab).
- No new dependencies beyond those already added (fonts/audio/haptics/assets).
- No test weakening, no `data-testid`, no blind retries/sleeps.
- No iOS lane (no macOS host) and no real store submission — store metadata
  is documented, not executed.

## Current Checkpoint

- Current milestone: W9 regression ladder — final full Chromium battery in
  flight; all targeted fixes verified (P0 journeys 25/25, Vitest 2055/2055,
  lint PASS, typecheck PASS).
- Completed:
  - W0–W8 as recorded below.
  - Fixed the redesign-surfaced regressions: Todos list height/virtualization,
    recurring-chain spawn semantics (+ real-SQLite regression test), Calories
    row name/kcal split, section-helper + heading selectors for the new shell,
    and merged-kcal assertions in determinism/journey specs.
  - P0 journey lane 25/25 PASS; past-midnight freshness + writes PASS after
    the ACTIVE_SECTION_SELECTOR/SECTION_HEADINGS updates.
- In progress: final `--project=chromium` battery on the frozen tree.
- Current failures: habits.spec.ts:222 is the documented known-gap flake
  (register §3: intermittent, passes standalone; re-verify before touching
  product code); portable-backup failures in the prior battery passed
  standalone → load flake.
- Exact next action: read the final battery; then `npm run web:verify`,
  `npm run web:hygiene`, deterministic simulation, OpenSpec/plan validators,
  native Android smoke on an owned AVD, refresh release-doc numbers, complete
  the ExecPlan, and commit/push in coherent scopes.
- Remaining definition of done: final battery evidence; web:verify/hygiene;
  sim green; release doc numbers refreshed; plan COMPLETED; commits pushed;
  native lane evidence or explicit ENVIRONMENT blocker.

## Delegation Log

| Subtask               | Owner    | Files (exclusive)                                                                                                           | Expected output                                                                                               | Status                       |
| --------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| To-Do Pop redesign    | subagent | `features/todos/*.tsx` (TodosScreen, TodoItem, TodoListToolbar, TodoBulkBar, TodoQuickCapture, PriorityBadge, DueDateBadge) | Pop hero/rows/empty state; labels preserved; eslint+tsc clean                                                 | integrated (eslint+tsc PASS) |
| Habits Pop redesign   | subagent | `features/habits/*.tsx` (screen, circles, grids, day strip, modals)                                                         | Pop hero with day chips; ring grid; tinted groups; labels preserved; eslint+tsc clean                         | integrated (eslint+tsc PASS) |
| Calories Pop redesign | subagent | `features/calories/*.tsx` (screen, form, diary, fields, chips, charts, modals)                                              | Pop hero with kcal remaining + fixed Form/Diary switch; tinted meal cards; labels preserved; eslint+tsc clean | integrated (eslint+tsc PASS) |

No two owners share a directory; the lead does not edit those directories while
the delegated work is running.

## Progress

- [x] W0 — recovery: evidence, typecheck repair, ExecPlan (2026-09-12)
- [x] W1 — lint + build:web green on recovered tree (2026-09-12)
- [x] W2 — screenshot inventory of all surfaces (phone + desktop) (2026-09-12)
- [x] W3 — Todos Pop redesign completed (delegated, integrated) (2026-09-12)
- [x] W4 — Habits Pop redesign completed (delegated, integrated) (2026-09-12)
- [x] W5 — Calories Pop redesign completed (delegated, integrated) (2026-09-12)
- [x] W6 — remaining screens audited/upgraded (Focus, Workout, Settings,
      Planning/Review/Command/Capture/Achievements, cards, states) (2026-09-12)
- [x] W7 — gamification completeness verified (wiring, tests, docs) (2026-09-12)
- [ ] W8 — docs truth (Pop doc, gamification doc, AGENTS/README/structure)
      — Pop doc/gamification/AGENTS/shell docs done; release numbers pending
- [ ] W9 — full validation ladder (P0 + Vitest + lint green; final chromium,
      web:verify, sim, native pending)
- [ ] W10 — commit/push, clean tree, CI check

## Surprises & Discoveries

- The interrupted session's state was fully recoverable from
  `~/.omp/agent/sessions/...jsonl` (audit files + subagent transcripts),
  including the verbatim screen assignments — recovery did not need planning
  from scratch.
- The killed subagents left two syntax-level breaks in one file; all other
  partial edits compile.
- The omp session also produced `docs/release/app-store-readiness.md` and
  native Android verification screenshots under `.cursor/native-verify/`.
- The redesign surfaced one real PRODUCT_BUG in the data layer: completing a
  _future_ recurring instance looked for the next copy on the same future
  date, found its own just-completed row, and stopped the series. Fixed with
  `nextRecurringSpawnDueDate` (single + bulk paths) and covered by a new
  real-SQLite integration test. The boundary E2E chain contract now holds.
- The redesigned Todos list needed its quick-add well + Pending header moved
  into the list's own header: the fixed chrome above the list collapsed the
  list to zero height on short viewports, making rows unreachable and
  undraggable (8 E2E failures).
- The Calories form row merged the food name and kcal into one text node,
  breaking the boundary spec's exact-name lookup; split into name + kcal
  nodes (better Pop layout) and updated the calories spec selector without
  weakening its assertion.

## Decision Log

- 2026-09-12 — Treat the uncommitted redesign as the active campaign and
  complete it, rather than reverting or replanning: the work is coherent,
  typechecks after two fixes, and matches the user's explicit mission.
- 2026-09-12 — Fix the recurring-spawn data-layer bug instead of adjusting the
  boundary E2E: the test encodes the intended repeated-expansion contract
  (documented in `docs/testing/autonomous-qa.md`).
- 2026-09-12 — Split the Calories form row name/kcal and update the
  `calories.spec.ts` selector (name + body-contains kcal) rather than keeping
  the merged node and breaking the boundary spec: selector updates are
  allowed on UI change, assertion strength preserved.
- 2026-09-12 — Resume the omp session's parallel-screen strategy with strict
  disjoint file ownership (todos / habits / calories) to finish W3–W5 while
  the primary agent audits remaining surfaces.
- 2026-09-12 — Normalize line endings via the repo's Prettier instead of
  hand-fixing 86 `Insert ␍` errors; the interrupted session wrote LF into
  CRLF files. Four real lint errors were fixed manually.
- 2026-09-12 — Promote the Pop design contract from the omp session dir into
  `docs/ui-ux/12-pop-design-system.md` as a repo artifact (do not leave design
  state in `.omp`).

## Validation Ledger

- 2026-09-12 — `npm run typecheck` — PASS (exit 0) after repair.
- 2026-09-12 — `npm run lint` — PASS (exit 0) after Prettier + 4 fixes.
- 2026-09-12 — `npm run build:web` — PASS (exit 0, multiple rebuilds).
- 2026-09-12 — `npx playwright test e2e/zz-pop-visual-audit.spec.ts
--project=chromium` — PASS 3/3 (32 screenshots, phone/desktop/empty).
- 2026-09-12 — `npx playwright test --project=chromium` (full feature suite)
  — FAIL 11/146 initially (list-layout regressions + 2 real gaps); after the
  list repair 45/48 of the failing subset passed; the last two were fixed by
  the recurring-spawn data fix and the calories row split; habits.spec:222 is
  the documented pre-existing flake (tracked below).
- 2026-09-12 — `npx vitest run --project integration
tests/integration/recurringSeriesCorrection.test.ts
tests/integration/todoReminderActions.test.ts` — PASS 13/13 (includes the
  new chain-advance regression test).

## Changed Files / Areas

- `features/calories/MacroTrendChart.tsx` — repaired interrupted edit.
- `features/todos/*.tsx`, `features/habits/*.tsx`, `features/calories/*.tsx` —
  delegated Pop completion (W3–W5).
- `.agent/execplans/pop-frontend-redesign-v1.md` — this plan.
- `docs/ui-ux/12-pop-design-system.md` — promoted design contract.
- `.cursor/playwright-output/pop-audit/*.png` — visual inventory (gitignored).
- (campaign-wide diff recorded by Git; see `git status --short`.)

## Recovery / Resume Instructions

1. Read `AGENTS.md`, `.agent/PLANS.md`, this plan.
2. `git status --short` + `git diff --stat`; the campaign is the entire dirty
   tree — do not revert it.
3. `npm run agent:resume -- --plan .agent/execplans/pop-frontend-redesign-v1.md`.
4. `npm run typecheck` and `npm run lint` must be clean before UI work.
5. Re-read the recovered assignments under the `.omp` session path (see
   Context) if screen-level intent is unclear; the Pop contract is also in
   `docs/ui-ux/12-pop-design-system.md` once promoted.
6. Continue from `Exact next action`.

## Outcomes & Retrospective

- Status: Active.
- Summary: pending completion.
- Follow-up: pending completion.
