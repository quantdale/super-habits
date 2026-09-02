# Warm Momentum 2.2 — shared interaction primitives, tablet density, accessibility order

Warm Momentum 2.1 normalized the visual system (tokens, primitives, radius,
spacing rhythm, modal contract). Warm Momentum 2.2 addresses the next layer of
friction: interaction consistency, information density on tablet widths, and
screen-reader/keyboard order. It is a consolidation + responsiveness pass — it
is **not** another global redesign, and it changes no domain/data/sync
behavior.

A surface passes 2.2 when selection feels consistent, dense surfaces read well
on a tablet instead of stretching into a long phone column, and assistive
technology announces things in the order the product intends.

## 1. One shared segmented-selection primitive

`core/ui/SegmentedControl.tsx` is now the single implementation for
**exactly-one-of-N** view/mode switching, replacing bespoke repeated
`Pressable` rows. Contract:

- typed option values (`value: T`, generic over the option union);
- visible label per option, optional accessible-name override;
- `selected` and `disabled` states;
- `accessibilityRole="tab"` per option + `accessibilityState.selected`, with
  a `tablist` group and group `accessibilityLabel`;
- web keyboard support: Left/Right arrows move selection (pure navigation
  model in `core/ui/segmentedControl.model.ts`, unit-tested), focus ring kept
  via `useKeyboardFocusRing`;
- touch target ≥ `size.touchTargetMin` (44);
- theme-aware (selected = section/accent token, unselected = surface + border);
- `flex-wrap` + `flexBasis: auto` so labels wrap on large text / narrow widths
  instead of clipping or shrinking.

### Semantic boundary (do not conflate)

| Control             | Semantics                      | Treatment            |
| ------------------- | ------------------------------ | -------------------- |
| Segmented selection | exactly one of N (view/mode)   | `SegmentedControl`   |
| Filter chips        | zero/one/many filtering        | `PillChip` group     |
| Status badges       | informational, non-interactive | badge text/icon      |
| Action chips        | trigger an operation           | explicit button/chip |

## 2. Adoption map

| Surface                              | Change                                                                                                                                                                                                               |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Planning Hub tabs                    | migrated to `SegmentedControl` (Today / Projects / Goals / Progress / Timeline); state model unchanged; selected tab stays highlighted when a detail is open.                                                        |
| Habits status filter                 | migrated to `SegmentedControl` (Active / Paused / Archived / All); moved **above** the habit list + stats (previously after them, contradicting screen-reader order); per-option label `Filter habits: X` preserved. |
| Habits sort                          | stays a distinct `PillChip` group — a management control, not a view switch.                                                                                                                                         |
| Calories Form/Diary switch           | migrated to `SegmentedControl` (replaced duplicated `ViewModeSwitch` logic).                                                                                                                                         |
| Pomodoro mode selector               | migrated to `SegmentedControl` (Focus / Short break / Long break); paused-session abandonment semantics preserved.                                                                                                   |
| Workout weekly plan / today override | stays `PillChip` — a single-select per-day option set, not a view switch.                                                                                                                                            |

## 3. Tablet density composition

The screen shell caps content at `layout.contentMaxWidth` (720). Tablets and
desktop therefore compose into columns _inside_ that width rather than
stretching a phone column. Two surfaces got explicit composition:

### Calories Diary

At `width >= contentMaxWidth`, the diary renders the daily summary card as a
right-hand context pane beside the diary content (quick-add + day navigator +
meal groups). The Form/Diary switch and date navigation appear **once**. The
layout collapses back to the stacked phone flow below the breakpoint, and an
empty day rebalances rather than leaving a dead pane. One responsive tree — no
duplicate reads, no duplicate chart mounts.

### Workout history / progress

Start/resume stays first and dominant (Today card, week card, start/resume
card all full width). The analytics stack (recent sessions, totals /
progress / body-weight, weekly volume, history heatmap) composes into a
two-column grid at content-max widths. Gym V2 persistence and progression
semantics are untouched.

## 4. Density discipline (no user setting)

Dense surfaces use tighter _non-interactive_ row whitespace (compact) while
keys and touch targets stay ≥ `size.touchTargetMin`. No density preference is
exposed to users.

## 5. Accessibility order

Screen-reader order was re-audited on the touched surfaces. The web keyboard
focus-order probe (`scripts/a11y-focus-probe.mjs`) confirms:

- tab order starts `Today → To Do → Habits → Focus → Workout → Calories`,
  then primary actions (Customize dashboard, Open settings, Plan today, then
  per-section cards);
- **no keyboard focus lands inside inactive, `aria-hidden` sections**
  (`HIDDEN_FOCUS_COUNT=0`);
- segmented groups announce group context + option + selected state.

The one order contradiction found (Habits filter rendered _after_ the list it
filters) was fixed by moving the filter above the list, via tree order (no
invisible accessibility-only duplicates).

## 6. Visual evidence

Before/after evidence is persisted under
`docs/ui-ux/warm-momentum-2-2-screenshots/` (manifest.json records the source
SHA, viewports, and file list). The matrix covers Planning Hub, Habits,
Calories (Form + Diary), and Workout at phone-390 / tablet-768 / desktop-1280.
The "before" reference is the WM2.1 baseline in `docs/ui-ux/baseline-screenshots/`.

## 7. Deliberately unchanged

- Today-first hierarchy, six direct sections, one global Add,
  `Add → Describe it`, current route architecture.
- Warm Momentum 2.0/2.1 design tokens, primitives, radius, spacing rhythm.
- Workout weekly-plan chips (variable per-day option sets), Habits
  status badges, date strip.
- All SQLite / domain / sync / backup persistence contracts.

## 8. QA evidence

See the campaign ExecPlan and the final report for the full gate set:
typecheck, lint, Vitest, `openspec:validate`, `qa:impact:validate`,
`validate:themes`, `supabase:schema:validate`, `agent:plan:validate:all`,
`sim:validate`, `build:web`, `web:verify`, applicable Playwright, and
`web:hygiene`.
