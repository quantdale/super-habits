# Super Habits Design DNA — “Warm Momentum”

This document defines the visual and behavioral rules that every Super Habits feature must share. It is intentionally stricter than a mood board. Future implementation work should treat these rules as a contract unless a documented product reason requires an exception.

---

## 1. Identity

### Design statement

**Warm Momentum** combines the calm clarity of a serious productivity tool with the warmth and tactile feedback of a habit/wellness app.

The experience should feel:

- calm, not sterile;
- friendly, not childish;
- rewarding, not manipulative;
- colorful, not noisy;
- dense enough for power users, but not cognitively dense;
- animated, but never slow;
- personal, while remaining structurally predictable.

### Visual metaphor

Use **growth and accumulation** as the shared emotional metaphor. A completed action should feel like a small contribution to something larger.

Possible implementation vocabulary:

- leaves / sprouts / garden;
- path segments;
- stars / constellation;
- tiles in a mosaic;
- small “momentum” particles that settle into a persistent artifact.

Select one system-wide metaphor before implementation. Do not give each feature a different unrelated game mechanic.

---

## 2. Design principles

### P1 — Calm first, delight second

The underlying screen must be clear before animation, gradients, illustration, or celebration is added.

### P2 — Section color is an accent, not a theme

Todos, Habits, Focus, Workout, and Calories retain their existing semantic accents. The global surface system, typography, shapes, spacing, shadows, icon style, and motion remain shared.

### P3 — One dominant action per state

A screen can contain many controls, but only one should visually read as the primary next action.

### P4 — Progressive disclosure over visible complexity

Show what is needed for the current task. Put advanced options in details, sheets, menus, expandable rows, or secondary steps.

### P5 — Feedback follows causality

Animation must originate from or clearly relate to the control the user manipulated. Avoid arbitrary page-level motion after small actions.

### P6 — Reward the behavior, not app opening

Progress, badges, and celebrations should correspond to meaningful user actions and goals. Do not reward repeated checking with random incentives.

### P7 — Recovery is part of the product

Missing a day is an ordinary state. Returning should feel positive. UI copy and color should never imply moral failure.

---

## 3. Token architecture

The repository's current `ThemeTokens` system should remain responsible for semantic colors. Extend the design system with non-color token groups rather than overloading color themes.

Recommended conceptual structure:

```text
design tokens
├── color        (existing theme tokens + section accents)
├── typography
├── spacing
├── radius
├── border
├── elevation
├── size
├── layout
├── motion
├── opacity
└── layer
```

Names should be semantic where possible. A feature should ask for `space.md`, not `12`; `radius.card`, not `16`; `motion.feedback`, not `220ms`.

---

## 4. Spacing

Use a **4-point base grid**.

Recommended scale:

| Token | Value | Typical use |
|---|---:|---|
| `space.0` | 0 | reset |
| `space.xs` | 4 | icon/text micro-gap |
| `space.sm` | 8 | tightly related controls |
| `space.md` | 12 | row internal spacing |
| `space.lg` | 16 | card padding / standard page rhythm |
| `space.xl` | 24 | section separation |
| `space.2xl` | 32 | major content groups |
| `space.3xl` | 48 | hero separation / large empty-state rhythm |

Rules:

- phone horizontal page padding: normally 16;
- tablet/desktop horizontal padding may increase, but content width should be capped;
- use 8–12 between tightly related elements;
- use 16–24 between separate concepts;
- do not solve hierarchy by adding arbitrary margins.

---

## 5. Typography

Prefer a platform-friendly sans-serif stack with excellent numerals and accessibility behavior. A custom font is optional, not required for identity.

### Recommended semantic roles

| Role | Nominal size | Weight | Use |
|---|---:|---|---|
| `display` | 32 | 700 | rare hero values / celebratory moments |
| `title.lg` | 24 | 700 | primary screen title |
| `title.md` | 20 | 650–700 | card/section title |
| `body.lg` | 16 | 400–500 | primary reading/body |
| `body.md` | 14 | 400–500 | normal rows and descriptions |
| `label` | 13–14 | 600 | controls, chips, metadata labels |
| `caption` | 12 | 500 | secondary metadata |
| `metric` | 24–32 | 700 | key number/value |

### Rules

- use weight and size before color to create hierarchy;
- avoid all-caps for normal navigation or labels;
- use tabular numerals for timers, weight/reps, calorie totals, and changing counters when supported;
- keep line height generous enough for font scaling;
- never hard-code a height that clips scaled text;
- muted text remains readable; “muted” does not mean low-contrast decoration.

---

## 6. Shape language

The existing `rounded-2xl` card direction is compatible with Warm Momentum.

### Recommended radius roles

| Token | Value | Use |
|---|---:|---|
| `radius.sm` | 8 | compact inputs / small tags |
| `radius.md` | 12 | list rows / controls |
| `radius.lg` | 16 | default cards / buttons |
| `radius.xl` | 24 | hero panels / sheets where appropriate |
| `radius.full` | 999 | pills, avatars, circular status |

Rules:

