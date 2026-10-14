## Design — W13 Settings / Command Center / Achievements

Design authority: `docs/ui-ux/13-calm-momentum-design-system.md` (§3 surfaces,
§5 typography, §7 actions, §8 lists/rows).
Reference decisions: `docs/ui-ux/14-v3-reference-ledger.md`.
Defect evidence: `docs/ui-ux/15-v3-defect-ledger.md` (`SUR-08`, `SYS-14`,
`SUR-11`, `SUR-13`).
Baseline evidence: `docs/ui-ux/v3-audit/w13/baseline.md` + `before/`.
Parent: `openspec/changes/frontend-v3-calm-momentum/design.md`.

### D13.1 One Settings grammar

`Group heading → concise setting label → current value/state → action or
detail`.

- **Group heading** is a quiet `SectionLabel`-class eyebrow plus a short title
  (no icon tile, no subtitle sentence). The section keeps a single `ScreenSection`
  rhythm.
- **Label** names the setting, never the feature. `Reduce motion`, not
  `Motion · Accessibility`.
- **Current value** is rendered once, adjacent to the control that changes it.
  A row that shows the current value `and` a separate `Current selection` row
  `and` an `Active behavior` row is the `SUR-08` defect.
- **Detail** (the previous mandatory `description`) is preserved but moves to
  a caption that is _optional_: a row exposes `accessibilityState.expanded` and
  reveals the explanation on demand, so a screen of settings reads as settings.

Rejected: deleting descriptions entirely. Several of them carry real safety or
permission meaning (restore consequences, notification permission truth) and
the campaign forbids hiding essential warnings. Progressive disclosure keeps
them reachable in one tap instead.

### D13.2 Risk classes stay separate

Three visually similar rows can mean very different things. The grammar must
not flatten them:

1. **Local UI preference** (theme, motion, reward feedback): applies
   immediately, no data risk.
2. **Stored user data / device state** (timer defaults, nutrition goals,
   notification schedules): a real write with validation and an error state.
3. **Destructive or externally visible** (restore, portable import, account
   protection): preview → consequence → explicit confirmation → non-destructive
   cancel.

Only class 1 may apply on tap without a save affordance. Class 2 keeps its
Save/error contract. Class 3 keeps its confirmation dialogue and recovery path.
A value rendered in the new grammar never claims a remote effect that only a
local write produced.

### D13.3 Command Center: input first

Reading order becomes `intent field → (examples only while empty) → parsed
meaning → preview → explicit run/confirm → outcome`.

- The `Command input` card header and its two-sentence implementation subtitle
  are removed; a one-line caption stays beside the field.
- The bordered `Supported examples` panel becomes chips, rendered only while
  the field is empty (already the rule for Suggestions), so a typed command
  sees no example wall.
- `Recent commands` stays (it is real user data, not documentation) and is
  capped at the existing chip limit.
- `LaunchContextCard` becomes one caption line naming the launch section;
  the panel is removed (`SUR-11`).
- Nothing about parse/confirm/execution ordering, disambiguation,
  `canConfirm`, the execution token or the success/failure reporting changes.

### D13.4 Achievements: milestone before grid

- An earned milestone leads: the highest newly-earned or most recent badge, or
  the level just reached, with its real name and the date it was earned.
- Exactly one **next target** follows (the nearest locked tier by real
  progress), never "almost there" invented from arbitrary activity.
- Earned tiers render inline; locked tiers move behind one `All badges`
  disclosure with accurate expanded state.
- The three `StatBlock` tiles are reduced to the level/XP fact plus the streak
  fact; `Total XP` is already stated by the level hero.
- The reward ledger, idempotency, thresholds and celebration overlay are
  untouched.

### D13.5 Test and evidence contract

- New Playwright assertions pin: no always-visible description block on a
  Settings row until expanded; one current-value authority per setting; the
  Command examples rendered only while the field is empty; no `CURRENT SECTION`
  panel; earned badges before locked, locked behind a disclosure.
- Existing `e2e/settings.spec.ts`, `e2e/command.spec.ts`,
  `e2e/gamification.spec.ts` and the settings/backup/portable journeys keep
  their SQLite and outbox oracles; selector updates are allowed only where the
  product contract deliberately changed, never as a weakening.
- A `VISUAL_AUDIT=1` instrument captures before/after at 360/390/412/768/1280
  light/dark into `docs/ui-ux/v3-audit/w13/`.
