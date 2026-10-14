## Context

See proposal.md for why this change exists. Explore ran read-only against `main` `bf09c0d50ca35a23bcc9df2582ea8398124d1038`, which matched `origin/main`. The user's main checkout also has stash `pre-recovery-local-changes` and untracked `.tmp-ios36423379932/`. Those are foreign and must stay untouched.

Planning artifacts for this change already live on branch `frontend-v3-post-w17-adversarial-correction` in worktree `D:/Documents/tryPython/superhabits-post-w17-correction`. That worktree has no `node_modules`. Implementation continues there, not in the user's main checkout.

```
published waves                         this change
W12–W17 on main bf09c0d                 isolated worktree
        │                                       │
        ▼                                       ▼
stale parent checkpoint ──────────▶ replace in place, stay ACTIVE
W17 docs call 1177ac2 "final" ────▶ split historical run vs current head
settings-ripple wants Goal 2,400 ─▶ retarget to W10 grammar + SQL oracle
settle() can return unsettled ────▶ negative control, then fail closed
```

## Goals / Non-Goals

**Goals:**

- Turn the explore dispositions below into reproduced fixes, disproofs, or explicit external blocks.
- Satisfy the four spec deltas without a Calm Momentum redesign.
- Leave one Plan-Version 2 ExecPlan whose exact next action is executable after compaction.

**Non-Goals:**

- Re-running W12–W17 as new waves, regenerating their capture sets, or mass-checking their historical `tasks.md` boxes.
- A dependency allowlist, audit-script edit, `continue-on-error`, or "security pass except audit" wording.
- Schema migration, backup-scope change, or production Supabase access.
- iOS certification from Windows, or claiming the `b50034d` APK covers later feature edits.

## Decisions

### D1 — Keep implementation in the existing worktree

The branch and worktree already exist at the baseline SHA plus these planning files. Do not create a second change slug. Do not commit or push until a coherent correction slice has its own tests. The user's main checkout is not the integration branch.

Alternative considered: write the change into the main checkout. Rejected because the campaign forbids dirtying that checkout and the foreign stash/iOS extract live there.

### D2 — Calories ripple is a test retarget unless runtime falsifies it

Source reading classifies C-3 as `TEST_BUG`, not a product miss. `CaloriesDailyHero` renders `Edit goal` (`accessibilityLabel` `Edit daily calorie goal`) and `Today · 0 of 2,400 kcal logged`. The page title is `2,400 kcal left` when today's consumed total is 0. SMALL's two calorie rows are today at 0 kcal and yesterday at 9999 kcal, so `2,400 kcal left` is the correct today title. `Goal 2,400` is journey-only (`e2e/journeys/settings-ripple.spec.ts` around the calorie step). W10 `calories-logging-first` forbids a second goal statistic.

Still run the hermetic journey before editing. If the title or SQL row does not update, fix the product path and keep the new spec. If they do, change only the stale visible assertion to the title, context line, and edit-goal accessible name. Keep the `app_meta.calorie_goal` equality check, the reload check, and the unchanged calorie-entry count.

Alternative considered: restore the string `Goal 2,400` in the hero. Rejected. It violates the shipped single-fact contract.

### D3 — Visual readiness is fail-closed only after a red negative control

`settle()` in `e2e/visual-regression.spec.ts` returns when its 4s deadline passes, treats non-finite opacity as settled, and swallows `document.fonts.load` rejections. No test forces those branches. `pointerEvents: 'none'` is tied to inactive state immediately, so a 200–240ms hit-test hole is not supported by source. `inert` is applied in a web effect after commit; that is a one-frame gap, not a confirmed product bug.

First add a harness-local negative control that stubs a stuck opaque inactive section and a rejected required font load. It must fail on the current helper. Then make `settle()` throw a named diagnostic and stop before `toHaveScreenshot`. Do not add an unbounded wait, a mask, or a non-zero `maxDiffPixels`. Do not regenerate the 30 goldens unless a real product pixel change is inspected side by side. Recompute the current golden-set hash with the repo's existing method and keep it distinct from the historical `0676368d…` W15 hash.

Alternative considered: delete the deadline loop and always screenshot. Rejected. That keeps the fail-open.

### D4 — Parent plan stays ACTIVE and its checkpoint is replaced

`openspec/changes/frontend-v3-calm-momentum/execplan.md` still says W12 has not begun and that the next action is to author W12. `tasks.md` in that change already checks W12–W17. `.agent/PLANS.md` does not allow `COMPLETED` while certification residuals remain and Progress is not fully checked. Replace the Current Checkpoint and Recovery section in place. Do not append a second current checkpoint. Historical wave notes stay under Progress and the validation ledger.

