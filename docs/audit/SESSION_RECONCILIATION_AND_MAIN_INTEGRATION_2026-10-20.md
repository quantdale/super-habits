# SuperHabits — Session Reconciliation and Main Integration

Date: 2026-10-20
Worktree: `D:/Documents/tryPython/superhabits-post-acceptance`
Branch: `fix/post-acceptance-defects`
Base reviewed: `85599dfb` (= `main` / `origin/main` at session start)
Final integration: see "Main Integration" below.

This is the authoritative, end-to-end record of the session that (a) reviewed the
backup-integrity correction package independently, (b) finalized it against the
acceptance conditions, and (c) reconciled a second round of defects found by
re-auditing the session's own claims before pushing to `main`.

---

## 1. Session Timeline

### Phase A — Independent acceptance review (read-only)

The reviewer established the real source state (`85599dfb`, uncommitted
correction worktree) and independently verified the implementation agent's
claims instead of trusting them:

- Personally traced `ensureRecoveryPoint` / `uploadGeneration` / `push` and the
  keep-local resolution path.
- Executed the pinned Node 22.23.2 static gates and reproduced the reported
  integration ledger (103 files / 1 skipped at that time).
- Independently ran `scripts/qualify-backup-provenance.mjs` on a disposable
  PostgreSQL 17.5 cluster applying the actual four-migration chain (PASS).
- Ran three independent read-only sub-reviews (server protocol, test evidence,
  whole-diff/SH-04/SH-13/formatting) and cross-checked their conclusions.
