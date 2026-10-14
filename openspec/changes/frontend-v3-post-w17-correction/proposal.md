## Why

Frontend V3 waves W12–W17 are published on `main` at `bf09c0d`, but the living recovery authority still tells the next agent to start W12, and several current-status records attribute later evidence to earlier SHAs. One red Settings→Calories journey and a visual-capture helper that can continue after an unmet settle condition undermine the release claim. This change is the post-W17 correction, not a redesign.

## What Changes

- Reproduce the carried `settings-ripple` Calories step and align it with the shipped W10 grammar. The durable `app_meta.calorie_goal` oracle stays. Do not add a duplicate `Goal 2,400` statistic to make the old selector pass.
- Prove whether `e2e/visual-regression.spec.ts` `settle()` can accept an unsettled cross-fade or a failed font load, and fail that capture closed only if the negative control shows it. Preserve `maxDiffPixels: 0` and the current 30 goldens unless a real product pixel change is separately inspected.
- Replace the parent Calm Momentum ExecPlan checkpoint and recovery text so a zero-context agent does not restart W12–W17. Keep that parent plan `ACTIVE`: hosted security, iOS, and exact-source Android certification are still unearned.
- Reconcile present-tense W17 provenance. Historical runs stay attributed to the SHA that produced them (`1177ac2`, `b50034d`, `3aaca2a`). Do not relabel them as runs of `bf09c0d` or of a later correction SHA.
- Investigate, rather than assume, the remaining suspicion ledger: host-local calendar keys outside the fixed planning helper, weekly-review sibling failure boundaries, accessibility/PWA/native gaps, and the two inherited high advisories. Fix only reproduced defects. Do not waive, allowlist, or suppress `braces` / `node-forge`.
- Publish the correction through the normal pull-request path and leave an honest conditional verdict. No W12–W17 screen rewrite, schema migration, or production Supabase use.

## Capabilities

### New Capabilities

- `calorie-goal-settings-propagation`: a saved Settings nutrition goal reaches the mounted Calories surface in the W10 remaining/consumed-of-goal grammar and persists in `app_meta.calorie_goal`.
- `visual-capture-readiness`: curated visual capture does not compare a golden when a documented settle or font-load condition is unmet.
- `post-w17-correction-evidence`: current correction and release statements name the revision that was actually tested and do not inherit Android, iOS, hosted E2E, or security passes.

### Modified Capabilities

- `release-contract-convergence`: the current-runtime metadata requirement still mandates schema version 24 and next migration slot 25. Runtime migration 25 is already applied; the next slot is 26. Update that current statement only.

## Impact

- Tests and harnesses: `e2e/journeys/settings-ripple.spec.ts`, `e2e/visual-regression.spec.ts`, and any date-key specs a reproduction shows are host-local. No assertion is weakened to go green.
- Product UI only if a reproduction falsifies the W10 contract or finds a new P0/P1. Expected Calories copy is already `2,400 kcal left`, `Today · 0 of 2,400 kcal logged`, and `Edit goal`.
- Docs and plans: parent `openspec/changes/frontend-v3-calm-momentum/execplan.md`, `docs/ui-ux/v3-audit/w17/` current-status lines, `docs/ui-ux/v3-audit/post-w17-correction/`, and present-tense known-gap claims. Dated historical notes stay.
- Security and native: audit script and CI gate stay fail-closed. Android at `b50034d` does not cover later `features/` edits in `af8eeda`. iOS stays owner-deferred.
- No dependency, migration, backup-scope, or sync-semantic change unless a reproduced invariant requires one, which this proposal does not authorize in advance.
