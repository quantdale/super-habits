# Full-Spectrum Pre-Production Campaign — Report and Correction Backlog

**Date:** 2026-10-22
**Starting `origin/main`:** `0259c2a72bb71ba3f9459cd071b791feb2a4ff35`
**Ending `origin/main`:** `0259c2a72bb71ba3f9459cd071b791feb2a4ff35` (unchanged)
**Merged to `main` during campaign:** nothing
**Production deployed:** nothing · **Vercel hold:** intact · **Destructive cloud actions:** none

ExecPlan: `.agent/execplans/full-spectrum-preproduction-campaign-v1.md`

---

## A. Executive verdict

**`BROAD_PROGRESS_VALIDATED`**

All six workstreams received investigation **and** a committed, validated
increment. Three workstreams produced genuine defect corrections (one of them a
confirmable user-data-loss window); three produced executable gates that were
proven capable of failing. Two pre-existing release blockers were correctly
confirmed as unremediable rather than papered over.

The campaign also **corrected a false premise in the repository's own security
record**: three `brace-expansion` advisories were allowlisted for six weeks on
the claim that no fix existed. Every affected range publishes a patched release.

No production readiness is claimed. `main` is **not** release-ready.

---

## B. Repository provenance

### Branches created (all pushed, none merged)

| Branch                                       | Head       | PR                |
| -------------------------------------------- | ---------- | ----------------- |
| `campaign/ws02-dependency-scope`             | `329cab41` | **#86**           |
| `branding/canonical-super-habits` (existing) | `c88b4d40` | **#85** (updated) |
| `campaign/ws04-web-lifecycle`                | `4132a23c` | **#87**           |
| `campaign/ws03-backup-schema-guard`          | (see PR)   | **#88**           |
| `campaign/ws05-native-identity`              | (see PR)   | **#89**           |
| `campaign/ws06-release-governance`           | (see PR)   | **#90**           |

Worktree used for branding isolation: `../sh-branding` (one writing agent, one
worktree, one owned branch — the shared-config files `package.json`, `app.json`,
`eas.json`, `vercel.json`, and `ci.yml` each had a single writing owner per
branch).

### Untouched

`origin/main`, PRs #57 / #80 / #81 (left in their pre-campaign state), all
historical branches, all existing worktrees, no stashes created or consumed, no
force-push to any shared branch (the single `--force-with-lease` was on
`campaign/ws02-dependency-scope`, my own unshared branch, to correct a lockfile
regression I had introduced myself — see E.4).

---

## C. Workstream results

### WS-01 — Branding and identity · `PARTIAL_IMPLEMENTED`

**Objective:** canonicalize `super-habits` without breaking durable identity.

**Starting condition:** PR #85 draft, `quality` red.

**Investigation:** `quality` was red on the PR's _own_ ExecPlan — three
`Current Checkpoint` fields written in camelCase where the validator
canonicalizes human-readable labels (`modifiedFiles` / `lastValidation` /
`remainingDod`). The repository's inventory was a **file count** (467 files),
which cannot drive a rename because one literal is both live brand copy and
durable identity.

**Implemented:**

- Fixed the ExecPlan schema defect → hosted CI now logs
  `PASS .agent/execplans/canonical-super-habits-identity-v1.md [ACTIVE]` and
  advances to the advisory gate.
- `scripts/legacy-name-inventory.mjs` + `npm run brand:inventory`: classifies
  every tracked occurrence into 11 classes with explicit dispositions. Two-stage
  (path first, then content) so a historical plan quoting `openDatabaseAsync(...)`
  stays _preserved history_ rather than being misfiled as a frozen storage key.
- Gate fails **only** on `brand` / `package` — the two classes this migration may
  change without owner authorization.
- Finished the live brand copy the inventory surfaced in 8 files, and updated the
  E2E selector (`close other super-habits tabs`) that pinned the renamed bootstrap
  copy **in the same change**, rather than leaving it to fail in CI.
- Wired `brand:inventory` into the `quality` job.

**Tests:** `tests/legacyNameInventory.test.ts` (9) — classification rules,
frozen-class non-gating, line reporting, canonical/legacy distinctness, and that
the gate is wired into an npm script.

