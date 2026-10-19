## 1. Provenance

| Key                     | Value                                                                                                                                                                                                                       |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Audit source (baseline) | `main` @ `fb10d6ccfe66b54613c6fd22cb82da7dd7626e4f`                                                                                                                                                                         |
| Main merge-base         | `fb10d6ccfe66b54613c6fd22cb82da7dd7626e4f`                                                                                                                                                                                  |
| Implementation base     | `92a9565b1ac8f7cdaec0abe8b00a90ec60eb7f23` (PR #80 tip; contains PR #79 `120ab19` and `main`)                                                                                                                               |
| Branch                  | `audit/independent-audit-resolution`                                                                                                                                                                                        |
| Worktree                | `D:/Documents/tryPython/superhabits-audit-resolution` (fresh; the original checkout is untouched)                                                                                                                           |
| Toolchain               | Node `v22.23.2` (from `.nvmrc`), npm `10.9.8` - the declared range                                                                                                                                                          |
| Lockfile                | `package-lock.json` md5 `b991db1e48bbf6e25fe710df53bf6453` - IDENTICAL to the base. No dependency was added, removed or upgraded.                                                                                           |
| Inherited stack         | PR #79 (workout reliability, atomic routine duplication) + PR #80 (durable linked-action handoff, multi-rule recovery, historical reward reconciliation). Neither PR was merged, and this campaign took no merge authority. |

**Base decision (D1).** The successor stack was coherent and unmerged, so the
documented exception was taken: work started from the PR #80 tip rather than main,
to avoid reimplementing dependent recovery fixes. Reuse is labelled
`ALREADY_FIXED_VERIFIED` and never claimed as campaign authorship.

**History disclosure.** No PR was created, no merge and no force-push occurred, and
no pre-existing commit was rewritten. `git reflog` does record ONE
`commit (amend)` on an unreleased local campaign commit (`85e2661`), which replaced
an earlier attempt at the same message after shell backtick expansion mangled it.
The amended tree differs only in that commit's own content; nothing was lost. The
earlier packet claimed "no history rewrite" without this qualification and cited an
obsolete commit SHA; both are corrected.

### Verification commands, and how they had to be invoked

`npx <bin>` is broken in this Windows shell - the installed `.bin` shim is a POSIX
script node cannot parse, and `npx` exits non-zero with **no output at all**. Every
command below therefore invokes the CLI entry directly. `scripts/hermetic-build.mjs`
and `scripts/build-dist-web.mjs` were hardened to do the same so a future run
surfaces real errors instead of a silent failure.

```bash
node node_modules/typescript/bin/tsc --noEmit                                   # 0 errors
node node_modules/eslint/bin/eslint.js . --max-warnings 0                       # 0 errors, 0 warnings
node node_modules/vitest/vitest.mjs run --project unit --project integration    # 288 files / 2975 passed, 2 skipped
node scripts/qa-timezones.mjs                                                   # PASS, 5 zones / 111 tests
node simulation/.build/simulation/runner/cli.js run --mode deterministic        # 23/23 scenarios
node node_modules/@playwright/test/cli.js test --project=chromium               # 255 passed
node node_modules/@playwright/test/cli.js test --project=journeys --project=pwa # 86 passed, 45 labelled skips
E2E_SHELL_B_READY=1 ... test --project=pwa --grep "two-build shell upgrade"     # 3/3 passed
node node_modules/@playwright/test/cli.js test --project=visual                 # FAIL - 7 failed, 27 passed
node scripts/validate-supabase-schema.mjs                                       # PASS
node scripts/release-profile-guard.mjs / cloud-native-isolation.mjs             # PASS
node scripts/audit-runtime-deps.mjs                                             # RED (SH-20, external)
```

---

## 2. Finding dispositions (post-review, corrected)

**This section was rewritten after an independent review of `365bc8a` rejected the earlier completion claim.** That review found 13 reproducible defects that contradicted several `RESOLVED_VERIFIED` dispositions and the statement that only external work remained. The earlier dispositions were wrong and are not defended here. Every finding is now fixed with a regression that fails against the code the reviewer tested.

| ID    | Sev/conf    | Disposition               | Evidence                                                                                                                                                                                                                                                                                                                                          |
| ----- | ----------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SH-01 | High/Conf   | RESOLVED_VERIFIED         | Fingerprint is a precondition on every adoption path and re-checked in the commit. **Review 8** (an unreadable origin failed OPEN) fixed: a failed read now yields an UNREADABLE sentinel and refuses with `unreadable_origin`.                                                                                                                   |
| SH-02 | High/Conf   | IMPLEMENTED_NOT_CERTIFIED | Immutable generations **integrated into the production path** (**review 6**): maintenance captures, the adapter publishes chunks + head via RPC BEFORE the mutable manifest, restore reads the pinned generation. Capture persists chunks, owner and captured revisions. Server atomicity/RLS/cross-client races still need a disposable backend. |
| SH-03 | High/Conf   | RESOLVED_VERIFIED         | Per-record streaks and adapter wording. **Review 9** (accounting still entity-wide) fixed: a failed write batch acknowledges the batches that stored and reports only its own records.                                                                                                                                                            |
| SH-04 | High/Conf   | RESOLVED_VERIFIED         | Durable pending-save state. **Review 1 and 2** fixed: the durable `phaseIndex` is restored so a reopened summary re-collects every exercise, and the completion effect awaits the write before clearing the draft.                                                                                                                                |
| SH-05 | High/Conf   | RESOLVED_VERIFIED         | Generated content revision on every export path. **Review 11 and 12** fixed: the second build is a REAL second export with changed application JavaScript (asserted), and root precached icons/favicon now participate in the hash.                                                                                                               |
| SH-06 | High/Conf   | ALREADY_FIXED_VERIFIED    | Base persists the source event in the completion transaction and drains at startup. Campaign authored none of it.                                                                                                                                                                                                                                 |
| SH-07 | Medium      | RESOLVED_VERIFIED         | Backfill re-reads state inside the enqueue transaction; a committed delete intent is never superseded.                                                                                                                                                                                                                                            |
| SH-08 | Medium      | RESOLVED_VERIFIED         | Bounded batches + paginated verification of the complete id set; truncation never reported as missing.                                                                                                                                                                                                                                            |
| SH-09 | Medium      | RESOLVED_VERIFIED         | Routine-exercise INSTANCE identity through summary, grouping, payload and history.                                                                                                                                                                                                                                                                |
| SH-10 | Medium      | RESOLVED_VERIFIED         | Running deadline separated from session identity; resume recomputes from the frozen remainder.                                                                                                                                                                                                                                                    |
| SH-11 | Medium      | RESOLVED_VERIFIED         | Recovery releases the live ACTIVE claim, so one rejected startup cannot wedge Focus.                                                                                                                                                                                                                                                              |
| SH-12 | Medium      | RESOLVED_VERIFIED         | One shared association contract on every create/update/bulk entrypoint. **Review 5** (Habit creation bypassed it) fixed: both habit creation paths resolve through it.                                                                                                                                                                            |
| SH-13 | Medium      | RESOLVED_VERIFIED         | The creation dialog's Project/Goal selections reach the data layer.                                                                                                                                                                                                                                                                               |
| SH-14 | Medium      | RESOLVED_VERIFIED         | Composed single-transaction parent+rule saves. **Review 3** (the EDIT path still pre-committed `updateTodo`) fixed: the edit branch is one composed operation.                                                                                                                                                                                    |
| SH-15 | Medium      | ALREADY_FIXED_VERIFIED    | Base commits both reschedule legs and both intents in one transaction. Campaign authored none of it.                                                                                                                                                                                                                                              |
| SH-16 | Medium      | RESOLVED_VERIFIED         | Derived eligibility separated from ledger-backed payment. **Review 13** was right that the earlier pipeline test asserted nothing: the unit `expo-crypto` mock returned constant bytes, `createId` collided and rows were dropped. Fixed; the test now commits a real plan and asserts action + quest XP and exactly-once replay.                 |
| SH-17 | Medium      | RESOLVED_VERIFIED         | Fingerprint includes delivery identity. **Review 4** fixed: the code read `response.date` instead of Expo's `notification.date`, and the test manufactured the property it read; the fixture now uses Expo's real shape and 4 cases fail against the old code.                                                                                    |
| SH-18 | Medium      | RESOLVED_VERIFIED         | Oracles must carry an executable expectation. **Review 7** fixed: an `unchanged` oracle no longer discards its sibling oracles.                                                                                                                                                                                                                   |
| SH-19 | Medium      | RESOLVED_VERIFIED         | API legs use the REAL data path via a hermetic build-only bridge. **Review 10** fixed: the production export strips the bridge flag and scans the artifact, failing closed; the bridge is now scoped to `build:e2e:sim` only.                                                                                                                     |
| SH-20 | Medium      | BLOCKED_EXTERNAL          | `braces` 3.0.3 and `node-forge` 1.4.0 are registry-latest with `first_patched_version: null`. Gate truthfully red; no waiver or threshold change.                                                                                                                                                                                                 |
| SH-21 | Medium/Prob | IMPLEMENTED_NOT_CERTIFIED | Hermetic by configuration with a gating CI preflight. An authorized cloud run to inspect an artifact is still required.                                                                                                                                                                                                                           |

### What the review changed about this packet

The earlier packet claimed "no local work remains". **That was false.** The visual lane is itself proof (see §5). What remains local is the visual-regression defect; what remains external is SH-20, SH-02's server-side proof and SH-21's artifact inspection.

---

## 3. Regression evidence by finding

| ID    | Test file                                                                | Cases  |
| ----- | ------------------------------------------------------------------------ | ------ |
| SH-01 | `tests/integration/importedOwnershipAdoption.test.ts`                    | 10     |
| SH-02 | `tests/integration/publishedGenerations.test.ts`                         | 28     |
| SH-03 | `tests/outboxRetryAccounting.test.ts` + batch case in `syncResponseCaps` | 13 + 1 |
| SH-04 | `tests/integration/workoutPendingSaveRecovery.test.ts`                   | 11     |
| SH-05 | `tests/pwaShellRevision.test.ts` + `e2e/pwa-shell-upgrade.spec.ts`       | 25 + 3 |
| SH-06 | `tests/integration/durableOperationBoundaries.test.ts` (reuse proof)     | 3      |
| SH-07 | `tests/integration/backfillRaceIntegrity.test.ts`                        | 6      |
| SH-08 | `tests/integration/syncResponseCaps.test.ts`                             | 13     |
| SH-09 | `tests/workoutExerciseIdentity.test.ts`                                  | 6      |
| SH-10 | `tests/pomodoroResumedDeadline.test.ts`                                  | 10     |
| SH-11 | `tests/pomodoroStartupClaims.test.ts`                                    | 8      |
| SH-12 | `tests/integration/associationAuthority.test.ts`                         | 22     |
| SH-14 | `tests/integration/composedParentRuleSave.test.ts`                       | 10     |
| SH-15 | `tests/integration/durableOperationBoundaries.test.ts` (reuse proof)     | 4      |
| SH-16 | `tests/questPaymentIdentity.test.ts`                                     | 6      |
| SH-17 | `tests/notificationDeliveryIdentity.test.ts`                             | 8      |
| SH-18 | `tests/simulation.oracleIntegrity.test.ts` + runner live spec            | 17 + 5 |
| SH-19 | oracle-integrity live spec + 23/23 deterministic scenarios               | -      |
| SH-20 | `scripts/audit-runtime-deps.mjs` (retained red)                          | -      |
| SH-21 | `tests/cloudNativeIsolation.test.ts`                                     | 15     |

**Discrimination, honestly stated.** For each review finding the corrected test was run against a temporarily reverted implementation and observed to FAIL, then restored and observed to pass:

- **F1** - the real collectors return 1 record at cursor 0 and 3 at the finished cursor; the screen restores `pendingSave.phaseIndex`.
- **F2** - the effect is structurally asserted: awaited write in try/catch, early `return` on failure, `clearDraft()` only after.
- **F3** - the edit branch contains exactly one row write; no committed `updateTodo` precedes the composed call.
- **F4** - reverting to `response.date` fails 4 cases with the Expo-shaped fixture.
- **F5** - real SQLite probes reject dangling parents and align a Project-backed Goal.
- **F7** - an impossible `rows` expectation beside `unchanged` FAILS the run.
- **F8** - reverting the sentinel to `null` lets the guard admit an unrelated account; the decision-layer case fails.
- **F9** - reverting to entity-wide acknowledgement reports 0 acknowledged instead of 250.
- **F16** - the constant-byte `expo-crypto` mock produced duplicate ids.

Findings F6, F10, F11 and F12 are wiring/configuration properties; those assertions name the production source or artifact and are stated as such rather than claimed as behavioural proofs.

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

| Axis                       | Status                                                                                                                                     |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Local implementation       | Complete for all 21 IDs after the review round                                                                                             |
| Deterministic verification | PASS — typecheck, lint, 2975 Vitest (289 files), 23/23 deterministic scenarios, 255 chromium + 86 journeys/pwa + 3 two-build shell upgrade |
| Timezone matrix            | PASS — 5/5 zones (Asia/Manila, UTC, America/New_York, Pacific/Honolulu, Pacific/Kiritimati), 111 tests                                     |
| **Visual regression**      | **FAILING — open local defect.** 7 of 34 cases fail; root cause NOT isolated (see below). No golden was refreshed.                         |
| Real backend qualification | **NOT RUN** — no disposable Supabase project authorized in this session                                                                    |
| Android                    | **NOT RUN** — no campaign-owned emulator available                                                                                         |
| iOS                        | **NOT RUN** — deferred by owner, no macOS/iOS toolchain here                                                                               |
| Security                   | **RED** — SH-20 unchanged, two undocumented highs with no published fix                                                                    |
| Deployment                 | **NOT PERFORMED** — no deploy, no production mutation                                                                                      |
| Release                    | **BLOCKED** — security gate red, visual lane red, and the platform/backend gates above are open                                            |

### The visual lane: run, failing, and not papered over

The first version of this packet never ran the visual lane and left that implicit.
It has been run:

- `--project=visual` — **7 failed, 27 passed.**
- The base (`92a9565`) passes the same goldens 4/4; this branch fails them.
- The delta is a **stable ~194-pixel, single-channel** difference at the Today
  header icons and the bottom tab-bar labels. Both renders are visually identical;
  per-pixel channel deltas reach 120 with no layout movement — glyph
  rasterization, not a design change.
- Copying this branch's `dist/` into the base worktree reproduces the failure, and
  copying the base's `dist/` into this worktree removes it. **The difference is
  carried by this branch's built JavaScript.**

Ruled out by measurement: the simulation bridge (now scoped out of the shared
export — still fails), Tailwind's CSS output (now byte-identical to base, md5
`0e22913c…`), the `data-db-ready` ordering, the font assets (identical), and the
golden files themselves (byte-identical to base).

