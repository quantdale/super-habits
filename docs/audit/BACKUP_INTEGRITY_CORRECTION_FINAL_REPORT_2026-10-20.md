# SUPERHABITS — BACKUP INTEGRITY CORRECTION FINAL REPORT

Date: 2026-10-20  
Worktree: `D:\Documents\tryPython\superhabits-post-acceptance`  
Branch: `fix/post-acceptance-defects`  
Base SHA: `85599dfbf3cbe2077f04ae51bfe3c19b6c04bff3`  
Previous report: `docs/audit/POST_ACCEPTANCE_CORRECTION_REPORT_2026-10-20.md` (superseded / historical evidence)

---

## A. Executive Outcome

The local correction package is ready for a **new independent acceptance review**, not self-certified as accepted or release-ready.

F1–F3 and F6 now have source-level corrections and production-path evidence. F4 has a local additive server migration and a real PostgreSQL 17 qualification against the actual migration chain; production deployment and hosted concurrency remain external. F5 was replaced with meaningful adapter/maintenance/SQL coverage. F7's inaccurate claims are superseded by this report and by a banner on the old report.

Three independent read-only adversarial reviews were run (client multi-device consistency, server/old-client protocol, conflict/outbox ordering). Their mandatory findings were folded into the owner-scoped baseline, dual-capture fail-closed, transactional conflict recording, clear-first resolution, SQL cleanup/privileges, and exact-SQLSTATE qualification.

No commit, push, merge, deployment, or production migration was performed.

---

## B. Repository Provenance

| Item                           | Value                                         |
| ------------------------------ | --------------------------------------------- |
| HEAD                           | `85599dfbf3cbe2077f04ae51bfe3c19b6c04bff3`    |
| Branch                         | `fix/post-acceptance-defects`                 |
| Base                           | Same SHA as `main` / `origin/main`            |
| Local commits                  | None                                          |
| Worktree                       | 23 modified tracked files; 10 untracked files |
| Final source state             | The working tree, not a commit                |
| Production changes             | None                                          |
| Commit / push / merge / deploy | None                                          |

The final report and ExecPlan are untracked local evidence. The old correction report is retained with a clear `SUPERSEDED / HISTORICAL EVIDENCE` banner; its earlier F1/F2/F3 claims are not current acceptance evidence.

---

## C. F1–F7 Disposition Matrix

| Finding                                         | Status                                                             | Summary                                                                                                                                                                                                               |
| ----------------------------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1 — observed head adopted as local base        | **RESOLVED_WITH_EVIDENCE**                                         | Observed head is informational only. A new owner-scoped verified baseline authorizes publication; unverified dirty devices conflict before remote mutation.                                                           |
| F2 — normal pending captures checked too late   | **RESOLVED_WITH_EVIDENCE**                                         | Pending capture base is preflighted and the capture is published generation-first, before mutable entity/settings/manifest writes.                                                                                    |
| F3 — keep-local flushed stale pending state     | **RESOLVED_WITH_EVIDENCE**                                         | Resolution now retires capture + pending settings/manifest first, tracks in-progress state, and marks the conflict resolved last. Real maintenance proves success/failure/retry.                                      |
| F4 — server had no capture provenance           | **RESOLVED_WITH_EVIDENCE (local) / BLOCKED_EXTERNAL (production)** | Additive migration adds capability fence, base-head reservation, publish wrapper, old-RPC removal, privilege cleanup, and provenance-0 cleanup. PostgreSQL qualification passes; production rollout remains external. |
| F5 — tests bypassed production paths            | **RESOLVED_WITH_EVIDENCE**                                         | Full `push()` F1/F2 tests, real-maintenance F3 tests, server SQL qualification, and updated capability mocks replace the insufficient evidence.                                                                       |
| F6 — capture replacement during active conflict | **RESOLVED_WITH_EVIDENCE**                                         | `captureInto()` blocks active conflicts; conflict recording re-reads durable captures transactionally; malformed conflict JSON fails closed.                                                                          |
| F7 — inaccurate completion claims               | **RESOLVED_WITH_EVIDENCE**                                         | Old report superseded; this report states actual guarantees, residuals, and external gates.                                                                                                                           |

### F1 — observed vs verified baseline

**Initial defect:** `ensureRecoveryPoint()` stored the current remote head as the device's observed base. A stale dirty device with no pending capture could then capture local bytes with base B2 and publish A3 over B2 without conflict.

**Correction:**

