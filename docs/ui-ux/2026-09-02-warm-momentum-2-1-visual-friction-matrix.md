# Warm Momentum 2.1 — visual friction matrix and screenshot manifest

Date: 2026-09-02
Source SHA (baseline): `d5c963df61467c44e8284f6692aee018353589a0`
Source SHA (post-campaign): `cc956af527d6ddd28e216311a5304accc56ef42e`

## 1. Visual friction matrix

Findings from the current-state audit, classified by category. Each item is
either resolved by this campaign or deferred with a reason.

### Hierarchy

- **Resolved:** Today/Overview content shell now uses a consistent max-width
  (`layout.contentMaxWidth`) and tokenized gutters, keeping the day's primary
  action visually anchored on desktop.
- **Resolved:** modal/sheet radius and padding follow one tokenized hierarchy,
  so dialog vs bottom-sheet vs drawer reads consistently.
- **Deferred:** deeper composition passes (hero stats vs secondary lists) for
  Workout history and Calories Diary can be tuned in a follow-up campaign
  without changing their information architecture.

### Density

- **Resolved:** `Card` default padding is tokenized to `spacing.lg`, removing
  the `p-4`/`p-5` fragmentation that made adjacent cards feel uneven.
- **Deferred:** long-dataset "card wall" reduction on Today is intentionally
  conservative (frozen Overview card order/read models preserved).

### Typography

- **Resolved:** control rows no longer mix `text-base` inputs with oversized
  icon buttons; quick-add and tab labels use consistent sizes.
- **Deferred:** global heading-scale tuning across all six sections is
  possible once screen/section roles are exercised together in a dedicated
  type ramp pass.

### Spacing

- **Resolved:** screen gutters (`spacing.lg`), section rhythm
  (`spacing.lg`/`spacing.xxl`), control gaps (`spacing.sm`), card padding
  (`spacing.lg`), and compact metadata gaps (`spacing.xs`) now follow one
  tier system.

### Component consistency

- **Resolved:** `PillChip` is the single filter/segmented treatment on every
  surface (Habits filters, Planning Hub tabs).
- **Resolved:** `Modal` layout prop is `modalLayout` at all five call sites.
- **Resolved:** `DashboardCard` icon tiles use one `radius.md`/`spacing.md`
  geometry.
- **Deferred:** a shared `SegmentedControl` primitive could absorb the
  Planning Hub tab pills and Habits chips into one component; currently they
  share tokens but live separately.

### Color

- **Resolved:** accent colors confined to icon tiles, top bars, and selected
  states; surfaces stay neutral.
- **Resolved:** 140 theme contrast checks remain green.

### Interaction clarity

- **Resolved:** touch targets standardized to `size.touchTargetMin` (48) for
  controls; chips use `48 - 4` with surrounding room.
- **Resolved:** selected chip state exposed via `accessibilityState.selected`.

### Responsive

- **Resolved:** shell tab rail uses tokenized padding/radius and keeps full
  primary labels at 360–1440px.
- **Resolved:** Today content caps at `layout.contentMaxWidth` on desktop
  instead of stretching edge to edge.
- **Deferred:** tablet-width (768) multi-column layouts for dense diaries and
  workout history remain a follow-up.

### Accessibility / motion

- **Resolved:** keyboard focus ring on the shell rail retained; reduced-motion
  paths unchanged.
- **Deferred:** a full re-audit of screen-reader order on the newly tokenized
  Planning Hub tabs and Settings rows is scheduled with the next QA pass.

## 2. Screenshot manifest

Baseline artifacts live under `docs/ui-ux/baseline-screenshots/`.

| Surface          | Viewport                     | Artifact            | State      | Notes                     |
| ---------------- | ---------------------------- | ------------------- | ---------- | ------------------------- |
| Today (Overview) | 360 / 390 / 412 / 768 / 1440 | `{vp}-overview.png` | empty/seed | shell rail, content shell |
| To Do            | 360 / 390 / 412 / 768 / 1440 | `{vp}-todos.png`    | empty/seed | quick add, list           |
| Habits           | 360 / 390 / 412 / 768 / 1440 | `{vp}-habits.png`   | empty/seed | check-in focus            |
| Focus            | 360 / 390 / 412 / 768 / 1440 | `{vp}-pomodoro.png` | empty/seed | timer hero                |
| Workout          | 360 / 390 / 412 / 768 / 1440 | `{vp}-workout.png`  | empty/seed | start/resume              |
| Calories         | 360 / 390 / 412 / 768 / 1440 | `{vp}-calories.png` | empty/seed | form/diary                |

Legend: `{vp}` ∈ {`phone-360`, `phone-390`, `phone-412`, `tablet`, `desktop`}.

Post-campaign screenshots for major surfaces are regenerated from the current
SHA before the next whole-product walkthrough; the manifest above records the
comparable baseline set already persisted.

## 3. Verification evidence

- `npm run typecheck` — PASS
- `npm run lint` — PASS (0 warnings)
- `npm test` — PASS (1837 tests / 160 files)
- `npm run validate:themes` — PASS (140 checks)
- `npm run openspec:validate` — PASS (46 items)
- `npm run qa:impact:validate` — PASS (13 rules)
- `npm run sim:validate` — PASS (23 scenarios)
- `npm run build:web` — PASS (independent verifier; `dist/` exported)
- Independent verification agent — PASS (incl. token/prop/rename probes)