- equivalent components always share radius;
- do not randomly mix sharp and rounded cards;
- destructive confirmations are not made “scarier” through shape changes;
- circular controls are reserved for icon actions or meaningful circular progress affordances.

---

## 7. Surfaces and elevation

Prefer subtle layering over heavy shadows.

### Elevation roles

- **Level 0:** page background.
- **Level 1:** ordinary card/row surface.
- **Level 2:** floating action, sticky control, popover, active timer.
- **Level 3:** modal/sheet/dialog.

Use borders to define Level 1 surfaces and reserve stronger shadow for floating elements. Dark mode should rely more on tonal separation than black shadow.

### Card hierarchy

Do not put every block inside a card. Use cards only when the content benefits from grouping, interaction, or independent identity.

Preferred patterns:

- grouped rows on plain background for lists/settings;
- cards for meaningful summaries;
- hero card for the single most important dashboard state;
- inset section for secondary information;
- avoid card-inside-card unless the nested surface is functionally necessary.

---

## 8. Color behavior

### Existing semantic section identity

Retain the established section accents:

- Todos — blue;
- Habits — green;
- Focus — purple;
- Workout — orange;
- Calories — amber.

### Usage rule

On an ordinary feature screen, section accent should normally occupy **less than roughly 15–20% of the visual area**. It should guide attention, not become a full-screen paint bucket.

Use section accent for:

- selected state;
- progress/ring/bar;
- key icon;
- thin card edge/header treatment;
- primary feature-specific action;
- small illustration detail;
- chart series when semantically appropriate.

Avoid:

- large saturated backgrounds behind long text;
- multiple competing accent colors on one screen;
- using red for ordinary incompletion;
- using green alone to mean success without another cue.

### Semantic color takes precedence

Danger, warning, success, info, selection, and disabled states must remain semantically stable regardless of feature accent.

---

## 9. Iconography and illustration

### Icons

Use one icon family and consistent optical sizing. Material Icons already exist in the codebase and can remain unless a deliberate migration is justified.

Rules:

- 16–18: inline metadata;
- 20–24: standard control/navigation;
- 28–32: feature/empty-state emphasis;
- icon-only actions require accessible labels/tooltips where appropriate;
- do not mix filled, outlined, rounded, and sharp styles arbitrarily.

### Illustration

Borrow Avocation/Forest's emotional idea, not their art.

Create a Super Habits-specific illustration language:

- simple rounded geometry;
- restrained palette derived from semantic tokens;
- low-detail enough to render consistently on mobile;
- optional subtle motion;
- character/growth visuals used mainly in onboarding, empty states, milestones, and living-progress areas;
- never obscure task content or turn every screen into a game scene.

Illustration should support a state, not merely fill space.

---

## 10. Motion system

The codebase already has `react-native-reanimated` and gesture support. Standardize motion before adding more animations.

### Motion roles

| Role | Duration target | Purpose |
|---|---:|---|
| `instant` | 80–120 ms | pressed/hover response |
| `feedback` | 160–220 ms | completion/check/select |
| `transition` | 220–320 ms | sheet/card state change |
| `celebration` | 350–600 ms | meaningful milestone only |
| `ambient` | slow/continuous | optional living scene; must be subtle and disableable |

Durations are guidance, not frame-perfect requirements. Direct-manipulation gestures should track the finger rather than wait on preset timing.

### Recommended motion grammar

#### Press

- tiny opacity/scale response;
- immediate, reversible;
- no bounce-heavy effect on every tap.

#### Complete

1. input changes state immediately;
2. progress indicator advances;
3. 160–280ms spring/fade confirms completion;
4. optional light native haptic;
5. milestone celebration only if a real threshold was crossed.

#### Add item

- item appears from its insertion point with short fade/size transition;
- list does not dramatically reshuffle.

#### Delete

- require confirmation only when consequence warrants it;
- row collapses smoothly after decision;
- provide undo where safe and practical.

#### Modal/sheet

- coherent enter/exit direction;
- backdrop and content animate together;
- avoid slow cinematic transitions.

#### Charts

- animate initial reveal only when it helps comprehension;
- data changes should interpolate briefly;
- repeated tab switches should not replay the same flourish.

### Reduced motion

When system Reduce Motion is enabled:

- remove parallax, bouncing, large translations, and ambient growth motion;
- use opacity and direct state changes;
- preserve the same information and success feedback;
- haptic/audio feedback remains optional and user-controlled.

---

## 11. Feedback and haptics

Define semantic feedback once:

- **selection:** light impact;
- **completion:** light/medium success-like haptic;
- **milestone:** stronger but rare confirmation;
- **error:** notification-style feedback only for an actual error;
- **timer end:** distinct user-configurable notification/haptic.

Never use vibration to punish a missed habit or exceeded calorie target.

Web must receive equivalent visible feedback without haptics.

---

## 12. Component contracts

The redesign should extend existing `core/ui` components. Every component must document anatomy, variants, states, accessibility, and responsive behavior.

### Button

Required variants:

- primary;
- secondary/ghost;
- destructive;
- icon;
- optional compact only where density demands it.

