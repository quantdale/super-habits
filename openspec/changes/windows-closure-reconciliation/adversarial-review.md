# Adversarial review — Windows closure campaign

OpenSpec change `windows-closure-reconciliation`, tasks 4.1–4.12 (canonical task `6.1`).
Prepared: 2026-10-01. Reviewer: repository-native session (direct execution, no delegation).

## Method and evidence discipline

Every surface below was reviewed against the **current** source at the campaign
baseline (`210afd3` plus this campaign's committed changes), with executing
coverage run where it exists. The review is deliberately not a repeat of the
historical repository audit: it looks for certification-critical defects,
false-green paths, and claims that contradict source.

Rules applied:

- A finding needs direct evidence (a file/line, an artifact, or a command
  result), not an impression.
- Stale documentation is distinguished from an executable defect. Prose that
  contradicts the repository is corrected; prose that does not is left alone.
- **Live production facts are not inferred from repository tests.** The
  production catalog, RLS policies, and recovery inventory remain explicitly
  credential-blocked; nothing here promotes them to verified.
- Nothing is called a pass from a skipped, cancelled, or retried-only run.
- Raw evidence from earlier campaigns (including the Android machine label
  `PRODUCT_BUG`) is preserved unedited.

## Findings

| ID   | Surface           | Severity                     | Classification                                                                   | Disposition                                                                                                                                                                                           |
| ---- | ----------------- | ---------------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AR-1 | J. Documentation  | Medium                       | Documentation defect (no runtime effect)                                         | **FIXED** — the false ignore claim is corrected in `final-certification-closure/closure-report.md` and removed from its ExecPlan checkpoint; the successor preflight records the true untracked state |
| AR-2 | E. Native release | High (blocked qualification) | `TEST_BUG` — stale flow step against the intentional default-off render boundary | **FIXED and device-verified** — platform-scoped flow repair + non-vacuous regression guard; smoke 2/2 on the current-source hermetic APK                                                              |

No executable product defect was found in surfaces A–D, F–I. Four candidate
concerns were investigated and **withdrawn after evidence review** (recorded in
"Withdrawn candidates" so the same ground is not re-covered as if unresolved).

## A. Recovery and restore integrity

**Checked:** `core/backup/backupRestore.ts` (fetch → validate → integrity → graph
→ settings → transactional import), `core/backup/backupValidators.ts`,
`core/backup/backupCheckpoint.ts`, `lib/checksum.ts`.

Direct evidence:

- Every remote row is runtime-validated before import; a single malformed row
  returns `status: 'invalid'`, `reason: 'validation_failed'` with up to 50
  diagnostics, and no local write (`backupRestore.ts` validation loop).
- Counts **and** SHA-256 checksums are recomputed per entity against the
  manifest and compared before any write; mismatch returns
  `reason: 'integrity_mismatch'` (`backupRestore.ts`, `checksumRows`).
- The dependency graph is validated (`validateBackupGraph`) before writes.
- Settings are certified separately: version agreement across row/manifest/
  metadata (current version plus frozen historical V2/V3/V4), runtime payload
  validation, and canonical checksum equality.
- The emptiness guard and owner binding are re-checked **inside** the import
  transaction; local data appearing mid-restore aborts with `local_data_present`
  and an explicitly unchanged device.
- A manifest fetch that merely _looks_ like a missing V2 table is not downgraded
  to the legacy 3-entity path without a second probe; "unknown" always fails
  closed instead of promising a smaller dataset.
- `lib/checksum.ts` documents and tests deterministic canonicalization
  (`undefined`→`null`, fixed column order, rows sorted by `id`, UTF-8 SHA-256
  verified against NIST vectors).
- Executing coverage (fresh, this review): `tests/integration/backupRestore.test.ts`
  fault-injection matrix — corrupt manifest, future schema version, unrecognized
  scope, duplicate ids, owner mismatch, remote disabled — plus
  `tests/backupManifest.test.ts`, `tests/backupValidators.test.ts`,
  `tests/integration/backupPushOwnerStamping.test.ts`: **63 tests passed**.

**Verdict:** no defect. Numeric precision is a **known, separate** gate: values
already rounded by remote `REAL` are not repaired by the type migration, and
recapture requires a source device (residual R4).

## B. Ownership and isolation

**Checked:** `core/auth/accountCoordinator.ts`, `core/auth/account.data.ts`,
`core/backup/backupSettings.ts`, the remote adapter's RLS assumptions, and the
account/ownership suites.

Direct evidence:

- `isDeviceEmptyForRestore` is the single definition of "empty" for both V1 and
  V2 paths: no user data in any user-owned table (active **or** deleted) and no
  pending, unowned, or foreign-owned outbox work.
- Restore refuses when the local dataset binding names a different owner
  (`owner_mismatch`), and re-verifies the auth uid immediately before the import
  transaction.
- `getRemoteFingerprint` records the owners actually present on the remote
  (bounded 20-row probe across three entities) as independent evidence rather
  than restating counts, so the `remote_foreign_owner` branch is reachable by
  construction; a missing remote table is treated as provably empty with a
  recorded diagnostic, while every other error rethrows.
- Local owner binding (`app_meta.account.owner_user_id`) mirrors the documented
  invariant: a session loss or wrong-account Auth state pauses remote work
  instead of silently rebinding local data.
- Executing coverage: `tests/supabaseOwnership.test.ts` (5), `tests/account.*`
  and `tests/integration/account*` (run in the full unit/integration gates),
  and the restore owner-mismatch fault case above.

**Limitation, stated:** live RLS policy behaviour cannot be asserted from this
host. The review verifies the repository-side contract (owner-scoped queries,
ownership stamping, fail-closed branches) and leaves the live assertion in
residual R2. Repository fixtures are **not** treated as live proof.

## C. Migration chain and schema mirror

**Checked:** `core/db/client.ts`, `core/db/schema.sql`,
`supabase/migrations/`, `tests/migrationChainIntegrity.test.ts`.

Direct evidence:

- Migration blocks are strictly `if (version < N)` for N = 2…25, with the
  bootstrap DDL defining version 1. A programmatic enumeration found 24 blocks,
  the single "missing" number 1 explained by the bootstrap; **no gap and no
  duplicate**.
- `tests/migrationChainIntegrity.test.ts` (6/6 passed) covers: an unreadable
  stored version with data present fails loudly, the block-6 sort-order backfill
  guard, the asserted maximum version, append-only/gated block shape, a real
  corrupted-version database (fails instead of re-running), and the snapshot's
  declared version matching the chain.
- `core/db/schema.sql` is a header-declared partial reference snapshot (18
  `CREATE TABLE` vs the runtime's 31); the header states it may lag and that
  `client.ts` is authoritative. Drift is therefore documented, not a hidden
  divergence.
- Remote set: 16 files under `supabase/migrations/`, ending with the documented
  four-file contract in filename order (`20260824010000`, `20260824020000`,
  `20260925125655`, `20260930000000`) — verified against the directory listing.
  No fifth migration exists at this baseline.
- `npm run supabase:schema:validate` → **PASS** (16 migration files; 4
  owner-scoped sync tables; 14 owner-scoped backup tables; Scope-V5/V6/7 closure;
  private AI quota RPC).

**Verdict:** no defect. Production DDL remains stopped (residual R3).

## D. Sync outbox and completeness checkpoint

**Checked:** `core/sync/sync.engine.ts`, `core/sync/supabase.adapter.ts`,
`core/backup/backupCheckpoint.ts`.

Direct evidence:

- Flush snapshots the queue, restores the snapshot on adapter failure, and keeps
  a _newer_ record enqueued during the await instead of stacking a duplicate.
- Failures are classified per record; a durable attempt ledger persists across
  restarts so a terminal verdict survives a crash; terminal records are removed
  from the retry queue (not requeued) and surfaced through
  `blockedEntities`/backup status.
- Partial-failure pushes persist removal only for the records that actually
  succeeded.
- Post-push **read-back** exists in the adapter (`select('id')` after upsert)
  with an explicit error when the read-back fails, so a local "pushed" verdict
  cannot be recorded for a row the remote never stored.
- The checkpoint's `durableOutboxCount` excludes terminally blocked keys, and
  `computeEntityMetadata` omits blocked entities from the certified snapshot so
  the manifest never certifies rows the remote cannot hold; the omission is
  disclosed (`missingEntities`).
- Executing coverage: `tests/integration/syncPushVerification.test.ts` **3/3
  passed** (read-back contract), `tests/sync.engine.test.ts`,
  `tests/integration/syncOutbox*.test.ts`, `tests/backupInventoryCoherence.test.ts`
  (5/5 passed).

**Verdict:** no defect.

## E. Native release posture

**Checked:** the hermetic envelope (`scripts/hermetic-build.mjs`), APK bundle
scanner, Git provenance gate, release-profile guard, `app.json`/`eas.json`, and
the **actual** current-source build.

Direct evidence from the current-source hermetic build (source `80b0b33`, the
campaign's Android fix commit, clean detached checkout):

- `EXPO_NO_DOTENV=1`; no ambient `EXPO_PUBLIC_*` values; `remoteConfiguration:
'local-only'`; bundle scan of the APK found **0** occurrences of `supabase.co`.
- Merged release manifest: **36** permissions, exactly the committed inventory
  (the guard reads the real merge when Gradle intermediates exist), with
  `allowBackup: false` and `android.permission.SYSTEM_ALERT_WINDOW` absent
  (tracked `blockedPermissions`).
- `tests/store-declaration-drift.test.ts` re-run **in the checkout that contains
  the real `android/` build tree** (checked-out 17/17 passed), so the
  built-manifest limb was evaluated against the artifact rather than the
  committed transcription.
- The release-profile guard confines `EXPO_PUBLIC_HABIT_REMINDER_E2E_TEST` to
  the `e2e-test` profile (`eas.json` line 20 is the only profile carrying it),
  and `requireCleanGitTree` refuses a certification build from a dirty tree —
  exercised for real when this campaign's first provisioning attempt correctly
  refused the main worktree's untracked state.

**Verdict:** no defect. AR-2 is the one native-lane defect, and it was in the
flow, not the product (see below).

## F. CI integrity

**Checked:** `.github/workflows/ci.yml`, `scripts/e2e-retry-report.mjs`,
`tests/ciLaneIntegrity.test.ts`, the simulation lane matrix.

Direct evidence:

- No step `if:` references the `secrets` context (verified by grep across
  workflows); the disposable-backend lane uses an env-probe step publishing a
  step output, which is the documented fix for run `36807888273`'s parse-time
  failure.
- The retry gate is a real gate: a missing JSON report is a hard error, every
  retried test is printed, and a **strict** assertion (timing ceiling / row
  oracle markers) that passed only on a retry exits 1. It is blocking in the
  gating `e2e` job and report-only (`continue-on-error`) in `nightly`, matching
  the lane table's `gates: false`.
- `nightly` is schedule-only (`if: github.event_name == 'schedule'`), which is
  exactly why it is `skipped` on pushes — the expected skip in every recorded
  run.
- Concurrency is `${{ github.workflow }}-${{ github.event_name }}-${{ github.ref }}`
  with `cancel-in-progress: true`, so a later push supersedes an earlier run —
  the reason this campaign treats each pushed SHA as its own evidence boundary.
- `tests/ciLaneIntegrity.test.ts` **10/10 passed**; `npm run sim:validate` →
  23 scenarios / 13 personas / 7 workflows, apiLeg guards clean;
  `tests/e2eRetryReport.test.ts` covers the strict-retry verdict.

**Verdict:** no defect.

## G. Store, privacy, and release posture

**Checked:** `docs/release/*`, `public/privacy.html`, `app.json`, the merged
manifest, `eas.json`.

Direct evidence: the permission inventory matches the built artifact (previous
section); `docs/release/submission-package.md` frames signing/submission as
owner actions in a table of required owner inputs; `eas.json` keeps
`submit.production = {}` so no credentials are committed; the privacy policy is
hosted from `public/privacy.html` and the data-declaration drafts explicitly
label themselves as owner-review drafts rather than a filed declaration.
`tests/store-declaration-drift.test.ts` also pins the privacy/disclosure copy
against the actual app behaviour (automatic Auth/backup, conditional AI
processing, reward state outside backup scope, no email-removal promise).

**Verdict:** no unsupported submission or signing claim. Store filing remains an
owner action (residual R9).

## H. AI and paid-provider boundary

**Checked:** `features/command/commandSurface.ts`, `CommandScreen.tsx`,
`ModeToggle.tsx`, `askParser.ts`, `AI_ASK_EXPERIMENT_ENABLED`, and the
default-off suites.

Direct evidence: `AI_ASK_EXPERIMENT_ENABLED` derives from
`EXPO_PUBLIC_AI_ASK_INTERNAL_ROLLOUT`; the ordinary build returns the command
content **without mounting** `ModeToggle`, so no Ask/Auto view can render;
`askParser` refuses the request at the provider choke point without the flag
(tested with a mocked, configured provider so a missing remote cannot make the
test pass for the wrong reason); the render boundary is a pure module consumed
by both the screen and the selector, so a refactor cannot desynchronize them.
`tests/askDefaultOffSurface.test.ts` **7/7 passed**. Certification does not
depend on AI availability: the hermetic native build has no remote configured and
the API surface still renders.

**Verdict:** no defect.

## I. Test-only behaviour and release seams

**Checked:** the native E2E seam, the auth mock, environment flags, and the
release profile guard.

Direct evidence: the only source use of
`EXPO_PUBLIC_HABIT_REMINDER_E2E_TEST` is `lib/notifications.ts:219` (a
scheduling break-out for reminders) and it is set by exactly one EAS profile
(`e2e-test`); the release-profile guard fails any other profile carrying it.
The native auth mock is an owned loopback server bound to
`127.0.0.1`/`localhost`, started only under `--auth-mock`, with its own
`tests/nativeAuthMock.test.ts`; no mock leaks into a default lane. The Android
build used for qualification carries the seam (as designed for the E2E battery)
and is not a store artifact.

**Verdict:** no defect.

## J. Documentation consistency

**Checked:** `AGENTS.md`, `docs/testing/*`, `docs/release/*`, the canonical
`final-certification-closure` documents, and the successor's artifacts, against
source/CI/Android state.

Direct evidence:

- `tests/agentDocConsistency.test.ts` **11/11 passed** (schema version, runtime
  pins, SW cache generation, backup entity scope size, guidance inventory,
  `build:web`-before-E2E ban, Ask/Auto claim, schema snapshot version, lint
  warning cap, authoritative-doc status, register status labels).
- Independently verified claims that the consistency test does not cover:
  CACHE_VERSION `v7` matches `public/sw.js`; `BACKUP_ENTITIES` is 21 entries and
  `BACKUP_SCOPE_VERSION`/`BACKUP_SETTINGS_VERSION` are 7/5; the COOP/COEP claims
  in `AGENTS.md` are true — `app.json` carries them through the `expo-router`
  plugin options and `expo.extra.router.headers`, with `metro.config.js` (dev),
  `vercel.json` (production) and `scripts/serve-e2e.js` (E2E) covering the other
  lanes; the Settings section list matches `SettingsScreen.tsx` render order.
- **AR-1 (fixed):** the canonical closure report and ExecPlan asserted that
  `.tmp-ios36423379932/` "is gitignored at `.gitignore:81`". It is not ignored
  (`git check-ignore` exits 1; `.gitignore:81` is `/dist-sync/`). The report now
  states it is untracked and not ignored, which is also the preflight fact the
  successor records. This matters because "it is ignored" would invite treating
  untracked foreign evidence as uncommittable rather than as state that must be
  deliberately excluded from every commit.

**Withdrawn candidates** (investigated, then refuted by evidence — recorded so
they are not re-raised):

1. "`app.json` lost its COOP/COEP headers, contradicting `AGENTS.md`." Refuted:
   the headers live in the `expo-router` plugin configuration and
   `expo.extra.router.headers`.
2. "The migration chain is missing a version (only 24 `if (version < N)` blocks
   for head 25)." Refuted: version 1 is the bootstrap DDL; the chain is complete
   with no duplicates.
3. "The store-permission inventory is a hand transcription that can drift."
   Refuted: the guard reads the real merged manifest when a Gradle build exists,
   and it was re-run against this campaign's fresh build.
4. "A terminally blocked outbox record freezes the completeness checkpoint
   forever." Refuted: blocked keys are excluded from the durable count and
   blocked entities are omitted from the certified snapshot with disclosure.

## Executable repairs, regression protection, and second pass

**AR-2 (Android smoke repair).** The unconditional `tapOn: 'Create'` in
`.maestro/flows/command-center-v2.yaml` could never match in an ordinary build,
because `CommandScreen` returns the command content without mounting
`ModeToggle` while `AI_ASK_EXPERIMENT_ENABLED` is false. The repair is scoped to
the flow: platform-conditional behavior where Android asserts the ordinary
Create surface (`Command input` visible, `Ask`/`Auto` absent) and the iOS branch
keeps the historical command unchanged. No product code, test ID, optional step,
timeout, or assertion was changed.

Regression protection: `tests/maestroCommandCenterFlowGuards.test.ts` (8/8
passed) pins the repaired shape, the unchanged iOS sequence, the product render
boundary, and the smoke tag coverage, and **proves it rejects the reconstructed
pre-fix step** rather than passing vacuously.

Device verification (task 3.4, clean detached checkout of `80b0b33`; pinned Node
22.23.2; ambient Supabase variables unset; `Nitro_API_36`, `emulator-5554`, API
36, `x86_64`; package `com.dale16.superhabits` 1.0.0 (1); APK SHA-256
`E2F43FBBE37FFA28D31EB3379DAB7C06B352EBF456748AF958D367245C3690D2`):

- Provisioning **PASS** (hermetic, local-only, bundle scan 0 matches).
- Smoke **2/2**, including `command-center-v2` (37 s), which exercises the
  previously unproven example/parse/review/confirm steps after the repaired step.
- Persistence **11/11** (13 m 32 s).
- Lifecycle **6/6** (recorded in the closure report and the canonical ledger).

**AR-1 (documentation repair).** The false ignore claim is corrected; the
successor preflight now records the true state (untracked, never staged) and the
preservation rule for foreign evidence. No executable behaviour changed, so no
product regression test applies; the durable protection is the corrected
authoritative record plus the preflight evidence, and `tests/agentDocConsistency.test.ts`
keeps the machine-checkable claims honest.

Second pass over the repairs and cross-surface implications:

- The flow change is the only `.maestro/` edit in this campaign; it does not
  touch the iOS flow inventory (`command-center-v2` is not in either EAS flow
  list) and does not alter shared iOS semantics.
- The regression guard reads the same files the fix touches, so a revert of the
  fix fails the guard.
- The Android repair introduced no app-code change, so backup/ownership/
  migration/sync surfaces are untouched and no re-validation of those surfaces
  was earned by the repair.
- CI behaviour is unaffected by the flow change (no CI lane runs `.maestro/`
  flows), and the unit gate covers the new guard.
- No executable high-value finding remains hidden as a recommendation in this
  campaign. Residuals are external, owner-gated, credential-gated, or
  intentionally deferred, and each carries `WHY` / `CLASSIFICATION` / `WHAT IS
REQUIRED` / `EXACT RESUME ACTION` in the closure report.
