# SUPERHABITS — FINAL BACKUP INTEGRITY INDEPENDENT ACCEPTANCE REPORT

Date: 2026-10-20
Reviewer: Independent acceptance reviewer (read-only review phase)
Package reviewed: uncommitted local correction worktree
`D:\Documents\tryPython\superhabits-post-acceptance`, branch
`fix/post-acceptance-defects`, base `85599dfbf3cbe2077f04ae51bfe3c19b6c04bff3`
Implementation reports treated as claims, not evidence. GitHub `main` was not
treated as authority (the package is local-only).

---

## A. Executive Verdict

**ACCEPT_WITH_CONDITIONS** (integration) — see Section J.
**NOT READY FOR RELEASE** (release) — see Section K.

The three data-integrity gates (F1–F3) are genuinely corrected. The reviewer
personally traced the production paths (`ensureRecoveryPoint` →
`uploadGeneration` → `push`; keep-local resolution → `runBackupMaintenance`) and
independently executed the decisive evidence on the pinned Node 22.23.2
toolchain: full integration project **103 passed / 1 skipped** (exact match to
the claim), the F1/F2/F3 suites 30/30, typecheck/lint clean, and
`backup:provenance:qualify` **PASS on a real disposable PostgreSQL 17.5 cluster
applying the actual four-migration chain**. The four disclosed residual risks
are real but bounded and architecture-consistent — none constitutes silent
corruption or unrecoverable loss of the immutable recovery point.