**Not isolated:** which source change in this branch produces the rasterization
difference.

**No golden was refreshed.** Refreshing would suppress an unexplained rendering
difference, which is the exact class of change this campaign exists to prevent.

### Remaining local work (not external gates)

1. **Isolate and fix the visual-regression delta** above. Until then the visual
   lane is red and the full `npm run e2e` aggregate cannot pass.
2. Re-run the affected suites after that fix.

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
- **Visual-regression delta — OPEN LOCAL DEFECT (not an external gate).** Seven of
  34 visual cases fail on this branch while the base passes. The cause is carried by
  this branch's built JavaScript and was **not** isolated. No golden was refreshed.
  Fixing it is remaining local work, listed in §5.
- **Untouched unrelated paths.** `.tmp-ios36423379932/`, `features_tsx_list.txt`, the
  preserved stash, all tags, all other worktrees and the original planning checkout
  are unmodified. No PR was created, no merge and no force-push occurred; no
  pre-existing commit was rewritten (see the amend disclosure in §1).
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

## 9. Second review round (after `fe725b35`)

A second independent review rejected the claim that only the visual issue
remained locally and found 10 more defects. All 10 are fixed at `2fb611fa` with
regressions. This section records what the review changed about the checkpoint —
the reviewer specifically asked that local failures be listed alongside the visual
issue and the external gates.

