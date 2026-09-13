# ExecPlan: Baseline Failure Repair V1

Plan-Version: 2
Status: COMPLETED

## Purpose / User Outcome

The full Playwright inventory was red at the previous campaign's baseline in
four places that had been hiding behind the blocked CI: one documented flake
that reproduces standalone (known-gap 16) and three journey steps (`P2`
six-section activation, `P3` settings→calorie-goal ripple, `P5` offline
writes). Each must be diagnosed to a product bug or a test bug with on-device
or in-browser evidence, repaired at the correct layer, and re-verified in the
full battery — without weakening a single assertion.

Observable success: `npx playwright test --project=chromium --project=journeys`
is green (aside from documented skips), the root cause and classification of
each failure is recorded in the plan and the known-gap register, and the
repairs are pushed.

## Context

- Baseline: `main == d86e979` (UI type campaign pushed). Baseline evidence:
  a `dist-base` export from `575c3d8` reproduced all four failures, so none
  were caused by the UI campaign.
- Failure 1 — `e2e/habits.spec.ts` "target edits keep a prior completed date
  complete" (known-gap 16, reproducible standalone): the edit DID commit
  (probe logs inside `updateHabit` show `{"changed":true}` and both rule
  entries), but the test's guard waited for `Save changes` to hide — which
  happens when the button enters its **loading** state — so the SQL oracle
  navigated away ~130ms later and aborted the in-flight OPFS transaction.
  Classification: `TEST_BUG`.
- Failure 2 — `three-months-in.spec.ts` P2 step 3: `sectionOpacity()` and
  `measureSwitch()` looked for an **inline** `style.position === 'absolute'`;
  the shell's `SectionContainer` applies `StyleSheet.absoluteFill`, which RN
  Web compiles to a CSS class, so the active section was never observed and
  the poll timed out with opacity 0. Classification: `TEST_BUG`.
- Failure 3 — `settings-ripple.spec.ts` P3 step 2: `setNumberStepper` clicked
  and typed per character; probing showed the freshly clicked input loses
  focus to `<body>` within 600ms (an async post-open re-render), so only the
  first digit landed and the save wrote the unchanged 2000. Classification:
  `TEST_BUG` (interaction realism), with the focus theft noted as a minor
  product observation.
- Failure 4 — `the-commute.spec.ts` P5 step 3: the todo completion toggle was
  clicked through a structural XPath (`../../preceding-sibling::*[1]`) that no
  longer resolves; the step hung to its 120s budget. The item exposes a
  semantic checkbox (`Mark complete: <title>`). Classification: `TEST_BUG`.
- Environment: unrelated emulator-5560 and the brain-training Metro server on
  :8081 stay untouched; E2E runs on `E2E_PORT=8095`.

## Scope

1. Diagnose each failure with in-browser evidence (probe logs, DOM state,
   focus tracking, DB rows) before editing.
2. Repair at the correct layer: test guards/selectors/helpers where the product
   is correct; product code only if a probe proves the product is wrong.
3. Re-verify: each spec individually to a stable pass, then the full
   `journeys` project, then the `chromium` project.
4. Update `docs/testing/known-gaps.md` (gap 16 resolved as `TEST_BUG`) and keep
   the register's closing evidence honest.
5. Commit and push the repairs with the evidence.

## Non-Goals

- No assertions weakened, skipped, or deleted; no blind retries or timeout
  inflation.
- No product-code change unless a probe proves one is required.
- No change to unrelated flows, journeys, or CI configuration.

## Current Checkpoint

- Current milestone: COMPLETE — chromium and journeys are both green at the
  repaired tree; register updated; closure push pending.
- Completed: four diagnoses with in-browser probes; guard/helper/selector
  repairs; per-spec verification (3/3, 7/7, 6/6, 6/6); chromium 136 passed /
  7 skipped / 0 failed; journeys 104 passed / 6 skipped / 0 failed; typecheck
  and lint clean on the changed specs.
- In progress: none.
- Important modified files: the four specs, `docs/testing/known-gaps.md`,
  this plan.
- Last successful validation: see the Validation Ledger below.
- Current failures: none in these projects (documented skips only).
- Relevant quarantines: known-gap 15 (unchanged host-load flake); 16 closed.
- Blockers: None.
- Condition required to unblock: None.
- Exact resume action after unblock: None.
- Exact next action: none for this plan. Next successor campaigns: OpenSpec
  lifecycle reconciliation; a native lane re-run after the UI type change.
- Remaining definition of done: none for this plan.

## Progress

- [x] WS1 — diagnose gap-16 (edit commit vs loading-state guard)
- [x] WS2 — diagnose and repair P2 (computed position), P3 (single fill),
      P5 (semantic checkbox)
