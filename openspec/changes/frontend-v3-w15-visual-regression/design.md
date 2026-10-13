## Design — W15 persistent visual regression system

Authority: `openspec/changes/frontend-v3-calm-momentum/design.md` D5,
`docs/ui-ux/13-calm-momentum-design-system.md`,
`docs/testing/autonomous-qa.md`,
`playwright.config.ts`, `e2e/helpers/{seed,reset,clock,browserDate}.ts`.
Baseline: `c6937b5` (W14) on `frontend-v3-w12-w17-integration`.

### D15.1 Curated, risk-weighted coverage

~25–45 intentional baselines covering every distinct UI anatomy, not a
Cartesian product of 400 fragile images. Selection is by _anatomy class_:

| Class                | Snapshots                                                                                           |
| -------------------- | --------------------------------------------------------------------------------------------------- |
| Global shell         | Today first-run + populated, dark Today, 768 Today, 1280 Today (rail)                               |
| Primary destinations | To Do typical + long-title + completed, Habits, Focus idle, Workout landing, Calories day           |
| Lists/states         | To Do HEAVY, Habits quantitative, one empty state, one error/retry state                            |
| Secondary W12        | Weekly Review step 1, Progress headlines + disclosure, Activity rows + filters                      |
| Secondary W13        | Settings top (grouped rows + Details), Settings backup, Command input-first, Achievements milestone |
| Overlays             | Quick Capture sheet, one modal at 768                                                               |
| Themes               | A dark counterpart for Today, Settings, To Do and one secondary surface                             |

### D15.2 Determinism engineering

1. **Hermetic build.** `npm run build:e2e` only; the Supabase leak guard must
   report 0 hosts. Baselines are generated from that artifact.
2. **Fresh state per snapshot.** `resetAll` (OPFS + AsyncStorage + SW caches)
   then `seedFixture`, so no state leaks between cases.
3. **Stable clock.** `installClock(page, FIXED_LOCAL_TIME)` before the first
   app render (the helper's documented contract), so day labels, the greeting
   and week strips are constant. Day-specific seeds use `browserDate.ts`.
4. **Font readiness.** `await page.evaluate(() => document.fonts.ready)` plus a
   bounded settle, never an arbitrary long sleep.
5. **Motion.** Reduced motion emulated (`reducedMotion: 'reduce'`) _and_
   screenshots taken with `animations: 'disabled'`, so entrance springs and
   cross-fades cannot race the capture. Functional specs still run with real
   motion, so freezing motion here hides no product defect.
6. **Fixed viewport + scale.** Each snapshot sets its viewport explicitly and
   the project pins `deviceScaleFactor: 1`.
7. **No network.** No route beyond the local DB harness; no external images.
8. **State assertions before each snapshot.** Every capture asserts a real
   semantic element (heading/label/count) first, so a screenshot of an error
   page or a still-loading surface fails instead of becoming a baseline.
9. **Masking.** Only the current-time greeting and the date-derived header are
   masked (both are clock/locale facts, not product layout), each with a
   manifest reason. No title, count, alignment or section is masked.
10. **Failure artifacts.** Playwright's default
    `*-expected.png` / `*-actual.png` / `*-diff.png` are retained under the
    configured output directory alongside the report.

### D15.3 Baseline review process

A baseline change is a controlled edit:

1. Generate with the dedicated script (`npm run visual:update`), never in CI.
2. Open previous, proposed and diff images side by side.
3. Explain the intentional design change and cite the source SHA.
4. Reject unexplained shifts; commit approved updates separately where possible.
5. Record the change in `docs/ui-ux/v3-audit/w15/golden-manifest.md`.

Thresholds are never widened to absorb platform noise. This repository's
supported capture environment is the pinned Chromium served by
`scripts/serve-e2e.js`; a different OS/browser renderer is documented as an
exclusion in `docs/testing/known-gaps.md` rather than normalised away.

### D15.4 Stability and sensitivity proof

- Run the full curated suite on one clean build → record artifacts.
- Tear down browser contexts and run a **second independent fresh-state
  repetition** on the exact same SHA; both must pass unchanged baselines.
- Run one representative snapshot under a different worker order.
- Negative sensitivity: temporarily perturb a controlled style in an isolated
  working tree, prove at least one baseline fails, then restore fully.

### D15.5 CI integration

Register a `visual` project and a `visual-regression` step in the existing
`e2e` job shape without changing what already gates a PR (the inherited
dependency-audit red is not bypassed and not weakened). The step must not be
able to silently skip: it runs the spec file explicitly.
