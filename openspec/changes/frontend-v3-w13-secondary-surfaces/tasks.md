# W13 — Settings / Command Center / Achievements (secondary surfaces)

## 1. Preflight and planning

- [x] 1.1 Confirm W12 is committed on `frontend-v3-w12-w17-integration`
      (commit `1d54b70`, PR #76)
- [x] 1.2 Read every owned module in full (Settings shared UI + 9 sections,
      Command screen/input/preview, Achievements/BadgeGrid/LevelHero)
- [ ] 1.3 Author this slice + `execplan.md` before any W13 edit

## 2. W13 baseline evidence

- [ ] 2.1 Capture the current Settings top/bottom/backup/portable, Command
      empty/populated/error and Achievements empty/earned/locked states into
      `docs/ui-ux/v3-audit/w13/before/` (360/390/412/768/1280, light/dark where relevant)
- [ ] 2.2 Inspect the captures; write `baseline.md` with the `SUR-08`/`SYS-14`/
      `SUR-11`/`SUR-13` observations and measured first-fold facts

## 3. Design lock

- [x] 3.1 Write `design.md` D13.1–D13.5 (settings grammar, risk classes,
      command grammar, achievement grammar, test contract)
- [ ] 3.2 Pin the grammar with deliberately failing W13 assertions before the
      implementation (description-not-always-visible, single value authority,
      examples demoted, no current-section panel, earned-before-locked)

## 4. Settings reconstruction

- [ ] 4.1 Shared row primitive: label · value · control, optional disclosure
      detail, accessible expanded state
- [ ] 4.2 Section heading: quiet eyebrow + short title (no icon tile, no
      subtitle)
- [ ] 4.3 Remove the duplicated `Current selection` / `Active behavior`
      narration rows in Appearance and Accessibility
- [ ] 4.4 Apply the grammar across the 9 sections without changing any
      persistence path, validation, error surface or confirmation flow

## 5. Command Center reconstruction

- [ ] 5.1 Input leads; one-line caption replaces the implementation subtitle
- [ ] 5.2 `Supported examples` becomes chips rendered only while the field is empty
- [ ] 5.3 `LaunchContextCard` becomes one caption line (no panel)
- [ ] 5.4 Preserve parser, review, disambiguation, execution token and
      success/failure reporting exactly

## 6. Achievements reconstruction

- [ ] 6.1 Earned milestone leads with its real name and earn date
- [ ] 6.2 Exactly one next target from real ledger progress
- [ ] 6.3 Earned tiers inline; locked tiers behind one `All badges` disclosure
- [ ] 6.4 Reduce the stat tiles to the level/XP and streak facts

## 7. Regressions and oracles

- [ ] 7.1 New W13 Playwright assertions for the five pinned grammar rules
- [ ] 7.2 Settings persistence oracles: theme/motion value in UI = persisted
      value after reload; notification permission versus setting truth
- [ ] 7.3 Command regressions: preview-then-confirm, no hallucinated success,
      rapid double-enter, mode gates
- [ ] 7.4 Achievements oracles: earned/locked differentiation, no duplicate
      award on remount
- [ ] 7.5 W13 audit spec capturing before/after

## 8. Validation, review and closure

- [ ] 8.1 `qa:fast`, `qa:affected`, `qa:integration`, focused Chromium,
      P0 journeys, deterministic simulation
- [ ] 8.2 Adversarial review of density, backup/restore safety, command
      execution claims and reward integrity; fix findings
- [ ] 8.3 Inspect every new capture; write `docs/ui-ux/v3-audit/w13/README.md`
      and update the defect ledger for `SUR-08`/`SYS-14`/`SUR-11`/`SUR-13`
- [ ] 8.4 Commit and publish W13; advance the parent checkpoint to W14