Independent adversarial review confirmed one new source defect (W-1: a
provenance-0 INSERT path in the new migration could permanently wedge an
account's publication pipeline — availability, not integrity) and residual
reporting inaccuracies (F7). Both were required to be corrected in the same
open package before commit. (Section L records that these conditions were
subsequently implemented in the same session and re-verified.)

## B. Repository Provenance

| Item               | Verified value                                                                                                                                                                                                                                                                                                   |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Worktree           | `D:\Documents\tryPython\superhabits-post-acceptance` (linked worktree)                                                                                                                                                                                                                                           |
| Branch / HEAD      | `fix/post-acceptance-defects` @ `85599dfbf3cbe2077f04ae51bfe3c19b6c04bff3` (= `main`/`origin/main`; zero local commits)                                                                                                                                                                                          |
| Source state       | **Uncommitted**: 23 modified tracked files (+1,129/−83), 10 untracked files at review time                                                                                                                                                                                                                       |
| Production changes | `core/sync/supabase.adapter.ts` (+391), `core/backup/generations/capture.ts` (+89), new `generations/conflict.ts` (190), new `backupConflictResolution.ts` (138), `backupRestore.ts` (+13), `generationProtocol/Format`, `core/db/appMeta.ts` (+27), `restore.coordinator/types`, `SettingsBackupSection/Screen` |
| New migration      | `supabase/migrations/20261020090000_enforce_backup_publication_provenance.sql` (untracked; applied nowhere)                                                                                                                                                                                                      |
| New tooling        | `scripts/qualify-backup-provenance.mjs`; `package.json` script entries only — no dependency or lockfile change                                                                                                                                                                                                   |
| Tests              | +246 in `generationClientRecovery.test.ts`; new `backupConflictResolution{,Maintenance}.test.ts`, `generationBaseline.ts`; fixture adaptations in 6 suites; SH-04/SH-13 specs                                                                                                                                    |
| Docs               | New final report + ExecPlan; prior report retained with `SUPERSEDED / HISTORICAL EVIDENCE` banner (verified)                                                                                                                                                                                                     |

Review methods: line-level tracing of every production path named in F1–F4; full
reads of the migration and qualification script; independent execution of
static gates, unit/integration suites, and both PostgreSQL qualification lanes
(temp-isolated clusters); three read-only independent sub-reviews (server /
old-client protocol; test-evidence adequacy; whole-diff + SH-04/SH-13 +
formatting) cross-checked against source. No file was modified during the
review phase; the worktree was verified byte-identical before and after.

## C. F1–F7 Disposition Matrix

| #           | Original problem                                                                                          | Correction                                                                                                                                                                                                                                                                                                       | Direct evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Independent assessment                                                                                                                                                        | Confidence  | Residual                                                                                        | Disposition                                                                   |
| ----------- | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| F1 (High)   | Stale device without pending capture could adopt the observed remote head as its base and publish over it | Observed head is informational; publication authority is the owner-scoped verified base set only by successful publication / verified restore / explicit keep-local; no sequence-counter promotion; mismatch ⇒ durable capture + conflict before any remote write                                                | `capture.ts` (`baseHeadProof`, `readVerifiedGenerationBaseHead`); `supabase.adapter.ts` `resolveVerifiedGenerationBaseHead` has no fallback; test "F1: stale dirty device without a capture conflicts before any remote mutation" (full `push()`, asserts zero remote writes, head unchanged, retained capture based on the VERIFIED head); "does not promote the device-global sequence counter"; server re-checks base==head at reserve and publish (independently qualified) | The actual production path cannot silently replace newer recoverable content; helper-level proof not relied upon                                                              | High        | Pre-provenance devices always conflict once a head exists (deliberate fail-closed owner review) | **VERIFIED_RESOLVED**                                                         |
| F2 (High)   | Pending-capture conflicts detected only after entity/settings/manifest writes                             | Pending capture preflighted before mutable writes; verified-base match publishes the capture generation-first; mismatch/`unverified` proof ⇒ conflict before any write; dual legacy+normal captures fail closed                                                                                                  | `ensureRecoveryPoint` pending branch; ordering test asserts chunk upload precedes the first mutable write; test "F2: stale normal pending capture rejects before any mutable write" asserts BOTH `writes == []` and head unchanged on full `push()`; re-executed 30/30 green                                                                                                                                                                                                    | Correction real and production-path-tested. Post-preflight TOCTOU residual is a different, narrower race (Section D.1)                                                        | High        | Mutable-staging staleness in the post-preflight window (bounded)                                | **VERIFIED_RESOLVED**                                                         |
| F3 (High)   | Keep-local flushed stale pending settings/manifest before replacement                                     | Atomic resolution transaction: marker → retire captures → clear pending settings/manifest → chosen base/dirty → mark resolved LAST → clear marker; entity outbox never deleted                                                                                                                                   | `backupConflictResolution.ts`; `backupConflictResolutionMaintenance.test.ts` drives real resolution → real `runBackupMaintenance()` → real `push()`, asserting stale settings/manifest bytes never reach the remote, failed publication retains the capture, retry publishes                                                                                                                                                                                                    | Original defect closed with discriminating tests. Destructive-before-replacement residual classified in Section D.2                                                           | High        | Retired capture snapshot not retained until replacement publishes (bounded)                     | **VERIFIED_RESOLVED**                                                         |
| F4 (High)   | Server accepted publications without base-head provenance; old clients could bypass client fences         | Additive migration: provenance columns + CHECKs, base-bound sequence reservation under one per-owner advisory lock, publish wrapper re-checking base==live head under the same lock, old RPCs dropped/renamed+revoked, head SELECT-only, TRUNCATE/DELETE revoked, capability fence, provenance-0 staging cleanup | Migration (full read); **reviewer-executed `qualify-backup-provenance.mjs` PASS on PostgreSQL 17.5** (capability v2, RPC/ACL fences, stale-base reserve and stale-race publish rejected with exact SQLSTATE 40001 + head-unchanged, valid publish, idempotent retry)                                                                                                                                                                                                            | For the stated adversary (unmodified pre-correction client) every bypass is fenced; one wedge path for raw same-account writes found (W-1) and fixed in the finalization pass | High        | W-1 (fixed pre-application); hosted PostgREST/Auth/RLS unqualified; old binary not executed     | **VERIFIED_RESOLVED (local) / BLOCKED_EXTERNAL (hosted & production)**        |
| F5 (Medium) | Tests bypassed the failing production paths                                                               | Full `push()` F1/F2 tests, real-maintenance F3 tests, real-PostgreSQL lane, updated capability mocks                                                                                                                                                                                                             | Independent 12-scenario audit: 7 PROVEN, 5 PARTIALLY_PROVEN with named gaps (Section F); negative controls verified capable of failing on revert                                                                                                                                                                                                                                                                                                                                | The finding is corrected; remaining gaps are additive edge coverage                                                                                                           | High        | W-7 evidence gaps                                                                               | **VERIFIED_RESOLVED** (gaps listed)                                           |
| F6 (Low)    | Active conflicts could be bypassed by capture replacement                                                 | `captureInto()` refuses replacement during an active conflict; `failGenerationConflict` re-reads durable captures transactionally; malformed conflict JSON fails closed                                                                                                                                          | Discriminating tests: "AUD-F6: refuses to replace the durable capture while a conflict is active" (fails if the guard is removed); "fails closed when the durable conflict record is malformed"                                                                                                                                                                                                                                                                                 | Guard adequate and load-bearing; the transactional re-read has no discriminating test                                                                                         | Medium-High | Re-read unpinned by test                                                                        | **VERIFIED_RESOLVED**                                                         |
| F7 (Medium) | Completion report overstated guarantees                                                                   | Old report superseded with banner; new report scopes the TOCTOU residual and retracts the unconditional claims                                                                                                                                                                                                   | Banner verified; §F2/§I disclosures accurate against code                                                                                                                                                                                                                                                                                                                                                                                                                       | Two residual inaccuracies found: "no permanent reserve wedge" contradicted by W-1; §F5 listed "conflict re-read" as tested evidence                                           | High        | Amended in the finalization pass (Section L)                                                    | **PARTIALLY_RESOLVED at review time; conditions implemented in finalization** |

## D. Four Critical Risk Assessments

### D.1 Mutable staging TOCTOU after successful preflight — BOUNDED RECOVERABLE CONSISTENCY LIMITATION (acceptable, disclosed)

After `ensureRecoveryPoint` passes on a verified-base match, `push()` writes
mutable rows via direct PostgREST upserts; a concurrent publisher B can advance
the head inside that window and A's writes land over B's staging rows, after
which A's outbox is acknowledged. Blast radius is bounded by four verified
facts: (a) the immutable head is never touched — server-side base==head CAS
rejects A's next publication; (b) `pull()` returns `[]`
(`supabase.adapter.ts`), i.e. sync is push-only, so stale staging rows cannot
regress any other device's local data; (c) Restore V2 reads the head generation
whenever one exists (`backupRestore.ts`), so user-visible restore is
unaffected; (d) A's next capture conflicts into durable owner review before any
further publication, and A's data persists in local SQLite. The only loss
channel is device destruction during the unresolved window before a fresh
capture — the same class of exposure as any un-captured local edit in a
local-first app. Mutable-staging staleness affects only the no-generation
fallback and legacy V1 reads. **Not unrecoverable loss, not silent corruption.**

### D.2 Keep-local destructive-before-replacement — ACCEPTABLE OWNER-AUTHORIZED DESTRUCTIVE OPERATION (bounded gap, honest disclosure)

Exactly what is destroyed: the pending capture's snapshot bytes and pending
settings/manifest snapshots — inside one atomic SQLite transaction (no partial
state on crash). Never destroyed: local rows, the remote head/generations,
ordinary entity outbox work. Interruption analysis: transaction crash ⇒
all-or-nothing rollback with the conflict active; post-transaction crash ⇒
resolved state with `dirty=1` and automatic re-capture by the next maintenance
cycle; publication failure ⇒ capture retained, head unchanged, retry proven
green by the real-maintenance tests. The unprotected element is only the
point-in-time snapshot artifact whose content equals the live local rows that
remain; it is lost only if the user deletes those rows before a successful
replacement. "Keep this device's data" explicitly authorizes replacement and
the UI copy scopes it accurately ("replaces the remote recovery point… The
previous remote generation stays retained… restore does not merge into
non-empty local data"). No crash-safe-recovery claim is made for the retired
snapshot. Retire-after-replacement would be strictly safer (hardening).

### D.3 Server-side provenance and old-client fencing — CORRECT FOR THE STATED ADVERSARY; ONE DEFECT FOUND AND FIXED; HOSTED CERTIFICATION OUTSTANDING

Enforcement lives server-side: base==live-head checked at reservation and
publication under one per-owner `pg_advisory_xact_lock` + `FOR UPDATE`;
delegation to the content/manifest/graph verifier with sequence CAS;
publication idempotent only for the same visible snapshot; head writable only
by the SECURITY DEFINER publisher; `search_path` pinned; minimal grants. An
unmodified old client is fenced at three layers (capability check pauses before
any remote write; old RPC signatures gone; ACL revokes the renamed internal)
and cannot call old RPCs, supply an arbitrary base, reserve without provenance,
publish stale legacy generations, or advance the head. Both rollout directions
fail safe with a durable outbox. **W-1** (found by independent review): the
migration's legacy trigger branch admitted a provenance-0 insert at a reserved
identity, able to occupy the PK and wedge the publisher — availability only,
head integrity preserved. Fixed in the finalization pass: every generation
insert must now match its reservation on sequence + provenance version + base
pair; provenance-0 hijack resistance is now asserted by the qualification.
My PostgreSQL PASS certifies local SQL correctness only; hosted
PostgREST/JWT/`auth.uid()`/RLS/concurrency remain external.

### D.4 Pre-provenance recovery and owner review — ACCEPTABLE DELIBERATE PRODUCT POLICY

Pre-provenance captures normalize to `unverified`; devices with an existing head
and no verified base conflict rather than promote; the sequence-counter
promotion is gone (verified in code and by test). The Settings UI surfaces the
conflict with truthful semantics and one scoped action (keep-local) plus an
explicit remote-adoption path (export + restore on an empty device). The
one-time review burden for upgraded devices is the correct trade against silent
replacement.

## E. Server Migration Review

- **Ordering/additivity:** sorts after and modifies only objects of the three
  prior generation migrations; new columns nullable with XOR CHECKs and
  `NOT NULL DEFAULT 0` version columns; content protocol stays 1 so published
  generations remain restorable.
- **Cleanup safety:** only unpublished, non-head provenance-0 staging is deleted
  (double `NOT EXISTS` guards; `ON DELETE RESTRICT` FKs as backstop) — no
  restorable content is destroyed. Reviewer-added qualification now proves the
  preservation half (published provenance-0 history + head + journal survive).
- **Enforcement:** reservation records base snapshot+sequence and requires
  base==live head (`40001`); the publish wrapper re-validates stored provenance
  and base==live head under the same lock before delegating to the pinned v1
  verifier; triggers enforce reservation-provenance matching and content
  immutability (post-W-1: for EVERY insert).
- **Security:** SECURITY DEFINER functions pin `search_path = pg_catalog`,
  schema-qualify relations, revoke from PUBLIC/anon (and authenticated/service_role
  for the internal publisher); head SELECT-only; RLS owner scoping unchanged.
- **Rollout:** qualify in isolation → deploy capability-2 client → migrate
  production. New client vs old server pauses before writes; old client vs new
  server pauses at the capability fence with a durable outbox (availability
  loss, no corruption). Between production migration and last client upgrade,
  old clients cannot back up at all — an explicit rollout communication item.
- **Qualification integrity:** applies the actual migration files in order (not
  copies); asserts exact SQLSTATEs and head-did-not-move; reviewer-executed
  green both before and after the W-1 fix. Scope limits: sequential race
  modeling, single-user RLS, partial ACL assertions, Windows-only tooling (W-8).

## F. Validation and Evidence Audit

Independently executed (Node 22.23.2; worktree verified unchanged after):
`tsc --noEmit` PASS; `eslint . --max-warnings 0` PASS; `prettier --check` on all
33 changed/new files PASS; `prettier --check .` FAIL with exactly 91 files and
**zero overlap** with the package (formatting claim verified as pre-existing);
`vitest --project integration` full = **103 passed / 1 skipped** (exact match);
gate suites 30/30; unit adapter/restore suites 23/23; `vitest --project unit`
full = 2430 passed / **1 failed** — `tests/portableExportSize.test.ts`, a 5s
timeout under full parallel load (2/2 runs) that passes 2/2 in isolation
(inherited flake, W-2 — zero files in its module graph are in the diff);
`qualify-backup-provenance.mjs` PASS (real PostgreSQL 17.5, actual chain);
`qualify-backup-generations.mjs` PASS.

Reviewed but NOT executed (would overwrite evidence artifacts or require
builds): `build:e2e`, `e2e:journeys:p0` (25/25), `build:sync`, `e2e:sync`
(52/52), SH-04/SH-13 focused Playwright (2/2) — specs and harness read
line-by-line instead.

**Toolchain discrepancy:** browser-lane evidence (and its build artifacts) ran
on Node 24.3.0/npm 11.4.2 while engines pin Node `>=22.22.1 <23` and
`.nvmrc` = 22.23.2. Real qualification gap, fully disclosed; deterministic
gates (including reviewer reruns and both PostgreSQL lanes) are green on Node 22. Smallest closure: re-run `build:e2e` + the browser lanes under Node 22 or
record an explicit waiver.

**12-scenario evidence matrix:** F1 stale-dirty-no-capture PROVEN; F2 stale
pending capture PROVEN; keep-local resolution PROVEN; old-client fencing PROVEN
(SQL lane + capability test); concurrent publication PROVEN; interrupted
reservation PARTIAL (reserve idempotency double-only → now also SQL-asserted in
finalization); lost acknowledgement PROVEN (mutual negative controls); process
restart PARTIAL (no close/reopen test); valid publication PROVEN; remote
recovery PROVEN except the restore→verified-base write (unpinned); TOCTOU
residual PARTIAL (classification accurate; residual itself unpinned by test);
partial-migration/old-client PARTIAL (dual legacy+normal capture branch
untested). F6: guard PROVEN, malformed fail-closed PROVEN, transactional
re-read NOT proven by a discriminating test.

## G. Whole-Diff Findings

| ID  | Severity | Confidence | Location                                                                        | Expected vs actual                                                                                                                                                     | Impact                                                                                      | Direction                                                  |
| --- | -------- | ---------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| W-1 | Medium   | High       | migration trigger `backup_generation_require_reservation` (legacy ELSIF branch) | Expected: every insert matches a provenance-1 reservation. Actual: provenance-0 insert accepted at a reserved identity → PK occupation → permanent publisher wedge     | Per-account availability; head integrity preserved; not reachable by unmodified old clients | **FIXED in finalization** + qualification cases            |
| W-2 | Low      | High       | `tests/portableExportSize.test.ts` (inherited)                                  | Expected: green under `qa:fast`. Actual: 5s timeout under full parallel load (2/2), passes isolated (2/2)                                                              | Host-dependent ledger; no product impact                                                    | Classified `FLAKY_TEST`/environment                        |
| W-3 | Low      | High       | `conflict.ts` → `restore.coordinator.buildRestorePreview`                       | Expected: malformed conflict state degrades only publication. Actual: whole backup panel blanked (caught at call sites, no crash)                                      | UX degradation in an extreme state                                                          | **FIXED in finalization** + 2 tests                        |
| W-4 | Low      | High       | `backupConflictResolution.ts` trailing maintenance                              | Expected: result reflects the resolution. Actual: post-commit maintenance failure reported as resolution failure; preview not refreshed                                | Confusing failure UX after a committed decision                                             | **FIXED in finalization**                                  |
| W-5 | Low      | High       | `generationFormat.ts` comment                                                   | Comment conflated content protocol 2 with capability 2; dead `[1, 1]` array                                                                                            | Misleading                                                                                  | **FIXED in finalization** (comment)                        |
| W-6 | Low      | High       | migration publish idempotent shortcut                                           | Skips checksum/chunk-count re-check on idempotent return                                                                                                               | Informational only                                                                          | Accepted as-is                                             |
| W-7 | Low      | High       | final report §F5 + tests                                                        | Evidence-list claims without discriminating tests (conflict re-read; unverified-proof conjunct; restore→verified-base write; dual-capture branch; restart persistence) | Claim/evidence mismatch                                                                     | Report amended in finalization; tests listed as follow-ups |
| W-8 | Info     | High       | `qualify-backup-provenance.mjs`                                                 | Windows-only paths; not CI-wired                                                                                                                                       | F4 lane regenerates only on Windows+PG17                                                    | Open hardening                                             |

No regressions found in local-first behavior, ownership/account isolation,
restore V1, sync/outbox accounting, crash recovery, compatibility, security, or
previously working features. The five touched legacy test suites changed only
fixtures; assertion sets unchanged. `package-lock.json` untouched.

## H. SH-04 / SH-11 / SH-13

- **SH-04 — PRESERVED, coverage genuine.** New test: SQL-trigger failure
  injection on `workout_logs` (no production hooks), user-visible failure state
  asserted, durable `app_meta.workout.pending_save` asserted via SQL, genuine
  cold remount, recovery banner, retry, exactly one `workout_logs` row in SQL,
  pending key cleared. DB- and UI-level. Not re-executed by the reviewer
  (evidence-artifact safety); spec reviewed line-by-line.
- **SH-13 — PRESERVED, coverage genuine.** Real modal creation, Project/Goal
  chips with `aria-pressed`, DB-asserted associations, cold reload, cancelled
  edit with a real negative assertion (DB unchanged), edit clearing only the
  goal. Non-tautological. Not re-executed; spec reviewed line-by-line.
- **SH-11 — PARTIAL/UNVERIFIED (native).** The native scheduling-rejection
  branch is unexecutable in the web export (the web scheduler returns `null`
  before native scheduling is attempted). Web-side `runTimerStartup` coverage
  does not substitute. Must remain an explicit partial disposition until an
  Android/iOS run exists.

## I. Remaining Release Requirements

1. Hosted Supabase qualification (Auth/JWT→`auth.uid()`, PostgREST RPC routing,
   RLS, concurrent publishers, lost responses).
2. Production migration authorization + rollout plan (after the W-1 fix),
   including the old-client pause window communication.
3. Actual old installed binary against the new server.
4. Native qualification (Android/iOS lifecycle; SH-11 native scheduling
   rejection).
5. Browser lanes on pinned Node 22 (or waiver): `build:e2e`, SH-04/SH-13, P0
   journeys, `build:sync`, sync journeys; full `npm run e2e`.
6. SH-20 dependency advisories; SH-21 cloud-artifact inspection.
7. F4 qualification portability/CI (W-8) and the remaining SQL negative cases.
8. Hosted multi-device recovery drill end-to-end.

## J. Integration Recommendation

**ACCEPT_WITH_CONDITIONS.**

Conditions BEFORE integration (all small, all in unapplied/uncommitted
artifacts):

1. Fix W-1 in the migration + add its qualification cases + re-qualify green.
2. Amend the final report (W-1 disclosure, evidence-list qualification).
3. Correct the validation ledger (W-2 flake classification).

Conditions legitimately outstanding until release certification: everything in
Section I. W-3–W-6 and W-8 are hardening, not integration conditions.

Explicitly: no material unmitigated data-loss defect exists in this package —
W-1 is an availability wedge with head integrity preserved, and the disclosed
residuals (D.1, D.2) are bounded, owner-visible, and architecture-consistent.

## K. Release Readiness

**NOT READY FOR RELEASE**, independent of the integration verdict. Local
PostgreSQL qualification passing is not a substitute for hosted certification.
Accepting this source package says nothing about production deployment
readiness.

## L. Exact Next Steps and Finalization Record

Smallest justified sequence, as issued to the implementation owner (the review
phase itself performed none of these):

1. Fix W-1 (migration trigger + qualification cases) → re-qualify green.
2. Amend the final report per conditions 2–3.
3. Re-run `typecheck` / `lint` / `test:unit` with an honest ledger.
4. Commit the package as one controlled change referencing this report (no
   push/merge without the normal review lane).
5. Before release: W-3/W-4 hardening, then execute Section I.

**Finalization record (same session, post-review, operator-authorized):** steps
1–5's local half were completed: W-1 fixed and qualified (hijack-resistance,
reservation idempotency, cleanup preservation cases added; PASS on PostgreSQL
17.5); report amended (§K acceptance response added, evidence-list corrected,
flake classified); W-3/W-4/W-5 fixed with 2 new preview tests; full gates
re-run (typecheck, lint, unit, integration, both qualify lanes green — unit
retains the classified W-2 flake); the package committed as one controlled
change. Hosted/native/release gates (Section I) remain external.
