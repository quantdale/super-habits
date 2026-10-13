## Design — W14 whole-app integrity sweep

Authority: `docs/ui-ux/13-calm-momentum-design-system.md` (visual rules),
`docs/testing/autonomous-qa.md` (failure taxonomy),
`docs/ui-ux/15-v3-defect-ledger.md` (existing defects).
Campaign brief §3 (W14), §4 (cross-wave quality standard).
Baseline for this wave: `b1569f0` (W13) on `frontend-v3-w12-w17-integration`.

### D14.1 Convergence, not reinvention

W14 fixes reproduced defects on the integrated source. It does not reopen
W0–W13 implementation campaigns and does not change design direction. A defect
is only `VERIFIED-FIXED` with rendered confirmation plus an executable
regression where behaviour is involved.

### D14.2 Severity rules

| Class | Meaning                                                                                                                                                                               |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0    | Corrupts data, creates false success, blocks key navigation, excludes a main workflow from assistive tech, unconfirmed destructive action, security-sensitive misleading status       |
| P1    | Cannot complete a major task; clipping/overlap hides a required control; dramatic cross-screen inconsistency; genuine responsiveness cliff; broken save/retry; major contrast failure |
| P2    | Conspicuous density/hierarchy defects, duplicate facts, inconsistent row/action/disclosure, non-fatal responsiveness issue, confusing filters, dark/light mismatch                    |
| P3    | Small optical spacing/typographic alignment; deferred with owner + screenshot + justification                                                                                         |

No untriaged P0/P1 may remain at the wave exit.

### D14.3 Coverage model — risk-weighted, not a Cartesian product

| Dimension | Values                                                                                                                                               |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Surfaces  | 6 primary destinations + Quick Capture, Planning Hub (Today/Projects/Goals/Progress/Timeline), Weekly Review, Settings, Command Center, Achievements |
| Viewports | 360, 390, 412, 768, 1280 (+ 899/900 only if shell logic is touched)                                                                                  |
| Themes    | light, dark                                                                                                                                          |
| Fixtures  | FIRST_RUN, EMPTY, TYPICAL, HEAVY, LONG_TEXT, ERROR                                                                                                   |

Not every surface is captured at every viewport × theme × fixture. Each
surface class, each semantic state and each breakpoint/theme **category** is
covered, and every cell is recorded as inspected or explicitly not-run — never
implied.

### D14.4 Rendered truth over static inspection

Every claim in the W14 ledger cites a capture from this wave (or an explicit
not-run marker). Static source reading is not rendered evidence, and a passing
typecheck is not a visual result.

### D14.5 Instruments

- `e2e/visual-audit.spec.ts` stays the campaign's existing whole-app
  instrument and is re-run unchanged against the integrated build.
- `e2e/habits-w7-audit`, `pomodoro-w8*`, `workout-w9*`, `calories-w10*`,
  `planning-w11*`, `planning-w12*`, `secondary-surface-w13*` are re-run to
  detect cross-wave regressions.
- `e2e/a11y.spec.ts` and `e2e/helpers/a11yAudit.ts` stay the accessibility
  instrument.
- New W14 additions only where the current instruments cannot capture a state
  the matrix requires.
