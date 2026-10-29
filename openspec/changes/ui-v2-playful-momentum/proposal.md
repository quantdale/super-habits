---
schema: spec-driven
created: 2026-10-29
---

## Why

The neutral V4 direction ("Calm Momentum, finished") was rejected by the owner
as "too professional". The new design brief v2, "Playful Momentum", brings the
Duolingo/Brilliant design DNA: white canvas with loud chunky objects, pressable
3D buttons/nodes with a bottom lip, a small saturated one-hue-per-job palette
(Sprout green brand), a seedling mascot ("Sprout") and a game-world Momentum
Garden, and celebrations sized to the achievement — while keeping the repo's
vision constraints (one question per screen, no moral failure, reward the
behavior not app opening) and every existing contract (six nav labels,
overlays, 14 theme IDs, test IDs/roles/labels, one global Add flow). This is
presentation-only work — no domain, data, sync, backup, migration, or routing
changes.

## What Changes

- A durable v2 spec and delivery ledger
  (`docs/ui-ux/16-playful-momentum.md`): the design brief adapted as the
  spec — token system with exact values (§5), component standards (§6),
  per-screen redesign notes (§7), reward-feature reconciliation (§8), the
  P0–P22 phased plan (§10), the §9 spec-conflict resolutions (C1–C11), §12
  provisional owner decisions, and the per-phase ledger (§13).
- Supersedes the V4 neutral finish: `docs/ui-ux/16-v4-calm-momentum-finish.md`
  is kept with a SUPERSEDED banner (links stay valid), and the never-applied
  `openspec/changes/ui-v4-visual-finish` change is deleted and replaced by this
  change. `docs/ui-ux/13-calm-momentum-design-system.md` receives short
  amendment notes (C1–C10) pointing at doc 16; `12-pop-design-system.md` is
  marked HISTORICAL (C10).
- The v2 token system replaces the Pop-era/V4 values through the existing
  `core/theme` semantic tokens (no parallel design system): Sprout-green
  brand/primary CTA (violet retired to the Focus hue "Grape" + Royal Purple
  theme), the Sprout palette with bright/solid/lip tiers (§5.1), white/charcoal
  neutrals (§5.2/§5.3), Nunito kept on an 8-role weight-disciplined scale
  (§5.5 — no new dependency; the V4 Inter decision is void), playful radii
  (§5.6), the pressable lip depth system (§5.7), and motion/celebration tiers
  on installed Reanimated 4 (§5.8).
- New primitives: `Pressable3D`, `OptionRow`, `CheckNode`, `PathNode`,
  `ProgressBar`/`ProgressRing`, `StreakChip`/`XpChip`, hero duotone SVG icons,
  and the "Sprout" mascot (5 poses, SVG, at most one appearance per screen).
- P0 slice only (this change's first delivery): the spec/ledger, this OpenSpec
  change, doc 13/12/README amendments, and the renamed opt-in lint guardrails
  (`eslint.ui-guardrails.config.mjs`, WARN) banning raw `text-[Npx]` className
  literals, raw Tailwind palette color utilities, and emoji literals in UI
  chrome. Zero runtime diff.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `ui-ux-visual-coherence`: adopts the Playful Momentum v2 contract — the
  bright/solid/lip section-and-reward palette and its usage boundaries (one
  solid/bright hero per screen allowed, section-solid primary CTAs, reward
  hues on reward surfaces only), the pressable lip depth system as the default
  affordance (gradients retired), Nunito role-based type at 800/600 discipline
  with sentence-case buttons, pressable-3D geometry (radii 8–28, 2px card
  borders), feedback-vs-celebration motion tiers with reduced-motion fallbacks
  and no ambient motion outside Garden/empty/celebration contexts, no emoji in
  UI chrome (hero icons + Sprout mascot instead), restraint inside operational
  flows (Workout session/Calories form get check pops only), doc-16 precedence
  over docs 12/13 for visual values, and the deliberate-per-phase visual
  golden policy (linux goldens regenerated and inspected per phase; win32
  baselines deferred to P22).

## Impact

- `docs/ui-ux/16-playful-momentum.md` (new spec + ledger),
  `docs/ui-ux/16-v4-calm-momentum-finish.md` (SUPERSEDED banner),
  `docs/ui-ux/13-calm-momentum-design-system.md` (amendment notes C1–C10),
  `docs/ui-ux/12-pop-design-system.md` (HISTORICAL banner),
  `docs/ui-ux/README.md` (index), `openspec/changes/ui-v2-playful-momentum/*`
  (this change), deletion of `openspec/changes/ui-v4-visual-finish/`, and
  `eslint.ui-guardrails.config.mjs` (renamed from `eslint.v4-guardrails.config.mjs`
  — still opt-in; imports `eslint.config.mjs`, which stays byte-identical to
  `main`, and appends three WARN `no-restricted-syntax` guardrails scoped to
  `core/ui/**/*.tsx` and `features/**/*.tsx`; run `npx eslint -c
eslint.ui-guardrails.config.mjs core/ui features`).
- Zero runtime diff in P0: no app code, tokens, themes, components, test
  assertions, or `package*.json` changes. P1–P22 carry the surface changes per
  ledger §10; each phase is its own PR off fresh `main` (branches
  `ui/v2-pNN-<slug>`).
- Lint guardrails run at WARN through P0–P21 via the opt-in config (counts
  tracked in the ledger and each PR body) and tighten to `error`, folded into
  the main `eslint.config.mjs`, at P22 close-out.
- C11 (`Cards use tokenized default padding`, 16 = `spacing.lg`) is
  compatible and needs no requirement change.
