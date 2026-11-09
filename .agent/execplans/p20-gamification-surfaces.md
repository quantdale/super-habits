# P20 — Gamification surfaces + Momentum Garden art

Plan-Version: 2
Status: COMPLETED

## Purpose / User Outcome

Presentation-only v2 restyle of the reward surfaces (`features/gamification/*`)
and the Momentum Garden art (`features/momentum/*`) per
`docs/ui-ux/16-playful-momentum.md` §7 "Gamification surfaces" / "Momentum
Garden" and §10 P20.

Observable success: badge tiles are hexagon plates in tier hues with a lip,
quest rows are lipped cards with a Gold bar and a chest, the week strip reads as
Flame/Ice nodes, the level hero is Gold-consistent, and the garden is a flat
illustrated world on a soft sky band with one plant species per existing
contribution area — while every asserted string, accessible name/role, testID,
and lifetime-ledger behaviour stays byte-identical.

## Context

- Session split: `features/gamification/*`, `features/momentum/*`,
  `e2e/gamification*.spec.ts`, `e2e/momentum-garden*.spec.ts`, related unit tests.
- Untouched by design: `features/overview/*` (Today), `features/progress/*`,
  `core/ui/*`, `core/theme/*`, `constants/*`, `tailwind.config.js`,
  `app/_layout.tsx`, package/playwright configs, `e2e/visual-regression.spec.ts`,
  and every golden PNG.
- Design tokens in play: `SECTION_HUES`/`REWARD_HUES` (§5.1),
  `core/theme/contrast` (`inkOnFill`, `tintOver`, `WCAG_AA_*`),
  `depth.card`/`depth.lip` (§5.7), `typography` roles (§5.5).
- Isolation: E2E port 8093; every heavy command ran under
  `flock /tmp/sh-heavy.lock /workspace/pi-sessions/memwait.sh …`, serialized
  (including `tsc` and vitest, per the driver rule update).

## Scope

In scope — reward surface presentation and garden illustration:
`AchievementsScreen`, `BadgeGrid`, `LevelHero`, `XpBar`, `XpRing`, `QuestRow`,
`WeekStrip`, `MomentumGardenArt`, `MomentumDetailView`, `MomentumCard`, plus new
pure visual modules, one new plate primitive, and new/extended specs.

## Non-Goals

- No ledger/schema/domain change (XP, streaks, freezes, quests, badges).
- No new data, no new strings for asserted copy, no new dependencies.
- No golden PNG creation/update, no visual-project run.
- No edits outside the file split (Today/Progress, `core/ui`, `core/theme`,
  `constants`, configs).

## Current Checkpoint

Milestone: complete. Every item below is retired; no failures, quarantines or
blockers remain.

- Completed work: pure visual models, hexagon badge plate, all reward-surface
  restyles, garden scene rewrite, detail/card restyle, 2 new unit suites, 2 new
  E2E specs, full validation sweep.
- In progress: none.
- Important modified files: `features/gamification/*` (7 changed + 2 new),
  `features/momentum/*` (3 changed + 1 new), `tests/gamificationSurfaces.test.ts`,
  `tests/momentumGardenVisual.test.ts`, `e2e/gamification-surfaces.spec.ts`,
  `e2e/momentum-garden-art.spec.ts`.
- Last successful validation: see Validation Ledger (all green).
- Current failures: none.
- Quarantines: none.
- Blockers: none.
- Exact next action: none — hand off to the parent session for review, full
  gates, golden adoption from CI artifacts, and PR.
- Remaining definition of done: none for this session.

## Progress

- [x] Pure resolvers `gamificationSurfaces.visual.ts` (tier hues, badge tile,
      week node, quest row, level ring).
- [x] `BadgePlate.tsx` hexagon plate (64 × 70 viewBox, 4-unit lip).
- [x] `BadgeGrid` hexagon plates + locked monochrome; `BadgeFamilyTile` for the
      milestone/next-target cards.
- [x] `QuestRow` depth.card + Gold bar + chest; `WeekStrip` Flame/Ice nodes;
      `XpBar` highlight + lip; `XpRing` lip band; `LevelHero` Gold polish and
      reward-hue pills.
- [x] `AchievementsScreen` composition (all headings, disclosure, streak
      protection kept).
- [x] `momentumGarden.visual.ts` scene model + species map + inks.
- [x] `MomentumGardenArt` flat illustrated garden (species per area, sky band,
      one ground line, additive growth, reduced-motion grow-in).
- [x] `MomentumDetailView` / `MomentumCard` restyle keeping explanation text and
      the read-only data path.
- [x] Unit suites across all 14 themes; E2E geometry/AA/garden-art specs.

## Surprises & Discoveries

- RN-Web also has an `aria-label` accessible wrapper _inside_ `role="dialog"`,
  so scroll/geometry probes must climb to the element that owns the children;
  the week-strip summary label sits on an inner wrapper, not the strip itself.
- A 360pt drawer measured mid-entrance spring reports a spurious 361–391px
  scroll width. Measuring under `prefers-reduced-motion: reduce` (which the app
  honours by snapping `Modal` progress to 1) removes that class of flake without
  sleeping or loosening the assertion.