Required states:

- default;
- hover (web/desktop);
- focused;
- pressed;
- disabled;
- loading.

A page normally has only one visually dominant primary button in the same decision context.

### Card

Standardize:

- surface card;
- interactive card;
- section-accent card;
- metric card;
- hero card.

Every card must have a reason to be a card.

### Text field / numeric field

Required states:

- default;
- focused;
- populated;
- disabled;
- error;
- success only when useful.

Label stays visible; placeholder is not the only label.

### Chips

Use for:

- filtering;
- lightweight selection;
- categories/tags;
- quick destination choice.

Do not use chips as miniature buttons for every action.

### Empty state

An empty state should contain:

1. concise explanation;
2. one useful next action;
3. optional illustration;
4. no blame.

### Loading

Prefer:

- existing content retained during refresh;
- local skeleton/progress for first load;
- button-level indicator for submissions;
- no full-screen spinner when only one card is refreshing.

### Error

Explain:

- what failed;
- whether data is safe;
- what the user can do;
- retry where appropriate.

### Toast/banner

Use non-blocking feedback for reversible or informational events. Avoid stacking repeated banners.

---

## 13. Shared screen anatomy

Most standard screens should follow:

1. safe area;
2. page header;
3. optional short context/summary;
4. primary content/action region;
5. supporting sections;
6. optional sticky/floating action where justified.

### Header rules

A feature title should not compete with the global navigation. Use consistent title size and action placement. Secondary actions belong on the trailing side or in an overflow menu.

### Section rules

A section has:

- heading;
- optional short explanation or value;
- content;
- optional trailing action.

Do not invent a different header pattern in every module.

---

## 14. Responsive design

Super Habits is primarily phone-oriented but also runs through React Native Web and should scale sensibly.

### Compact phone

- single-column;
- 16px logical horizontal padding;
- 44–48px frequent touch targets;
- bottom/sticky controls positioned above safe area;
- no critical multi-column grids.

### Large phone / small tablet

- still prioritize single-column workflows;
- summary metrics may use 2-column grids;
- wider modal/sheet layouts possible.

### Tablet / desktop

- content max width prevents stretched reading lines;
- dashboard may use 2–3 columns;
- task/planning surfaces may adopt master-detail layouts;
- keyboard/mouse states become first-class;
- navigation can shift to side rail if validated.

Do not merely scale every phone element proportionally upward.

---

## 15. Accessibility contract

### Touch and pointer targets

Use 44×44 logical points as the normal minimum for frequently tapped mobile controls. WCAG 2.2 web conformance requires at least 24×24 CSS pixels or adequate spacing under its Target Size (Minimum) criterion; Super Habits should exceed that minimum for primary controls.

### Focus

On web/keyboard-capable platforms:

- every interactive component is reachable;
- focus is never visually hidden;
- focus indication is high-contrast and obvious;
- dialogs trap focus correctly and restore it on close;
- sticky bars do not obscure focused content.

### Screen readers

- icon-only controls have labels;
- completion states are announced meaningfully;
- progress values expose name/value where possible;
- charts have textual summaries;
- timers do not announce every second unless explicitly useful.

### Motion and flashing

- respect Reduce Motion;
- no rapid flashing;
- no continuous high-amplitude background motion;
- important information is never motion-only.

### Color vision

Use icon, text, shape, position, or pattern in addition to color for status.

---

## 16. Engagement visual language

### Everyday completion

Small and quick. No confetti for every checkbox.

### Daily completion

Slightly richer summary, e.g. a growing leaf/segment or “day settled” state.

### Milestone

Rare celebration: streak milestone, meaningful PR, first completed week, goal completion. Animation may be more expressive but should remain dismissible/skippable.

### Returning after absence

Preferred copy tone:

- “Welcome back.”
- “Pick up where you left off.”
- “Today is a fresh start.”

Avoid:

- “You broke your streak!”
- “You failed yesterday.”
- alarming warning styling for ordinary inactivity.

---

## 17. Design review checklist

A screen is not design-complete until all answers are yes:

- Is the main action obvious within three seconds?
- Does it use shared typography roles instead of arbitrary sizes?
- Does spacing fit the shared scale?
- Are card/radius/elevation decisions consistent?
- Is section color used as an accent rather than a replacement theme?
- Are loading, empty, error, disabled, pressed, focused, and success states defined?
- Is motion tied to a user-understandable cause?
- Does reduced motion preserve meaning?
- Are controls comfortably tappable?
- Can the flow be used without swipe/drag alone?
- Does dark mode preserve hierarchy?
- Does the screen still work at large text sizes?
- Is there a clear reason for every chart?
- Does any engagement mechanic create unnecessary guilt or urgency?
- Could this same component behavior be reused elsewhere instead of introducing a one-off pattern?

---

## 18. Final rule

Feature personality comes from **content and accent**, not from reinventing the design system.

A Workout screen and a Habits screen should look different enough that their purpose is obvious, while still sharing unmistakable Super Habits DNA in their surfaces, controls, motion, copy, hierarchy, and feedback.
