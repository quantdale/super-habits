# ui-v4-visual-finish — phased tasks (P0–P20)

Phase scope, acceptance criteria, and snapshot/test impact are normative in
`docs/ui-ux/16-v4-calm-momentum-finish.md` §8; this file tracks phase state.
One PR per phase, presentation-only, branch `ui/v4-pNN-<slug>` off fresh
`main`. Ground rules (gates, golden policy, label/test-ID freeze) live in §8.

- [x] P0 — Spec + guardrails: this ledger doc, the `ui-v4-visual-finish`
      OpenSpec change, three WARN ESLint guardrails (`text-[Npx]`, raw Tailwind
      palette utilities, emoji in UI text) scoped to `core/ui/**` + `features/**`
      TSX; zero runtime diff
- [ ] P1 — Color tokens (default light/dark): `core/theme` values per §5.1/§5.2
      (+`textSubtle`, `focusRing`), contrast checks extended
- [ ] P2 — Section hues: harmonized Radix-scale hues per §5.3, reward colors,
      no Tailwind-500 hex left in `constants/`/`tailwind.config.js`
- [ ] P3 — Typography: `@expo-google-fonts/inter`, 8-role scale + tabular
      metrics per §5.5, Nunito removed
- [ ] P4 — Geometry, elevation, motion tokens: radii/spacing/elevation per
      §5.6/§5.7, motion per §5.8, `:focus-visible`-only focus ring
- [ ] P5 — Icon system + emoji purge: `core/ui/Icon.tsx` (Ionicons outline),
      MaterialIcons migration, emoji out of UI chrome
- [ ] P6 — Primitives A — actions & inputs: Button (+`tonal`), IconButton,
      TextField, NumberStepperField, SegmentedControl, PillChip→Chip
- [ ] P7 — Primitives B — surfaces & lists: Card, ListGroup/ListRow,
      SectionLabel, PageHeader, EmptyStateCard, StatBlock, Skeleton, Screen rhythm
- [ ] P8 — Overlays: Modal (dialog/bottom-sheet/drawer), MenuSheet,
      confirmation dialog, in-app/update banners
- [ ] P9 — Shell: tab bar + sidebar + capture slot + content width
      (`layout.dashboardMaxWidth`)
- [ ] P10 — Today / Overview: one hero, single stats card, no violet slab
- [ ] P11 — To Do: rows/composer per §7
- [ ] P12 — Habits: day strip, ListGroups, neutral 0/x
- [ ] P13 — Focus: idle/running per §7 and the W8 contract
- [ ] P14 — Workout landing + routine detail: no peach panels/rust fills, week
      ListGroup
- [ ] P15 — Workout session: set table per §7, PR moment without emoji
- [ ] P16 — Calories: hero with macros, neutral segmented, chip wrap
- [ ] P17 — Settings modal: grouped rows, no narration paragraphs
- [ ] P18 — Command Center + Quick capture: palette anatomy per §6/§7
- [ ] P19 — Secondary surfaces + 12 themes: accent-variant rework, validate:
      themes ≥ baseline
- [ ] P20 — Close-out: win32 goldens on Windows, `VISUAL_AUDIT=1` re-capture,
      ledger close, lint guardrails → error, Michael sign-off
