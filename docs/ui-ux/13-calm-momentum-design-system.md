# Calm Momentum — SuperHabits design system (V3)

Status: **CAMPAIGN CANONICAL** (Frontend V3 "Calm Momentum").
Supersedes the _visual_ rules of `12-pop-design-system.md`; Pop's component
inventory, section-hue concept, and gamification layer remain, but their
styling contracts below replace Pop's. When this document and any older
`docs/ui-ux/*` file disagree, **this document wins** for V3 work.

---

## 1. Why V3 exists

The owner manually reviewed the rendered app and rejected it: misalignments,
awkward spacing, layout mistakes, visual noise, unfinished feel. The W1
rendered-truth audit (`15-v3-defect-ledger.md`, screenshots in `v3-audit/`)
confirmed systemic causes. Pop's core reflexes produced them:

| Pop reflex                                 | Observed damage                                                                    |
| ------------------------------------------ | ---------------------------------------------------------------------------------- |
| Tint every surface with the section hue    | 5-hue stat rows, tinted cards inside tinted cards inside a tinted canvas           |
| Colored header bands on every card         | Saturated slabs (Workout rust, Calories brown, Habits green) dominate every screen |
| Big radii (20–34) + full pills everywhere  | Everything looks inflated; dense screens waste ≥30% of their height                |
| Hero title + explanatory subtitle per page | Documentation copy eats the first screenful; content starts below the fold         |
| One loud gradient primary style            | Every action shouts; hierarchy between actions disappears                          |
| Floating brand FAB on every screen         | FAB overlaps card content and form fields (measured on 4 of 6 sections)            |

Calm Momentum keeps Pop's warmth, playfulness where it earns its place, and the
section-hue **concept** — but flips the default from _expressive_ to _calm_:
neutral canvas, disciplined geometry, color as signal rather than wallpaper.

## 2. North star

> **A screen answers one question first.** Everything on it either serves that
> answer or gets quiet. Momentum comes from frictionless frequent actions, not
> from decoration.

Every surface states its primary question in code comments and designs for it:

- Today → _What matters today?_
- To Do → _What do I need to do?_ (throughput)
- Habits → _Did I do today's check-ins?_
- Focus → _Am I focusing right now?_ (calmest screen)
- Workout → _What am I training and logging right now?_ (operational)
- Calories → _What did I eat / what's left today?_ (logging-first)

## 3. Canvas & surfaces

Semantic surface ladder (each step exists for a reason; never skip steps by
nesting a card directly inside a same-level card):

| Token           | Use                                                   | Treatment                                                                        |
| --------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------- |
| `background`    | App canvas                                            | Neutral (light: near-white warm gray; dark: near-black). **No page-level tint.** |
| `surface`       | Grouping container, list sections, sheet body         | Flat fill one step from canvas, hairline border optional                         |
| `surfaceSunken` | Input wells, progress tracks, inactive segments       | Recessed, **never** bordered-and-shadowed                                        |
| `surfaceRaised` | A real object floating above the page (sheet, dialog) | Shadow level2/3 only                                                             |
| `inset`         | Sub-group inside a surface                            | Tint ≤6% or sunken fill; no shadow, no heavy border                              |
| `hero`          | The one emphasis surface a screen may own             | Section tint ≤12% or solid accent; max **one per screen**                        |

Rules:

1. **One hero per screen.** Today's UP NEXT may be a hero; the stat strip,
   garden, queue cards may not.
2. **Card headers are not colored slabs.** A group header is a small
   label/title row on the same surface (or a `caption` eyebrow + title), not a
   saturated band.
3. Shadows communicate _z_, not _importance_. Cards on the page get at most
   level1; most get none (border or tone separates them).
4. Radii calm down: controls 10–12, cards 16, sheets/hero 20–24, pills stay
   full for chips only. Nothing on a phone gets radius > 24 except pills.
5. The ambient `canvasTint` wash is **removed** (it renders as a stray arc on
   desktop). Clean canvas + spacing does the separating.

## 4. Color

- **Neutral first.** Text/surface hierarchy carries the page; color marks
  state, identity, and the primary action.
- Section hue appears in: active navigation state, the section's hero (≤1),
  progress/completion accents, and section-specific charts. Not on every card
  background.
- Status colors (success/warning/danger) only for actual status — a neutral
  `0/99` progress value is **not** danger-red.
- Charts and multi-series visuals keep hue variety; static metadata rows do
  not.
- Dark theme: same hue system at reduced saturation; hero surfaces get
  _darker_ accents with light ink (never light fill + white text).

## 5. Typography

One family (Nunito) stays. The weight ladder flattens — 900/800 become rare:

| Role      | Size/weight (phone)          | Notes                               |
| --------- | ---------------------------- | ----------------------------------- |
| `display` | 34 / 800 — celebrations only | XP, streak milestones, timer digits |
| `titleLg` | 22 / 700                     | Screen title (PageHeader)           |
| `titleMd` | 17 / 700                     | Card/sheet titles                   |
| `bodyLg`  | 16 / 400–500                 | Primary reading                     |
| `bodyMd`  | 15 / 400–500                 | Rows, descriptions                  |
| `label`   | 13 / 600                     | Buttons, chips                      |
| `caption` | 12 / 500                     | Metadata, helper text               |
| `metric`  | 28–34 / 800 tabular          | Key numbers (timer, kcal, streaks)  |

- **Screens do not carry doc-copy subtitles.** If a control needs explanation,
  the explanation lives beside the control as `caption`.
- Numerals in metrics/timers use tabular figures to avoid jitter.
- `core/ui/Text` remains the single typography authority; the role table above
  is implemented in `core/theme/designTokens.ts`.

