# W15 golden-baseline manifest

30 curated `toHaveScreenshot` goldens under
`e2e/__screenshots__/visual-regression.spec.ts/`.

**Capture environment.** `npm run build:e2e` artifact (hermetic, 0 Supabase
hosts), pinned Chromium from `playwright.config.ts`, `deviceScaleFactor: 1`,
`timezoneId: 'Asia/Manila'`, locale `en-US`, reduced motion emulated,
animations disabled at capture, fixed clock `2026-10-13T19:30:00` local,
`maxDiffPixels: 0`, **no masks**.

**Platform scoping (2026-10-21).** Golden filenames are `…-{win32,linux}.png`
via the `{-platform}` template token. Text rasterization is an OS
rendering-stack property (DirectWrite vs FreeType): at zero pixel tolerance a
single shared corpus cannot span Windows dev hosts and the Ubuntu CI runner.
The `win32` corpus was generated locally (Windows); the `linux` corpus was
derived from the hosted Run B actual captures
(`39545583888`, head `a70026ec`) — every one of the 31 hosted mismatches was
analyzed and classified as glyph-edge rasterization drift (ratios 0.01–0.04,
identical layout/bboxes, differing stroke weight/antialiasing on identical
letterforms), with the 32nd hosted failure being the strictness control's own
first assertion failing on the same drift. Each platform compares strictly
against its own baseline; `maxDiffPixels: 0` and the no-mask contract are
unchanged. Regenerate per platform with `npm run visual:update` on that
platform; the reviewed manifest note requirement below still applies.

**Fixture classes.** FIRST_RUN = `resetAll` only (no seed). TYPICAL / HEAVY per
`e2e/helpers/seed.ts`.

| #   | Snapshot                               | Surface        | Fixture             | Viewport | Theme | Rationale                                                |
| --- | -------------------------------------- | -------------- | ------------------- | -------- | ----- | -------------------------------------------------------- |
| 1   | `shell-today-first-run-390-light`      | Today          | FIRST_RUN           | 390×844  | light | First-run empty shell anatomy and onboarding affordances |
| 2   | `shell-today-first-run-360-light`      | Today          | FIRST_RUN           | 360×740  | light | Narrow-phone first-run reflow (no clipping)              |
| 3   | `shell-today-390-light`                | Today          | TYPICAL             | 390×844  | light | Primary phone home: hero, glance strip, plan, rewards    |
| 4   | `shell-today-390-dark`                 | Today          | TYPICAL             | 390×844  | dark  | Dark hero contrast (SYS-10) and dark surface ladder      |
| 5   | `shell-today-768-light`                | Today          | TYPICAL             | 768×1024 | light | Tablet gutter/rhythm                                     |
| 6   | `shell-today-1280-light`               | Today          | TYPICAL             | 1280×800 | light | Desktop rail + two-column glance                         |
| 7   | `todos-390-light`                      | To Do          | TYPICAL             | 390×844  | light | Flat row grammar, one summary line (SYS-05)              |
| 8   | `todos-390-dark`                       | To Do          | TYPICAL             | 390×844  | dark  | Dark rows, danger ink for overdue, checkbox contrast     |
| 9   | `todos-long-title-390-light`           | To Do          | TYPICAL + LONG_TEXT | 390×844  | light | Wrap-never-clip row growth                               |
| 10  | `todos-empty-360-light`                | To Do          | FIRST_RUN           | 360×740  | light | Empty state + one action at narrow width                 |
| 11  | `todos-heavy-1280-light`               | To Do          | HEAVY               | 1280×800 | light | Virtualized HEAVY list density                           |
| 12  | `habits-390-light`                     | Habits         | TYPICAL             | 390×844  | light | Daily check-in row anatomy                               |
| 13  | `habits-quantitative-detail-390-light` | Habits         | TYPICAL             | 390×844  | light | Quantitative habit detail + section tabs                 |
| 14  | `focus-idle-390-light`                 | Focus          | TYPICAL             | 390×844  | light | Calm idle timer screen                                   |
| 15  | `workout-landing-390-light`            | Workout        | TYPICAL             | 390×844  | light | Training-state header + quick-start rows                 |
| 16  | `calories-390-light`                   | Calories       | TYPICAL             | 390×844  | light | Logging-first day summary + macros                       |
| 17  | `calories-390-dark`                    | Calories       | TYPICAL             | 390×844  | dark  | Dark nutrition surfaces                                  |
| 18  | `quick-capture-390-light`              | Quick Capture  | TYPICAL             | 390×844  | light | Sheet anatomy: X + primary + Describe it                 |
| 19  | `settings-top-390-light`               | Settings       | TYPICAL             | 390×844  | light | W13 grouped rows + single value authority + `Details`    |
| 20  | `settings-top-1280-dark`               | Settings       | TYPICAL             | 1280×800 | dark  | Grouped settings in dark at wide width                   |
| 21  | `settings-backup-390-light`            | Settings       | TYPICAL             | 390×844  | light | Backup/restore rows and scope coverage                   |
| 22  | `command-input-390-light`              | Command Center | TYPICAL             | 390×844  | light | W13 input-first shell (no CURRENT SECTION panel)         |
| 23  | `achievements-390-light`               | Achievements   | TYPICAL             | 390×844  | light | W13 milestone-first + next target                        |
| 24  | `review-step1-390-light`               | Weekly Review  | TYPICAL             | 390×844  | light | W12 narrative-first step 1 + `All numbers`               |
| 25  | `review-step1-390-dark`                | Weekly Review  | TYPICAL             | 390×844  | dark  | W12 review in dark                                       |
| 26  | `progress-details-390-light`           | Progress       | TYPICAL             | 390×844  | light | W12 headline rows + expanded details disclosure          |
| 27  | `timeline-filters-390-light`           | Activity       | TYPICAL             | 390×844  | light | W12 flat rows + open filter disclosure                   |
| 28  | `timeline-1280-light`                  | Activity       | TYPICAL             | 1280×800 | light | Timeline at wide width                                   |
| 29  | `plan-hub-today-390-light`             | Planning Hub   | TYPICAL             | 390×844  | light | Daily plan intention-first hierarchy                     |
| 30  | `plan-hub-projects-768-light`          | Planning Hub   | TYPICAL             | 768×1024 | light | Projects list at tablet width                            |