- Added `backup.verified_generation_base_head` (`core/db/appMeta.ts`), owner-scoped.
- `GenerationCapture` now carries `baseHeadProof`; captures use only the verified base (`core/backup/generations/capture.ts`).
- Successful publication, V2 restore, and explicit keep-local set the verified base.
- The unsafe promotion from the device-global `backup.generation_sequence` counter was removed; a sequence match alone never authorizes publication.
- A dirty device with no verified base and an existing remote head preserves local bytes in a durable capture and records a conflict before any mutable write.
- Dual legacy/normal capture state fails closed instead of letting the legacy early return bypass the normal-capture preflight.

**Evidence:** `tests/integration/generationClientRecovery.test.ts` F1/no-promotion tests; full integration pass.

**Limitation:** Pre-provenance devices with an existing remote head and no verified base require explicit owner review (keep-local or restore) rather than silent promotion. This is deliberate fail-closed behavior.

### F2 — pending capture ordering

**Initial defect:** a normal pending capture was only checked at manifest publication, after entity rows and settings had already been written.

**Correction:**

- `ensureRecoveryPoint()` reads the pending capture before mutable writes.
- A verified-base match publishes the capture first; the server validates base + head under its advisory lock.
- A mismatch records a conflict and throws before any entity/settings/manifest write.
- The same path rejects migrated captures whose `baseHeadProof` is `unverified`.

**Evidence:** `tests/integration/generationClientRecovery.test.ts` F2 test asserts the full `push()` path leaves `target.writes` unchanged and the head unchanged.

**Residual (disclosed, not claimed as solved):** after a verified-base preflight succeeds, a concurrent publisher can still advance the head before later direct mutable PostgREST writes. The immutable generation head remains protected by server provenance/CAS and is what Restore V2 reads; mutable staging can be stale in that race. The report does **not** claim no mutable writes can ever occur after a successful preflight.

### F3 — keep-local ordering

**Initial defect:** resolution cleared only the generation capture, then maintenance could flush stale pending settings/manifest before a new capture.

**Correction:**

- Durable in-progress marker added (`backup.generation_resolution_in_progress`).
- Resolution transaction: write marker → retire legacy/normal capture → clear pending settings/manifest → set chosen base/observed/dirty → mark conflict resolved LAST → clear marker.
- Ordinary entity outbox records are not deleted.
- A crash after the final resolved write can leave a marker; the next resolution call clears it when no active conflict remains.

**Evidence:** `tests/integration/backupConflictResolutionMaintenance.test.ts` uses real `runBackupMaintenance()` for success, failed publication, and retry. Stale settings/manifest are never written; the final fresh generation publishes after retry.

**Residual:** keep-local retires the conflicted capture before the replacement publication succeeds. Local rows and `backup.dirty=1` remain and the operation is retryable, but the old local capture snapshot is no longer available if the user later deletes/changes local rows before a successful replacement. The immutable previous remote head remains.

### F4 — server provenance and old clients

**Correction:**

- New additive migration: `supabase/migrations/20261020090000_enforce_backup_publication_provenance.sql`.
- Capability `protocol_version = 2`, `publication_provenance_version = 1`.
- Reservation records base snapshot/sequence and requires it to equal the live head.
- Publication wrapper requires provenance version 1, stored generation provenance, and base == live head under the advisory lock; first publication requires no base.
- Old 1-arg reserve is dropped; old 4-arg publish is renamed and revoked from `PUBLIC/anon/authenticated/service_role`; internal verifier runs with pinned `search_path`.
- Old client capability check (v1) pauses before mutable writes; old RPC signatures cannot publish.
- Pre-migration provenance-0 unpublished staging is deleted so it cannot permanently wedge the upgraded client.
- Broad Supabase-style default privileges are revoked and exact DML re-granted; TRUNCATE is removed.

**Evidence:** `npm run backup:provenance:qualify` on isolated PostgreSQL 17.5 applies the four migrations, seeds provenance-0 staging, verifies cleanup, capability/ACL fences, stale reservation, stale race publication, valid publication, and idempotent retry. It asserts exact SQLSTATE `40001` for expected rejections and verifies the head did not move.

**Limitation:** production migration and hosted PostgREST/Auth/RLS/concurrency are not run. `service_role` remains trusted by design. A truly ancient client that skips the capability check may still write mutable staging rows, but cannot advance the immutable head through the removed/guarded RPCs.

### F5 — evidence

Production-path coverage now includes:

- F1 stale dirty/no-capture full `push()`.
- F1 device-global sequence no-promotion.
- F2 stale pending capture full `push()`, asserting no remote writes.
- F3 real maintenance success, publication failure, and retry.
- F4 real PostgreSQL migration chain + old RPC/ACL/stale-base checks.
- F6 active-conflict capture guard, malformed conflict fail-closed, conflict re-read (the transactional re-read in `failGenerationConflict` is implemented but has no discriminating test — see the acceptance-response gaps below).
- Lost acknowledgement current head vs newer head.
- Interrupted reservation, racing writer, valid publication, restore, empty-device recovery.

The previous direct private-helper test was converted to the full `push()` path. The old conflict test no longer mocks `runBackupMaintenance()` for its retained tests.

### F6 — defensive conflict integrity

- `captureInto()` refuses to replace a capture while an active conflict exists.
- `failGenerationConflict()` re-reads the durable legacy/normal capture inside a SQLite transaction before persisting the conflict, so the record cannot point at a snapshot that another write replaced.
- `readBackupGenerationConflict()` fails closed on malformed non-null state instead of treating it as “no conflict”.

### F7 — report accuracy

- Old report is marked superseded/historical.
- This report explicitly scopes the mutable-staging TOCTOU residual.
- The inaccurate “no mutable rows, settings, or manifest” and “neither recovery point can be silently superseded” claims are not repeated as unconditional guarantees.

---

## D. Backup Protocol Correctness

### Client state authorities

1. **Observed head** — diagnostic only; never publication authority.
2. **Verified baseline** — owner-scoped `{ ownerUserId, snapshotId, sequence }`, set by successful publication, verified V2 restore, or explicit keep-local.
3. **Pending capture** — immutable local bytes + manifest + `baseHeadProof`.
4. **Sequence reservation** — server-issued, idempotent, bound to base head.
5. **Published head** — server-visible authoritative recovery point.
6. **Conflict** — durable owner-review state; blocks publication and capture replacement.
7. **Resolution marker** — durable in-progress keep-local state.

### Publication rules

- Current client must receive capability protocol 2 + provenance version 1.
- A pending capture is verified/published before mutable entity/settings/manifest writes.
- A stale pending capture conflicts before remote mutation.
- A dirty device with no verified base and an existing head conflicts before remote mutation.
- A verified-base match allows continuation; the server still re-checks at reservation and publication.
- First publication requires no base; restore records the restored head as verified.
- Lost acknowledgement at the same visible head is retired as success; a newer head is a conflict.
- Keep-local retires stale evidence first and marks resolution last.

### Server rules

- Reservation and publication serialize on one per-owner advisory lock.
- The reservation must match the live head; the publication wrapper re-checks base against the live head.
- Publication is idempotent only for the same visible snapshot.
- Content/manifest/chunk verification remains the existing protocol-1 verifier.
- Head advancement and generation writes are the authoritative recovery path; V2 restore reads the head generation, not mutable staging.
- Direct client head writes, destructive table privileges, and old RPC signatures are blocked.

### Rollout order

1. Apply the additive migration in isolation and run `npm run backup:qualify`.
2. Deploy the matching client (capability v2).
3. Apply to production only under owner authorization.
4. Keep the migration additive; old published generations remain restorable.

---

## E. Adversarial Scenario Matrix

| Scenario                                                        | Observed outcome                                                                                                                 |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| A1 → B2 → stale A, dirty, no pending capture                    | Conflict before remote writes; local capture based on verified A1; B2 head unchanged                                             |
| A1 → B2 → stale normal pending capture                          | Full `push()` conflicts before any entity/settings/manifest write; capture retained                                              |
| Capture reserved against G1, head advances to G2 before publish | Server rejects with `40001`; head remains G2                                                                                     |
| Pre-migration provenance-0 staged generation/reservation        | Migration deletes unpublished staging; no permanent reserve wedge                                                                |
| Old client sees capability protocol 1                           | Pauses before mutable writes                                                                                                     |
| Old 1-arg reserve / 4-arg publish                               | RPC absent; old internal publisher lacks client/service EXECUTE                                                                  |
| Lost acknowledgement, same visible head                         | Returns success, retires capture, records verified base                                                                          |
| Lost acknowledgement, newer head appears                        | Conflict, not success; capture bytes retained                                                                                    |
| Keep-local, fresh publication succeeds                          | Stale settings/manifest dropped; current local state publishes above chosen head                                                 |
| Keep-local, fresh publication fails                             | No stale writes; capture remains; retry publishes safely                                                                         |
| Keep-local interrupted after marker                             | Durable marker allows resume; conflict remains active until final write                                                          |
| Active conflict during capture                                  | Capture replacement refused; durable evidence preserved                                                                          |
| Malformed conflict JSON                                         | Publication paused; no fail-open                                                                                                 |
| Owner replacement with matching device-global sequence          | No promotion; conflict/owner review required                                                                                     |
| Valid established device                                        | Normal sync/publication remains functional                                                                                       |
| Empty-device restore                                            | Restores head generation and records verified base; continued sync works                                                         |
| Mutable staging race after verified preflight                   | **Residual:** head remains protected by server CAS/provenance; mutable staging may be stale; V2 restore reads the immutable head |

