---
schema: spec-driven
created: 2026-10-14
---

## Why

W12 closed. Frontend V3 parent tasks §13 owns Settings, the Command Center and
Achievements (`13.1` grouped-row grammar + remove narration duplicates `SUR-08`

- quiet Command Center `SYS-14`/`SUR-11`; `13.2` Achievements milestone-first
  `SUR-13`). The live surfaces were read in full and still carry pre-V3 grammar:

* `SettingsSharedUi.SettingsRow` renders `label · status pill` **plus a
  mandatory `description` sentence** on every row. Every Settings section opens
  with a `SettingsSectionHeading` icon tile + uppercase eyebrow + 20px title +
  subtitle, and the Appearance and Accessibility sections each add
  `Current selection` **and** `Active behavior` rows that narrate the same value
  a third and fourth time (`SUR-08`). Measured on
  `docs/ui-ux/v3-audit/390-settings-top.png` from the W1 audit: the first fold
  is icon tiles and prose, not controllable preferences.
* `CommandInputCard` renders `Command input` header + a two-sentence
  implementation subtitle ("Parsing saves text in recent commands on this
  device…"), a Recent commands block, a Suggestions block, **and** a bordered
  `Supported examples` panel, then a `Parse command` button — all before the
  parsed result. The `LaunchContextCard` spends a whole panel on the current
  section (`SYS-14`, `SUR-11`).
* `AchievementsScreen` opens with `LevelHero`, then three `StatBlock` tiles
  (Total XP / Best streak / Badges), then This week, Today's quests, Badges and
  Streak protection. Earned and locked badges share one grid; the earned
  milestone is not the primary fact (`SUR-13`).

## What Changes

- **Settings grammar:** one shared row primitive
  (`Group heading → concise label → current value/state → control or detail`)
  with the description sentence **optional and collapsed** rather than
  mandatory. Section headings lose the icon tile and the subtitle. The
  duplicated `Current selection` / `Active behavior` narration rows are
  replaced by the control's own value display. Every capability and every
  persistence path is preserved.
- **Command Center grammar:** the input field leads. The `Supported examples`
  panel becomes demoted example chips shown only while the field is empty; the
  implementation-narration subtitle becomes a one-line caption; the launch
  context becomes one quiet caption line instead of a panel. Parsed meaning,
  preview, confirmation and outcome ordering is unchanged.
- **Achievement grammar:** an actual earned milestone leads, then one believable
  next target, then earned history with locked badges behind a disclosure.

## Capabilities

### New Capabilities

- `secondary-surface-grammar`: the observable contract of the W13 surfaces —
  grouped Settings rows with one authority for each value, the input-first
  Command Center, and milestone-first Achievements.

### Modified Capabilities

None. Settings persistence, account/backup/portable semantics, notification
permission truth, the command parser/executor/confirmation flow and the reward
ledger all keep their contracts.

## Impact

- `features/settings/*` (shared row/heading primitives and each section),
  `features/command/{CommandInputCard,CommandPreview,CommandScreen}.tsx`,
  `features/gamification/AchievementsScreen.tsx` (+ `BadgeGrid`).
- `e2e/settings.spec.ts`, `e2e/command.spec.ts`, `e2e/gamification.spec.ts`,
  new W13 regressions.
- Docs: `docs/ui-ux/v3-audit/w13/*`, `docs/ui-ux/15-v3-defect-ledger.md`.
- No `core/*` semantics change, no schema/migration/dependency/security-policy
  change, no production Supabase mutation.
