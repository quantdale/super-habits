# W17 — Final cross-wave integration, regression and release readiness

## Verdict

**CONDITIONAL / NEAR-COMPLETE.**

Substantial implementation and verification are finished across all six waves
(W12–W17) with every relevant web/PWA gate green — including, for the first time
in the campaign, a fully green Vitest suite (2,700 passed / 0 failed) and a
source-authenticated Android API-36 PASS. The verdict is not "release-candidate
ready" in the whole-application sense because:

1. **Two inherited dependency advisories remain** (`braces`, `node-forge`), with
   no upstream fix and the CI audit gate still red. Not waived.
2. **iOS is owner-deferred** and unclaimed.
3. **Hosted `e2e`/`nightly` have never run** since the W11.5.1 baseline; the
   evidence is the local ladder.
4. **The Android certification is at `b50034d`**, one test/docs-only commit
   behind the W17 SHA, and was not re-earned at the final revision.
5. One pre-existing red journey (`settings-ripple`) is carried (C-3).

None of these is a product/data/security regression introduced by W12–W17.

## What this wave produced

| Artifact                                           | Content                                                                                                                        |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| [`rc-manifest.md`](rc-manifest.md)                 | Exact candidate SHA, tree state, artifact identities, build commands, environment, CI status, and the candidate's known limits |
| [`verification-matrix.md`](verification-matrix.md) | The seven-lane ladder with per-lane executed/pass/fail/skip counts from each lane's own run, plus explicit not-run rows        |
| [`defect-register.md`](defect-register.md)         | Two defects resolved in W17, seven carried residuals with owners, and the full security reconciliation                         |
| [`correction-handoff.md`](correction-handoff.md)   | Prioritized bounded repair packet with a single imperative first action and acceptance gates                                   |

## Wave outcome summary

| Wave                                    | Status                         | Principal evidence                                                                                                              |
| --------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| W12 Weekly Review / Progress / Activity | Implemented, tested, published | `SUR-12` VERIFIED-FIXED; 40 inspected captures; `e2e/planning-w12.spec.ts` 5/5; `weeklyReviewW12Persistence` 3/3                |
| W13 Settings / Command / Achievements   | Implemented, tested, published | `SUR-08`, `SYS-14`, `SUR-11`, `SUR-13` VERIFIED-FIXED; 44 inspected captures; fixed a real `PillChip` a11y gap                  |
| W14 Whole-app integrity sweep           | Executed, converged            | 247 captures across 7 widths; full Chromium 245/245; found and fixed the P1 disclosure touch-target defect                      |
| W15 Persistent visual regression        | Built, stable, CI-integrated   | 30 curated goldens; two clean runs with an unchanged hash; negative sensitivity proven (perturb → 18 failures, restore → 30/30) |
| W16 Android API-36 qualification        | PASS at `b50034d`              | 23/23 flows across six lanes; exact-source APK provenance; two product defects fixed and re-verified on-device                  |
| W17 Final regression / RC               | Executed                       | Fully green suite; full ladder; security reconciliation; this handoff                                                           |

## The most significant W17 finding

W7 through W16 each recorded an `ENVIRONMENT` residual:

> Windows-CRLF `agentDocConsistency` ENVIRONMENT failure.

W17 reproduced it and proved the classification wrong. `read()` returned file
content verbatim; on a `core.autocrlf=true` Windows checkout, tracked text is
materialized with CRLF, so the register parser's `^##\s+(.+)$` never matched
(`(.+)` swallowed the `\r`) and the check compared **zero** entries against its
own `> 10` guard. It was a silently-dead assertion, not an environment problem.
Normalizing CRLF → LF in `read()` fixed it; the suite is green end-to-end, and a
second guard broken by W13's legitimate change was repaired. Both are recorded
as `TEST_BUG` with the misclassification preserved in the register so the
history is not rewritten.

## Verification summary (source `af8eeda`)

| Lane                                                         | Result                                          |
| ------------------------------------------------------------ | ----------------------------------------------- |
| Typecheck / lint / themes / OpenSpec / plans / profile guard | 0 errors · 140/140 · 86/86 · all PASS · 3/3     |
| Vitest unit + integration                                    | **2,691 passed / 2 skipped / 0 failed**         |
| Integration project                                          | 419 passed / 2 skipped                          |
| Timezones (5 zones)                                          | 105 passed                                      |
| P0 journeys                                                  | 25/25                                           |
| Full Chromium battery                                        | **245/245** in 23.8m                            |
| W15 visual goldens                                           | 30/30 (hash `0676368d…`)                        |
| Accessibility                                                | 10/10                                           |
| Deterministic simulation                                     | 1/1 scenario, 24 steps                          |
| Android API-36 (at `b50034d`)                                | 23/23 flows                                     |
| Dependency audit                                             | **FAIL — 2 inherited advisories, unremediated** |

## Cross-wave integration checks

- W12 and W13 render on one build: their audit instruments both run green there,
  and the W14 matrix confirms both grammars co-exist.
- All 23 Android flows were corrected against the _current_ W12–W15 labels, which
  is direct evidence that the waves' product changes are what the native layer
  sees.
- The migration/schema story is unchanged: no migration was added in W12–W17.

## Preserved invariants

- No `core/db`, `core/sync`, `core/backup` or `core/portable` semantics change in
  W12–W17; the only product-source edits were presentational (`app/index.tsx`
  nav label width, `features/workout/WorkoutScreen.tsx` a11y label, plus the W12
  and W13 surface rebuilds).
- No schema, migration, dependency or security-policy change.
- No production Supabase mutation. Both the web export and the APK are
  credential-free (0 remote hosts).
- The preserved foreign evidence `.tmp-ios36423379932/` and the pre-existing
  stash were never touched.

## Residuals

See [`defect-register.md`](defect-register.md) § "Carried residuals" (C-1 … C-7)
and [`correction-handoff.md`](correction-handoff.md) for the bounded repair list.

## Campaign conclusion

The engineering campaign is **operationally complete**: six waves implemented,
integrated, evidenced and published on the campaign branch, with a truthful
assessment and a precise next-session packet. Full-application release
certification stays open in the parent Frontend V3 plan, for the reasons listed
in the verdict.
