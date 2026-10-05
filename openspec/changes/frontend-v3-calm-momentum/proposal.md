## Why

The owner manually reviewed the rendered app and rejected the current visual/UX
state: misalignment, awkward spacing, visual noise, poor hierarchy, and an
unfinished feel. The W1 rendered-truth audit (`docs/ui-ux/15-v3-defect-ledger.md`,
evidence in `docs/ui-ux/v3-audit/`) confirmed the damage is systemic — it comes
from the "Pop" styling reflexes (tinted everything, colored slab headers,
oversized geometry, doc-copy subtitles, colliding FAB), not from isolated bugs.
Previous "visual QA complete" claims were historical evidence only and did not
survive contact with the rendered app.

The product's domain behavior is mature and must be preserved. What changes is
the frontend experience layer: design tokens, typography, geometry, component
styling, navigation ergonomics, and screen information hierarchy — "Calm
Momentum".

## What Changes

- Replace the Pop visual contract with the **Calm Momentum** design system
  (`docs/ui-ux/13-calm-momentum-design-system.md`): neutral canvas, surface
  ladder, compact typography scale (titles 22/700, no doc subtitles), radii
  ≤24, four-level action hierarchy (primary/secondary/tertiary/celebrate),
  flat-list-first grouping, one hero per screen, FAB replaced by explicit
  capture affordances.
- Rebuild the shell: phone navigation moves to a **validated five-destination
  model** (Today, To Do, Habits, Focus, Health) with a center capture slot,
  or the six-tab fallback if validation rejects the merge; wide screens keep a
  richer side rail.
- Reconstruct screen-by-screen hierarchy per wave: Today (orientation-first),
  To Do + Quick Capture (throughput), Habits (daily check-in first), Focus
  (calm running state), Workout (operational set-logging), Calories/Health
  (logging-first), Planning/Goals/Projects/Daily Plan (shared grammar),
  Weekly Review/Progress/Activity (narrative-first), Settings (quiet grouped
  rows).
- Standardize overlays, empty/loading/error/success states, motion (event-only,
  reduced-motion honored), and accessibility (contrast, targets, wrap-not-clip).
- Add a **persistent curated visual regression suite** (Playwright
  `toHaveScreenshot` baselines) and keep the W1 audit harness
  (`e2e/visual-audit.spec.ts`) as the campaign's rendered-truth instrument.
- Preserve every domain invariant: soft delete, sync enqueue via
  `runSyncedMutation`/`runBackupMutation`, DB singleton, `createId`/`toDateKey`,
  append-only migrations. No production Supabase mutations. No schema changes
  are expected; any that become necessary follow migration 26+ rules.

## Capabilities

### New Capabilities

- `frontend-calm-momentum`: the observable visual/UX contract of the V3
  redesign — canvas/surface hierarchy, typography scale, action hierarchy,
  navigation model, overlay anatomy, state grammar, and the visual-regression
  guard that pins them.

### Modified Capabilities

None. Existing behavioral capabilities (todos, habits, workout, calories,
backup, sync, gamification, …) keep their contracts; their _presentation_ is
restyled and their tests keep passing (selectors updated only where a
genuinely better UX changes labels/structure, without weakening behavioral
guarantees).

## Impact

- `core/theme/*` (tokens, designTokens, themes), `core/ui/*` (Button, Card,
  PageHeader, Screen, Modal, StatBlock, EmptyStateCard, …), `app/index.tsx`
  (shell/nav), and every `features/*/*Screen.tsx` + feature components.
- `e2e/`: new `e2e/visual-regression.spec.ts` + baselines; audit harness stays.
- Docs: `docs/ui-ux/13…15` (design system, reference ledger, defect ledger).
- No changes to `core/db`, sync engine, backup/restore semantics, or Supabase
  edge functions. No production data mutations.
