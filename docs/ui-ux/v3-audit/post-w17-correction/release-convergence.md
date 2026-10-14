# Post-W17 correction — release convergence and verdict

Change: `frontend-v3-post-w17-correction`
Revision: branch `frontend-v3-post-w17-adversarial-correction` (app source at
`52a10d0`, native flow fix `eb718ca` is YAML-only)
Baseline: `bf09c0d50ca35a23bcc9df2582ea8398124d1038`

## Verdict (spec `post-w17-correction-evidence`)

**CONDITIONAL / NEAR-COMPLETE.**

In-scope reproduced defects are fixed or disproven (C-3 retargeted green,
visual capture fail-closed, H08 date keys reproduced and fixed, native
`TEST_BUG` flow fixed), and two required lanes remain externally unresolved:

1. **Dependency audit — FAILED, UNREMEDIATED (exposure limited).**
   `node scripts/audit-runtime-deps.mjs` still reports the two inherited
   undocumented HIGH advisories (`braces` GHSA-vfj7-8cjw-p6xm,
   `node-forge` GHSA-86w9-cpqp-85rv). Both packages are at their latest
   published versions with advisory range `*`, so no upstream or
   dependency-graph fix exists. Nothing waived, allowlisted, or softened.
   Hosted `e2e`/`nightly` skip behind this gate at every revision and are
   recorded as **not run**, never passed.
2. **iOS — NOT RUN** at every revision, including this one. No simulator/cloud
   lane was authorized; no iOS claim is made.

Revision limits of each lane in this verdict:

| Lane                                              | State                                                         | Revision limit                                                                                                |
| ------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Web unit + integration                            | PASS (2,700 / 2,702 executed, 0 failed)                       | produced on the tree committed as `52a10d0` (product unchanged through `78adfb3`)                             |
| Web journeys (settings-ripple 6/6, P0 25/25)      | PASS                                                          | settings-ripple fixed at `2c1fe99`, re-run green at `52a10d0`; P0 at `52a10d0`                                |
| Visual goldens + readiness self-checks (34/34 ×2) | PASS                                                          | goldens at `b0d5d0c`; strengthened self-checks 4/4 at `95d5b23`; golden set `f19261d5…`                       |
| Timezones (111, 5 zones)                          | PASS                                                          | `52a10d0`                                                                                                     |
| Date-key boundary + control (41/41 ×2)            | PASS                                                          | fixed at `76f0fa6`; `calories-w10-audit.spec.ts` date key fixed at `95d5b23`                                  |
| Android native (23/23, six tags)                  | PASS at exact source with two recorded `FLAKY_TEST` incidents | APK source `52a10d0` = this revision's app source (covers `af8eeda`; the `b50034d` APK covers `b50034d` only) |
| Dependency audit                                  | **FAILED — UNREMEDIATED**                                     | re-run at `52a10d0` tree                                                                                      |
| iOS                                               | **NOT RUN**                                                   | none                                                                                                          |
| Hosted `e2e` / `nightly`                          | **NOT RUN** (skip behind the audit gate)                      | none since W11.5.1 baseline                                                                                   |
| `e2e:sync` (dist-sync lane)                       | **NOT RUN** in this change (nightly-class; report-only lane)  | none                                                                                                          |

Because the security gate is failed and iOS is not run, this verdict is
deliberately **not** "release-ready" (spec: the correction SHALL NOT use
release-ready while a required security, iOS, or exact-source Android gate
remains failed, skipped, or not run).

## Release-contract convergence (spec `release-contract-convergence`)

Current-runtime metadata was audited against source at this revision:

| Statement                       | Value                                       | Verified in                                                                                                              |
| ------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Local schema version            | **25**                                      | `core/db/client.ts` migration chain ends at `if (version < 25)`; `tests/agentDocConsistency.test.ts` derives and pins it |
| Next append-only migration slot | **26** (`if (version < 26)`)                | same; no migration 26 was added by this change                                                                           |
| Backup scope                    | **7** (frozen Scope-6 compatibility intact) | `core/backup/` unchanged by this change                                                                                  |
| Backup schema version           | 2 (independently versioned)                 | unchanged                                                                                                                |

Current-runtime statements in commonly-read documentation (AGENTS.md,
`docs/PROJECT_STRUCTURE_MAP.md`, `docs/master-context.md`, knowledge base,
`.github/copilot-instructions.md`) already read schema 25 / next 26 and are
consistent; the OpenSpec `release-contract-convergence` delta in this change
updates the requirement sentence from 24/25 to **25/26** accordingly.
Historical pre-migration-25 notes stay dated and historical — none were
rewritten.

## Inherited-campaign closure state

- **Android status convergence.** The W17 document annotations correctly say
  that only `b50034d` was Android-certified for the revisions up to `bf09c0d`
  — the `b50034d` APK does not cover `af8eeda`'s feature edits. That is
  superseded for this branch by the correction's own exact-source
  qualification: the APK built at `52a10d0` covers `af8eeda` and the app source
  through `95d5b23` (no `features/`, `app/`, `core/`, or `lib/` change after
  `52a10d0`; 23/23 flows). Revisions between `b50034d` and `52a10d0` never had
  their own APK.

- **Recovery does not restart finished waves** (spec scenario): the parent
  Calm Momentum plan's Current Checkpoint/Recovery were replaced in place; its
  Exact next action points at this correction, never at authoring W12–W17; the
  plan remains `ACTIVE` because hosted security, iOS, and (until this
  change's run) exact-source Android were unearned. With Android now
  re-earned at exact source, the parent's remaining unearned lanes are the
  audit and iOS.
- **Provenance discipline** (spec scenario): every current statement in the
  W17 documents names its revision; historical runs (`1177ac2`, `3aaca2a`,
  `b50034d`, hosted CI run ids, W15 golden hashes) keep their original
  attributions and none were reused as passes for a later revision.

## What would make this release-ready

1. An upstream or dependency-graph fix that removes both HIGH advisories with
   zero undocumented findings from `node scripts/audit-runtime-deps.mjs` (no
   waiver), then hosted `e2e`/`nightly` re-enabled and green.
2. An exact-source iOS run (`npm run qa:native:ios` on an authorized
   simulator, or the EAS cloud workflow) recorded at the release revision.
3. A stable-host re-run of the native persistence lane (the two `FLAKY_TEST`
   flows already pass in full-lane runs; the flake record stays visible).
