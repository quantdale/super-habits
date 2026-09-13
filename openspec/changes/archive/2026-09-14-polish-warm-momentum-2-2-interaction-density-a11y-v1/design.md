# Warm Momentum 2.2 — Interaction Primitives, Tablet Density, Accessibility Order

## Context

Warm Momentum 2.1 normalized the visual system: semantic tokens
(`spacing`, `radius`, `size`, `layout`, `typography`) in
`core/theme/designTokens.ts`, shared primitives in `core/ui/` (`Button`,
`Card`, `Screen`, `ScreenSection`, `EmptyStateCard`, `FeatureStatCard`,
`PillChip`, `MenuSheet`, `Modal` with `modalLayout`), a single chip
treatment (`PillChip`), a 14-theme registry, and 140 theme-contrast checks
green.

The remaining friction is interaction-level, not visual-level:

1. **Duplicated selection controls.** Planning Hub tabs and Habits
   status/state chips each implement mutually-exclusive selection with
   bespoke repeated `Pressable` rows that share tokens but no code. The
   2.1 friction matrix deferred a shared `SegmentedControl` primitive.
2. **Stretched tablet layouts.** Dense surfaces (Calories Diary, Workout
   history/progress) render as single long columns at 600–1024px, wasting
   horizontal space and hurting scan efficiency. The 2.1 matrix deferred
   tablet multi-column composition.
3. **Screen-reader order not yet re-audited.** Tokenization touched
   Planning Hub tabs and Settings rows; a full focus/read order re-audit
   was explicitly scheduled for the next QA pass.
4. **No density discipline.** Dense surfaces mix whitespace levels; the
   campaign introduces a small internal density vocabulary (comfortable /
   compact) without exposing a user setting.

Warm Momentum 2.2 builds on 2.1: it consolidates interaction primitives,
composes dense surfaces responsively, and verifies accessibility order. It
is not another redesign.

## Goals / Non-Goals

**Goals:**

- One shared `SegmentedControl` primitive (exactly-one-of-N selection)
  with typed options, selected/disabled states, accessible semantics,
  keyboard navigation on web, focus ring, ≥48dp touch targets, and theme
  tokens.
- Planning Hub tabs migrate onto it without changing the state model.
- Habits controls are semantically clarified: single-filter segmented
  selection where genuinely single-select; distinct visual language for
  filter chips, status badges, and action chips.
- Tablet/desktop multi-column composition for Calories Diary (summary +
  diary) and Workout (start/resume primary + history/analytics secondary)
  using a single responsive tree with no duplicated data reads.
- Screen-reader order matches product hierarchy on touched surfaces;
  keyboard traversal verified on web.
- Large-text resilience: segmented labels, nav, statuses, view selectors
  never clip; deliberate wrap/scroll/responsive composition instead of
  font-shrinking.
- Empty/loading/dense/error states stay truthful; tablet two-column
  layouts collapse or rebalance when one pane has no data.
- Internal density vocabulary (comfortable / compact) applied to touched
  surfaces without exposing a settings feature.
- Visual evidence persisted: phone/tablet/desktop matrix + a11y semantic
  hierarchy evidence for the shared control.

**Non-Goals:**

- New product features (habits, workout programming, nutrition, sync,
  navigation destinations, AI, analytics, gamification, subscriptions).
- Revisiting Warm Momentum 2.0/2.1 solved decisions (Today-first, six
  direct sections, one global Add, `Add → Describe it`, route
  architecture, theme catalog, accessibility minimums) unless evidence
  shows regression.
- Any domain/data/sync/persistence/migration change — presentation layer
  only.
- A user-facing density setting.
- Pixel-perfect screenshot test suite (semantic/layout assertions plus
  durable visual evidence instead).

## Decisions

### D1. Shared `SegmentedControl` lives in `core/ui/`

`core/ui/SegmentedControl.tsx` exports a typed component:

```ts
interface SegmentOption<T extends string> {
  value: T;
  label: string;
  icon?: string; // only where justified
  disabled?: boolean;
}

interface SegmentedControlProps<T extends string> {
  options: ReadonlyArray<SegmentOption<T>>;
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel?: string;
  density?: 'comfortable' | 'compact'; // compact only where genuinely needed
  scrollable?: boolean; // horizontal scroll for constrained widths
  wrap?: boolean; // deliberate wrapping for large text / narrow widths
}
```

Behavior:

- Exactly one option selected at all times (single-select view/mode
  switch). This is the semantic boundary vs filter chips (zero/one/many).
- Rendered as a horizontally laid-out group of `Pressable` options with
  visible selected state (fill + text change) and
  `accessibilityState={{ selected: true/false }}` on each option.
- Group exposes an accessible label; options expose
  `accessibilityRole="radio"` or `"tab"` semantics via
  `accessibilityRole`/`accessibilityState` (announce group context,
  option name, selected state).
- Keyboard on web: Tab reaches the group; Left/Right (and Up/Down where
  vertical) arrows move selection; Enter/Space activate the focused
  option; visible focus ring retained.
- Touch targets: options are ≥ `size.touchTargetMin` (48) high; compact
  variant may use `size.touchTargetMin - 4` (44) only when the surrounding
  row still satisfies the 48dp contract (same rule as 2.1 chips).