## 6. Geometry & spacing

- 4pt grid stays. Page gutter 16 (phone), 24 (≥768), 32 (≥1280 with rail).
- Section vertical rhythm: `xl` (24) between groups, `lg` (16) inside groups,
  `md`/`sm` inside rows.
- **List rows are 48–56pt** with title + optional one-line metadata; equal rows
  share exact height, leading, and alignment (audit: "almost the same" one-offs
  are defects).
- Touch targets ≥ 44–48pt; visual size may be smaller with hitSlop.
- The FAB: **removed from screens where it collides with content or duplicates
  a visible affordance.** Quick capture gets an explicit affordance (nav bar
  center slot on phone, header button on rail layouts) instead of a floating
  circle over content.

## 7. Buttons & actions

Four semantic levels replace one loud default:

| Level       | Treatment                                          | Use once per view?    |
| ----------- | -------------------------------------------------- | --------------------- |
| `primary`   | Solid accent fill, white ink, subtle press travel  | Yes — the main action |
| `secondary` | Tonal fill (accent ≤10%) + accent ink, **no lip**  | Supporting actions    |
| `tertiary`  | Plain text/ghost                                   | Dismiss, rare paths   |
| `danger`    | Solid danger fill reserved for destructive confirm | As needed             |

- The 3D gradient lip is **retired from the default button**. It survives only
  as an opt-in `celebrate` treatment (gamification moments).
- Buttons stop being pills by default: radius 12 (compact 10). Pills remain
  for chips/filters.
- Compact operational actions (Todo rows, Workout sets, Settings) use
  icon-buttons at 40pt visual / ≥44pt hit area.
- `TactileButton` consolidates into `Button` (variant `celebrate`) — one
  component, one press-physics implementation.

## 8. Lists, cards, rows

- Default grouping = **flat rows** with hairline separators, not card grids.
- True cards only for distinct objects (a habit, a workout day, a session).
- Progressive disclosure: row → detail; never expose every field up front.
- Completed states: muted ink + check, no strikethrough circus.
- Empty states: one sentence + one action (`EmptyStateCard` stays, restyled
  quiet).

## 9. Navigation

- **Phone (primary decision under test in W4/W10):** five destinations —
  Today, To Do, Habits, Focus, Health — plus a **center capture slot** in the
  bar. Health parents Workout + Calories. This must be validated against
  frequency-of-access and not silently forced; the six-tab model is the
  fallback.
- Labels ≥ 11px, no truncated two-line tabs; active state = filled tonal
  capsule + accent icon (no heavy outline ring).
- **Wide (≥900):** side rail may expose richer destinations (planning,
  review) — phone and desktop are _not_ required to match density.
- All modals stay overlays (Settings, Planning Hub, Weekly Review,
  Achievements, Quick Capture, Command Center).

## 10. Overlays

Bottom sheets for lightweight mobile workflows (quick capture, pickers);
centered dialogs for confirmations; full drawers only for Settings-class
surfaces. Standard anatomy: handle (sheets), title row, close button, 16pt
body padding, actions pinned above keyboard safe area, backdrop `overlayScrim`.
One visible primary action per overlay; destructive actions separated.

## 11. States

- **Loading:** stable geometry (SkeletonBlock), never layout shift.
- **Empty:** one line + one action.
- **Error:** what failed + one recovery action.
- **Success:** acknowledge inline (toast/banner ≤2s); never block the next tap.
- **Celebration:** reserved for real milestones (level up, PR, streak record);
  brief, dismiss-anywhere.

## 12. Motion

- Press: scale/translate ≤2px, ≤150ms.
- State changes: ≤200ms ease-out; completion feedback: one pop.
- No staggered entrances on ordinary screens; no continuous ambient animation
  (timer screen's decorative grower is **static** unless it marks an event).
- `useReducedMotion()` honored everywhere (existing infra).

## 13. Accessibility

- Roles/labels preserved (they are test contracts); new anatomy keeps them.
- Contrast: text ≥4.5:1, large numerals ≥3:1 — dark-theme hero surfaces fixed
  accordingly.
- Non-color status cues (icon + label, not hue alone).
- Text scaling: rows wrap, never clip; validated at largest OS text size.
- Keyboard: focus ring 2px accent, visible on all interactive elements (web).

## 14. Component inventory changes

| Component                     | V3 action                                                             |
| ----------------------------- | --------------------------------------------------------------------- |
| `Button`                      | Restyle (levels above), add `celebrate` variant, absorb TactileButton |
| `Card`                        | Kill colored header bands; add `inset` + `hero` semantics; radii 16   |
| `PageHeader`                  | Compact: small title row, no doc subtitle, actions inline             |
| `Screen`                      | Remove canvas wash; gutter/rhythm per §6                              |
| `StatBlock`                   | Neutral surface; hue only for the value                               |
| `PillChip`                    | Stays for filters; quieter inactive state                             |
| `SegmentedControl`            | Compact height 36; sunken track                                       |
| `EmptyStateCard`              | Quieter art, one action                                               |
| `Modal`                       | Standardized anatomy per §10                                          |
| `TabBar` (in `app/index.tsx`) | 5-destination model + capture slot (pending W4 validation)            |
| `TactileButton`               | Deprecated → `Button variant="celebrate"`                             |

## 15. What V3 deliberately rejects

- Colored shadows on ordinary cards; gradient surfaces on every card.
- Tinted page canvas; tinted cards inside tinted cards.
- 26–34pt radii on phones; every control a pill.
- Doc-copy subtitles under every screen title.
- Rainbow metadata strips (hue per stat with no semantic delta).
- FABs floating over interactive content.
- Gamified surfaces inside operational flows (Workout logging, Calorie form).
