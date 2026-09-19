# ExecPlan: app-store-store-assets-checklist-v1

Plan-Version: 2
Status: COMPLETED

## Purpose / User Outcome

Close the highest-value remaining locally-actionable store gap: `docs/release/store-data-declarations.md` §4 is a 10-line device-bound stub with no verifiable dimensions, counts, or surface-to-code mapping. Deliver a verifiable store-assets dimensions/spec checklist (`docs/release/store-assets-checklist.md`, referenced from §4 and `app-store-readiness.md` items 1–2) that lists Apple + Play sizes/counts, maps the six preferred surfaces to real existing screens/components, and states capture acceptance criteria — without fabricating PNG screenshots. Device capture itself stays `[OWNER ACTION]` / device-bound checkboxes.

## Context

- Prior store increments are COMPLETED and uncommitted (commit left to release-time per loop intent): `app-store-privacy-artifacts-v1`, `app-store-privacy-hosting-v1`, `app-store-release-notes-v1`, `app-store-age-rating-dsa-v1` (just closed 2026-09-19 after re-verify: plan valid, prettier PASS, 4/4 focused PASS).
- Current stub: `docs/release/store-data-declarations.md` §4 lists "6.7\" + 6.1\" iPhone sets; 12.9\"/13\" iPad sets" and "feature graphic 1024×500, ≥ 2 phone screenshots" with six surfaces and acceptance line, but no pixel dimensions, no per-size counts, no file/route mapping, no framing rules.
- Readiness pointers: `docs/release/app-store-readiness.md` items 1–2 describe the same six surfaces (Today dashboard, Habits, Focus timer, Workout session, Calories diary, Level & Achievements) as seeded-device captures.
- Real single-page shell (`app/index.tsx`): six sections behind `NavigationContext.activeSection` — `overview` (Today), `todos`, `habits`, `pomodoro` (Focus), `workout`, `calories` — plus overlays: Settings modal, Weekly Review modal, Planning Hub modal, Quick Capture bottom-sheet, Achievements drawer (`isAchievementsOpen`, title "Level & Achievements").
- Real surface-to-code mapping (verified 2026-09-19, no invented UI):
  - Today → `features/overview/OverviewScreen.tsx` via `app/index.tsx` `SECTION_SCREENS.overview`.
  - Habits → `features/habits/HabitsScreen.tsx` via `SECTION_SCREENS.habits`.
  - Focus → `features/pomodoro/PomodoroScreen.tsx` via `SECTION_SCREENS.pomodoro`.
  - Workout session → `features/workout/WorkoutSessionScreen.tsx` (guided session) reached from `features/workout/WorkoutScreen.tsx` via `SECTION_SCREENS.workout`.
  - Calories diary → `features/calories/CaloriesScreen.tsx` Diary mode (`CaloriesDiaryView`, storage key `superhabits.calories.viewMode`) via `SECTION_SCREENS.calories`.
  - Level & Achievements → `features/gamification/AchievementsScreen.tsx` (with `LevelHero`) opened as the "Level & Achievements" drawer modal in `app/index.tsx`.
- Constraints: docs + static guard-test change only; no product code, schema, migration, sync, or UI changes; no `git tag`; no EAS credentials; no invented emails/URLs/owner identity — `[OWNER ACTION]` only; do NOT fabricate PNG screenshots or image binaries (no seeded device/emulator locally).

## Scope

