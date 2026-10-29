---
schema: spec-driven
created: 2026-10-29
---

## Why

The V3 Calm Momentum rules are right, but the rendered product still reads
"vibe-coded": the token values and primitives never left "Pop" — lavender
canvas, violet+fuchsia brand, Tailwind-500 rainbow section hues, Nunito's
rounded letterforms, filled Material icons, emoji in chrome, and per-screen
ad-hoc type sizes. V4 finishes the job with the same principles but new values
and stricter primitives: warm-neutral ink-first surfaces, color-as-signal
section hues, a professional Inter type scale, flat grouped lists over card
soup, and a Linear-grade desktop shell. This is presentation-only work — no
domain, data, sync, backup, migration, or routing changes, and no test ID,
accessible role/label, or product-facing label changes.

## What Changes

- A durable V4 spec and delivery ledger
  (`docs/ui-ux/16-v4-calm-momentum-finish.md`): exact token values (§5),
  component standards (§6), per-screen redesign notes (§7), the P0–P20 phased
  plan (§8), recorded decisions (§9), and the per-phase ledger (§10).
- The V4 token system replaces the Pop-era values: neutral ink-first
  light/dark palettes with `textSubtle`/`focusRing`, six harmonized section
  hues used only as signal, Inter typography roles with tabular metrics,
  tightened radii/spacing rhythm, neutral elevation, and new motion timings —
  all through the existing `core/theme` semantic tokens (no parallel design
  system).
- Stricter primitives and shell: flat grouped lists over cards, one hero and
  one primary action per view, one outline icon family with no emoji in UI
  chrome, labeled sidebar + centered content grid at ≥1280, keyboard-first
  command palette.
- The 14 theme IDs are all kept and become accent variants on the neutral
  system (no theme pruning).
- P0 slice only (this change's first delivery): the spec/ledger, this OpenSpec
  change, and three WARN-severity ESLint guardrails
  (`no-restricted-syntax` selector regexes, no new deps) banning raw
  `text-[Npx]` className literals, raw Tailwind palette color utilities, and
  emoji literals in `core/ui/**` + `features/**` TSX. Zero runtime diff.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `ui-ux-visual-coherence`: adopts the V4 finish contract — exact neutral/
  section-hue token values and their usage boundaries, role-based type with
  tabular metrics, one outline icon family and no emoji in UI chrome, flat
  grouped lists over card soup, one hero/primary per screen, and the
  deliberate-per-phase visual golden policy (linux goldens regenerated and
  inspected per phase; win32 baselines deferred to P20).

## Impact

- `docs/ui-ux/16-v4-calm-momentum-finish.md` (new spec + ledger),
  `openspec/changes/ui-v4-visual-finish/*` (this change),
  `eslint.v4-guardrails.config.mjs` (new opt-in config — imports
  `eslint.config.mjs`, which stays byte-identical to `main`, and appends three
  WARN `no-restricted-syntax` guardrails scoped to `core/ui/**/*.tsx` and
  `features/**/*.tsx`; run `npx eslint -c eslint.v4-guardrails.config.mjs core/ui features`).
- Zero runtime diff in P0: no app code, tokens, themes, components, test
  assertions, or `package*.json` changes. P1–P20 carry the surface changes per
  ledger §8; each phase is its own PR off fresh `main`.
- Lint guardrails run at WARN through P0–P19 via the opt-in config (counts
  tracked in the ledger and each PR body) and tighten to `error`, folded into
  the main `eslint.config.mjs`, at P20 close-out.
