# ExecPlan — UI v2 P3: Geometry + depth tokens

Plan-Version: 2
Status: ACTIVE

## Objective

Implement phase **P3 "Geometry + depth tokens"** of brief v2 "Playful Momentum"
(`docs/ui-ux/16-playful-momentum.md` §5.6, §5.7, §10 P3 row) on branch
`ui/v2-p03-geometry`, stacked on P2 (`origin/ui/v2-p02-typography` @ 7f23746b,
PR #145) which itself stacks on P1 (PR #139 @ f47813a9).

Scope (presentation-only):

1. `core/theme/designTokens.ts`
   - `radius`: xs 8, sm 12, md 16, lg 20, xl 28, full 9999 (§5.6).
   - `elevation`: keep levels 0–2 (neutral, for floating surfaces only); retune
     `level3` to the §5.7 `0 12 32 rgba(16,19,26,0.18)` light spec (sheets,
     dialogs, celebration card only).
   - NEW `depth` tokens: `lip.lg|md|sm` = 4/3/2,
     `card` = 2px `border` + 4px `borderStrong` bottom,
     `flat` = 2px `border`, no lip. Plus `deep(depth, appearance)` dark-mode
     composition helper (`surfaceElevated` + 2px `border`, per §5.7).
   - `layout.contentMaxWidth` 760 → **640**.
   - NEW `layout.dashboardMaxWidth` 1040 so the §5.6 dashboard 2-column grid
     keeps its documented cap instead of inheriting the narrowed column.
2. `core/ui/useKeyboardFocusRing.ts` — real `:focus-visible` semantics:
   keyboard focus (Tab, or a focus() that follows a Tab press) shows the 2px
   ring; a pointer click/tap shows **no** ring.
3. Token-swap-only wiring in `core/ui` (+ `app/index.tsx` tab rail, which is the
   reference implementation of the ring this hook mirrors): Card, StatBlock,
   EmptyStateCard, FeatureStatCard, SectionLabel, TextField, NumberStepperField,
   InAppNoticeBanner, ValidationError, Button (radius only — no Pressable3D),
   Modal, SegmentedControl.
4. Call sites that pinned raw 720/760 to the old token (HabitsScreen, the
   Overview dashboard cap, `e2e/workout-w95.spec.ts`'s literal) move with it.
5. Regenerate linux visual goldens and inspect diffs (radii/borders/max-width
   only; no clipping/overflow).

Explicitly out of scope: Pressable3D (P5), Button/IconButton restyle (P5),
colour values (P1), typography (P2), inputs/selection redesign (P6),
surfaces rework (P7), overlays (P8). No new deps, no test id/role/label/copy
edits.

## Constraints / invariants

- Never touch: `.github/`, `vercel.json`, `supabase/`, `package*.json`,
  `core/db/schema.sql`, node_modules.
- Never push to `main`, never force-push.
- Heavy commands one-at-a-time under `flock /tmp/sh-heavy.lock`.
- E2E served only on **port 8087**, kill only the owned PID.
- Only this lane may run `visual:update`.

## Current Checkpoint

- 2026-10-29 20:40 Asia/Manila — context read (ui.findings STATUS, doc 16
  §5.6/§5.7/§10-P3, designTokens, core/ui consumers, focus-ring hook).
  Baseline: clean worktree at 7f23746b (P2 tip). Next: edit designTokens.ts.

## Validation plan

`typecheck` → `lint` → `test:unit` → `validate:themes` (each under flock);
hermetic `build:e2e` (Supabase env unset) → serve :8087 → `visual:update` →
inspect diff PNGs → targeted chromium: `a11y.spec`, `a11y-audit-contract`,
`health-nav-w10`, `settings.spec`. Record what was and was not run.

## Close-out (21:13 Asia/Manila)

Status: ACTIVE — shipped as draft PR #148, one open follow-up remains.

Done: designTokens radius/depth/elevation/contentMaxWidth+dashboardMaxWidth,
`:focus-visible` hook, token-swap wiring, 29 linux goldens inspected, gates
(typecheck, lint, test:unit 2183, validate:themes 168, hermetic build:e2e,
visual:update, targeted a11y/health-nav/settings 27/27).

Open follow-up (NOT applied — time-boxed): `e2e/habits-w7.spec.ts` 2/11 red
(`:301`, `:365`) because those cases `.focus()` programmatically after pointer
input, so Chromium's `:focus-visible` is false and the ring is (correctly)
absent. Planned fix: `isFocusVisible() || !pointerPressActive`, flag spanning
pointerdown → ~100 ms after pointerup.

Exact next action: apply that fallback on ui/v2-p03-geometry, rerun
`habits-w7` + a no-update visual pass (inspect any moved golden), commit, push
(never force), comment on #148. Then await @codex review and the #139/#145
squash-merges, `git rebase --onto origin/main 7f23746b`, and start P4.
