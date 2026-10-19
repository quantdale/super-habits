# Independent audit resolution — review packet

This is the review packet for the resolution of the independent repository audit
(SH-01 … SH-21). It is written for a reviewer who has not seen the working
session. It distinguishes a **reviewable engineering result** from a **fully
qualified release**: several required gates are external and remain open. No
independent reviewer has yet accepted this work.

Read `START-HERE.md`, `audit-baseline.md`, `design.md`,
`validation-matrix.md`, `tasks.md` and `execplan.md` alongside this packet.

---

## 1. Provenance

| Key                     | Value                                                                                                                                                                                                                                 |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Audit source (baseline) | `main` @ `fb10d6ccfe66b54613c6fd22cb82da7dd7626e4f`                                                                                                                                                                                   |
| Main merge-base         | `fb10d6ccfe66b54613c6fd22cb82da7dd7626e4f`                                                                                                                                                                                            |
| Implementation base     | `92a9565b1ac8f7cdaec0abe8b00a90ec60eb7f23` (PR #80 tip; contains PR #79 `120ab19` and `main`)                                                                                                                                         |
| Branch                  | `audit/independent-audit-resolution`                                                                                                                                                                                                  |
| Worktree                | `D:/Documents/tryPython/superhabits-audit-resolution` (created fresh; the original checkout is an untouched snapshot)                                                                                                                 |
| Toolchain               | Node `v22.23.2` (from `.nvmrc`), npm `10.9.8` — the declared range. The ambient Node 24.3.0/npm 11.4.2 is out of range and was not used.                                                                                              |
| Lockfile                | `package-lock.json` md5 `b991db1e48bbf6e25fe710df53bf6453` — IDENTICAL to the base. No dependency was added, removed or upgraded.                                                                                                     |
| Campaign commits        | `1de7e64`, `634dffe`, `235dd45`, `ba4d332`, `182b066`, `41c86e7`, `0351b0b`, `f449e7f`, `280ecd5`, `558a36c`, `faefa91`, `4cf5ff8`, `074c33e`, `c4946b7`                                                                              |
| Inherited stack         | PR #79 (workout reliability, atomic routine duplication) + PR #80 (durable linked-action handoff, multi-rule recovery, historical reward reconciliation). Neither PR was merged, and this campaign granted itself no merge authority. |

**Base decision (D1).** The successor stack was coherent and unmerged, so the
documented exception was taken: work started from the PR #80 tip rather than main,
to avoid reimplementing dependent recovery fixes. Reuse is labelled
`ALREADY_FIXED_VERIFIED` and never claimed as campaign authorship.

### Verification commands used

```bash
npx tsc --noEmit                                  # 0 errors
npx eslint . --max-warnings 0                     # 0 errors, 0 warnings
node node_modules/vitest/vitest.mjs run --project unit         # 191 files / 2414 passed
node node_modules/vitest/vitest.mjs run --project integration  # 98 files / 542 passed, 2 skipped
node node_modules/vitest/vitest.mjs run --project unit --project integration  # 289 files / 2956 passed
node simulation/.build/simulation/runner/cli.js validate      # 23 scenarios, guards clean
node simulation/.build/simulation/runner/cli.js run --mode deterministic  # 23/23 passed
E2E_REUSE_SERVER=1 node node_modules/@playwright/test/cli.js test --project=chromium   # 255 passed
E2E_REUSE_SERVER=1 node node_modules/@playwright/test/cli.js test --project=journeys --project=pwa  # 86 passed
npm run e2e:shell-upgrade                         # 3/3 real two-build PWA upgrade cases
node scripts/audit-runtime-deps.mjs               # RED — 2 undocumented highs (external)
node scripts/validate-supabase-schema.mjs         # PASS (17 migration files)
node scripts/release-profile-guard.mjs            # PASS
node scripts/cloud-native-isolation.mjs           # PASS
node scripts/quarantine-register-parity.mjs       # PASS (26 gate files)
```

---

## 2. Finding dispositions

`RESOLVED_VERIFIED` = fixed in this campaign with a passing, discriminating
regression. `ALREADY_FIXED_VERIFIED` = the base already fixed it and this campaign
proved the regression discriminates. `IMPLEMENTED_NOT_CERTIFIED` = implemented and
locally tested, with a named external/qualification gate still open.
`BLOCKED_EXTERNAL` = no safe local remediation exists.

| ID    | Sev/conf    | Disposition               | What was done (and what is NOT claimed)                                                                                                                                                     |
| ----- | ----------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SH-01 | High/Conf   | RESOLVED_VERIFIED         | Imported-origin fingerprint is a precondition on **every** adoption path, re-checked inside the durable commit. Local use preserved; already-owned outbox never reassigned.                 |
| SH-02 | High/Conf   | IMPLEMENTED_NOT_CERTIFIED | Immutable generation namespace + coherent capture + CAS publication RPC. **Server atomicity, RLS isolation and cross-client races need a disposable backend.**                              |
| SH-03 | High/Conf   | RESOLVED_VERIFIED         | Per-record classification, streak earned per record, real adapter wording recognized, bounded re-probe of pre-fix verdicts.                                                                 |
| SH-04 | High/Conf   | RESOLVED_VERIFIED         | Durable `workout.pending_save` recovery state; cleared only by a committed log or explicit discard; exact-identity reconcile prevents duplicates.                                           |
| SH-05 | High/Conf   | RESOLVED_VERIFIED         | Generated `sha-<content revision>` on every export path; real two-build browser upgrade proven (installed client really updates, data survives).                                            |
| SH-06 | High/Conf   | ALREADY_FIXED_VERIFIED    | Base persists the source event in the completion transaction and drains it at startup. Campaign authored none of it.                                                                        |
| SH-07 | Medium      | RESOLVED_VERIFIED         | Backfill re-reads state inside the enqueue transaction; committed delete intents are never superseded by a stale create.                                                                    |
| SH-08 | Medium      | RESOLVED_VERIFIED         | Bounded write batches + paginated `order().range()` verification comparing the complete id set; truncation is never reported as missing data.                                               |
| SH-09 | Medium      | RESOLVED_VERIFIED         | Identity is the routine-exercise INSTANCE throughout summary, grouping, payload and history; same-name and repeated-catalog exercises stay distinct.                                        |
| SH-10 | Medium      | RESOLVED_VERIFIED         | Session identity separated from the running countdown deadline; resume recomputes it from the frozen remainder, so paused time is never focus.                                              |
| SH-11 | Medium      | RESOLVED_VERIFIED         | Recovery releases the live ACTIVE claim, not only the rendered flags, so one rejected startup no longer wedges Focus.                                                                       |
| SH-12 | Medium      | RESOLVED_VERIFIED         | One shared association contract used by every create/update/bulk/assignment entrypoint; dangling parents refused atomically.                                                                |
| SH-13 | Medium      | RESOLVED_VERIFIED         | The creation dialog's Project/Goal selections reach the data layer (edit already did).                                                                                                      |
| SH-14 | Medium      | RESOLVED_VERIFIED         | Composed single-transaction parent+rule saves for both editors, so a failed rule write cannot duplicate the parent on retry.                                                                |
| SH-15 | Medium      | ALREADY_FIXED_VERIFIED    | Base commits both reschedule legs and both intents in one transaction. Campaign authored none of it.                                                                                        |
| SH-16 | Medium      | RESOLVED_VERIFIED         | Derived quest eligibility separated from ledger-backed payment, so a quest made eligible by another action is paid exactly once.                                                            |
| SH-17 | Medium      | RESOLVED_VERIFIED         | Host replay fingerprint includes delivery identity; durable action idempotency keys unchanged.                                                                                              |
| SH-18 | Medium      | RESOLVED_VERIFIED         | Oracles must carry an executable expectation; `diagnostic` reads can never certify a mutation; failed reads surface.                                                                        |
| SH-19 | Medium      | RESOLVED_VERIFIED         | API legs call the REAL data functions through a hermetic, allowlisted, build-only bridge; shadow SQL deleted; full deterministic library green.                                             |
| SH-20 | Medium      | BLOCKED_EXTERNAL          | `braces` 3.0.3 and `node-forge` 1.4.0 are the registry latest with `first_patched_version: null`. Gate truthfully red; no waiver, allowlist edit or threshold change was made.              |
| SH-21 | Medium/Prob | IMPLEMENTED_NOT_CERTIFIED | Cloud test build is hermetic by configuration (dotenv disabled, 5 backend vars blanked, gating preflight job). **An actual authorized cloud run to inspect an artifact is still required.** |

**Tally:** 12 RESOLVED_VERIFIED (SH-01, 03, 04, 05, 07, 08, 09, 10, 11, 12, 13,
14, 16, 17, 18, 19 — 16 counting all), 2 ALREADY_FIXED_VERIFIED, 2
IMPLEMENTED_NOT_CERTIFIED, 1 BLOCKED_EXTERNAL. Every one of the 21 IDs has a
disposition backed by evidence above.

---

## 3. Regression evidence by finding

Every campaign-authored case is named `AUD-SHnn-x` in its test titles and lives in
the repository, not in a scratch script.

| ID    | Test file                                                                                      | Cases  |
| ----- | ---------------------------------------------------------------------------------------------- | ------ |
| SH-01 | `tests/integration/importedOwnershipAdoption.test.ts`                                          | 8      |
| SH-02 | `tests/integration/publishedGenerations.test.ts`                                               | 25     |
| SH-03 | `tests/outboxRetryAccounting.test.ts`                                                          | 13     |
| SH-04 | `tests/integration/workoutPendingSaveRecovery.test.ts`                                         | 9      |
| SH-05 | `tests/pwaShellRevision.test.ts` + `e2e/pwa-shell-upgrade.spec.ts`                             | 20 + 3 |
| SH-06 | `tests/integration/durableOperationBoundaries.test.ts` (reuse proof)                           | 3      |
| SH-07 | `tests/integration/backfillRaceIntegrity.test.ts`                                              | 6      |
| SH-08 | `tests/integration/syncResponseCaps.test.ts`                                                   | 12     |
| SH-09 | `tests/workoutExerciseIdentity.test.ts`                                                        | 6      |
| SH-10 | `tests/pomodoroResumedDeadline.test.ts`                                                        | 10     |
| SH-11 | `tests/pomodoroStartupClaims.test.ts`                                                          | 8      |
| SH-12 | `tests/integration/associationAuthority.test.ts`                                               | 16     |
| SH-13 | same file (creation-payload + membership reload)                                               | (4)    |
| SH-14 | `tests/integration/composedParentRuleSave.test.ts`                                             | 10     |
| SH-15 | `tests/integration/durableOperationBoundaries.test.ts` (reuse proof)                           | 4      |
| SH-16 | `tests/questPaymentIdentity.test.ts`                                                           | 6      |
| SH-17 | `tests/notificationDeliveryIdentity.test.ts`                                                   | 8      |
| SH-18 | `tests/simulation.oracleIntegrity.test.ts` + `simulation/runner/specs/oracleIntegrity.spec.ts` | 17 + 5 |
| SH-19 | oracle-integrity live spec (capture→outbox) + 23/23 deterministic scenarios                    | —      |
| SH-20 | `scripts/audit-runtime-deps.mjs` (retained red)                                                | —      |
| SH-21 | `tests/cloudNativeIsolation.test.ts`                                                           | 15     |

**Discrimination.** Each fix was verified against the audited counterexample
shape, not merely by a green test: SH-01 reproduced `anonymous_ready` +
`bindCurrentUserId = temporary_B` before the guard; SH-03 reproduced
`attempts: 5, blockedNow: true` after four transients; SH-10's suite asserts both
readings (the legacy one yields `complete-unlogged`, the fixed one `interrupted`);
SH-09 asserts the old name lookup demonstrably collapses two exercises; SH-18's
live spec proves a false oracle now FAILS the run. Two inherited fixes were
re-derived from their audited counterexamples rather than trusted.

---

## 4. Design / protocol / migration decisions

- **D3 imported ownership.** `lib/importOrigin.ts` (moved to `lib/` because the
  domain layer may not import `core/`) exposes `decideImportOriginClaim`. The
  rules: no recorded origin → unchanged local-only adoption; malformed origin →
  fail closed; matching fingerprint → allowed; temporary or unrelated account →
  refused. Enforced in the decision **and** inside the commit
  (`assertImportOriginAllowsBinding`).
- **D5 immutable generations.** Immutable content + atomic head; see §2 SH-02.
  Automatic production garbage collection is deliberately **not** implemented;
  `generatableForCleanup` exists so the eventual policy is testable.
- **D6 durable operations.** Composed saves extract transaction-aware helpers
  (`updateTodoWithinTransaction`, `applyHabitUpdateWithinTransaction`) so the
  composed and plain paths cannot drift and no nested transaction is opened.
- **D7 identity/relationships.** `features/shared/associations.ts` holds the
  association contract once; `exerciseIndex` is the durable exercise instance
  identity. Repairs are limited to what the hierarchy determines — nothing is
  guessed, and legacy free-text keeps its name snapshot.
- **D8 timer/payment/notification identity.** `runningDeadlineIso` is separate
  from `startedAtIso`; quest `paid` is separate from derived `complete`; host
  delivery identity is separate from the durable action key.
- **D9 PWA + simulation.** One post-export revision step shared by every export
  path; the data bridge is typed, allowlisted, build-flag-gated and refused by the
  release-profile guard.
- **Migrations.** One additive remote file
  (`20261018000000_add_backup_generation_protocol.sql`) and one additive local
  `app_meta` key set. **No applied migration was edited**, no production push was
  performed, and the local DB schema version stays 25.
- **Compatibility.** V1/V2, Scope-6/7 and Portable V1 readers are untouched; a
  newer generation protocol is refused explicitly rather than approximated.

**Rollback.** The generation namespace is additive and unread by old clients, so
rollback is "stop publishing generations"; the local capture key and sequence
floor can be deleted without data loss. Nothing in the campaign rewrites existing
local or remote rows.

---

## 5. Status by axis (no green composite)

| Axis                       | Status                                                                                                  |
| -------------------------- | ------------------------------------------------------------------------------------------------------- |
| Local implementation       | Complete for all 21 IDs                                                                                 |
| Deterministic verification | PASS — typecheck, lint, 2,956 Vitest, 23/23 scenarios, 255 chromium + 86 journeys/pwa + 3 shell-upgrade |
| Real backend qualification | **NOT RUN** — no disposable Supabase project authorized in this session                                 |
| Android                    | **NOT RUN** — no campaign-owned emulator available                                                      |
| iOS                        | **NOT RUN** — deferred by owner, no macOS/iOS toolchain here                                            |
| Security                   | **RED** — SH-20 unchanged, two undocumented highs with no published fix                                 |
| Deployment                 | **NOT PERFORMED** — no deploy, no production mutation                                                   |
| Release                    | **BLOCKED** — security gate red and the platform/backend gates above are open                           |

---

## 6. Failures, flakes and skips preserved

- **Planned-run failure (carried forward).** `tests/nativeAuthMock.test.ts:96` timed
  out at 5 s in the planning session's `qa:fast` and passed alone. On this base the
  full unit suite is green repeatedly, so the earlier failure is recorded as load
  sensitivity, not silently folded into a green run.
- **Pre-existing skips.** 2 integration tests and 45 Playwright tests skip; they are
  the labelled `@sync`/`@account`/`@portable`/native runtime gates, unchanged by this
  campaign.
- **Two campaign-introduced failures were fixed, not waived.** (a) 23
  `tests/integration/backupRestore.test.ts` cases failed because my SH-08 pagination
  made a hand-written fake remote incomplete — the fake was wrong, and it was
  extended to model the real `select().in().eq().order().range()` chain. (b)
  `e2e/infrastructure.spec.ts` asserted "served worker == `public/sw.js`", which
  SH-05 deliberately inverts; the invariant was rewritten to the new contract
  (generated revision present, template placeholder never served), not deleted.
- **Three deterministic scenarios failed first and were corrected.** All three were
  expectations written against the old shadow-SQL behaviour that enqueued nothing.
  With the real data path they now pin the exact `(entity, operation)` multiset —
  in one case five records rather than a row count, which is a stronger assertion.
- **Environment note.** `npx <bin>` is broken in this Windows shell (the installed
  `.bin` shim is a POSIX script node cannot parse) and exits non-zero with **no
  output**. The build and E2E commands above therefore invoke the CLI entries
  directly; `scripts/hermetic-build.mjs` and `scripts/build-dist-web.mjs` were
  hardened to do the same so a future run surfaces real errors instead of a silent
  failure.

---

## 7. Known limitations and untouched work

- **Recurrence association inheritance — SPEC_AMBIGUITY, unchanged.** Recurring
  Todo successors omit Project/Goal associations. This was reproduced, but no
  authoritative specification settles per-instance versus series inheritance, so the
  behaviour was deliberately **not** changed. It needs a separate product decision.
- **SH-20 has no safe remediation.** `braces` 3.0.3 is the registry latest and its
  advisory has `first_patched_version: null`; `node-forge` 1.4.0 is likewise the
  latest with no patch. The gate stays red by policy. Unblock condition and the
  exact resume matrix live in `openspec/changes/resolve-braces-security-blocker/final-report.md` §L.
- **SH-02's server-side proof.** The migration is written and locally reviewed, but
  transactional atomicity, RLS isolation and cross-client publication races cannot
  be certified without a disposable backend.
- **SH-21's artifact inspection.** Isolation is enforced by tracked configuration
  and gated in CI, but no artifact was built (that would incur paid cloud usage).
- **Untouched unrelated paths.** `.tmp-ios36423379932/`, `features_tsx_list.txt`, the
  preserved stash, all tags, all other worktrees and the original planning checkout
  are unmodified. No PR was created, no merge, no force-push, no history rewrite.
- **No independent acceptance.** This packet is a self-assessment by the
  implementing agent. The owner will request a separate independent review.

---

## 8. How to review

1. Read `execplan.md` (the live checkpoint) and this packet.
2. Diff against the base, not main: `git diff 92a9565..HEAD --stat`. The full
   main-to-head stack (including PR #79/#80 content this campaign inherited) is a
   separate, larger diff — do not attribute it to this campaign.
3. For each disposition in §2, open the named test file and confirm the assertion
   actually discriminates the audited counterexample.
4. Re-run the commands in §1 with the pinned toolchain.
5. Check the three external gates in §5 yourself before any release decision.
