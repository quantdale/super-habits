# W13 baseline — Settings / Command Center / Achievements

Source: branch `frontend-v3-w12-w17-integration` at W12 commit `1d54b70`
(descends from `1f23da4defd7fa45c679261e0db5fade1374bbd5` = `origin/main`).

Build: `unset EXPO_PUBLIC_SUPABASE_URL EXPO_PUBLIC_SUPABASE_ANON_KEY &&
npm run build:e2e` → hermetic export, 0 Supabase hosts in `dist/`.

Harness: `VISUAL_AUDIT=1 VISUAL_AUDIT_OUTPUT_DIR=docs/ui-ux/v3-audit/w13/before
E2E_PORT=8086 npx playwright test e2e/secondary-surface-w13-audit.spec.ts
--project=chromium` → 5/5 PASS, 22 captures.

## Entry paths

| Surface        | Route                                                      |
| -------------- | ---------------------------------------------------------- |
| Settings       | Today header → `Open settings` (full-screen modal)         |
| Command Center | Today → `Quick capture` → `Describe it` (global overlay)   |
| Achievements   | Today → `Level & Streaks card — open achievements` (modal) |

## Measured baseline observations

### Settings (`390-settings-top.png`, `390-settings-mid/backup/bottom.png`)

- The first fold is consumed by an icon tile, the uppercase eyebrow
  `APPEARANCE`, a 20px `Theme and display` title and a two-line subtitle before
  the first control. The `Back` control occupies its own row above that.
- **The theme value is narrated four times in one viewport:** the `System`
  pill's selected state, a `Current selection` row with a `SYSTEM` pill, a
  `Current behavior` row with a `LIGHT` pill, and the sentence
  `Following your device setting. Light mode is active right now. Active theme:
Light.` (`SUR-08`).
- Every setting carries a mandatory prose `description` sentence
  (`SettingsRow.description` is a **required** prop), so explanatory copy — not
  the control — dominates each card.
- Section headings repeat the eyebrow: `ACCESSIBILITY` + `Motion` +
  `Control how much animation SuperHabits uses.`, then `ACCESSIBILITY` +
  `Reward feedback` + `How completing habits, quests, and levels feels.`

### Command Center (`390-command-empty.png`)

- A full-width bordered `CURRENT SECTION` panel (eyebrow + `Overview` + a
  sentence) is the **first and largest** element, above the input (`SUR-11`).
- The input card adds a `Command input` title and a two-sentence
  implementation subtitle (`Parsing saves text in recent commands on this
device. App actions require confirmation.`) — `SYS-14`.
- A bordered `Supported examples` panel renders unconditionally, duplicating the
  purpose of the `Suggestions` chips, which are already gated on an empty field.
- The `Parse command` button renders disabled with no parsed result yet; at
  390px the input is the third visual block.

### Achievements (`390-achievements-top.png`, `390-achievements-bottom.png`)

- Order is `LevelHero` → three equal `StatBlock` tiles (`75 Total XP / 50
today`, `2 Best streak / 2 current`, `1/36 Badges`) → `This week` → quests.
- `Total XP` is stated twice within one viewport (the hero's `25/132 XP` line is
  distinct, but the tile repeats the lifetime total while `Best streak`
  repeats the hero's `2 day streak` chip) — three tiles for two facts.
- The `Badges` grid renders earned and locked tiers in one undifferentiated
  12-tile block (`BadgeGrid.visibleBadges` concatenates unlocked then
  in-progress with a hard `maxTiles = 12` cut), with all 36 badges in the same
  treatment. Earned-vs-locked is carried only by colour plus a small
  `Earned` / `n/m` caption — `SUR-13`.
- The scroll position after `390-achievements-bottom.png` is identical to the
  top capture: the modal body does not scroll in this harness, so the locked
  tiers were not separately inspectable. Recorded as a capture limitation.

## Defect register (baseline)

| ID     | Surface      | Class        | Sev | Evidence                   | Problem                                                                                                | Correction                                  |
| ------ | ------------ | ------------ | --- | -------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------- |
| W13-01 | Settings     | PRODUCT_UX   | S2  | `390-settings-top.png`     | Theme value narrated 4× (pill + `Current selection` + `Current behavior` + sentence) — ledger `SUR-08` | One value authority per setting             |
| W13-02 | Settings     | DENSITY      | S2  | `390-settings-top.png`     | Every row renders a mandatory prose description                                                        | Explanation optional + disclosure-backed    |
| W13-03 | Settings     | HIERARCHY    | S2  | `390-settings-top.png`     | Icon tile + eyebrow + 20px title + subtitle before the first control                                   | Quiet group heading                         |
| W13-04 | Command      | HIERARCHY    | S2  | `390-command-empty.png`    | `CURRENT SECTION` panel leads the overlay — ledger `SUR-11`                                            | One caption line                            |
| W13-05 | Command      | VISUAL_TASTE | S3  | `390-command-empty.png`    | `Command input` title + implementation-narration subtitle — ledger `SYS-14`                            | One-line caption beside the field           |
| W13-06 | Command      | DENSITY      | S3  | `390-command-empty.png`    | `Supported examples` panel is always visible and duplicates `Suggestions`                              | Chips, only while the field is empty        |
| W13-07 | Achievements | PRODUCT_UX   | S3  | `390-achievements-top.png` | 3 stat tiles for 2 distinct facts; `Best streak` repeats the hero chip                                 | Level/XP + streak facts only                |
| W13-08 | Achievements | DENSITY      | S3  | `390-achievements-top.png` | Earned and locked tiers in one undifferentiated block, cut at 12 — ledger `SUR-13`                     | Earned inline; locked behind one disclosure |

## Preserved expectations (must not change)

- Theme/motion/reward-feedback preferences persist (AsyncStorage + `setMotionPreference`).
- Pomodoro defaults and calorie goals keep their validation, Save affordance
  and error surfaces; `savePomodoroSettings`/`setCalorieGoal` untouched.
- Backup/restore: `getRestorePreview`, `restoreFromRemoteBackup`, the blocked/
  invalid/success branches, per-entity restore counts, account protection and
  recovery flows all keep their semantics and confirmation.
- Portable export/import preview/validation/blocked paths.
- Notification permission truth versus desired schedule.
- Command parse → review → preview → explicit confirm → outcome, the execution
  token, ambiguity resolution, `canConfirm`, and success/failure reporting.
- Gamification award idempotency, thresholds, celebration overlay and the
  local-only reward ledger.
