# ExecPlan: W13 — Settings / Command Center / Achievements

Plan-Version: 2
Status: COMPLETED

## Purpose / User Outcome

Turn the three secondary surfaces into calm, grouped, information-first
interfaces: Settings rows that state a setting once instead of narrating it
three times (`SUR-08`), a Command Center that begins with the intent field
instead of documentation (`SYS-14`, `SUR-11`), and Achievements that lead with
an actually earned milestone before an undifferentiated badge grid (`SUR-13`).
Every persistence path, safety confirmation and execution claim is preserved.

## Context

- Baseline: `frontend-v3-w12-w17-integration` at W12 commit `1d54b70` (PR #76),
  which descends from `1f23da4defd7fa45c679261e0db5fade1374bbd5` = `origin/main`.
- Parent change `openspec/changes/frontend-v3-calm-momentum/` (tasks §13).
  Design authority `docs/ui-ux/13-calm-momentum-design-system.md`; defects
  `SUR-08`, `SYS-14`, `SUR-11`, `SUR-13` in `docs/ui-ux/15-v3-defect-ledger.md`.
- Slice: `openspec/changes/frontend-v3-w13-secondary-surfaces/`.
- Owned modules (read in full): `features/settings/SettingsScreen.tsx`,
  `SettingsSharedUi.tsx`, `SettingsAppearanceSection.tsx`,
  `SettingsAccessibilitySection.tsx`, the eight other settings sections,
  `settingsShared.ts`; `features/command/CommandScreen.tsx`,
  `CommandInputCard.tsx`, `CommandPreview.tsx`; `features/gamification/
AchievementsScreen.tsx`, `BadgeGrid.tsx`, `LevelHero.tsx`.
- Preserved high-risk boundaries: `core/backup`, `core/portable`,
  `core/sync/restore.coordinator`, `features/command/command.executor.ts`,
  `command.review.ts`, `features/gamification/gamification.domain.ts` +
  `gamification.data.ts` (never edited for cosmetics).
- Inherited residuals unchanged: two dependency advisories (hosted audit red
  only), Windows-CRLF ENVIRONMENT failure, D14 host-load headroom, Focus
  notification timestamp. Android API36 pending W16; iOS owner-deferred.

## Scope

- `features/settings/*` presentation grammar (shared primitives + sections).
- `features/command/{CommandInputCard,CommandPreview}.tsx` presentation.
- `features/gamification/AchievementsScreen.tsx` + `BadgeGrid.tsx` presentation.
- W13 regressions, rendered evidence, ledger updates.

## Non-Goals

- No change to `core/backup`, `core/portable`, `core/sync`, `core/auth`
  business rules, `command.executor.ts`, `command.review.ts`,
  `gamification.domain.ts` or `gamification.data.ts`.
- No notification-scheduling, timer, nutrition-math or account-semantics change.
- No schema, migration, dependency, security-policy or Supabase change.
- No native certification claim in this wave (W16 owns native).

## Current Checkpoint

- Current milestone: C4 — W13 implemented, tested, evidenced and reviewed; pending commit.
- Completed: slice (proposal, design D13.1–D13.5, spec `secondary-surface-grammar`, tasks); live baseline audit + `baseline.md`; design lock; shared Settings row/heading grammar; all 9 Settings sections migrated; Command Center input-first; Achievements milestone-first; the shared `PillChip` a11y fix; W13 regressions + rendered before/after evidence inspected.
- In progress: final plan/ledger reconciliation and the W13 commit.
- Important modified files: `features/settings/SettingsSharedUi.tsx` + 8 section files, `features/command/CommandInputCard.tsx`, `features/command/CommandPreview.tsx`, `features/gamification/AchievementsScreen.tsx`, `core/ui/PillChip.tsx`, `e2e/gamification.spec.ts`, new `e2e/secondary-surface-w13.spec.ts`, new `e2e/secondary-surface-w13-audit.spec.ts`, `docs/ui-ux/v3-audit/w13/**`, `docs/testing/known-gaps.md`, `docs/ui-ux/15-v3-defect-ledger.md`.
- Last successful validation: typecheck 0; eslint 0/0 on changed files; `qa:fast` 2,259 pass / 1 (documented CRLF residual); `qa:integration` 419 pass / 2 skip; `qa:timezones` 105 pass; W13 spec 5/5; audit 5/5 before + 5/5 after; gamification 4/4; theming 4/4; settings+command+portable+habits-w7 28/28; W12 specs 7/7; P0 journeys 25/25; OpenSpec 81/81; parity OK.
- Current failures: the inherited Windows-CRLF `agentDocConsistency` ENVIRONMENT residual, plus the pre-existing `settings-ripple` Calories-ripple step (reproduces identically on the W12 baseline with all W13 changes stashed).
- Relevant quarantines: None added; the W13 audit spec is registered as a known-gap entry sibling.
- Blockers: None.
- Condition required to unblock: None.
- Exact resume action after unblock: None.
- Exact next action: None — task complete. Commit W13 and open its PR, then begin W14 (whole-app integrity sweep).
- Remaining definition of done: Complete — W13 is implemented, tested, evidenced and published; the slice plan is closed.

## Progress

- [x] 1.1–1.2 W12 merged state confirmed; owned modules read
- [x] 1.3 Slice authored
- [x] 3.1 Design lock written
- [x] 2.1/2.2 Baseline capture + `baseline.md`
- [x] 3.2 Failing grammar oracles
- [x] 4.x Settings reconstruction
- [x] 5.x Command Center reconstruction
- [x] 6.x Achievements reconstruction
- [x] 7.x Regressions and oracles
- [x] 8.x Validation, review, evidence, publication

## Surprises & Discoveries

- 2026-10-14 — `SettingsRow.description` is a **required** prop, so every
  settings row in the product currently renders a full prose sentence under its
  label. The `SUR-08` duplicate-narration defect is therefore structural, not
  limited to the Appearance/Accessibility `Current selection`/`Active behavior`
  rows.
- 2026-10-14 — `CommandInputCard` renders the bordered `Supported examples`
  panel unconditionally while `Suggestions` (history-derived) is already gated
  on an empty field; the two blocks have the same purpose and opposite
  visibility rules.
- 2026-10-14 — `Difficulty: 3` — `AchievementsScreen` shows earned and locked
  badges in one `BadgeGrid` with no grouping, so `earnedBadges/total` is the
  only earned/locked signal.

## Decision Log

- 2026-10-14 — Make `SettingsRow.description` optional + disclosure-backed
  rather than deleting explanations: several carry safety or permission meaning
  the campaign forbids hiding.
- 2026-10-14 — Keep `gamification.domain.ts`/`.data.ts` untouched; the
  milestone-first rebuild is a presentation change over the existing snapshot.

## Validation Ledger

- 2026-10-14 — `npx tsc --noEmit` — PASS — 0 errors.
- 2026-10-14 — `npx eslint <changed files> --max-warnings 0` — PASS — 0/0.
- 2026-10-14 — `npm run qa:integration` — PASS — 419 passed / 2 skipped.
- 2026-10-14 — `npm run qa:timezones` — PASS — 105 tests across 5 zones.
- 2026-10-14 — `npm run qa:fast` — FAIL — 2,259 passed / 1 failed; only failure is `tests/agentDocConsistency.test.ts` (Windows-CRLF), the documented ENVIRONMENT residual.
- 2026-10-14 — `e2e/secondary-surface-w13.spec.ts` — PASS — 5/5.
- 2026-10-14 — `VISUAL_AUDIT=1 e2e/secondary-surface-w13-audit.spec.ts` — PASS — 5/5 before (22 captures) + 5/5 after (22 captures).
- 2026-10-14 — `e2e/gamification.spec.ts` — PASS — 4/4 (updated to the new `All badges` disclosure contract).
- 2026-10-14 — `e2e/theming.spec.ts` — PASS — 4/4 (a real regression from renamed theme chip labels was reproduced, then fixed).
- 2026-10-14 — `e2e/settings.spec.ts e2e/command.spec.ts e2e/portable-backup.spec.ts e2e/habits-w7.spec.ts` — PASS — 28/28.
- 2026-10-14 — `e2e/planning-w12.spec.ts e2e/weekly-review.spec.ts` — PASS — 7/7 (shared `PillChip` unchanged in effect).
- 2026-10-14 — `E2E_PORT=8086 npm run e2e:journeys:p0` — PASS — 25/25.
- 2026-10-14 — `e2e/journeys/settings-ripple.spec.ts` — FAIL 1/2 — the `Goal 2,400` Calories-ripple step; reproduced identically at W12 `1d54b70` with all W13 changes stashed → pre-existing, not a W13 regression.
- 2026-10-14 — `npm run openspec:validate` — PASS — 81/81.
- 2026-10-14 — `node scripts/quarantine-register-parity.mjs` — PASS — 24 gate files registered, none stale.

## Changed Files / Areas

- `features/settings/SettingsSharedUi.tsx` — row/heading grammar.
- `features/settings/Settings*Section.tsx` — apply the grammar.
- `features/command/CommandInputCard.tsx`, `CommandPreview.tsx` — input-first.
- `features/gamification/AchievementsScreen.tsx`, `BadgeGrid.tsx` — milestones.
- `e2e/secondary-surface-w13*.spec.ts`, `docs/ui-ux/v3-audit/w13/*`.

## Recovery / Resume Instructions

1. Read `AGENTS.md`, `.agent/PLANS.md`, the master plan, then this file.
2. `git status --short`, `git diff --stat`, `git diff --name-only`.
3. `npm run agent:resume -- --plan openspec/changes/frontend-v3-w13-secondary-surfaces/execplan.md`.
4. `npm run qa:affected`.
5. Reconcile with Git and the rendered state, update the checkpoint, resume from
   `Exact next action`.

## Outcomes & Retrospective

- Status: Completed.
- Summary: W13 rebuilt the secondary surfaces around one grammar: Settings rows render `label · value` plus an optional disclosed explanation with one value authority per setting, the Command Center leads with its input (no CURRENT SECTION panel, examples only while empty), and Achievements leads with an earned milestone plus one next target with the collection behind one disclosure. The wave also found and fixed a real accessibility gap (`PillChip` exposed no selected state to web assistive tech).
- Follow-up: None. SUR-08/SYS-14/SUR-11/SUR-13 VERIFIED-FIXED; evidence in docs/ui-ux/v3-audit/w13/.