---

## F. Validation Ledger

### Environment

- **Pinned gate environment:** disposable Node `v22.23.2`, npm `10.9.8` (extracted under TEMP; no version manager installed).
- **Browser lane environment:** Node `v24.3.0`, npm `11.4.2`; this is a remaining environment mismatch for browser execution only.
- PostgreSQL: local PostgreSQL 17.5 disposable clusters; minimal `auth.uid()`/role shim; no shared/production database.
- No commit, push, merge, deployment, or production migration.

### Executed

| Command                                            | Result                                                                          |
| -------------------------------------------------- | ------------------------------------------------------------------------------- |
| `npm run qa:fast` (Node 22.23.2)                   | PASS — typecheck, lint, 194 unit files, journey/quarantine/release/cloud guards |
| `npm run test:integration` (Node 22.23.2)          | PASS — 103 files passed, 1 skipped                                              |
| `npm run backup:provenance:qualify` (Node 22.23.2) | PASS — actual four-migration PostgreSQL chain                                   |
| `npm run backup:qualify` (Node 24.3.0)             | PASS — 67 predecessor checks + provenance lane                                  |
| `npm run build:e2e` (Node 24.3.0)                  | PASS — hermetic export, 0 Supabase hosts                                        |
| SH-04 focused Playwright                           | PASS — 1/1, durable pending save/remount/retry                                  |
| SH-13 focused Playwright                           | PASS — 1/1, create/reload/cancel/edit associations                              |
| `npm run e2e:journeys:p0`                          | PASS — 25/25                                                                    |
| `npm run build:sync`                               | PASS — dummy-Supabase export                                                    |
| `npm run e2e:sync`                                 | PASS — 52/52 remote-boundary journeys, including P5/P6                          |
| `npm run typecheck`                                | PASS — 0 errors                                                                 |
| `npm run lint`                                     | PASS — 0 errors, 0 warnings                                                     |
| `npx prettier --check <changed files>`             | PASS — all changed/new files formatted                                          |
| `npm run format:check` (repo-wide)                 | FAIL — 91 pre-existing unrelated files; no changed/new file is listed           |

### Not run / external

- Full `npm run e2e` (all feature + visual + PWA projects).
- Repo-wide `npm run format:check` remains red on pre-existing unrelated files; the changed-file check is green.
- Native Android/iOS smoke, persistence, lifecycle; SH-11 native scheduling rejection.
- Hosted/disposable Supabase Auth/PostgREST/RLS/concurrency.
- Production migration/deployment.
- SH-20 dependency-advisory remediation/waiver.
- SH-21 real cloud-artifact inspection.
- Actual old installed binary executed against the new server (old-client behavior is enforced by capability/RPC/ACL fences and SQL qualification, not by launching an old build).

---

## G. Regression and Compatibility Assessment

- No entity payload, manifest, restore-import, or local-first behavior change was introduced.
- Content protocol remains 1, so already-published generations remain restorable; capability/provenance version 2/1 is a transport fence.
- Old clients now pause at the capability check; this is deliberate compatibility behavior, not silent failure. Rollout must deploy the client with or before server enforcement.
- Pre-provenance devices without a verified base require one-time owner review; no silent promotion from a device-global counter.
- Existing V2 restore records the restored head as the verified base, so restored devices can continue publishing.
- SH-04/SH-13 accepted browser evidence remains intact.
- Table grants are narrower: no client TRUNCATE/DELETE on the immutable recovery store; only the DML needed by owner-scoped staging/publication remains.
- Keep-local does not delete ordinary entity outbox work; failed records remain retryable.

---

## H. Outstanding External Requirements

