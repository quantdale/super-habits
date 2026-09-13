# Warm Momentum 2.1 — Whole-Product Visual Coherence

## Context

Warm Momentum 2.0 established the behavioral contract: Today-first hierarchy,
one global Add action, action-first feature surfaces, and a responsive shell.
The remaining gap is visual coherence. Super Habits still reads as several
capable screens that share a theme rather than one intentionally designed
product: spacing and typography vary per feature, multiple chip/card/button
treatments compete, and empty/loading/error states are inconsistent.

The repository already has the right foundation: `core/ui/` primitives
(`Button`, `Card`, `Screen`, `ScreenSection`, `EmptyStateCard`,
`FeatureStatCard`, `PillChip`, `MenuSheet`, `Modal`), a 14-theme registry,
semantic tokens in `core/theme/designTokens.ts` (`spacing`, `radius`, `size`,
`layout`, `typography`, `elevation`, `opacity`, `layers`), and motion tokens in
`core/theme/motion.ts`. The campaign consolidates around these primitives; it
does not create a parallel design system.

## Goals / Non-Goals

**Goals:**

- Normalize the shared primitives (`Screen`, `Card`, `Modal`, `PillChip`) onto
  the semantic design tokens.
- Apply the token system to the shell/navigation rail, Today/Overview cards,
  and every feature surface's padding/radius/target-size conventions.
- Preserve one global Add action and `Add → Describe it` as the advanced
  Command path; do not reintroduce a second global command launcher.
- Keep section accent colors as accents, not full-screen paint.
- Verify the result with the full QA gate set and record before/after visual
  evidence.

**Non-Goals:**

- New product features, gamification, or analytics surfaces.
- Navigation/architecture rewrites; the six-section single-page shell stays.
- Database, sync, backup, or account behavior changes.
- Native iOS certification (environment-dependent on Windows).
- A pixel-perfect screenshot test suite (semantic/layout assertions plus
  durable visual evidence instead).

## Decisions

### 1. Consolidate on existing primitives and tokens

All changes use the existing `spacing`/`radius`/`size`/`layout` tokens from
`core/theme/designTokens.ts`. Hard-coded paddings like `px-[18px]`, `p-4`,
`rounded-2xl`, and `h-12 w-12` are replaced with semantic tokens where a token
already exists. No new parallel design system is introduced.

### 2. Touch targets stay at ~48dp

Interactive controls keep `size.touchTargetMin` (48) as the minimum height or
width. Chips and compact controls may land at `size.touchTargetMin - 4` where
the surrounding touch area still satisfies the 48dp contract.

### 3. Modal layout prop is `modalLayout`

The `Modal` component's layout variant prop is renamed from `layout` to
`modalLayout` to avoid shadowing the `layout` design-token import and to make
call sites unambiguous. All call sites (`app/index.tsx` bottom-sheet/drawer,
`features/command/CommandCenterProvider.tsx` drawer/bottom-sheet) are updated
in the same commit.

### 4. Overview state variable renamed to `cardLayout`

`OverviewScreen` previously named its local card-order state `layout`, which
shadowed the `layout` token import. The state is renamed `cardLayout` so the
content shell can use `layout.contentMaxWidth` without shadowing.

### 5. Visual-only, behavior-preserving

No domain, data, sync, backup, or account code changes. Every edit is in the
presentation layer. Existing E2E selectors and test contracts remain valid
because product-facing semantics did not change.

## Risks / Trade-offs

- [Risk] Token substitution can subtly change visual rhythm. → Mitigation:
  tokens map to the values the design already used (e.g. `spacing.lg` = 18,
  `radius.lg` = 16), so the change is a normalization, not a redesign.
- [Risk] A renamed prop (`modalLayout`) could miss a call site. → Mitigation:
  strict `tsc` plus the web bundle are the gate; the verification agent
  confirmed all 5 call sites.
- [Risk] `openspec:validate` requires delta specs. → Mitigation: this change
  ships `specs/ui-ux-visual-coherence/spec.md` with ADDED requirements and
  scenarios; validation is part of the final gate set.

## Migration Plan

No database migration. Deploying the code immediately applies the normalized
tokens; rollback is a normal code rollback with no data cleanup.

## Open Questions

None. The token set, primitive set, and per-surface scope are fixed by this
design and the delta spec.