**Known limitations:** the native package/bundle ID, `superhabits` scheme,
`superhabits.*` storage keys, `superhabits-shell-*` cache prefixes, and
`superhabits-portable-backup` remain **frozen by design**. 297 files of
historical evidence carry the legacy token and must never be rewritten.

**Exact next action:** owner decides native-identity migration strategy (a new
Android package ID installs a _distinct app_ and strands local SQLite). Until
then the ledger is complete and the frozen set is documented.

### WS-02 — Dependency security · `PARTIAL_VALIDATED`

**Objective:** resolve or honestly disposition the two HIGH advisories.

**Investigation:** Both `braces` (`GHSA-vfj7-8cjw-p6xm`) and `node-forge`
(`GHSA-86w9-cpqp-85rv`) genuinely report **`first_patched_version: null`** for
every affected range — verified against the GitHub advisory API, not assumed.
Both reach the production tree **only** through build-time tooling
(`expo→@expo/metro→metro-file-map→micromatch`,
`react-native→babel-jest→@jest/transform`, `tailwindcss→chokidar`), never the
shipped bundle. They cannot be fixed and are correctly still red.

**The real finding:** three _other_ allowlisted entries were wrong. The
2026-09-29 allowlist claimed the 1.x/2.x `brace-expansion` lines had «no
non-breaking fix (npm offers react-native@0.87.1)». **Every affected range
publishes a patched release** (`1.1.21`, `2.1.7`, `5.0.12`). Each resolved copy
was pinned inside the caret range its parent already declares — a patch bump, not
a semver-major swap.

**Implemented:** overrides for all three lines; allowlist now **empty**, so a
regression surfaces as a NEW finding instead of hiding behind a stale rationale.
`isDocumented` / `evaluateAudit` / `main` now take an **injectable allowlist**,
decoupling twelve mechanism tests from live policy (correctly fixing an advisory
had broken the tests _for the matcher_).

**Second finding (separate defect):** `runMigrations()` ran migration 6's
`addColumnIfMissing(todos,'sort_order')` **outside** `applyMigration`. A crash
between that ALTER and the version bump left the column present with
`db_schema_version` still 5; the retry saw `addedSortOrder === false`, skipped
the creation-order backfill, and left **every row at `DEFAULT 0`** — silently
collapsing a user's manual todo ordering. Fixed, with an integration test that
**fails against the old placement** (verified by temporarily restoring it).

**Validation:** `npm ci` PASS from the patched lockfile · `tsc` 0 errors ·
`eslint` clean · `auditRuntimeDeps` 80/80 · `migrations` 11/11 · full suite
**3074 passed / 3 skipped / 0 failed** · hosted Linux CI confirms
`brace-expansion` is **absent from the CI tree**.

**Known limitations:** `braces` + `node-forge` remain red. Build-time-only
reachability is asserted from the dependency graph, not from a runtime
instrumentation proof.

**Exact next action:** owner governance decision on the two null-patch
advisories (accept build-time-only exposure with a dated, path-scoped entry, or
take a framework-major upgrade). **No waiver was added** — that decision is not
mine to make.

### WS-03 — Supabase, backup, recovery · `INVESTIGATION_COMPLETE` + guard

**Objective:** reduce uncertainty about hosted cloud qualification.

**Investigation (read-only):** 21 migrations; all 29 `public.*` tables end with
RLS enabled; the only `USING (true)` is in the v14 baseline that later
migrations correctly repair and that is never replayed against production. Owner
binding is checked **four times** in the restore path, and emptiness is re-checked
**inside** the import transaction. No `service_role` reference exists in client
source. Portable-backup import validates format version and accepts documented
legacy scopes.

**The gap found:** `scripts/validate-supabase-schema.mjs` asserted **nothing**
about the five backup-generation tables or the two privileged functions
(`grep -c backup_generation` → **0**) — the most security-sensitive surface in
the schema.