1. **Independent acceptance review** of this local package.
2. **Hosted Supabase qualification:** Auth, PostgREST, RLS, concurrent publishers, lost responses.
3. **Production migration authorization:** apply additive migration only after client rollout planning; no production mutation in this campaign.
4. **Native qualification:** Android/iOS lifecycle; SH-11's native notification scheduling-rejection branch remains unexecuted.
5. **Full browser suite:** feature/visual/PWA projects not run in this final pass.
6. **Old installed client execution:** server fences are locally proven; an actual old binary against the new server remains environment work.
7. **SH-20 dependency advisories:** no patched version/waiver applied.
8. **SH-21 cloud-artifact isolation:** static guard only, no real EAS/cloud inspection.
9. **Browser environment pin:** browser evidence ran on Node 24.3.0; pinned Node 22.23.2 was used for static/unit/integration/PostgreSQL gates.

---

## I. Remaining Risks and Follow-up

### Accepted residuals

- **Mutable staging TOCTOU:** after a verified-base preflight succeeds, a concurrent publisher can advance the head before later mutable PostgREST writes. The immutable head is protected and Restore V2 reads it; mutable rows/settings/manifest may be stale. This is not head corruption, but it is not “zero mutable writes in every race”.
- **Keep-local destructive-before-replacement:** conflicted capture bytes are retired before the new publication succeeds. Local rows + dirty state remain and retry is safe; the old local snapshot is not retained for a later post-resolution local deletion.
- **Pre-provenance device review:** no verified base means conflict, not silent sequence promotion.
- **Ancient client mutable writes:** an ancient client that bypasses capability checks may write mutable staging, but cannot advance the head through the guarded/removed RPCs.

### Mandatory local source work outstanding

None identified by the final adversarial review after the hardening pass.

### Optional follow-ups

- Add explicit UI copy for pre-provenance owner review.
- Add a multi-tab/web-process lock around keep-local resolution if multi-tab is a supported deployment.
- Add an actual archived old-client fixture against the new server when such an artifact is available.

---

## J. Final Handoff

The local implementation is suitable for a new independent acceptance review. It is not release-certified and must not be committed/pushed/deployed as part of this handoff.

Review these first:

1. `core/sync/supabase.adapter.ts` — observed vs verified base, pending-capture publication, conflict recording.
2. `core/backup/generations/capture.ts` — `baseHeadProof`, verified-base persistence, F6 guard.
3. `core/backup/backupConflictResolution.ts` + `core/backup/generations/conflict.ts` — clear-first/mark-last, marker, fail-closed state.
4. `supabase/migrations/20261020090000_enforce_backup_publication_provenance.sql` — reservation/publication wrapper, cleanup, privileges.
5. `scripts/qualify-backup-provenance.mjs` — actual PostgreSQL chain and exact SQLSTATE negative cases.
6. `tests/integration/generationClientRecovery.test.ts`, `backupConflictResolution.test.ts`, `backupConflictResolutionMaintenance.test.ts` — production-path evidence.
7. `e2e/journeys/bad-backend.spec.ts` — established-device provenance fixture for the sync lane.

Reproduce with:

```powershell
cd D:\Documents\tryPython\superhabits-post-acceptance
npm run qa:fast
npm run test:integration
npm run backup:qualify
npm run build:e2e
npx playwright test e2e/workout.spec.ts e2e/todos.spec.ts --project=chromium --grep "failed save keeps|associations survive"
npm run e2e:journeys:p0
npm run build:sync
npm run e2e:sync
```

Do not commit, push, merge, deploy, or apply the migration to production.

---

## K. Acceptance Review Response (2026-10-20, supersedes the ledger/inventory above where they differ)

An independent read-only acceptance review of this package (full report:
`docs/audit/BACKUP_INTEGRITY_ACCEPTANCE_REPORT_2026-10-20.md`) reached
**ACCEPT_WITH_CONDITIONS**: the F1–F3/F6 corrections and the F4 server fences
were independently verified — including a reviewer-executed
`backup:provenance:qualify` PASS on PostgreSQL 17.5 against the actual
four-migration chain and an exact reproduction of the 103/1 integration
ledger — and it confirmed one new source defect plus residual reporting
inaccuracies. The conditions were implemented in this final pass.

### Findings and final disposition