**Masking:** none. The fixed clock makes the date heading (`TUESDAY, OCTOBER 13`),
the greeting (`Good evening`) and every week strip deterministic, so no region
needs masking and no pixel tolerance is granted.

**Explicit exclusions.** Non-Chromium renderers (documented in
`docs/testing/known-gaps.md`); native Android/iOS rendering (W16); motion-heavy
in-flight states (Focus running, active workout session) which are covered by
their behavioural specs rather than frozen screenshots.

## Baseline change log

| Date       | Snapshot(s)                                                                                                                                                                                                  | Source                                                       | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Review                                                                                                                                                                                                                                                                                                                                                                                                          |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-14 | all 30                                                                                                                                                                                                       | `c6937b5` (+W15)                                             | Initial curation (tasks 15.1)                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | All 30 captures opened and inspected; each asserts a real semantic element before capture, so none is a loading/error surface                                                                                                                                                                                                                                                                                   |
| 2026-10-14 | `todos-390-dark`, `todos-long-title-390-light`, `timeline-1280-light`                                                                                                                                        | `3f2a847` → `frontend-v3-w17-visual-closure`                 | Three reviewed updates after a real flake fix                                                                                                                                                                                                                                                                                                                                                                                                                                                 | (1) `timeline-1280-light`: the intentional W17 R-3 change (calorie rows no longer render a fabricated clock time). (2)+(3) the two To Do snapshots: the intentional W16 nav-label centring, with measured differences confined to the nav bar (116 px and 1 px). Regenerated only after fixing the section cross-fade nondeterminism documented in `README.md`; `maxDiffPixels` stays 0 and no region is masked |
| 2026-10-18 | `achievements-390-light`, `plan-hub-projects-768-light`, `settings-top-1280-dark`, `shell-today-1280-light`, `shell-today-390-dark`, `shell-today-390-light`, `shell-today-768-light`, `timeline-1280-light` | `superhabits-reliability-recovery-successor` (C1, `c3d204a`) | Reward-truth update: housekeeping now pays backdated activity across a bounded 7-day lookback (C1). Fixture days that were previously unpaid now earn XP/streak/level, so reward-derived text and unlocked-badge state differ. Attribution verified by rebuilding with only the lookback reverted (34/34 goldens pass) and restored (the same 9 fail); every other UI region is pixel-identical, and diff concentrations are reward/level text and the tab band that carries the level state. | `maxDiffPixels` stays 0; no region is masked                                                                                                                                                                                                                                                                                                                                                                    |

| 2026-10-21 | all 30 (renamed `…-win32.png`; `…-linux.png` added) | `e2e-stabilization-visual-fidelity` (hosted run `39545583888`, head `a70026ec`) | Platform-scoping corpus split: hosted 31/31 mismatches at `maxDiffPixels: 0` were glyph-edge text rasterization drift (DirectWrite vs FreeType; ratios 0.01–0.04, identical layout/bboxes). `win32` goldens are byte-identical renames of the reviewed corpus (verified: 30/30 SHA-256 match); `linux` goldens derive from the hosted actual captures after per-image classification as rasterization-only. | Strict comparison retained (`maxDiffPixels: 0`, no masks); per-platform regeneration via `npm run visual:update`; adversarial review accepted (P2 note: provenance evidence lives in the preserved hosted archives) |

Future changes append a row with the source revision and the reason.

## Independent audit resolution � explained quest XP change (2026-10-20)

The SH-16 repair pays eligible unpaid quests during historical reconciliation.
For the fixed TYPICAL fixture at 2026-10-13, the old domain implementation
produced 230 total XP (level 3, 48/233); the repaired implementation produces
275 total XP (level 3, 93/233, 140 to level 4). The 45 XP are exactly three
15-XP quests: log_meals on October 7 and 9, and move_body on October 12.
`tests/integration/questVisualFixture.test.ts` seeds the same fixture, asserts
those exact ledger rows and totals, and verifies a second pass pays nothing.
The old visual difference was misclassified as glyph rasterization: its changed
pixels are the XP text/progress behind the navigation bar, not an unexplained
font or layout change. The four populated Today goldens are regenerated for this
intended semantic correction; capture now waits for the reconciled XP text.
No pixel tolerance or mask is changed. Any other golden change must receive its
own inspected explanation; do not refresh the entire set indiscriminately.

The same proven reward correction also updates `achievements-390-light.png` and
`plan-hub-projects-768-light.png`. The original strict Playwright diff has1090
changed pixels confined to the Achievements XP ring/text/total and302 pixels
confined to the background level ring behind Projects (x93–116,y750–791).
Sub-threshold antialiasing differences elsewhere are excluded by the existing
comparator; no threshold or mask changed. Together these are six explained
baseline updates; the full strict34-case lane is rerun after regeneration.