### Local work that was open and is now fixed (second round)

| #   | Severity | Defect                                                                                            | Fix                                                                                                                                                                                                                                                                                                                                    |
| --- | -------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | HIGH     | A second workout could overwrite an unsaved completed workout (single durable slot)               | Starting a session while a pending save is outstanding now refuses and routes to its save/recovery                                                                                                                                                                                                                                     |
| 2   | MEDIUM   | Recovery rebuilt the session from the CURRENT routine while measurements stayed positional        | Pending state snapshots the PERFORMED identity (`exerciseNames`, `routineName`) and recovery attributes by it                                                                                                                                                                                                                          |
| 3   | MEDIUM   | The Todo composed save dropped reminder reconciliation                                            | `reconcileTodoReminder` is shared and runs after BOTH the plain and composed writes                                                                                                                                                                                                                                                    |
| 4   | MEDIUM   | A failed notification dispatch recorded its replay key and cleared the response before succeeding | The key is recorded only on success; a failed dispatch stays retryable                                                                                                                                                                                                                                                                 |
| 5   | LOW      | The quest test depended on the rotating board's date                                              | Its clock is pinned to a date whose rotation includes a plan quest                                                                                                                                                                                                                                                                     |
| 6   | HIGH     | Restore mixed generations (mutable manifest + generation entities + mutable settings)             | Manifest, settings and entities all come from ONE immutable generation when one is published                                                                                                                                                                                                                                           |
| 7   | HIGH     | The SQL publication contract was broken three ways on a real PostgreSQL 17                        | `20261019000000_fix_backup_generation_publication.sql`: plain SELECT instead of the RLS-blocking `FOR UPDATE`, owner-scoped UPDATE policy + immutability trigger (retries legal, certified bytes frozen), direct head writes revoked (RPC-only advancement), SECURITY DEFINER RPC pinned to `search_path` with owner from `auth.uid()` |
| 8   | HIGH     | The adapter uploaded mutable entities before checking generation capability                       | A capability preflight runs BEFORE any mutable upload and refuses rather than destroy the only certified recovery point it cannot recreate                                                                                                                                                                                             |
| 9   | HIGH     | Partial-batch acknowledgement bypassed verification (250 "successful", 0 read-backs)              | Each batch is verified before its ids are acknowledged; the redundant whole-entity read-back is removed                                                                                                                                                                                                                                |
| 10  | MEDIUM   | The default E2E build armed the simulation bridge unconditionally                                 | Opt-in via `build:e2e:sim`; the default export carries no bridge                                                                                                                                                                                                                                                                       |

### Where this leaves the campaign

The review was correct that "only the visual issue remains locally" was wrong at
`fe725b35`. It is now the state at `2fb611fa`:

- **Local defects still open:** the visual-regression delta (§5). It is
  characterized but not isolated, and no golden was refreshed.
- **External gates:** SH-20 dependency advisories, SH-02's server-side
  certification (a disposable backend is still needed for the cross-client
  atomicity/RLS proof even though the SQL contract defects are fixed), and
  SH-21's artifact inspection.
- **Not run:** native Android/iOS lanes, real-backend qualification.

Verification at `2fb611fa`: typecheck 0 errors, lint 0/0, Vitest 288 files /
2975 passed (2 pre-existing skips). The full suite is green; the visual lane is
the single remaining local red and is recorded as such in the checkpoint and
§5 rather than folded into a green claim.