**Implemented:** guard coverage for RLS on all five tables, owner-scoped policies,
absence of `USING (true)` / `TO anon`, the privilege reset (**TRUNCATE bypasses
RLS**), client read-only on head/reservation/publication, pinned `search_path` on
the definer functions, and the retired v1 publisher staying revoked — plus
negative coverage that mutates the real migration and asserts rejection.

**Tests:** `tests/backupGenerationSchemaGuard.test.ts` (7), two of which prove
the guard can fail.

**Known limitations — hosted state is UNVERIFIED.** No Supabase CLI or
credential exists in this environment. Applied migrations, real `pg_policies`/ACL
contents, and PostgREST exposure are all unverified. Also noted:
`20260814140000_sync_schema_baseline.sql` contains a `FOR ALL TO anon USING
(true)` baseline — safe only because it is never replayed.

**Exact next action:** **EXTERNAL OWNER ACTION** — provide Supabase access (or
activate the project) to run hosted certification. No charge was incurred and no
project was touched.

### WS-04 — Web/PWA · `PARTIAL_IMPLEMENTED`

**Investigation:** shell revision is genuinely content-derived and fail-closed
(not hand-maintained); DB bootstrap failure has a real user-visible error gate;
migrations are per-block atomic. Two real gaps: (1) **nothing in the app handles
storage quota or eviction** — zero references to `QuotaExceededError`,
`storage.estimate()`, `storage.persist()`, or `BroadcastChannel`; (2)
`initializeDatabase()` was the **one unbounded bootstrap phase**, while every
remote phase was bounded at 10 s.

**Implemented (the P1):** OPFS `openDatabaseAsync` can **stall** rather than
reject when another tab holds the origin-wide write lock. Unbounded, that left
the startup gate on "Preparing local workspace" **forever with no retry** —
`BootstrapGate` only renders "Try again" when `dbError` is set, and a promise
that never settles never sets it.

`withLocalDbTimeout` bounds it at a deliberately generous 30 s; the underlying
task is **not cancelled** (only the await is bounded, so a later success is still
adopted); the timeout gets its **own copy** because a stall is neither browser
incapability nor a network problem; and it never advises clearing site data.

**Tests:** `tests/localDbPhase.test.ts` (10) — a task finishing in time is never
failed, a real error is never masked as a timeout, and the copy stays safe per
platform.

**Known limitations:** quota/eviction handling and multi-tab coordination remain
**genuine open gaps** (P0/P2 from recon). No hosted-preview verification was
performed — no Vercel credential.

**Exact next action:** add storage-pressure handling (`storage.persist()` request
at first write, `QuotaExceededError` catch on write paths, visible warning before
loss), tracked as **CORR-A-03**.

### WS-05 — Android / iOS · `PARTIAL_IMPLEMENTED` (static only)

**Investigation:** release is signed with the **debug keystore**
(`build.gradle` `release { signingConfig signingConfigs.debug }`) → Play rejects
it. No production keystore exists anywhere in the repo (correct: creating one is
an owner custody action). `app.json` is correct (`allowBackup: false`,
`SYSTEM_ALERT_WINDOW` blocked, minimal permissions). The _generated_ `android/`
tree is stale relative to `app.json` and is gitignored — it must not be read as
config truth. SH-11's fix shipped (`pomodoro.startup.ts` releases the live claim),
but the rejection path has **never executed on a device**. 27 Maestro flows exist;
selector spot-checks resolved.

**Implemented:** a guard that pins `credentialsSource` provenance. `eas.json`
`build.production` never sets it, so EAS resolves the upload key from **account
state** — no reviewer, and no gate, could answer _"which key signed this?"_ from
source, and the choice was never recorded, so a later edit could change it
silently. The posture record now documents it with the owner resume action, and
keeps stating that a pinned source still does not prove the **artifact** was
signed by it.

**Tests:** `tests/releaseBuildPosture.test.ts` (6, +2 new). The new guard was
verified to **fail first** before the record was updated.

**Known limitations:** **no device or emulator certification.** A live API-36
x86_64 emulator was detected with the app installed, but its APK dates from
2026-08-25 and is stale against current source — so it was **not** used as
evidence. No build was produced. iOS remains owner-deferred (no Apple hardware).