Slice `tasks.md` files for W12–W17 are still largely unchecked even where their ExecPlans say `COMPLETED`. Do not mass-edit those checkboxes and do not re-execute the tasks. The parent checkpoint must warn that slice checkbox counts are not current authority.

### D5 — Provenance is split, not rewritten

`af8eeda` changed `features/activity/*` and `features/weekly-review/*` after the Android certificate SHA `b50034d`. A test/docs-only claim is true only through `3aaca2a`, not through `1177ac2` or `bf09c0d`. W17 matrix text that calls `1177ac2` the final shipped main is false at HEAD, and its 2,691 / 2,699 / 2,700 Vitest figures must not be merged into one count.

Update present-tense sentences. Leave dated run records attached to the SHA that produced them. New evidence goes in `docs/ui-ux/v3-audit/post-w17-correction/`, not by pretending an old run happened at the correction SHA.

### D6 — Security investigation is fail-closed

`e2e` and `nightly` already `needs: quality`. The audit allowlist is path-scoped to three documented `brace-expansion` entries and does not expire. Re-run `node scripts/audit-runtime-deps.mjs`. Check whether `braces` (GHSA-vfj7-8cjw-p6xm) and `node-forge` (GHSA-86w9-cpqp-85rv) still have no patched release. A legitimate removal of the vulnerable edge is allowed only in a throwaway install if it keeps Expo and NativeWind builds green, then promoted with a full impact run. Otherwise the disposition is `UNREMEDIATED — exposure limited` or `INVESTIGATION INCOMPLETE`, and the gate stays red.

### D7 — Date keys and weekly-review siblings are probes, not blanket rewrites

Host-local calendar keys still suspected in `e2e/planning-hub.spec.ts`, `e2e/calories.spec.ts`, `e2e/calories-w10.spec.ts`, `e2e/calories-w10-audit.spec.ts`, `e2e/calories-day-navigation.spec.ts`, and `e2e/workout-w9.spec.ts`. Browser-evaluated today in `browserDate.ts`, `seedFixture`, `planning-w12`, overview, a-tuesday, three-months-in, and gym-v2 is already safe. Reproduce across a UTC/Manila midnight boundary before editing. Do not rewrite absolute `toISOString()` timestamps.

Weekly-review false-success copy is already fixed in source (`Review saved — some items need retry`). Do not redo that UI. A commitment-create failure still lacks a screen regression; a decision-update throw can skip the review save. Add a regression only for a boundary the probe shows is still wrong or untested in a way the spec now requires. Do not expand into a W12 redesign.

### D8 — One integration owner

Use read-only parallel reviewers for provenance, data integrity, UX/a11y, and test-harness lenses. One owner writes shared files: `app/index.tsx`, Playwright config, CI, package scripts, parent plan, and the post-w17 report. No second writer in the same source file.

## Risks / Trade-offs

- [Negative control is hard to inject in Playwright] → Keep the stub inside the visual spec's page evaluate. If a branch cannot be forced, record it `REPRO_PENDING` and do not claim the spec scenario passed.
- [Retargeting `settings-ripple` hides a real propagation bug] → Run the journey first and keep the SQL and reload oracles. A green text change without those oracles is not acceptance.
- [Doc reconciliation churns CI plan validation] → Edit the parent checkpoint once, then run `npm run agent:plan:validate -- --plan openspec/changes/frontend-v3-calm-momentum/execplan.md` before a broad doc sweep.
- [Android environment missing] → Record `BLOCKED_EXTERNAL` with the last legitimate SHA `b50034d` and the feature commits that invalidated it. Do not install onto an unrelated device.
- [Schema spec edit looks like a release-contract behavior change] → It only updates the current-runtime sentence from 24/25 to 25/26. Confirm `core/db/client.ts` still ends at migration 25 before archive. Do not add migration 26.

## Migration Plan

1. Install dependencies in the correction worktree. Do not mutate the main checkout.
2. Reproduce C-3 on a hermetic `npm run build:e2e` and an owned free port. Classify, then patch.
3. Add visual negative controls, then the fail-closed helper if they fail on the unfixed helper.
4. Reconcile parent checkpoint and current-status provenance in one docs slice.
5. Probe date-key, weekly-review, a11y, PWA, and audit hypotheses. Fix only confirmed defects.
6. Run affected gates, then the ladder the impact map requires. Publish one reviewable PR, or a short ordered sequence, against latest `origin/main`.
7. After merge, record the new `origin/main` SHA separately from pre-merge evidence.

Rollback is git revert of the correction PR. No data migration is involved. Goldens are not rebuilt in CI.

## Open Questions

- Whether `Nitro_API_36` is booted and credential-free provisioning is possible in this session. The spec already says not to inherit the old APK; availability does not change the approach.
- Whether a patched `braces` or `node-forge` release exists at implementation time. Re-check the registry then. Absence does not authorize a waiver.
