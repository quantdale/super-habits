# Warm Momentum 2.1 — visual system contract

Warm Momentum 2.0 established the behavioral contract. Warm Momentum 2.1 turns
that contract into one coherent visual and interaction system implemented
throughout the actual application. A surface passes 2.1 when it is easier to
scan, faster to act on, and visually predictable — never when it merely has
more decoration.

## 1. One visual language

Every section uses the same grammar even though it keeps its accent color:

- **Surfaces** are neutral; accent colors are sparks, not paint. A section
  color may drive selection, progress, a small icon tile, or a 4px top bar —
  it never floods a whole screen.
- **Primitives** come from `core/ui/`. No feature builds a parallel card,
  chip, or button system.
- **Tokens** come from `core/theme/designTokens.ts`. Hard-coded per-component
  numbers are replaced by semantic tokens where one exists.

## 2. Spacing rhythm

| Tier                  | Token                      | Use                            |
| --------------------- | -------------------------- | ------------------------------ |
| Screen edge / gutters | `spacing.lg` (18)          | horizontal page margin         |
| Section separation    | `spacing.lg`–`spacing.xxl` | vertical rhythm between groups |
| Related controls      | `spacing.sm` (8)           | gaps inside a control row      |
| Card padding          | `spacing.lg`               | default `Card` body padding    |
| Compact metadata      | `spacing.xs` (4)           | tight label/icon gaps          |

Vertical rhythm uses `spacing.lg` at the top of a scroll surface and
`spacing.xxl` at the bottom so the last element never touches the edge.

## 3. Radius hierarchy

| Surface                     | Token                                                |
| --------------------------- | ---------------------------------------------------- |
| Small controls / icon tiles | `radius.md` (12)                                     |
| Inputs / chips / tabs       | `radius.lg` (16) or `radius.full` for pills          |
| Cards                       | `radius.lg` (16)                                     |
| Modals / sheets             | `radius.lg` (16); bottom sheets `radius.xl` (28) top |

Not everything is equally rounded. Chips and segmented controls may use
`radius.full`; cards and dialogs stop at `radius.lg`.

## 4. Typography roles

Typography keeps the existing `typography` token map. The roles:

- **Screen / hero** — page title.
- **Section** — `ScreenSection` heading.
- **Body** — default text.
- **Label / stat emphasis** — card titles and numeric emphasis.
- **Caption / metadata** — muted secondary lines (use `tokens.textMuted`).

Avoid stacking more than two font sizes inside a card row.

## 5. Elevation and borders

- Page surface is flat.
- Grouped content uses a 1px `tokens.border` and the page background, not a
  floating card.
- Actionable cards use `Card` with the default surface + subtle shadow and an
  optional accent bar.
- Modals/sheets are the only surfaces that float with strong elevation.

Do not make every section into a card stack.

## 6. Controls

- **Buttons** — `Button` primary/secondary/destructive variants; quiet text
  actions are tertiary.
- **Chips** — `PillChip` for filters and selected/unselected states. One
  treatment serves the chip family; do not invent a second chip style for
  status.
- **Touch targets** — `size.touchTargetMin` (48). Compact chips may use
  `size.touchTargetMin - 4` when the surrounding row still satisfies 48dp.
- **Selected state** — always exposed via `accessibilityState.selected` and a
  visible fill change.

## 7. States

- **Empty** explains what is absent and offers one next action; no fake
  metrics.
- **Loading** reserves space; it never shows a confident empty state.
- **Error** names the failed surface, preserves local data, and offers retry.
- **Success** confirms briefly, then returns attention to the next action.
- **Dense** keeps the primary action anchored and lets lists scroll.

## 8. One global Add

Ordinary capture goes through Add. Advanced natural-language capture goes
through **Add → Describe it → Command Center**. There is no second global
command launcher. Settings may expose the advanced entry explicitly; parser
jargon stays out of the normal Add flow.

## 9. Modal layout contract

`Modal` exposes the layout variant as `modalLayout` (`dialog` | `bottom-sheet`
| `drawer`). This avoids shadowing the `layout` design token and keeps call
sites explicit.

## 10. Verification

- `npm run validate:themes` must keep all 140 contrast checks green.
- Touch targets, labels, focus order, and reduced-motion parity are design
  gates, not afterthoughts.
- The final gate set: typecheck, lint, vitest, theme contrast, OpenSpec
  validation, impact-map validation, simulation validation, web bundle, and
  full E2E where applicable.