**Exact next action:** owner decides `credentialsSource` (`remote` vs `local`);
then produce a production-signed AAB from a known SHA and record its certificate
fingerprint via `apksigner verify --print-certs`.

### WS-06 — Governance and operations · `PARTIAL_IMPLEMENTED`

**Investigation:** the GitHub `Protect Main` ruleset (id `15001092`) exists but is
**`enforcement: "disabled"`**, and there is **no classic branch protection** on
`main` — governance today is documentation-only. Release authorization lived
entirely in prose; nothing computed an answer. No tag- or release-triggered
workflow exists, and no store-submission automation. Error reporting: none
(startup failure surfaces only through the boot gate).

**Implemented:** `npm run release:readiness` — one verdict from
repository-observable inputs, each a hard blocker: dependency advisories (reusing
the existing gate so it cannot disagree with `quality`), owner actions
(`[OWNER ACTION` markers + R01–R16 rows), the production hold (**including the
wildcard-`true` bypass**, since Vercel precedence lets any `true` match win),
signing honesty, and submit-credential posture.

Fail-closed by construction: every input read returns a result object rather than
throwing, so an unreadable file becomes a _named blocker_ — never a crash and
never a silent zero. The count direction can only **over**-report outstanding
work. It also prints what it **cannot** observe.

**Tests:** `tests/releaseReadiness.test.ts` (8), two proving it rejects a false
signing claim and a wildcard hold bypass.

**Known limitations:** enabling the ruleset needs **administrator authorization**
— not performed. No observability/error-reporting was added (that requires a
privacy review, so it was deliberately deferred rather than bolted on).

**Exact next action:** owner enables the ruleset with an enforceable gate set
(requires the advisory policy decision from WS-02 first, since a permanently-red
required check blocks integration).

---

## D. Source changes

### Implementation

- `core/db/client.ts` — migration 6 ALTER moved inside its transaction (data-loss fix).
- `core/providers/localDbPhase.ts` **(new)** — bounded local DB phase.
- `core/providers/AppProviders.tsx` — use the bound + timeout-specific copy.
- `scripts/audit-runtime-deps.mjs` — allowlist emptied with corrected rationale; injectable seam.
- `scripts/legacy-name-inventory.mjs` **(new)** — classified legacy-name inventory.
- `scripts/release-readiness.mjs` **(new)** — release verdict.
- `scripts/validate-supabase-schema.mjs` — backup-generation guard.
- 8 live brand-copy files + `app.json`-adjacent copy (WS-01).

### Configuration

- `package.json` — `brace-expansion` overrides, `brand:inventory`, `release:readiness`.
- `package-lock.json` — 4 entries (2 version + 2 integrity); **all 57 Linux platform binaries preserved** (see E.4).
- `.github/workflows/ci.yml` — canonical-naming gate.

### Tests

- `tests/integration/migrations.test.ts` — +1 crash-window regression (115 lines).
- `tests/auditRuntimeDeps.test.ts` — decoupled from live policy.
- `tests/localDbPhase.test.ts`, `tests/backupGenerationSchemaGuard.test.ts`, `tests/releaseReadiness.test.ts`, `tests/legacyNameInventory.test.ts` **(new)**.
- `tests/releaseBuildPosture.test.ts` — +2 provenance guards.
- `tests/play-listing-copy.test.ts`, `e2e/journeys/two-tabs.spec.ts` — updated with renamed copy.

### Documentation

- `docs/branding/canonical-name-migration.md` — class ledger replacing the file count.
- `docs/release/release-signing-posture.md` — §5 upload-key provenance.
- `docs/release/store-data-declarations.md` — Play listing copy.
- `.agent/execplans/full-spectrum-preproduction-campaign-v1.md` **(new)**.

---

## E. Security status

### E.1 Genuinely unresolvable (verified against the advisory API)

| Advisory                     | Package      | Range      | First patched |
| ---------------------------- | ------------ | ---------- | ------------- |
| `GHSA-vfj7-8cjw-p6xm` (HIGH) | `braces`     | `<= 3.0.3` | **null**      |
| `GHSA-86w9-cpqp-85rv` (HIGH) | `node-forge` | `<= 1.4.0` | **null**      |

