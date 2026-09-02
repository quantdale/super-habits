# Proposal: Warm Momentum 2.1 — Whole-Product Visual Coherence

**Status:** Proposed
**Author:** Verboo Code
**Date:** 2026-09-02

## Why

Super Habits has deep functionality but currently feels like "several capable screens that happen to live in one application." Warm Momentum 2.0 established the behavioral hierarchy and interaction contracts, but the visual language across the six sections (Today, Todos, Habits, Focus, Workout, Calories) and secondary surfaces (Plan, Settings, Command) has drifted.

Remaining visual friction includes:

- Inconsistent spacing and typography across feature modules.
- Diverse card/chip/button treatments that create cognitive load.
- Weak visual distinction between primary and secondary content.
- Unpolished empty/loading/error states that feel "app-like" rather than "product-like."
- Responsive layout gaps on small phones and desktop widths.

## What Changes

### 1. Warm Momentum 2.1 Design Tokens & Primitives

Standardize the existing primitives in `core/ui/` to follow a unified semantic system for:

- **Spacing:** Edge, section, card, and metadata tiers.
- **Radius:** Controls, chips, cards, and hero containers.
- **Typography:** Hero/Action, Section, Body, Label, and Caption roles.
- **Elevation/Borders:** Distinction between page, section, card, and modal.
- **Color:** Section accents used as "sparks," not background paint.

### 2. Surface-by-Surface Visual Audit & Polish

Apply the 2.1 system to:

- **Today:** Visual anchor with clear "Next Action" hierarchy.
- **Todos/Habits:** Action-first scan/completion focus.
- **Focus/Workout/Calories:** Hero-state dominance (Timer, Start, Log).
- **Plan/Settings:** Grouped progressive disclosure and safety-critical differentiation.

### 3. Responsive & Accessibility Hardening

- Resolve 360px/412px/1440px layout issues.
- Verify 48dp targets and WCAG 4.5:1 contrast.
- Respect `prefers-reduced-motion`.

## Impact

- **User Experience:** Increased perceived quality and reduced cognitive load.
- **Engineering:** Consolidated design tokens and improved component consistency.
- **Risk:** Visual-only changes with high coverage (224+ E2E, 1800+ Vitest).

---

**Plan:** `openspec/changes/polish-warm-momentum-2-1-visual-system-v1/execplan.md`
