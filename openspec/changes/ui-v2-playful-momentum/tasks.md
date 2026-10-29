# ui-v2-playful-momentum — phased tasks (P0–P22)

Phase scope, acceptance criteria, and snapshot/test impact are normative in
`docs/ui-ux/16-playful-momentum.md` §10; this file tracks phase state. One PR
per phase, presentation-only, branch `ui/v2-pNN-<slug>` off fresh `main`.
Ground rules (gates, golden policy, label/test-ID freeze) live in §10; owner
defaults are in §12 (provisional).

- [x] P0 — Spec + doc: `docs/ui-ux/16-playful-momentum.md` (brief v2 as spec +
      ledger), supersede the V4 artifacts (SUPERSEDED banner on
      `16-v4-calm-momentum-finish.md`, delete `openspec/changes/ui-v4-visual-finish`,
      this change), amend doc 13 per §9 C1–C10, mark doc 12 historical
      (C10), and lint rules (WARN, opt-in `eslint.ui-guardrails.config.mjs` —
      run `npx eslint -c eslint.ui-guardrails.config.mjs core/ui features`):
      no `text-[Npx]`, no raw Tailwind palette colors, no emoji in JSX chrome;
      zero runtime diff
- [ ] P1 — Color tokens: `themes/light.ts`, `themes/dark.ts`, `tokens.ts`
      (+`primaryBright`, `buttonLip`, `textSubtle`), `createTheme.ts`,
      `constants/sectionColors.ts` (sections + reward), `tailwind.config.js`,
      `validate-theme-contrast.mjs` (+2 checks) per §5.1–5.3
- [ ] P2 — Typography: `designTokens.typography` (+`button`, `metricLg`),
      `core/ui/Text.tsx`; replace raw sizes in `core/ui`; Nunito only (no
      dependency change) per §5.5
- [ ] P3 — Geometry + depth tokens: `designTokens.radius/elevation` + new
      `depth`, `layout.contentMaxWidth 640`, `:focus-visible` focus ring per
      §5.6/§5.7
- [ ] P4 — Motion foundation: `core/theme/motion.ts`, new
      `core/ui/motion/{usePressDepth,useCheckBurst,useXpFloat,useProgressFill}.ts`
      on Reanimated 4, wired to `lib/rewardFeedback` tiers per §5.8
- [ ] P5 — Pressable3D + Button + IconButton: `core/ui/Pressable3D.tsx`,
      `Button.tsx` (drop gradient; variants §6), `IconButton.tsx`
- [ ] P6 — Inputs and selection: `TextField`, `NumberStepperField`,
      `SegmentedControl`, `PillChip`→Chip, new `OptionRow`, new `CheckNode`
- [ ] P7 — Surfaces and progress: `Card` (flat/card/hero), `ListRow/ListGroup`,
      `PageHeader`, `SectionLabel`, `StatBlock`, `FeatureStatCard`, new
      `ProgressBar`/`ProgressRing`, `SkeletonBlock`, `EmptyStateCard`
- [ ] P8 — Overlays + celebration card: `Modal` (sheet/dialog/drawer radius 28),
      `MenuSheet`, `useConfirmationDialog`, `RewardCelebrationOverlay` restyle
      (keeps box-none + 2.8s), banners/toast
- [ ] P9 — Icons + mascot + emoji purge: `core/ui/illustrations/icons/*` (14
      duotone SVG), `core/ui/illustrations/Sprout.tsx` (5 poses), replace
      chrome emoji; SVGs decorative (`aria-hidden`)
- [ ] P10 — Shell: `app/index.tsx` tab bar (tiles, duotone icons, Sprout
      capture), sidebar ≥900/≥1280, Streak/XP chips
- [ ] P11 — Today: `features/overview/*` (hero, Today's path from quests/plan
      only per §12, glance card, level card), `features/momentum/MomentumCard.tsx`
- [ ] P12 — To Do: `features/todos/*` (composer, rows, completion animation,
      empty)
- [ ] P13 — Habits: `features/habits/*` (day nodes, rows, CheckNode, detail
      sheet streak)
- [ ] P14 — Focus: `features/pomodoro/*` (hero timer, staged sapling, preset
      OptionRows sheet)
- [ ] P15 — Workout landing + routine detail: `WorkoutScreen.tsx`,
      `RoutineDetailScreen.tsx` (Coral hero + one CTA)
- [ ] P16 — Workout session: `WorkoutSessionScreen.tsx` (decoration off per C8;
      set CheckNode pop only)
- [ ] P17 — Calories: `features/calories/*` (one hue Berry; pops only per C8)
- [ ] P18 — Settings: `features/settings/*`, theme OptionRow previews, chunky
      Switch
- [ ] P19 — Command Center + Quick capture: `features/command/*`, quick
      capture in `app/index.tsx` (Sprout `think` + speech bubble)
- [ ] P20 — Gamification surfaces + Garden art: `AchievementsScreen`,
      `BadgeGrid`, `LevelHero`, `XpBar`, `XpRing`, `QuestRow`, `WeekStrip`,
      `MomentumGardenArt`, `MomentumDetailView` (garden read-only, no punitive
      art)
- [ ] P21 — Secondary surfaces + 12 themes: Planning Hub, Weekly Review,
      Progress/Activity, Health; `core/theme/themes/*` brand-hue swaps
      (validate:themes ≥ baseline; Nord green)
- [ ] P22 — Close-out: win32 golden regeneration on Windows, `VISUAL_AUDIT=1`
      captures to `docs/ui-ux/v2-audit/`, lint rules → error and folded into
      the main `eslint.config.mjs`, ledger close, Michael sign-off