Both production paths are build-time only. **Not** allowlisted; the gate stays
red. Adding an entry requires the same evidence standard that exposed the
`brace-expansion` error: re-check `first_patched_version` on every affected range
before asserting no fix exists.

### E.2 Remediated this campaign

`GHSA-q2hr-2g5m-vwhr`, `GHSA-qhr7-859c-m2p7`, `GHSA-6j4f-fj2g-mc7p` — all three
`brace-expansion` findings fixed by overrides to patched releases. Confirmed
absent from the hosted Linux CI tree.

### E.3 Remaining attack surface (unchanged, not weakened)

No security control was disabled, no severity downgraded, no waiver added, no
check bypassed.

### E.4 A regression I introduced and corrected

My first `npm install` on Windows **pruned 57 non-Windows optional platform
binaries** from `package-lock.json` (`@esbuild/linux-*`, `@rollup/rollup-linux-*`,
…). Committing that would have broken `npm ci` on the Linux CI runner — the
opposite of the intended fix. Detected by diffing the resolved package set
against `origin/main`, then corrected by **surgically patching only the four
affected lockfile entries** instead of regenerating. Verified: 1274 packages,
**57/57** platform binaries preserved, `npm ci` PASS, diff reduced to 42+/10−.
This is recorded because it is exactly the class of cross-platform breakage that
silently passes on one OS.

---

## F. Branding completion

- **Canonical name:** `super-habits`.
- **Active brand status:** no `brand` or `package` class occurrence remains
  (`npm run brand:inventory` → OK).
- **PR #85:** updated. Its `quality` failure was **fixed** (hosted log confirms
  the ExecPlan now passes); it now fails only the advisory gate.
- **Remaining legacy occurrences:** 488 tracked files / 1145 lines, fully
  classified: 297 `history` (preserved), 85 `test`, 26 `guidance`, 29 `storage`,
  34 `native-id`, 3 `backup`, 2 `cache`, 2 `cloud`, 1 `transient`, 1 `tooling`.
- **Migration compatibility:** native IDs, scheme, storage keys, cache prefixes,
  and backup protocol are **frozen**; changing them without a tested migration
  would strand local data or reject existing backups.
- **Cloud projects:** two Vercel projects (`super-habits`, `superhabits`) and one
  connected Supabase project (`superhabits`, id `kruubbynsmxzxfdunaal`) — **not
  inspected** (no CLI/credential) and **not modified**. Consolidation requires
  owner authorization.
- **No claim of total erasure**, and none is possible while compatibility
  requires the legacy identities.

---

## G. Cloud and backup readiness

| Area                          | Local proof                        | Hosted execution |
| ----------------------------- | ---------------------------------- | ---------------- |
| RLS on generation tables      | **guarded + negative-tested**      | **UNVERIFIED**   |
| Owner binding on restore      | verified in source (4 checkpoints) | **UNVERIFIED**   |
| Manifest checksum             | verified in source                 | **UNVERIFIED**   |
| Emptiness-before-restore      | verified (in-transaction)          | **UNVERIFIED**   |
| Portable backup legacy import | verified in source                 | n/a (local)      |
| Applied migrations vs repo    | **UNVERIFIED**                     | **UNVERIFIED**   |

No hosted certification is claimed. There is **no** Supabase CLI or credential
in this environment.

---

## H. Web/PWA readiness

- **Build/export:** not rebuilt this campaign (no web source change beyond the
  bootstrap bound); prior export evidence stands and was not reused as new proof.
- **Persistence/offline:** migration atomicity verified by existing integration
  tests; the **unbounded startup stall is now fixed**.
- **Storage quota/eviction: OPEN** — the app has no handling at all.
- **Multi-tab:** no coordination exists; the second tab correctly shows a gate,
  the first is never notified.
- **Deployment control:** `git.deploymentEnabled.main = false` intact, now also
  asserted against a wildcard bypass.
- **No preview verification** — no Vercel credential.

---