- Verdict delivered as `docs/audit/BACKUP_INTEGRITY_ACCEPTANCE_REPORT_2026-10-20.md`
  (**ACCEPT_WITH_CONDITIONS**), with eight findings W-1…W-8. Key confirmed
  defects: W-1 (provenance-0 reservation hijack could permanently wedge an
  account's publisher), plus residual reporting inaccuracies (F7).

### Phase B — Acceptance response and first finalization (commit `c8700bc0`)

The operator then authorized proceeding with the next steps. This phase:

- Fixed W-1 in the still-unapplied migration (every generation insert must
  match its reservation on sequence + provenance version + base pair) and
  extended the SQL qualification with hijack-resistance, reservation-idempotency
  and cleanup-preservation cases; re-qualified PASS on PostgreSQL 17.5.
- Fixed W-3 (malformed conflict state blanked the whole backup panel), W-4
  (false "resolution failed" after a committed decision), W-5 (comment conflating
  content protocol with capability version), and classified W-2 (an inherited,
  load-sensitive 5s test timeout) and W-6/W-7/W-8.
- Amended the correction report with an acceptance-response section and
  committed the acceptance report as repo evidence.
- Landed everything as a single controlled local commit, `c8700bc0`.

### Phase C — Second reconciliation (this review)

The operator asked to review the entire session, correct anything wrong, and
push to `main`. A fresh audit of the committed state, against Git and executable
evidence, found four further defects that the earlier review and finalization
had missed. Each was first reproduced with a failing test, then fixed:

1. **W-9 — legacy-cutover authority laundering (High).** Publishing a
   _preserved remote_ legacy V2 snapshot (`captureVerifiedRows` / `isLegacyCutover`)
   unconditionally granted the local device a "verified" publication baseline
   (`setVerifiedGenerationBaseHead`) — even when the device's own local rows
   diverged from that remote content. On the next push this falsely authorized
   overwriting the newer remote head (and the mutable rows backing it) without
   owner review. Reproduced with a failing test
   (`does not adopt a preserved remote legacy snapshot as the divergent local
baseline`), which asserted the divergent device must conflict and leave both
   the remote legacy bytes and its own capture intact.
2. **W-10 — dual-capture resolution identity mismatch (Medium).** When both a
   legacy capture and a normal capture were durably present (a mixed-version
   device), keep-local resolution matched on whichever storage key was read
   first rather than the conflict record's actual `localSnapshotId`, and
   wrongly refused a valid resolution ("pending recovery point changed").
   Reproduced (`resolves a normal-capture conflict when a separate legacy capture
is also pending`) and fixed by matching against the conflict's identity.
3. **W-11 — portable import inherited prior-dataset provenance (Medium).**
   A portable file import onto an empty device did not clear
   `backup.verified_generation_base_head`, `backup.verified_legacy_restore`, or
   `backup.observed_generation_head` left by an earlier dataset on the same
   device/owner. The imported dataset could therefore inherit authority to
   replace a current remote generation without review. Reproduced
   (`never claims cloud completeness…` extended to seed stale provenance and
   assert it is invalidated) and fixed inside the atomic import transaction.
4. **W-12 — E2E mock authenticated in-flight requests with global state (Low,
   test-only).** `portable-owner-recovery.spec.ts`'s Supabase mock resolved
   request ownership from a mutable `currentUser` global rather than the bearer
   token actually sent, so an in-flight source-account write was reinterpreted
   as the destination account after the journey switched users. Fixed by
   token-scoped ownership and an HTTP 403 (not an uncaught route assertion) for
   mismatched owners.

Additionally, after W-9's strict guard was introduced, a genuine compatibility
gap surfaced through the sync journey (`new-phone-v2.spec.ts` step 3: "new
activity syncs normally"): a device that had _actually restored_ a legacy V2
backup legitimately needed to continue publishing local edits above that
restored base. An earlier strict version of the guard created an unnecessary
conflict. The final design records an owner/content-bound proof
(`backup.verified_legacy_restore`, local-only) at verified-restore time and
authorizes later first-generation cutover **only** when the preserved remote
content still matches that exact restored base and owner. Tests cover unchanged,
remotely-changed, and wrong-owner bases.

The same audit also re-verified earlier session claims and corrected them where
they had drifted:

- The first finalization's claim that "full `push()` F1/F2 tests" replaced all
  private-seam calls was too broad: some failure-reconciliation tests still
  called the private `publishGenerationContents`. Those now drive the real
  `push()` path, and a file-backed close/reopen restart test was added for the
  previously untested process-restart scenario.
- The final report's historical ledger still cited the pre-W-9/W-10/W-11/W-12
  test counts and lacked the second-pass findings; this document and the plan
  now carry the corrected record.

### Phase D — Full validation (pinned Node 22.23.2 / npm 10.9.8)

Executed in this session, against the final source state:

| Gate                                                                           | Result                                                      |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| `npm run typecheck`                                                            | PASS — 0 errors                                             |
| `npm run lint --max-warnings 0`                                                | PASS — 0 errors, 0 warnings                                 |
| `npm run test:unit` (via `qa:fast`)                                            | PASS — 194 files, 2433 tests                                |
| `npm run qa:fast` (typecheck+lint+unit+guards)                                 | PASS                                                        |
| `npm run test:integration`                                                     | PASS — 103 passed / 1 skipped (623 tests / 2 skipped)       |
| `npm run openspec:validate`                                                    | PASS — 89/89                                                |
| `npm run qa:timezones`                                                         | PASS — 5-zone matrix                                        |
| `npm run backup:qualify` (generations + provenance, real PostgreSQL 17.5)      | PASS                                                        |
| `npm run build:e2e` (hermetic)                                                 | PASS — 0 Supabase hosts                                     |
| SH-04 + SH-13 focused Playwright                                               | PASS — 2/2                                                  |
| `e2e/portable-backup.spec.ts` + `todos.spec.ts` + `workout.spec.ts` (chromium) | PASS — 31/31                                                |
| Full standard E2E (`chromium` + `journeys` + `pwa` + `visual`)                 | PASS — 378 passed, 92 skipped (existing skip set), 0 failed |
| `npm run build:sync` + `npm run e2e:sync` (final exact build)                  | PASS — 52/52                                                |
| `npm run qa:simulation -- --all --mode deterministic`                          | PASS — 23/23 scenarios                                      |

Browser artifacts were written to fresh external result directories; the prior
`dist/` / `dist-sync/` builds were copied to an external evidence directory
before being rebuilt. No prior evidence was overwritten.

Two environment notes, preserved rather than papered over:

- One temporary Node 22 extraction (`Temp/node22/node-v22.23.2-win-x64`) had an
  incomplete npm distribution (`MODULE_NOT_FOUND` on `npm config get`), which
  caused two early `npm run` invocations to exit 1 with no output. A complete
  Node 22.23.2/npm 10.9.8 installation already present on disk
  (`Temp/node-v22.23.2-win-x64`) was used for all recorded gates.
- The first `e2e:sync` run against the then-current build reported 50 passed /
  2 failed (one `new-phone-v2` sync expectation and one portable-owner mock
  assertion). Both root causes were the W-9 compatibility gap and the W-12 mock
  bug above; both were fixed, and the focused (9/9) and complete (52/52) sync
  lanes then passed. The failing-run artifacts are preserved in the session
  evidence directory.

### Phase E — Main integration

With the corrections validated, the package was committed as one controlled
change and pushed to `origin` (branch `fix/post-acceptance-defects`) and then
fast-forwarded to `origin/main`, exactly as instructed. `origin/main` was
verified before and after the push. The unrelated dirty `main` worktree
(preserved untracked iOS evidence) was not touched.

---

## 2. Findings Ledger (this session's second pass)

| ID   | Severity        | Summary                                                                                        | Status                                                                                                                                                                             |
| ---- | --------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| W-9  | High            | Legacy-cutover publication granted false local publication authority over divergent local rows | FIXED — owner/content-bound legacy-restore proof; divergent devices now conflict before any mutable write; 3 discriminating scenarios (unchanged / remotely changed / wrong owner) |
| W-10 | Medium          | Keep-local resolution refused valid conflicts when both capture kinds were present             | FIXED — identity-based matching; regression test added                                                                                                                             |
| W-11 | Medium          | Portable import inherited prior-dataset publication lineage                                    | FIXED — provenance keys cleared inside the atomic import transaction; assertion added                                                                                              |
| W-12 | Low (test-only) | E2E Supabase mock used global mutable auth identity                                            | FIXED — bearer-token-scoped ownership, HTTP 403 for mismatched writes                                                                                                              |

Earlier findings W-1…W-8 remain as recorded in the acceptance report; W-1, W-3,
W-4, W-5 were fixed in Phase B, W-2/W-6/W-7/W-8 were classified or documented
there.

## 3. Corrections to Prior Session Claims

- The Phase B report's "full `push()` path" characterization was incomplete:
  some reconciliation tests still used the private `publishGenerationContents`
  seam. All now drive the real `push()` path; a file-backed restart test closes
  the previously untested process-restart scenario.
- The historical validation ledger in the correction report predates this
  session's second-pass fixes; this document is the current record.
- No prior test was deleted or weakened; every newly found defect is pinned by a
  test that fails without its fix.

## 4. Outstanding Release Requirements (unchanged, external)

Hosted Supabase Auth/PostgREST/RLS/concurrency qualification; production
migration authorization and rollout (including the old-client pause window);
actual old-binary execution against the new server; native Android/iOS lifecycle
and SH-11's native scheduling-rejection run; SH-20 dependency advisories;
SH-21 cloud-artifact inspection. Local PostgreSQL qualification is not a
substitute for hosted certification, and source integration is not production
release readiness.