- [x] WS3 — per-spec verification (3/3, 7/7, 6/6, 6/6)
- [x] WS4 — full journeys project 104/104 (6 documented skips)
- [x] WS5 — chromium 136 passed / 7 skipped / 0 failed; register updated

## Surprises & Discoveries

- 2026-09-13 — The gap-16 "product bug" is a test guard defect: the save
  commits correctly (`{"changed":true}` with both rule entries in a probe
  run); the guard fired on the button's loading state and the oracle aborted
  the OPFS transaction before it committed.
- 2026-09-13 — `sectionOpacity`/`measureSwitch` silently returned 0 for every
  section after the RN Web style refactor; the journey could never observe a
  completed switch.
- 2026-09-13 — The settings stepper input loses focus to `<body>` within
  ~600ms of being clicked (async re-render). Single-event `fill` is immune;
  per-character typing is not. Noted as a minor focus-theft observation, not a
  blocking product defect (unseeded apps hold focus).
- 2026-09-13 — The P5 todo toggle's structural XPath no longer resolves; the
  semantic checkbox solves it and is the stable selector.

## Decision Log

- 2026-09-13 — Classify all four as `TEST_BUG` after probes showed correct
  product behaviour (persisted rows, correct save, correct section state).
- 2026-09-13 — Keep every SQL/row oracle unchanged; only the interaction
  mechanism (guard, geometry probe, input method, selector) changes.
- 2026-09-13 — Do not "fix" the focus theft in product code: unseeded probes
  hold focus, the theft follows the drawer's async load, and a speculative
  focus-management change would exceed the evidence.

## Validation Ledger

- 2026-09-13 — baseline classification: `dist-base` (from `575c3d8`) reproduced
  gap-16, P2, P3, and P5 identically.
- 2026-09-13 — gap-16 probe (instrumented `updateHabit`): `{"changed":true}`,
  `afterWrite` shows `[08-10 target 1, 08-11 target 2]`; test passes 3/3 with
  the modal-title guard.
- 2026-09-13 — P2: `three-months-in.spec.ts` 7/7; `[J8 baseline]
maxSwitch=642/800ms (19.8% headroom)`, diarySearch 345/500ms.
- 2026-09-13 — P3: `settings-ripple.spec.ts` 6/6 with the fill-based stepper.
- 2026-09-13 — P5: `the-commute.spec.ts` 6/6 with the semantic checkbox.
- 2026-09-13 — full `--project=journeys`: 104 passed, 6 skipped, 0 failed.
- 2026-09-13 — full `--project=chromium`: 136 passed, 7 skipped, 0 failed
  (including `target edits keep a prior completed date complete`).
- 2026-09-13 — `tsc --noEmit` and `eslint` clean on the four changed specs.
- 2026-09-13 — FINAL: `npx playwright test --project=chromium` 136 passed /
  7 skipped / 0 failed and `npx playwright test --project=journeys` 104 passed /
  6 skipped / 0 failed — both lanes PASS at the repaired tree.

## Changed Files / Areas

- `e2e/habits.spec.ts` — post-save guard.
- `e2e/journeys/three-months-in.spec.ts` — `sectionOpacity`/`measureSwitch`
  computed style.
- `e2e/journeys/settings-ripple.spec.ts` — stepper helper uses one fill.
- `e2e/journeys/the-commute.spec.ts` — semantic completion checkbox.
- `docs/testing/known-gaps.md` — gap 16 closure.
- `.agent/execplans/baseline-failure-repair-v1.md` — this plan.

## Recovery / Resume Instructions

1. Read `AGENTS.md`, `.agent/PLANS.md`, this plan.
2. `git status --short`; reconcile with the checkpoint (Git wins).
3. Re-run the failing spec by name; probes/logs referenced above are removed
   from the committed specs.
4. Continue from the exact next action.

## Outcomes & Retrospective

- Status: Completed (2026-09-13).
- Summary: all four red spots in the browser inventory were `TEST_BUG`s that
  had rotted behind the blocked CI — a guard that fired on the save button's
  loading state and let the oracle abort the OPFS transaction, a journey
  helper still checking inline styles after RN Web moved to CSS classes, a
  per-character stepper interaction racing a focus-stealing re-render, and a
  structural XPath that no longer resolves. No product code changed; every
  SQL/row/geometry oracle is untouched; both Playwright projects are green.
- Proof: gap-16 3/3 standalone with the committed guard and an instrumented
  probe showing the correct commit; `three-months-in` 7/7; `settings-ripple`
  6/6; `the-commute` 6/6; full journeys 104 passed / 6 skipped / 0 failed;
  chromium 136 passed / 7 skipped / 0 failed; typecheck and lint clean.
- Follow-up: the settings stepper's post-open focus theft is a minor product
  observation (unseeded apps hold focus); consider a targeted focus fix only
  with stronger evidence. Next: OpenSpec lifecycle reconciliation and a native
  lane re-run after the type change.
