# ExecPlan: UI v2 P18 — Settings (Playful Momentum)

Plan-Version: 2
Status: COMPLETED

## Purpose / User Outcome

Implement phase **P18 "Settings"** of brief v2 "Playful Momentum"
(`docs/ui-ux/16-playful-momentum.md` §7 "Settings", §10 P18 row) on branch
`ui/v2-p18-settings`.

The user-visible outcome: the Settings modal reads as a Playful-Momentum
surface — **bold `titleMd` group titles**, rows inside `depth.flat` groups,
**no narration paragraphs**, a **theme picker made of OptionRow-style rows with
live mini-previews**, and the Sounds/Haptics reward-feedback preferences as a
**chunky Sprout switch**. Every asserted string, id, role, label, and domain
behaviour is unchanged.

Presentation-only: no data/sync/backup/migration/domain change, no new
dependency, no test weakened, no golden created.

## Context

- Worktree `/workspace/wt-v2-p18-settings`, branch `ui/v2-p18-settings` from
  `main` @ `39a6f7ea`. P1–P17 already shipped, so `Pressable3D`, `OptionRow`,
  `Chip`, `Card`, `ListGroup`, the `Text` roles, `depth` tokens and §5.1 hues
  already exist on this base.
- Owned files: `features/settings/*`, `core/ui/ThemePreviewCard.tsx`, one new
  `core/ui/Switch.tsx`, `e2e/settings-v2-p18.spec.ts` (new) plus the related
  unit tests that already cover these primitives.
- E2E that had to stay green unchanged: `e2e/settings.spec.ts`,
  `e2e/theming.spec.ts`, `e2e/secondary-surface-w13.spec.ts` (+ its opt-in
  `-audit` evidence spec), `e2e/portable-backup.spec.ts`,
  `e2e/gamification.spec.ts` (its two reward-feedback preference tests address
  Settings copy), `e2e/a11y.spec.ts` Settings audits, and the
  `journeys/settings-ripple` journey.
- Goldens `settings-top-390/1280`, `settings-backup-390` are CI-only and were
  **not** touched.

## Scope

1. `core/ui/Switch.tsx` (new) — the chunky two-position switch: Sprout-bright
   track, white knob with a 2px lip, labelled positions, `radiogroup` +
   `radio` + `aria-checked`/`aria-pressed`, Space/Enter and arrow keys,
   reduced-motion snap, 44pt track.
2. `core/ui/ThemePreviewCard.tsx` — reworked from a selectable card into the
   decorative live mini-preview (canvas, card, text bars, brand dot, mini
   button) painted from the _previewed_ theme's own tokens and hidden from
   assistive tech.
3. `features/settings/SettingsSharedUi.tsx` — bold `titleMd` group heading,
   `bodyMd`/`caption` row roles, unchanged sheet-detail disclosure contract,
   new `SettingsGroup` (`depth.flat`, radius 16, hairline dividers).
4. `SettingsAppearanceSection.tsx` — theme pickers are `OptionRow`s (role
   `radio`, name `<Theme>, <appearance> theme`) with the live preview trailing;
   the mode control stays a `Chip` row so `aria-pressed`/`getByRole('button',
name 'Dark')` keeps working.
5. `SettingsAccessibilitySection.tsx` — Sounds/Haptics are now the chunky
   switch with the existing position words; the same preview feedback fires.
6. Narration trim + `depth.flat` groups across
   `SettingsBackup/Portable/Command/Developer/Notifications/Pomodoro/Calories`
   sections, keeping every asserted string and all behaviour.
7. Fit fixes surfaced by 360/375/390 captures: full-width save + ghost revert
   (the two half-width buttons clipped their labels), and the weekly-review
   toggle moved off the weekday-chip row (the seventh chip clipped).

## Non-Goals

- No change to backup/restore/account logic or to the backup copy that
  `settings.spec.ts`, `portable-backup.spec.ts` and the new-phone journeys assert.
