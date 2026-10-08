# W7 Habits — rendered evidence

Status: **INSPECTED (web)**. All 46 PNGs were opened and visually reviewed:
43 after the supported-runtime `keyboard-matrix` run (33/33 PASS), followed
by six corrective recaptures (three replaced, three added). The corrective
empty/dark instrument passed 1/1. This is wave evidence, not a
pixel-regression baseline or native certification.

## Reproduce

On Node 22.23.2 / npm 10.9.4, with ambient Supabase credentials cleared:

```sh
npm run build:e2e
E2E_PORT=8083 VISUAL_AUDIT=1 VISUAL_AUDIT_OUTPUT_DIR=docs/ui-ux/v3-audit/w7 \
  npx playwright test e2e/a11y-audit-contract.spec.ts e2e/habits.spec.ts \
  e2e/habits-w7.spec.ts e2e/habits-w7-audit.spec.ts --project=chromium
```

The matrix is serial against real OPFS SQLite. Captures wait for the active
section, fonts, loaded heatmap and selected-pill destination geometry, not a
sleep. Populated scenes pin Monday 2026-08-10; empty and canonical HEAVY scenes
use their harness calendar. Older rejected/crossfade captures and the first
30/32 run are preserved in ignored `w7-review/` evidence, not represented as
approved images here. Logs/report: `.cursor/playwright-output/w7-review/`
`keyboard-matrix.log`, `keyboard-matrix-report.json`,
`keyboard-matrix-artifacts/`.

Corrective empty/dark evidence: `.cursor/playwright-output/w7-convergence/`
`empty-audit.log`, `empty-audit-report.json`, `empty-audit-artifacts/` and
`empty-after-review/`. The affected case ran with `--grep 'empty and dark phone'`
on the corrective hermetic export. All six images were inspected before
promotion; prior empty/dark images remain in `previous-empty-dark/`.

## Inspected coverage

- Populated widths **360, 390, 412, 768, 899, 900, 901, 1024, 1280, 1440**:
  same flat list and quiet groups, bounded reading column on wide screens,
  Today visible after every resize, no horizontal page overflow. 899/900/901
  verify the bottom-bar/side-rail boundary, not a second habit-grid layout.
- `390-habits-0-of-99`, dark list/detail, empty, quantitative zero/partial,
  all-complete and rest: untouched counts are muted, progress uses Habits ink,
  binary completion uses a check, quantitative add stays a button with a
  separate remove route. Rest does not imply failure.
- Light/dark empty lists retain a quiet secondary Trends entry below the
  single add action. Empty Trends opens normally, with explicit zero values,
  highest-current-streak wording and a loaded neutral heatmap; no NaN/undefined.
  The corrected boundary gate passes 3/3 without weakening those assertions.
- Lifecycle list, paused Today/Settings, disabled rest, historical list/detail
  and old-target list: state/date copy is explicit; unavailable actions are
  disabled while management remains reachable. Settings has separated delete.
- Today/Progress/Settings, history, editor/top/custom schedule/footer, filter
  sheet and phone/desktop Trends: daily analytics wall and per-row Progress
  pills are absent; reflection lives behind disclosure. Selected tabs are
  settled; loaded calendar/rate/target-vs-actual content is present and scrolls.
- Long-name, keyboard, reduced-motion and large-type browser proxy: full title
  wraps; enlarged title/metadata expands the row instead of clipping; visible
  2px focus rings. The proxy is **not** native OS largest-font proof.
- Canonical HEAVY, 120-habit history stress, loading and failed-write images:
  bounded viewport with scrolling, stable loading skeletons, precise recovery
  message with unchanged state (retry is the same check-in control).

## Measured and behavioral evidence

`w7-row-geometry.json` attached to the run: simple binary/metadata/quantitative
rows **57px**, leading action **48×48**, details at least **48px** tall. Editor
choice contracts assert **44×44** and keyboard state. Text contrast/accessible
names/inactive focus traps passed; helper contracts still fail for visible
low contrast and invisible non-inert focus traps.

`w7-heavy-timings.json`: **120 habits / 10,800 completion rows / 25 mounted**;
warm activation **543.42ms**, check-in **471.14ms**, both below the existing
**800ms** ceiling. SQL proves one completion row/count, historical target/XP
attribution, rapid binary guard versus two quantitative adds, and failed
check-in/delete rollback with successful retry. Binary Space check/undo twice
produces one XP event, not duplicate rewards.

## Closure and limits

Supports **SUR-05 / SYS-16 / SYS-12 VERIFIED-FIXED** and the Habits daily-screen
portions of SYS-01 / SYS-07 / SYS-17. See `docs/ui-ux/15-v3-defect-ledger.md`.
The editor's existing linked-action form is retained; no DB, reminder,
linked-action, sync, or reward contract is redesigned. Full QA/publication
state lives in `openspec/changes/frontend-v3-w7-habits/execplan.md`.

Android smoke/persistence qualification and native font/screen-reader checks
are not implied. Full Android certification remains W16; iOS is owner-deferred.
