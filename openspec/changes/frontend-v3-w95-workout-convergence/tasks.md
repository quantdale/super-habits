# W9.5 — Workout save integrity, scroll convergence, campaign closure

Bounded correction of two independently verified source-level defects at the
W9 baseline plus campaign-record reconciliation. W9's redesign, engine,
persistence, sync, and backup contracts are preserved.

## 1. Save integrity (P1)

- [ ] 1.1 Reproduce the false-success path: `logWorkoutSession()` returns
      `skipped` (routine soft-deleted mid-session) and the current
      `handleFinish()` still clears the draft, shows "Workout saved", and
      surfaces no error. Preserve the reproduction evidence.
- [ ] 1.2 Propagate the data-layer skip reason through
      `LogWorkoutSessionResult` (additive `reason`; existing callers and
      tests unaffected) so the failure message names the actual cause.
- [ ] 1.3 Guard success on `status === 'applied'` AND a non-empty `logId`:
      only then clear the draft, attribute the reward to that exact log id,
      and enter the saved-outcome state.
- [ ] 1.4 On skipped/failed finish: accurate actionable message naming the
      routine-unavailable cause, no success state, no XP, no draft clear, no
      automatic navigation, entered sets/added sets/phase intact.
- [ ] 1.5 Separate the durable commit from post-commit bookkeeping: wrap
      secondary effects so a bookkeeping failure after a committed log keeps
      the truthful saved state and never invites a duplicate insert.
- [ ] 1.6 Close the draft ordering race so an in-flight draft write cannot
      resurrect a cleared draft; keep draft writes best-effort and async.

## 2. Single scroll authority (P2)

- [ ] 2.1 Reproduce the nested `<Screen scroll><Screen scroll>` structure in
      `WorkoutScreen.tsx` and record the duplicated shells.
- [ ] 2.2 Remove the inner scroll-enabled `Screen`; keep exactly one
      page-level scroll authority with unchanged section order, gutters,
      safe-area and bottom-nav clearance, disclosures, modals, and keyboard
      behavior.
- [ ] 2.3 Verify scroll/keyboard behavior at 360/390/412/768/1280 (short
      empty page, many routines, history expanded, routine form, keyboard
      focus in name/description, top-to-bottom scroll, week assignment, nav
      away and back).

## 3. Regression and rendered evidence

- [ ] 3.1 Save-integrity regressions: successful save (exactly one row, sets
      persisted, success shown, draft cleanup, XP on that row); skipped save
      (zero rows, no success, no XP, no draft clear, values preserved,
      explanation shown); inconsistent result fails closed; database
      exception recoverable; double Finish idempotent; post-commit
      bookkeeping failure does not mislead. Real-SQLite oracles where they
      are stronger evidence.
- [ ] 3.2 Rendered evidence under `docs/ui-ux/v3-audit/w9.5/`: 360 landing,
      390 populated, 390 empty, 390 routine creation, 390 history expanded,
      390 save failure, 390 save success, 390 dark, 768, 1280 — inspected,
      not merely generated. W9 captures untouched.

## 4. Campaign record reconciliation (P3)

- [ ] 4.1 Reconcile the W9 slice ExecPlan with final history: PR #65 and
      PR #66 merged, final W9 main `8cdee8e717ac36dbe4eafbc25099ac0eeeb786a4`,
      exact-head CI `38083748134`, hosted tests 2,650 passed / 3 skipped,
      audit-only red, hosted E2E/nightly skipped. Preserve historical
      validation-ledger entries.
- [ ] 4.2 Parent ExecPlan: remove the two U+000C control characters from the
      W9 checkpoint line, correct the obsolete "W9–W17 unchecked" remaining
      work, remove the duplicated W7 fragment, and represent W9.5 accurately
      with W10 next and unimplemented.
- [ ] 4.3 Parent tasks: keep W9.1–W9.3 checked, add W9.5 as a separate
      bounded correction slice, leave W10 tasks unchecked.

## 5. Validation and publication

- [ ] 5.1 Full validation ladder: `git diff --check`, typecheck, lint,
      `validate:themes`, `openspec:validate`, `agent:plan:validate:all`,
      `npm test`, workout/boundary/a11y/keyboard/theming/gamification/
      draft/linked-actions/deterministic-simulation lanes.
- [ ] 5.2 Publish through normal PR/merge workflow (no force push, no
      dependency or security-policy change), then verify exact-head hosted
      CI: all frontend gates green; the only permitted red is the same two
      pre-existing undocumented audit advisories (braces, node-forge).
- [ ] 5.3 Hand off W10 (Calories / Health) with one coherent source of truth
      for the current wave; no W10 implementation in this wave.
