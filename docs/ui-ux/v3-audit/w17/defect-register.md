# W17 — Defect register

Findings reproduced on the integrated W12–W16 source during the W17 ladder, plus
the carried residuals from earlier waves. Every entry names an owner and a
verification state; nothing here is marked fixed without evidence.

## Resolved in W17

### R-1 — `agentDocConsistency` register check never ran (TEST_BUG, fixed)

| Field                         | Value                                                                                                                                                                                                                                                                                                                                                                       |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Surface                       | `tests/agentDocConsistency.test.ts` → `docs/testing/known-gaps.md`                                                                                                                                                                                                                                                                                                          |
| Category                      | TEST_BUG (misclassified for 10 waves as `ENVIRONMENT`)                                                                                                                                                                                                                                                                                                                      |
| Severity                      | P2 — a documentation-consistency guard silently stopped guarding                                                                                                                                                                                                                                                                                                            |
| Source                        | `d04793b` (reproduced); fixed at `3aaca2a`                                                                                                                                                                                                                                                                                                                                  |
| Repro                         | `npx vitest run --project unit tests/agentDocConsistency.test.ts` → `expected 0 to be greater than 10`                                                                                                                                                                                                                                                                      |
| Root cause                    | `read()` returned file content verbatim. With `core.autocrlf=true` a Windows checkout materializes tracked text as CRLF; the parser splits on `\n` and anchors headings with `^##\s+(.+)$`, so `(.+)` captured the trailing `\r` and `$` never matched. The register section list came back empty, tripping the test's own `expect(gaps.length).toBeGreaterThan(10)` guard. |
| Proof it is not environmental | Normalizing the same bytes yields **2** matching sections (`contract gaps`, `capability gaps`) and 11/11 tests pass; the identical failure reproduced on pristine `main` because that checkout has the same CRLF materialization.                                                                                                                                           |
| Fix                           | `read()` normalizes CRLF → LF (comment explains why)                                                                                                                                                                                                                                                                                                                        |
| Regression                    | `tests/agentDocConsistency.test.ts` 11/11; full suite 2,691 passed / 2 skipped / **0 failed**; also verified under `TZ=UTC`                                                                                                                                                                                                                                                 |
| Status                        | **VERIFIED-FIXED**                                                                                                                                                                                                                                                                                                                                                          |

**Impact of this fix:** the campaign's previous "inherited residuals" list
included this as an `ENVIRONMENT` limitation that every wave from W7 onward
re-reported. It was a real test defect: an assertion that never executed its
intended check. It also removes the last known Vitest failure in the repository,
so the suite is green for the first time since W7.

### R-2 — W13 broke the command-center flow guard (TEST_BUG, fixed)

| Field      | Value                                                                                                                                                                                                                                                                                                                                  |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Surface    | `tests/maestroCommandCenterFlowGuards.test.ts`                                                                                                                                                                                                                                                                                         |
| Category   | TEST_BUG (caused by a legitimate W13 product change)                                                                                                                                                                                                                                                                                   |
| Severity   | P2 — a guard pinning the repaired native flow broke, so the flow's expected shape was no longer enforced                                                                                                                                                                                                                               |
| Source     | `d04793b` (reproduced); fixed at `3aaca2a`                                                                                                                                                                                                                                                                                             |
| Repro      | `npm test` → 2 failures in `command-center-v2 Android smoke flow`                                                                                                                                                                                                                                                                      |
| Root cause | The guard pins the Android block by exact contiguous text, including `assertVisible: 'Command input'`. W13 deliberately removed that card header (the input now leads the surface), so the flow was corrected and the guard's expectation went stale. A comment I initially placed _inside_ the block also broke the contiguous match. |
| Fix        | The guard now expects `assertVisible: 'Command'` (the current field label); the explanatory comment moved above the block                                                                                                                                                                                                              |
| Regression | Guard suite **8/8**, including its own reconstructed-defect case, which still fails as designed (non-vacuous)                                                                                                                                                                                                                          |
| Status     | **VERIFIED-FIXED**                                                                                                                                                                                                                                                                                                                     |

