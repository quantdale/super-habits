## W11 Design — planning grammar / progressive disclosure

Authority: `docs/ui-ux/13-calm-momentum-design-system.md` V3 and
`docs/ui-ux/14-v3-reference-ledger.md`. User direction is existing Calm
Momentum; do not create a competing visual system.

### W11 reference lock

- **Primary direction: Things** (Refero style
  `0796cd74-edc2-4e12-9c71-25fac02a1cb2`): calm, precise alignment,
  simple typography, clear objective rows, restrained blue action accent.
  Adopt hierarchy/density, **not** its marketing mockups or custom fonts.
- **Detail pattern: Todoist project screen** (Refero
  `aefd059f-b01c-457b-8d49-8418981fe97b`): quiet task rows, one
  objective per row, supporting metadata secondary, add-action nearby.
  Reject desktop Kanban, loud red brand chrome and hard-coded app hues.
- **Day planning: Structured iOS** (Refero
  `0a443e69-2cf1-48df-86f4-d0467b299b18`): intentional day context
  and task-priority order. Adopt sequential planning, **not** its floating
  action button or complex time-block calendar (unsupported by DailyPlan).
- **Secondary role: Asana** (Refero style
  `a62c0ef5-f510-4e58-9321-e7605524a47e`): clear border-based
  grouping and quiet active filter states. Reject marketing gradients and
  novelty display typography.

Tokens are the existing `useAppTheme` and V3 design tokens. No new palette,
font or image assets. One accent for actions/progress; neutral metadata;
48–56pt rows where content permits; 44pt touch targets.

### W11-D1: shared list grammar

Goals/Projects rows use: title (objective); status plus horizon/date/project
or linked-work context (quiet, wrap-safe); progress reading and bar (goal
manual progress, project rollup); a single large row press target. Do not
replace project manual-order buttons with row presses or break accessible
names used by journeys. No duplicate percent badges and decorative bullets.

### W11-D2: disclosure, not removal

One "Filters & sort" disclosure per list, collapsed on initial mount, opens
the existing filter/sort controls with their existing accessible names.
When active filters/sort differ from defaults, the closed state must honestly
signal this fact; opening/disclosing does not reset filter values. A screen
reader receives expanded state. No nested scrolling panels.

Detail editors reveal optional target date, description, horizon/status,
color/linkage fields behind "More options" while keeping all existing save,
delete, lifecycle/progress and link actions accessible when needed.

### W11-D3: Daily Plan priority first

Initial morning hierarchy:
1. Plan date + status.
2. Intention and selected top priorities, with explicit "Add priority" action.
3. Primary Save Plan action.
4. Collapsed "More planning options" (focus target, notes, scheduled habits).
5. Collapsed "End-of-day reflection" (reflection, energy score, Complete).
6. Collapsed plan history (existing semantics).

If plan is already completed, expose completed status immediately. Do not
discard reflection values or silently mutate status when disclosures toggle.
Preserve guarded refresh/draft precedence, carry-forward semantics,
snapshot-title resolution and explicit save.

### W11-D4: evidence / certification

Baseline captures and after captures, at widths 360/390/412/768/1280
light/dark where feasible; keyboard, empty/populated, create/edit/delete,
filtered goals/projects, day plan, advanced edit and completed plan.
E2E pins disclosure accessibility, selected rows and persistence. No
runtime/visual certification claim without executing and inspecting.