- Theme-aware: colors from tokens; selected option uses the section/active
  token, unselected uses surface/border tokens. No per-feature hardcoded
  selected colors.
- Wrapping or horizontal scroll for constrained widths; large-text labels
  never clip.

### D2. Semantic boundaries stay distinct

| Control       | Semantics                           | Treatment                             |
| ------------- | ----------------------------------- | ------------------------------------- |
| Segmented     | exactly one of N (view/mode switch) | `SegmentedControl`                    |
| Filter chips  | zero/one/many filtering             | `PillChip` group (existing)           |
| Status badges | informational, non-interactive      | badge text/icon (existing)            |
| Action chips  | trigger an operation                | `Button`/`PillChip` + explicit action |

Do not force unrelated semantics into one primitive. A "All" state in a
status selector is a single-select filter only if the control still means
"exactly one status shown"; otherwise it stays a chip group.

### D3. Planning Hub migration

Planning Hub tabs (Today, Projects, Goals, Progress, Timeline) are a
single-select view switch → migrate to `SegmentedControl`. The underlying
tab state/keys and rendering per tab stay unchanged. Selected state is
exposed via `accessibilityState.selected`; keyboard arrow navigation works;
labels wrap or scroll at large text / narrow widths (never clip, never
shrink font).

### D4. Habits control clarification

Audit `HabitsScreen`:

- Status filter (Active / Paused / Archived / All): if it is a
  single-select "exactly one status shown" control, migrate to
  `SegmentedControl`; if "All" makes it a multi-select filter, keep a
  `PillChip` group.
- Sort/manage controls remain explicit actions (distinct visual language).
- Day strip date selection stays a distinct date-picker control.
- Habit state badges stay informational.

Users must be able to tell current filter vs management action vs date
selection vs habit state at a glance.

### D5. Tablet composition uses one responsive tree

- Breakpoints: phone 360–412, tablet ~600/768/820, desktop ≥1024; keep
  1440 coherent. No hardcoding to one emulator width; content-driven.
- **Calories Diary:** at tablet+ widths, a summary/context pane (daily
  totals, macros, targets) sits beside the diary content pane; controls
  (date nav, Form/Diary switch) live in ONE place — never duplicated in
  both panes. Empty/light days rebalance (no bizarre empty half).
- **Workout:** start/resume stays first and dominant at every width;
  history/analytics compose into a secondary pane/grid at tablet+ without
  moving analytics ahead of today's workout.
- **Performance rule:** one responsive tree preferred; if two structural
  variants are unavoidable, only the active one performs heavy work (no
  eager off-screen pane reads/mounts). No duplicate SQLite reads, no
  duplicate chart mounts, no duplicate history lists.
- Poor candidates stay single-column: dense editable forms split
  arbitrarily, active workout set entry, Add capture modal, long-text
  settings explanations.

### D6. Density discipline without a user setting

- "Comfortable" = current 2.1 token rhythm (`spacing.lg` card padding,
  `spacing.lg`/`xxl` section rhythm).
- "Compact" = reduced vertical whitespace between dense rows
  (`spacing.sm`/`xs` row gaps), same readability, same touch
  accessibility (≥44, ideally ≥48), no information loss.
- Applied only on touched dense surfaces (Calories Diary rows, Workout
  history rows) where the audit shows it helps; no Settings toggle.

### D7. Accessibility order re-audit

For touched surfaces, UI tree order must match product hierarchy:

- Shell: Today → To Do → Habits → Focus → Workout → Calories.
- Add: title → field → primary capture → destination disclosure →
  Describe it → close.
- Today: title/context → primary action → daily plan → meaningful summary
  → secondary content.
- Habits: daily action before metrics if visual hierarchy says so.
- Focus: timer + primary controls before historical statistics.
- Workout: start/resume before analysis.
- Calories: logging/current diary before tertiary analytics.
- Settings: understandable grouping.

Fixes use tree order only — no invisible accessibility-only duplicates.
Segmented control groups announce group context + option + selected state.

### D8. Presentation-only, contracts preserved

No domain, data, sync, backup, account, or migration changes. Existing
E2E selectors and labels stay valid unless a spec is deliberately updated
(never weakened). `Today` primary label and `overview` section key
unchanged. One global Add; no second command launcher.

## Risks / Trade-offs

- [Risk] Migrating controls changes DOM order / roles → E2E or
  screen-reader regressions. → Mitigation: keep labels and semantic roles
  stable, run full E2E + a11y walkthrough, update selectors without
  weakening assertions.
- [Risk] Tablet two-column layouts could duplicate state or reads. →
  Mitigation: single responsive tree; performance check measures heavy
  renders (Calories Diary, Workout history, Planning switch, Habits filter
  change).
- [Risk] Density changes could shrink touch targets below accessibility
  minimums. → Mitigation: hard floor of `size.touchTargetMin` (48) for
  interactive controls; compact only for non-interactive row whitespace.
- [Risk] Large text clipping in segmented controls. → Mitigation:
  deliberate wrap/scroll; never font-shrink.
- [Risk] `openspec:validate` requires delta specs. → This change ships
  `specs/ui-ux-interaction-density-a11y/spec.md` with ADDED requirements
  and scenarios; validation is part of the final gate set.

## Migration Plan

No database migration. Code deploy applies responsive/density changes
immediately; rollback is a normal code rollback with no data cleanup.
