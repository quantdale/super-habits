# Pop — SuperHabits design system (v2 redesign)

The app's visual language was replaced wholesale. This document is the contract
every screen must follow. Read it before touching UI.

## Identity

**Pop.** Friendly, chunky, high-contrast, and unmistakably a consumer app. The
references are Duolingo's tactile geometry, Brilliant's confident numeric
hierarchy, Mindllama/Pinkllama's soft-but-saturated surfaces. Pop is not a
dashboard: it is a companion that celebrates progress.

Rules of thumb:

1. **Rounded and fat.** Nothing below a 10pt radius. Cards 26pt. Buttons and
   chips are full pills. Touch targets ≥ 48pt.
2. **Color carries meaning.** Each section owns a hue and every surface in that
   section is tinted with it — a Habits screen is _green_, Focus is _violet_.
   Never ship a grey box where a tinted one belongs.
3. **Type does the hierarchy work.** Nunito, weight baked into the family:
   `Nunito_900Black` for heroes, `Nunito_800ExtraBold` for titles,
   `Nunito_600SemiBold` for body, `Nunito_700Bold` for labels. Big size jumps,
   short labels, no long paragraphs of chrome copy.
4. **Motion is physical.** Presses sink and spring back; values animate to their
   new state; sections cross-fade. Never animate information in a way that
   blocks the next tap, and always honour `useReducedMotion()`.
5. **One obvious next action.** Every empty state offers exactly one action;
   every screen's primary action is a chunky gradient button.

## Typography

Import `Text` from `@/core/ui/Text` — **never** from `react-native`. It maps the
role/weight onto the right Nunito family; raw RN `Text` renders in the system
font and breaks the identity.

| Role                | Use                                                     |
| ------------------- | ------------------------------------------------------- |
| `display`           | hero numbers, celebration values                        |
| `titleXl`           | screen hero title (via `PageHeader`)                    |
| `titleLg`           | card hero titles                                        |
| `titleMd`           | card and sheet titles                                   |
| `bodyLg` / `bodyMd` | reading text                                            |
| `label`             | buttons, chips, section eyebrows (uppercase + tracking) |
| `caption`           | metadata, helper text, axis labels                      |
| `metric`            | big inline numbers (timers, totals)                     |

Tones: `default`, `muted`, `accent`, `onAccent`, `inverse`, `success`, `danger`,
`warning` — use the tone prop instead of hardcoding a token color when it maps.

## Color & surfaces

Everything comes from `useAppTheme().tokens` (never hardcode hex in screens):

- `background` — canvas; `canvasTint` — ambient wash behind the hero.
- `surface`, `surfaceElevated`, `surfaceSunken` (input wells, tracks, trays).
- `border`, `borderStrong` (chunky outlines).
- `primary`, `brandGradient`, `glow` (colored shadow), `chipBackground`,
  `chipBorder`.
- `text`, `textMuted`, `iconMuted`, `onSolid` (text on saturated fills).
- status: `success*/warning*/danger*` families.
- Section hues: `useAppTheme().sectionAccents[key]` → `{ fill, text, tint }`.

Card pattern: `Card accentColor={accent}` gives a tinted fill (10%), a tinted
outline, and a colored shadow. `flat` drops the shadow for dense rows.

## Components (core/ui)

| Component           | Use                                                                                                                                                  |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Button`            | all actions. `primary` (gradient + lip), `secondary` (tinted), `ghost`, `danger`; sizes `sm/md/lg`; `icon`, `loading`, `fullWidth`.                  |
| `TactileButton`     | the same tactile treatment for bespoke CTAs (celebration).                                                                                           |
| `Card`              | every surface. `variant` `standard/header/stat`, `accentColor`, `flat`.                                                                              |
| `Screen`            | page canvas: wash, optional `hero`, safe areas, centered column on wide screens. Bottom tabs occupy ~144px, so keep Screen's default bottom padding. |
| `PageHeader`        | section hero: `eyebrow`, `title`, `subtitle`, `actions`.                                                                                             |
| `PillChip`          | filters/presets (zero-to-many selection), springs on press.                                                                                          |
| `SegmentedControl`  | exactly-one mode switch with a sliding pill.                                                                                                         |
| `StatBlock`         | compact metric tile.                                                                                                                                 |
| `EmptyStateCard`    | art + one sentence + one action (`children`).                                                                                                        |
| `SparkIllustration` | built-in SVG art, tinted by `color`.                                                                                                                 |
| `Modal`             | overlays: `dialog`, `drawer`, `bottom-sheet` (grab handle).                                                                                          |
| `TextField`         | filled, rounded, focus ring, label above.                                                                                                            |
| `SkeletonBlock`     | loading placeholder.                                                                                                                                 |

## Screen recipe

```tsx
<Screen
  scroll
  hero={<PageHeader eyebrow="TODAY" title="Good morning" subtitle="…" actions={<Button …/>} />}
>
  <Card accentColor={sectionAccents.habits.fill}>…</Card>
  <StatBlock accentColor={…} value={12} label="Day streak" />
  <EmptyStateCard accentColor={…} title="…" description="…">
    <Button label="Start" onPress={…} />
  </EmptyStateCard>
</Screen>
```

Guidelines:

- One hero per screen (never stack two big titles).
- Cards get an `accentColor`, section hue by default.
- Prefer a row of `StatBlock`s over a paragraph.
- Data viz: keep existing chart components, pass the section hue as the series
  color and `tokens.border` for gridlines.
- Keep every user-facing string and accessibility label that existed before —
  tests and QA flows depend on them; redesign presentation, not vocabulary.

## Motion

- `springs.press` for press feedback, `springs.pop` for value changes,
  `springs.enter` for entrances.
- Lists: stagger entrances by 40ms via `Animated` (no external lib).
- Respect `useReducedMotion()`: collapse durations to 0 and skip travel.

## Don'ts

- No raw `<Text>`/`<View>` grey-box layouts, no default `borderRadius: 8`.
- No `fontWeight` styling on custom families (it synthesises double-bold).
- No new dependencies. No `data-testid`. No emoji as status icons.
- No square corners, no hairline grey dividers as the primary separation —
  use spacing, tint, and radius.