- No theme token, `tailwind.config.js`, `app/*` or notification-scheduling edits.
- The native notification `Switch` controls were left on react-native's `Switch`
  (P18 names only the Sounds/Haptics toggles; converting them would risk a
  scheduling-path regression outside this phase's scope).
- No goldens.

## Current Checkpoint

- Current milestone: P18 implementation complete and validated; changes are
  uncommitted in this worktree for parent review/commit (no branch switch, no
  push, no PR per the session brief).
- Completed: `core/ui/Switch.tsx` (new chunky two-position switch),
  `core/ui/ThemePreviewCard.tsx` reworked into a decorative live mini-preview,
  `SettingsSharedUi` reworked (bold `titleMd` heading, `bodyMd`/`caption` rows,
  new `SettingsGroup` at `depth.flat`), Appearance theme picker converted to
  `OptionRow` + live previews, Sounds/Haptics converted to the chunky switch,
  narration trimmed (explanations moved behind the existing 44pt Details
  disclosure) and `depth.flat` groups applied across Backup, Portable, Capture,
  Notifications, Focus defaults, Nutrition defaults and Developer sections.
  Fit fixes: full-width save + ghost revert (labels clipped at 360/390) and the
  weekly-review toggle moved off the weekday-chip row (7th chip clipped).
  New coverage: `e2e/settings-v2-p18.spec.ts` (6 tests).
- In progress: none — awaiting parent review, gates and adoption of goldens from
  reviewed CI artifacts.
- Important modified files: `core/ui/Switch.tsx`,
  `core/ui/ThemePreviewCard.tsx`, `features/settings/SettingsSharedUi.tsx`,
  `features/settings/SettingsAppearanceSection.tsx`,
  `features/settings/SettingsAccessibilitySection.tsx`,
  `features/settings/SettingsBackupSection.tsx`,
  `features/settings/SettingsPortableSection.tsx`,
  `features/settings/SettingsCommandSection.tsx`,
  `features/settings/SettingsDeveloperSection.tsx`,
  `features/settings/SettingsNotificationsSection.tsx`,
  `features/settings/SettingsPomodoroSection.tsx`,
  `features/settings/SettingsCaloriesSection.tsx`,
  `features/settings/SettingsScreen.tsx`, `e2e/settings-v2-p18.spec.ts`,
  this plan.
- Last successful validation: `flock … npx tsc --noEmit` 0 errors; `eslint`
  clean on every touched file (`--max-warnings 0`); hermetic `build:e2e` OK
  (0 Supabase hosts); chromium
  `settings-v2-p18 + settings + theming + secondary-surface-w13 + portable-backup
  - gamification`28/28;`a11y.spec --grep "Settings|Command Center"`9/9;`journeys/settings-ripple`6/6;`vitest --project unit`full run
177 files / 2828 tests;`validate-theme-contrast.mjs` 168/168.
- Current failures: none.
- Relevant quarantines: none new. Pre-existing/unchanged: visual goldens
  `settings-top-390/1280` and `settings-backup-390` will diff in CI and were
  intentionally not regenerated here (goldens are adopted only from reviewed CI
  artifacts).
- Blockers: none.
- Condition required to unblock: none.
- Exact next action: None in this session — the parent reviews the diff, runs
  the full gates, adopts goldens, commits and opens the draft PR.
- Remaining definition of done: complete for this session's scope — every
  acceptance spec green, contrast/fit evidence recorded, and no file touched
  outside the session split.

## Progress

- [x] ExecPlan
- [x] `core/ui/Switch.tsx`
- [x] `core/ui/ThemePreviewCard.tsx`
- [x] `SettingsSharedUi.tsx` (headings, rows, `SettingsGroup`)
- [x] `SettingsAppearanceSection.tsx`
- [x] `SettingsAccessibilitySection.tsx`
- [x] Narration trim + flat groups across the remaining Settings sections
- [x] Fit fixes at 360/375/390 (button clipping, weekday chip clipping)
- [x] E2E extension `e2e/settings-v2-p18.spec.ts` (6 tests)
- [x] Gates + contrast/fit evidence

## Surprises & Discoveries

- `e2e/gamification.spec.ts` drives Settings by clicking the **pill words**
  (`Sounds off`, `Haptics off`), so the chunky switch has to keep those exact
  words as _real, named, tappable_ positions. A bare unlabelled switch would
  have quietly broken two passing tests.
- `e2e/theming.spec.ts` selects the mode with
  `getByRole('button', { name: 'Dark', exact: true })`, so mode stayed a Chip
  (role button + `aria-pressed`) while themes became OptionRows (role radio).
- In `system` mode, choosing a night theme does not change the live theme id
  when the browser resolves light; the new spec fixes the mode first, exactly
  as `theming.spec.ts` documents.
- The rendered A11Y audit resolves contrast against the nearest painted
  ancestor, so the ACTIVE switch label had to resolve against the **track**
  (the knob is a sibling slab, not its background): the first attempt
  (`section solid` on the knob) measured 2.51:1 and was fixed by using the
  §5.1 bright-fill ink for both labels.
- Two half-width action buttons clipped `Save timer defaults` /
  `Save nutrition defaults` at 360/390; full-width save + ghost revert fixed it
  without changing any label.

## Decision Log

1. **Mode picker stays `Chip`** — `theming.spec` and `settings-ripple` depend on
   `role=button` + `aria-pressed`.
2. **Theme picker is `OptionRow`** — the spec asks for OptionRow rows with live
   previews; `OptionRow` already emits `role=radio` + `selected` + `aria-checked`
   and the accessible name is passed through unchanged.
3. **Reward feedback is one two-position switch per preference with the existing
   words** — preserves the E2E contract and keeps each state a real control.
4. **`SettingsGroup` lives in `SettingsSharedUi`** — `ListGroup` (P7) wraps each
   child in its own divider container, which would double up with Settings'
   first/last row logic; adding it to the Settings module keeps P7 untouched.
5. **Knob face is white when on, `surfaceElevated` when off** — §7's literal
   "white knob", and it makes the label legible in both the ancestor-resolved
   audit and the visual reading.

## Validation Ledger

| When | Command                                                                            | Outcome                       |
| ---- | ---------------------------------------------------------------------------------- | ----------------------------- |
| P18  | `flock … npm run build:e2e` (hermetic, env unset)                                  | OK, 0 Supabase hosts          |
| P18  | `playwright --project=chromium e2e/settings-v2-p18.spec.ts`                        | 6 passed                      |
| P18  | `playwright --project=chromium` settings+theming+w13+portable+gamification (+ P18) | 28 passed                     |
| P18  | `playwright --project=chromium e2e/a11y.spec.ts --grep Settings/Command`           | 9 passed                      |
| P18  | `playwright --project=journeys e2e/journeys/settings-ripple.spec.ts`               | 6 passed                      |
| P18  | `VISUAL_AUDIT=1` secondary-surface-w13 Settings capture                            | 1 passed (evidence only)      |
| P18  | `flock … npx tsc --noEmit`                                                         | 0 errors                      |
| P18  | `npx eslint` on all touched files `--max-warnings 0`                               | clean                         |
| P18  | `flock … npx vitest run --project unit`                                            | 177 files / 2828 tests passed |
| P18  | `node scripts/validate-theme-contrast.mjs`                                         | 168 checks pass (≥ baseline)  |
| P18  | `flock … npx vitest run --project unit tests/uiTouchTargetContract…` etc.          | 79 passed                     |

## Changed Files / Areas

- `core/ui/Switch.tsx` (new), `core/ui/ThemePreviewCard.tsx`
- `features/settings/{SettingsSharedUi,SettingsAppearanceSection,SettingsAccessibilitySection,SettingsBackupSection,SettingsPortableSection,SettingsCommandSection,SettingsDeveloperSection,SettingsNotificationsSection,SettingsPomodoroSection,SettingsCaloriesSection,SettingsScreen}.tsx`
- `e2e/settings-v2-p18.spec.ts` (new)
- `.agent/execplans/ui-v2-p18-settings.md` (this plan)

## Recovery / Resume Instructions

1. Read `AGENTS.md`, `.agent/PLANS.md`, this plan.
2. `git status --short`, `git diff --stat`, `git diff --name-only`.
3. Re-read the acceptance specs before changing any label.
4. Re-run `flock /tmp/sh-heavy.lock /workspace/pi-sessions/memwait.sh env
E2E_PORT=8091 npx playwright test --project=chromium
e2e/settings-v2-p18.spec.ts e2e/settings.spec.ts e2e/theming.spec.ts
e2e/secondary-surface-w13.spec.ts e2e/portable-backup.spec.ts
e2e/gamification.spec.ts` after any edit.

## Outcomes & Retrospective

Shipped the Settings phase: bold group titles over `depth.flat` groups, no
narration paragraphs (explanations disclosed behind the existing 44pt
"Details" control), theme picker as `OptionRow` + live per-theme previews, and
a real chunky Sprout switch for Sounds/Haptics with the existing words and
behaviour. All eight owner specs plus the a11y audits and the settings-ripple
journey are green, `typecheck`/`lint`/unit suite/`validate:themes` are clean,
and 360/375/390 fit was verified from rendered captures (no horizontal
overflow, ≥44pt controls). Left out deliberately: native notification
`Switch`es, goldens, and the backup-restore copy/behaviour (unchanged).