## I. Native readiness

| Aspect                  | Status                                                                                |
| ----------------------- | ------------------------------------------------------------------------------------- |
| Static config           | **PASS** (`allowBackup:false`, minimal permissions, ids consistent)                   |
| Signing                 | **BLOCKED** — debug keystore; no production key (owner custody action)                |
| Upload-key provenance   | **Unpinned** — now documented and guarded                                             |
| Android device/emulator | **NOT RUN** — detected emulator carries a stale 2026-08-25 APK, so it is not evidence |
| iOS                     | **DEFERRED BY OWNER** — no Apple hardware                                             |
| Store submission        | **NOT READY** — no artifacts, no console records, R01–R16 open                        |

No Android or iOS certification is claimed.

---

## J. Governance and operations

- **Branch protection:** ruleset `15001092` **disabled**; no classic protection.
  Enabling requires administrator authorization.
- **CI:** 3 jobs; `e2e` deliberately independent of `quality`. All campaign PRs
  fail `quality` **only** on the two null-patch advisories.
- **Deployment hold:** intact and now double-asserted.
- **Signing:** unproven, honestly recorded, and now with a pinned-provenance guard.
- **Privacy/support:** 58 `[OWNER ACTION]` markers, 16 inventory rows — all still
  open because they are console/legal/credential work.
- **Observability: none.** No error reporting, crash handler, or telemetry
  exists. Deliberately not bolted on without a privacy review → **CORR-C-04**.

---

## K. Validation ledger