## Carried residuals (unchanged, correctly classified)

| ID  | Item                                                                                             | Class                     | Owner / next action                                                                                                                                                                                                                         |
| --- | ------------------------------------------------------------------------------------------------ | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C-1 | `braces` GHSA-vfj7-8cjw-p6xm (high)                                                              | Security                  | No upstream fix; see [security](#security-reconciliation)                                                                                                                                                                                   |
| C-2 | `node-forge` GHSA-86w9-cpqp-85rv (high)                                                          | Security                  | No upstream fix; see [security](#security-reconciliation)                                                                                                                                                                                   |
| C-3 | `settings-ripple` Calories-ripple step                                                           | Test / product            | Reproduced identically on the W12 baseline with all later changes stashed; **not** a W12–W17 regression. Owned by the settings-ripple journey; needs a decision on whether the Calories hero's `Goal 2,400` marker is the intended contract |
| C-4 | iOS native qualification                                                                         | External (owner-deferred) | Requires an authorized simulator or EAS-linked cloud lane                                                                                                                                                                                   |
| C-5 | Native notification-tray delivery, long-horizon recurrence, `Alert.alert`, system offline toggle | Capability gap            | Documented in `docs/testing/known-gaps.md`; unchanged                                                                                                                                                                                       |
| C-6 | AVD `Nitro_API_36` requires `-gpu host` on this host                                             | Environment               | Recorded in W16 `design.md` D16.6 and `README.md`                                                                                                                                                                                           |
| C-7 | Hosted `e2e`/`nightly` skipped behind the audit gate                                             | External CI               | Resolve C-1/C-2 or accept the local ladder as the evidence                                                                                                                                                                                  |

## Security reconciliation

**Current head:** `3aaca2a`. `node scripts/audit-runtime-deps.mjs` (the exact CI
gate) reports **2 undocumented high advisories**; the gate therefore remains red
and is **not** waived, allowlisted, or softened in this session.

| Advisory                   | Package      | Installed | Latest published | Range | Fix available | Runtime reachable?                                                                 | Ships in bundle? |
| -------------------------- | ------------ | --------- | ---------------- | ----- | ------------- | ---------------------------------------------------------------------------------- | ---------------- |
| GHSA-vfj7-8cjw-p6xm (high) | `braces`     | `3.0.3`   | `3.0.3`          | `*`   | **No**        | Build-time only: `tailwindcss → chokidar / micromatch → braces`                    | **No**           |
| GHSA-86w9-cpqp-85rv (high) | `node-forge` | `1.4.0`   | `1.4.0`          | `*`   | **No**        | Build-time only: `expo → @expo/cli → @expo/code-signing-certificates → node-forge` | **No**           |

Evidence for the exposure claim:

- Both packages are installed at their **latest published versions**, and both
  advisories carry range `*`, so no patched release exists upstream — there is
  nothing to upgrade to.
- Neither is a direct dependency (`dependencies` contains neither).
- `node-forge` does **not** appear in the web bundle or in `dist/` at all
  (0 matches for `node-forge` / `forge.pki`).
- `braces` matches in the bundle are **false positives**: a bare `braces` string
  inside a React error message and the Material Icons names `application-braces`
  / `cloud-braces`. There is no `require('braces')` and no `braces@` occurrence.

**Disposition:** leave red; document; do not weaken the gate. The prior waves
already recorded these as inherited. A safe remediation would require an
upstream release (or dropping the tooling that pulls them in, e.g. tailwind or
the Expo CLI code-signing path), neither of which is a W17-scoped change.

## Coverage gaps recorded, not scored

- PWA project and `journeys-sync` were not re-run in W17.
- Android lanes were not re-run at the W17 SHA (test/docs-only diff).
- No live Supabase/RLS round-trip was attempted.