- Cyberpunk Neon's `textMuted` fails AA on the Gold/Ice reward washes (3.91:1 /
  3.68:1), so reward-pill captions must resolve ink against the pill face, not
  the card surface.

## Decision Log

- Badge tiers are a **local table** (`BADGE_TIER_HUES`) rather than new tokens:
  the brief names Bronze/Silver/Gold/Platinum, `constants/sectionColors` is out
  of this session's split, and the tier fills are reward-art colours, not theme
  tokens.
- Gold progress bars in `QuestRow` keep the existing `XpBar` API (`accent` prop
  retained for API stability) instead of switching to `core/ui/ProgressBar`
  (outside the split); `AchievementsScreen` uses `ProgressBar` for the badge
  "Next target" bar, which is a new element.
- Locked badges never carry the tier hue at all: the same hexagon geometry in
  `surfaceSunken` with a `inkOnFill` ≥3:1 outline, so "locked" reads as a
  collection slot.
- The garden keeps one grow-in opacity fade (no ambient loop, no SMIL), and an
  empty bed is two seed marks — never a bending or drained plant.
- `XpRing`'s lip band animates with the same dash offset scaled to the wider
  radius so it always sits under the filled arc.

## Validation Ledger

- `flock … npx tsc --noEmit` — 0 errors (final).
- `npx eslint . --max-warnings 0` — 0 problems (final, whole repo).
- `flock … npx vitest run` — 292 files passed, 1 skipped; 3832 tests passed,
  2 skipped (single end-of-session full run).
- `npm run validate:themes` — all 168 contrast checks pass (≥ baseline).
- `flock … npm run build:e2e` — hermetic export OK (0 Supabase hosts).
- `flock … env E2E_PORT=8093 npx playwright test --project=chromium`
  `e2e/gamification.spec.ts e2e/gamification-surfaces.spec.ts
e2e/momentum-garden.spec.ts e2e/momentum-garden-art.spec.ts` — 19/19 passed
  (final run against a fresh hermetic `build:e2e`).
- Same lane, additional specs: `a11y.spec.ts` 15/15 · `overview.spec.ts` 2/2 ·
  `reward-key-upgrade.spec.ts` 2/2 · `secondary-surface-w13.spec.ts` 4/4.
- `npm run web:hygiene` — 8081/8082 free (no campaign-owned servers left).

## Changed Files / Areas

- New: `features/gamification/gamificationSurfaces.visual.ts`,
  `features/gamification/BadgePlate.tsx`,
  `features/momentum/momentumGarden.visual.ts`,
  `tests/gamificationSurfaces.test.ts`, `tests/momentumGardenVisual.test.ts`,
  `e2e/gamification-surfaces.spec.ts`, `e2e/momentum-garden-art.spec.ts`.
- Changed: `features/gamification/{AchievementsScreen,BadgeGrid,LevelHero,
QuestRow,WeekStrip,XpBar,XpRing}.tsx`,
  `features/momentum/{MomentumCard,MomentumDetailView,MomentumGardenArt}.tsx`.
- Git remains the authority for the actual diff.

## Recovery / Resume Instructions

1. Read `AGENTS.md`, `.agent/PLANS.md`, then this plan.
2. `git status --short` / `git diff --stat` in `/workspace/wt-v2-p20-gamification`;
   branch `ui/v2-p20-gamification`.
3. Re-run cheap gates first: `flock … npx tsc --noEmit`, `npx eslint .`.
4. Re-run targeted E2E with `unset EXPO_PUBLIC_SUPABASE_URL
EXPO_PUBLIC_SUPABASE_ANON_KEY`, `npm run build:e2e`, then
   `env E2E_PORT=8093 npx playwright test --project=chromium
e2e/gamification.spec.ts e2e/gamification-surfaces.spec.ts
e2e/momentum-garden.spec.ts e2e/momentum-garden-art.spec.ts`.
5. Golden regeneration is owned by the parent from CI artifacts; never commit
   `e2e/**/*-snapshots` from this worktree.

## Outcomes & Retrospective

Shipped the P20 gamification/garden presentation layer as pure, theme-tested
visual modules plus thin component wiring, so every colour pair is provably
AA-clean across all 14 themes instead of being verified by eye. The reward
contract (XP amounts, idempotency, celebration, disclosure, haptics) is
untouched and its original spec still passes unchanged; the new specs add the
geometry, state-matrix, fit and garden-art facts those specs could not see.

Lessons: measure RN-Web overlays under reduced motion rather than racing the
entrance spring; resolve every reward-label ink against the fill it actually
sits on (Cyberpunk Neon proved the point); and keep illustration growth strictly
additive so the garden's "never punitive" requirement is enforced by a test, not
by convention.

Follow-ups owned by the parent: adopt `achievements-390-light`,
`progress-details`, `shell-today-*` goldens from reviewed CI artifacts, and fold
the plan item into `openspec/changes/ui-v2-playful-momentum/tasks.md`.