| Command                                        | Result                                 | Where                       |
| ---------------------------------------------- | -------------------------------------- | --------------------------- |
| `npm run typecheck`                            | **0 errors**                           | local, all branches         |
| `npm run lint`                                 | **0 errors / 0 warnings**              | local                       |
| `npm test` (unit + integration)                | **3074 passed / 3 skipped / 0 failed** | local, `0259c2a7`+WS-02     |
| `npm ci` from patched lockfile                 | **PASS**                               | local                       |
| `node scripts/audit-runtime-deps.mjs`          | exit 1 — **braces + node-forge only**  | local + **hosted Linux CI** |
| `tests/auditRuntimeDeps.test.ts`               | 80/80                                  | local                       |
| `tests/integration/migrations.test.ts`         | 11/11                                  | local                       |
| `tests/localDbPhase.test.ts`                   | 10/10                                  | local                       |
| `tests/backupGenerationSchemaGuard.test.ts`    | 7/7 (2 prove rejection)                | local                       |
| `tests/releaseReadiness.test.ts`               | 8/8 (2 prove rejection)                | local                       |
| `tests/legacyNameInventory.test.ts`            | 9/9                                    | local                       |
| `tests/releaseBuildPosture.test.ts`            | 6/6 (guard failed first)               | local                       |
| `node scripts/validate-supabase-schema.mjs`    | PASS                                   | local                       |
| `npm run brand:inventory`                      | OK                                     | local                       |
| `npm run release:readiness`                    | BLOCKED, exit 1 (correct)              | local                       |
| Hosted `quality` (all PRs)                     | FAIL — advisory gate only              | GitHub Actions              |
| Hosted `Validate versioned ExecPlans` (PR #85) | **PASS** [ACTIVE]                      | GitHub Actions              |

**Not executed:** `npm run e2e` (Playwright), visual suite, `qa:native:*`,
simulation lanes, `openspec:validate`. These are unexecuted — **not** passed.
**Retries/flakes:** none observed in the suites that ran.

---

## L. Independent review

The adversarial pass was performed as self-review against the campaign's own
claims (no separate reviewer agent was available in this environment). Material
findings and dispositions:

| #   | Finding                                                                                          | Disposition                                                                                   |
| --- | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| L1  | A renamed bootstrap string was pinned by an E2E selector — the rename would have failed CI later | **Fixed in the same change** (WS-01)                                                          |
| L2  | `npm install` pruned 57 Linux platform binaries from the lockfile                                | **Fixed** by surgical patch; verified 57/57 preserved (E.4)                                   |
| L3  | Correctly fixing an advisory broke 12 tests of the _matcher_                                     | **Fixed** via injectable allowlist seam (WS-02)                                               |
| L4  | Migration-6 fix could have been a no-op if the guard logic were unchanged                        | **Proven** by restoring the old placement and observing the test fail (WS-02)                 |
| L5  | New guards could pass vacuously                                                                  | **Fixed** — 4 tests actively mutate inputs and assert rejection                               |
| L6  | `release-readiness` could crash on unreadable input instead of reporting                         | **Fixed** — non-throwing result objects; unreadable file → named blocker                      |
| L7  | Campaign PRs show red `quality`, easy to misread as campaign breakage                            | **Clarified** — verified per-run that the only failing step is the pre-existing advisory gate |
| L8  | Detected emulator is a tempting false native-evidence source                                     | **Refused** — APK predates current source; no native claim made                               |

**Claims deliberately NOT made:** hosted Supabase certification, Android/iOS
device certification, release readiness, "zero legacy tokens", green security
audit, or a passed E2E suite.

---

## M. Correction campaign roadmap

### Campaign A — Critical integrity (do first)

| ID        | Finding                                                                                                      | Severity | Blocks source? | Blocks release? |
| --------- | ------------------------------------------------------------------------------------------------------------ | -------- | -------------- | --------------- |
| CORR-A-01 | `braces` + `node-forge` HIGH, no upstream patch, build-time only                                             | High     | No             | **Yes**         |
| CORR-A-02 | Storage quota / eviction entirely unhandled; OPFS data can be evicted with no warning or backup prompt       | **P0**   | No             | **Yes**         |
| CORR-A-03 | No multi-tab coordination (`BroadcastChannel`/`navigator.locks`); first tab never told its lock is contested | P2       | No             | No              |
| CORR-A-04 | `withSQLiteTransaction` falls back to **no transaction** when `withTransactionAsync` is absent               | P2       | No             | No              |
| CORR-A-05 | Hosted RLS/Auth/backup certification never executed                                                          | High     | No             | **Yes**         |

**A-01** needs an owner governance decision (accept build-time-only exposure via
a dated, path-scoped entry — with the evidence standard that exposed the
`brace-expansion` error — or take a framework-major upgrade). Validation: gate
green + full suite.

### Campaign B — Cross-platform convergence

| ID        | Finding                                                                                                                               | Severity    |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| CORR-B-01 | Migration-6 crash window — **FIXED**, keep regression green                                                                           | ~~P1~~ done |
| CORR-B-02 | Local DB bootstrap stall — **FIXED**; extend the same bound to other local phases if any appear                                       | ~~P1~~ done |
| CORR-B-03 | SH-11 native scheduling-rejection path never executed on a device                                                                     | P1          |
| CORR-B-04 | No exact-alarm permission (`SCHEDULE_EXACT_ALARM`) for long timers on API 31+                                                         | P2          |
| CORR-B-05 | Native identity migration (package ID / scheme) still undecided; changing it installs a distinct app                                  | P2 (owner)  |
| CORR-B-06 | `native-smoke.yaml` asserts uppercase `DAILY CHECK-IN` but source renders mixed case with CSS `uppercase` — fragile, device-dependent | P3          |

### Campaign C — Infrastructure and operational completion

| ID        | Finding                                                                                             | Severity     |
| --------- | --------------------------------------------------------------------------------------------------- | ------------ |
| CORR-C-01 | Branch protection disabled (ruleset `15001092`) — needs admin auth                                  | High (owner) |
| CORR-C-02 | Production upload key absent; `credentialsSource` now documented, decision still open               | High (owner) |
| CORR-C-03 | No reproducible signed build pipeline / artifact hashes                                             | High (owner) |
| CORR-C-04 | No observability at all (error reporting / crash diagnostics) — needs privacy review first          | P2           |
| CORR-C-05 | Duplicate Vercel project + Supabase project never consolidated (needs non-destructive verification) | P2 (owner)   |
| CORR-C-06 | `dist/` staleness: web export not rebuilt this campaign                                             | P3           |

### Campaign D — Product and branding finalization

| ID        | Finding                                                                                                      | Severity |
| --------- | ------------------------------------------------------------------------------------------------------------ | -------- |
| CORR-D-01 | 26 `guidance` files still use the legacy token (`AGENTS.md`, `.cursor/`, `.github/`) — safe to update        | P3       |
| CORR-D-02 | Native ID / scheme / storage / cache / backup tokens permanently frozen — needs a written exception register | P3       |
| CORR-D-03 | 297 historical files must stay untouched; no action, recorded so nobody "cleans" them                        | —        |
| CORR-D-04 | 58 `[OWNER ACTION]` markers + R01–R16 open                                                                   | Owner    |
| CORR-D-05 | `two-tabs.spec.ts` comment still says `SuperHabits` (cosmetic)                                               | P3       |

---

## N. External owner-action ledger

| Action                                                | Requires                                                                         |
| ----------------------------------------------------- | -------------------------------------------------------------------------------- |
| Hosted Supabase certification                         | Dashboard/project access (or project activation); possible billing authorization |
| Enable branch protection                              | **Administrator** authorization                                                  |
| Decide `braces`/`node-forge` policy                   | Security policy owner decision                                                   |
| Production upload key + `credentialsSource`           | Signing custody; keystore generation on owner-controlled machine                 |
| Store accounts, ratings, trader status, privacy forms | Console access, legal counsel                                                    |
| Android device/emulator certification                 | Fresh build from current SHA (the present emulator's APK is stale)               |
| iOS certification                                     | Apple hardware — **owner-deferred**                                              |
| Vercel project consolidation                          | Non-destructive verification + authorization                                     |
| Production release / hold removal                     | Explicit owner authorization                                                     |

---

## O. Final recommendation

1. **Did all six workstreams get meaningful attention?** Yes — each has an
   investigation, a committed increment, and a precise next action.
2. **Which produced working code?** WS-02 (dependency + migration data-loss fix),
   WS-04 (bootstrap bound), WS-01 (inventory + brand copy), WS-03 (schema guard),
   WS-05 (provenance guard), WS-06 (release verdict).
3. **Which produced validated tests?** All six — 6 new/updated suites, 4 of which
   actively prove their guard can fail.
4. **Which remain external blockers?** WS-03 (hosted), WS-05 (signing/device),
   WS-06 (admin auth), WS-01 (native identity decision).
5. **Which PRs are ready for review?** #86 (strongest — real defect fixes), #85
   (unblocked), #87, #88, #89, #90 — all draft, all failing only the advisory gate.
6. **Which changes remain unverified?** Everything hosted (Supabase/Vercel), all
   native runtime behavior, and the full E2E/visual/simulation lanes (not run).
7. **Highest-risk unfinished items?** CORR-A-02 (unguarded storage eviction → data
   loss), CORR-A-01 (unpatchable advisories), CORR-A-05 (hosted RLS unproven).
8. **What should the next campaign do first?** Campaign A: storage-quota safety,
   then the advisory policy decision, then hosted certification.
9. **Is `main` production-release ready?** **No.**
10. **What must happen before the Vercel hold is lifted?** A green dependency
    gate (or a governed decision), hosted backup/restore certification, a
    production-signed artifact with verified certificate fingerprint, completed
    store/legal owner actions, and explicit release authorization — plus a
    deliberate decision that the hold itself is being released.

---

## P. Campaign status by workstream

| Workstream              | Status                                                  |
| ----------------------- | ------------------------------------------------------- |
| WS-01 Branding          | `PARTIAL_IMPLEMENTED`                                   |
| WS-02 Security          | `PARTIAL_VALIDATED`                                     |
| WS-03 Supabase / backup | `PARTIAL_IMPLEMENTED` (hosted `INVESTIGATION_COMPLETE`) |
| WS-04 Web/PWA           | `PARTIAL_IMPLEMENTED`                                   |
| WS-05 Native            | `PARTIAL_IMPLEMENTED` (static only)                     |
| WS-06 Governance        | `PARTIAL_IMPLEMENTED`                                   |

No workstream is `COMPLETE`, and none is claimed to be.