- Add `docs/release/store-assets-checklist.md`: Apple sizes + pixel dimensions + counts, Play feature-graphic + screenshot specs, six-surface → file mapping table, capture acceptance criteria, device-bound `[OWNER ACTION]` capture checkboxes, framing/don'ts, re-verify note.
- Update `docs/release/store-data-declarations.md` §4 to reference the new checklist as the verifiable spec (keep the stub's device-bound checkboxes, point at the new file).
- Update `docs/release/app-store-readiness.md` items 1–2 + snapshot line to reference the checklist as **delivered 2026-09-19**.
- Add `tests/store-assets-checklist.test.ts`: guard that the checklist exists, cites required dimensions (1290×2796, 1179×2556, 2048×2732, 1024×500), references the six known surfaces/screens without claiming PNGs exist, and preserves `[OWNER ACTION]` for capture.
- Validate: `agent:plan:validate`, `format:check`, `qa:affected` → cheapest sufficient gate + focused new test + hygiene.

## Non-Goals

- No product code, schema, migration, sync, or UI changes.
- No actual screenshot / feature-graphic image capture or binary creation (device-bound; stays owner-side).
- No App Store Connect / Play Console submission or credential configuration.
- No `git tag v1.0.0`, no EAS submit credentials.
- No invented contact email, URL, owner identity, or store-locale claims.
- No legal advice.

## Current Checkpoint

- Current milestone: Done — store-assets dimensions/spec checklist ships with guard test and readiness wiring; DoD re-verified 2026-09-19 before close.
- Completed: startup (AGENTS.md + PLANS.md read, agent:plans listed, git inspected); age-rating plan re-verified and marked COMPLETED (plan valid, prettier PASS, 4/4 focused PASS); six-surface → file mapping verified against `app/index.tsx` + feature screens; `docs/release/store-assets-checklist.md` drafted (Apple 1290×2796 / 1179×2556 / 2048×2732 / 2064×2752 + counts, Play 1024×500 + phone rules, six-surface file table, acceptance §4, owner capture boxes, no fabricated PNGs); `store-data-declarations.md` §4 + `app-store-readiness.md` items 1–2 + snapshot wired as delivered 2026-09-19; `tests/store-assets-checklist.test.ts` added (4/4 PASS); `agent:plan:validate` PASS; `prettier --write` + `--check` PASS; `qa:affected` consulted → gate qa:fast; `qa:fast` typecheck PASS + lint PASS + unit 1775 passed / 1 pre-existing ENVIRONMENT failure + parity OK; focused joint 16/16 PASS (store-assets + age-rating + release-notes + privacy-hosting); `web:hygiene` PASS (8081/8082 free); close-out re-verify 2026-09-19 (plan valid, prettier PASS, focused 16/16 PASS) with DoD still met.
- In progress: none — task complete.
- Important modified files: this plan (new); `docs/release/store-assets-checklist.md` (new); `docs/release/store-data-declarations.md` (§4 wiring); `docs/release/app-store-readiness.md` (items 1–2 + snapshot); `tests/store-assets-checklist.test.ts` (new).
- Last successful validation: 2026-09-19 close-out re-verify — plan valid; prettier PASS (4 files); focused 16/16 PASS (store-assets 4/4 + age-rating + release-notes + privacy-hosting); DoD still met.
- Current failures: None.
- Relevant quarantines: None.
- Blockers: None.
- Condition required to unblock: None.
- Exact resume action after unblock: None.
- Exact next action: None — task complete.
- Remaining definition of done: Done — all items complete: checklist doc ships with Apple + Play dimensions/counts, six-surface file mapping, acceptance criteria, and owner-action capture boxes (no fabricated PNGs); `store-data-declarations.md` §4 + `app-store-readiness.md` items 1–2 point at the checklist; `tests/store-assets-checklist.test.ts` guards dimensions + surfaces + owner-action and passes (4/4, 16/16 focused joint); `agent:plan:validate` PASS; `format:check` PASS; cheapest QA gate green except 1 pre-existing ENVIRONMENT failure classified with prior clean-tree evidence; hygiene PASS; checkpoint current.

## Progress

- [x] 2026-09-19 — Startup + age-rating COMPLETED close-out + surface mapping verification.
- [x] 2026-09-19 — Draft `docs/release/store-assets-checklist.md`.
- [x] 2026-09-19 — Wire §4 + readiness items 1–2.
- [x] 2026-09-19 — Add `tests/store-assets-checklist.test.ts`.
- [x] 2026-09-19 — Validation round: plan valid, prettier PASS (after --write on 2 files), store-assets 4/4 PASS, qa:affected consulted, qa:fast green except 1 pre-existing ENVIRONMENT failure (classified), focused 16/16 PASS, hygiene PASS.

## Surprises & Discoveries

- None yet.

## Decision Log

- 2026-09-19 — Chose the §4 store-assets dimensions/spec checklist as this loop's one gap: it is the highest-value local gap per the age-rating plan's Exact next action, fully writable from public store specs + verified repo surfaces, while PNG capture itself must stay device-bound.

## Validation Ledger

- 2026-09-19 — Startup + `agent:plans` + git inspection — age-rating ACTIVE with met DoD; prior three store plans COMPLETED.
- 2026-09-19 — Age-rating close-out re-verify: `agent:plan:validate` PASS (ACTIVE), `prettier --check` PASS, `tests/age-rating-dsa.test.ts` 4/4 PASS; then marked COMPLETED and re-validated PASS.
- 2026-09-19 — New plan `agent:plan:validate` PASS on creation (ACTIVE).
- 2026-09-19 — Focused `tests/store-assets-checklist.test.ts` 4/4 PASS; `prettier --write` applied to 2 files, then `--check` PASS (4 files).
- 2026-09-19 — `qa:affected` → gate qa:fast (rule agent-workflow-and-documentation), focused tests/agent-execplan.test.ts, no broad regression.
- 2026-09-19 — `qa:fast`: typecheck PASS, lint (`--max-warnings 0`) PASS, test:unit 1775 passed / 1 failed / 137 files (failure = `tests/web-lifecycle.test.ts › terminateOwnedTree` exitCode null — same pre-existing ENVIRONMENT failure recorded in all four prior store plans with clean-tree evidence; unrelated to this docs-only change), journey-label-parity OK. Focused joint 16/16 PASS (store-assets + age-rating + release-notes + privacy-hosting). `web:hygiene` PASS (8081/8082 free).
- 2026-09-19 — Close-out re-verify before COMPLETED: `agent:plan:validate` PASS (ACTIVE), `prettier --check` PASS (4 files), focused `store-assets + age-rating + release-notes + privacy-hosting` 16/16 PASS; DoD still met.

## Changed Files / Areas

- `.agent/execplans/app-store-store-assets-checklist-v1.md` — this plan.
- `.agent/execplans/app-store-age-rating-dsa-v1.md` — marked COMPLETED with close-out evidence (sibling increment).
- `docs/release/store-assets-checklist.md` — new (Apple/Play dimensions + counts, six-surface file mapping, acceptance, owner capture boxes).
- `docs/release/store-data-declarations.md` — §4 wiring to the checklist.
- `docs/release/app-store-readiness.md` — items 1–2 + snapshot wiring.
- `tests/store-assets-checklist.test.ts` — new guard (dimensions + surfaces + acceptance + owner-action, no PNG claims).

## Recovery / Resume Instructions

1. Read `AGENTS.md`, then `.agent/PLANS.md`.
2. Read this plan file completely.
3. Run `git status --short` and `git diff --stat`; Git wins over narrative.
4. Run `npm run agent:resume -- --plan .agent/execplans/app-store-store-assets-checklist-v1.md`.
5. Continue from `Exact next action` above; keep this checkpoint current.

## Outcomes & Retrospective

- Status: Done — task complete. Store-assets dimensions/spec checklist ships with guard test and readiness wiring; DoD re-verified 2026-09-19 before close.
- Summary: delivered the missing §4 verifiable spec (Apple 6.7"/6.1" + 12.9"/13" sizes with pixels + counts, Play 1024×500 + phone rules, six-surface → file table, acceptance criteria, owner capture boxes) with a 4-case guard test, wired §4 + readiness items 1–2, and closed the age-rating plan after re-verification; full local validation green except 1 pre-existing ENVIRONMENT failure classified with prior clean-tree evidence; close-out re-verify 2026-09-19 confirmed plan valid, prettier PASS, 16/16 focused PASS.
- Follow-up: commit at release-time discretion; successor gap is the app.json icon/splash/notification PNG-header audit (new plan `app-store-icon-splash-audit-v1.md`); capture, EAS submit credentials, trader filing, and v1.0.0 tag stay owner/release-time only.