| ID  | Severity | Summary                                                                                                                                                                                                                                               | Disposition                                                                                                                                                                                                                                                                      |
| --- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| W-1 | Medium   | The migration's legacy trigger branch admitted a provenance-0 insert at a live reserved identity, which could occupy the primary key and permanently wedge the account's publisher (availability only; the head stayed protected)                     | **FIXED.** `backup_generation_require_reservation` now requires an exact reservation match (sequence + provenance version + base pair) for every insert; qualification gained provenance-0 hijack-resistance, reservation-idempotency and cleanup-preservation cases; rerun PASS |
| W-2 | Low      | `tests/portableExportSize.test.ts` (inherited, untouched by this package) has a load-sensitive 5s timeout: 2/2 full-suite runs on the reviewer host timed out; 2/2 isolated runs passed                                                               | **Classified `FLAKY_TEST`/environment.** Not a correction regression (no file in its module graph appears in this diff)                                                                                                                                                          |
| W-3 | Low      | A malformed durable conflict record made `getRestorePreview()` reject, blanking the whole Settings backup panel                                                                                                                                       | **FIXED.** `buildRestorePreview` degrades to `backupConflict: null` on malformed state; publication still fails closed; two preview tests added                                                                                                                                  |
| W-4 | Low      | Keep-local resolution reported "resolution failed" when post-commit maintenance threw although the resolution had committed                                                                                                                           | **FIXED.** Post-commit `runBackupMaintenance()` is best-effort (logged); consistent with its retryable nature                                                                                                                                                                    |
| W-5 | Low      | `generationFormat.ts` comment conflated content protocol 1 with capability version 2 (dead `[1, 1]` array)                                                                                                                                            | **FIXED** (comment corrected; behavior unchanged)                                                                                                                                                                                                                                |
| W-6 | Low      | Publication's idempotent shortcut returns the visible head without re-checking `p_manifest_checksum`/`p_expected_chunk_count`                                                                                                                         | Accepted as-is (no state change; the head is SELECT-visible)                                                                                                                                                                                                                     |
| W-7 | Low      | Evidence gaps: `baseHeadProof === 'unverified'` conjunct, reserve idempotency (double-only), restore→verified-base write, dual legacy+normal capture branch, DB-restart persistence, and the conflict transactional re-read lack discriminating tests | Open evidence gaps (the §F5 bullet above is corrected accordingly); core invariants unaffected                                                                                                                                                                                   |
| W-8 | Info     | `qualify-backup-provenance.mjs` is Windows-pathed and not wired into CI                                                                                                                                                                               | Open; manual lane documented                                                                                                                                                                                                                                                     |

### Residual scope after this pass

- A same-account actor performing raw table writes can still stage a
  reservation-conforming generation (provenance-1 with matching base pair);
  such a row cannot advance the head without passing the full
  content/manifest/graph verification and is indistinguishable from ordinary
  client operation. This is inside the account trust domain; `service_role`
  remains the recovery authority by design.
- The mutable-staging TOCTOU and keep-local destructive-before-replacement
  residuals (§I) are unchanged; the review classified both as bounded,
  architecture-consistent limitations (the immutable head is protected, restore
  reads the head generation, and divergence surfaces as a durable conflict),
  not defects.

### Independent reviewer validation ledger (Node 22.23.2)

| Command                                            | Result                                                                                         |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `tsc --noEmit`                                     | PASS                                                                                           |
| `eslint . --max-warnings 0`                        | PASS                                                                                           |
| `prettier --check` (changed/new files)             | PASS                                                                                           |
| `prettier --check .` (repo-wide)                   | 91 pre-existing failures, **zero overlap** with this package (claim verified)                  |
| `vitest --project integration` (full)              | 103 passed / 1 skipped — exact match to the ledger above                                       |
| `vitest --project unit` (full)                     | 2430 passed / 1 failed — the failure is W-2 (passes 2/2 in isolation)                          |
| `scripts/qualify-backup-provenance.mjs` (pre-fix)  | PASS — reviewer-executed on PostgreSQL 17.5 against the actual migration chain                 |
| `scripts/qualify-backup-provenance.mjs` (post-fix) | PASS — including reservation idempotency, provenance-0 hijack resistance, cleanup preservation |
| `scripts/qualify-backup-generations.mjs`           | PASS (PostgreSQL 17.5)                                                                         |
| Post-fix targeted suites                           | 23/23 unit (incl. 2 new W-3 preview tests), 30/30 integration                                  |

### Outstanding external requirements (unchanged by this pass)

Hosted Supabase Auth/PostgREST/RLS/concurrency qualification, production
migration authorization and rollout (including the old-client pause window),
actual old-binary execution, native Android/iOS lifecycle and SH-11's native
scheduling rejection, the browser lanes on pinned Node 22 (or a toolchain
waiver), the full `npm run e2e` suite, SH-20 dependency advisories, and SH-21
cloud-artifact inspection all remain external release gates.
