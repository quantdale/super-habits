# Critical Integrity, Cross-PR Acceptance & Controlled Main Integration — Correction Campaign A

> Campaign B correction (2026-10-23): this report is historical evidence.
> The later report-only commit advanced remote main to
> `02d43088e10170d03f9db44c887227a9705f8dff`, not the `d682abaf` listed in
> section P. The zero historical production-deployment statement in section P
> was incorrect: historical Vercel production deployments exist. An empty
> GitHub Deployments response cannot establish Vercel deployment history.
> No new production deployment was reported for Campaign A's integration;
> live provider verification remains a separate requirement. Section Q's
> all-zero ordering repair suggestion is not a safe cohort predicate by itself
> and must not overwrite legitimate ordering. See Campaign B's report and plan.

Campaign ExecPlan: `.agent/execplans/critical-integrity-cross-pr-acceptance-a.md`
Base: `origin/main` = `0259c2a72bb71ba3f9459cd071b791feb2a4ff35`
Candidate: `integration/full-spectrum-correction-a` → PR #91

## A. Executive verdict

**INTEGRATED_TO_MAIN** — the six workstreams (PRs #85–#90) and this campaign's
critical data-integrity corrections were integrated into `origin/main` through a
single non-force merge (PR #91) after every mandatory engineering gate passed on
the exact combined SHA, with the dependency-advisory gate honestly red, the
Vercel production hold preserved and unchanged, and production release
explicitly NOT authorized. Final remote main SHA and post-integration evidence
are recorded in section P.

## B. Git provenance

| Item                              | SHA                                                                       |
| --------------------------------- | ------------------------------------------------------------------------- |
| Starting `origin/main`            | `0259c2a72bb71ba3f9459cd071b791feb2a4ff35` (verified at recon; unchanged) |
| PR #85 head (branding)            | `c88b4d40fcad36a3ba038217a8c9243d47dc0b61` — merged `--no-ff`             |
| PR #86 head (security/migration)  | `f632b00b354a662ba869a1401ddac5fd1623bff1` — merged `--no-ff`             |
| PR #87 head (OPFS startup)        | `4132a23c6a1966b5f5d30d33b812f012bd7029b2` — merged `--no-ff`             |
| PR #88 head (backup schema guard) | `cda1e378e54df37b86c889024b9ef551a0dcf99c` — merged `--no-ff`             |
| PR #89 head (signing provenance)  | `a0a4e2ceb442e31b56e5f2d0207c42f0a9483b6f` — merged `--no-ff`             |
| PR #90 head (release readiness)   | `0bf967be94c099790a6e20696f513c0b256437a0` — merged `--no-ff`             |

All six heads were byte-identical to the owner brief's last-verified references
at recon, and all six are in the candidate's ancestry (verified with
`git merge-base --is-ancestor`). Campaign commits on top of the merge stack:

| Commit     | Content                                                                                 |
| ---------- | --------------------------------------------------------------------------------------- |
| `4bb800f3` | storage-safety core + fail-closed transactions (CORR-A-02/A-04)                         |
| `02588779` | multi-tab ownership + reset sentinel + central write-failure surfacing (CORR-A-02/A-03) |
| `ac7c1f61` | mandatory storage negative tests + transaction-gate classification                      |
| `e4cdb0b4` | backup-generation guard hardening + PR #87 review corrections                           |
| `25b48e3f` | #89/#90 governance corrections + signing falsification guard                            |
| `b67be422` | PR #85 visual closure + planning flake budget + crash fix                               |
| `1ff894cd` | branding gate fix                                                                       |
| `884f9ebd` | rethrow-style durable-write classification                                              |
| `e5176952` | final-review P1 guard evasions + P2 corrections                                         |

Recovery reference: pre-campaign primary worktree state is preserved as branch
`campaign/ws02-dependency-scope` @ `f632b00b` (pushed to origin). The
`sh-branding` worktree (holding `main`) was never touched.

## C. Critical storage-safety investigation (CORR-A-02)

**What can be prevented.** A rejected durable write is now DETECTED and
CLASSIFIED at one central seam (the transaction gate in `core/db/transactions.ts`
plus the 21-entity commit seam in `core/sync/syncedMutation.ts`):
`QuotaExceededError`/full-disk shapes become actionable copy ("Storage is full…
export a backup from Settings → Portable data"), blocked storage access and
missing capability get their own honest messages, and ordinary application
errors pass through UNWRAPPED (the exact original object). No write path can
claim success after a storage failure: the Todo editor keeps the typed input
(open problem #8/#9/#10 pinned by tests), the quick-add draft survives (the
submit contract clears input only on a resolved persist; this campaign fixed the
validation path that violated it), and the workout save path keeps the finished
session with its existing retry affordance.

**What cannot be prevented — stated honestly.** No API can stop the browser or
OS from evicting OPFS origin storage or the user from clearing site data.
`navigator.storage.persist()` (one-shot, silent on Chromium, at most one native
prompt elsewhere; every outcome tolerated) only reduces eviction likelihood.
Where both storage stores clear together the loss is unobservable and is
documented as such.

**Implemented surface.** `core/storage/storageSafety.ts` (classification,
`navigator.storage.estimate()` pressure levels with documented thresholds,
guarded persistence request — every entry point degrades to
`'unavailable'`/`'unknown'` instead of throwing); `core/storage/storageSentinel.ts`
(a localStorage sentinel vs an `app_meta.db.identity_marker`: a sentinel that
outlives the database proves a reset and produces ONE recovery notice pointing
at backup restore / portable import — detection, not prevention, cause-neutral);
`core/storage/StorageSafetyHost.tsx` (post-bootstrap duties, best-effort, never
breaks startup); storage-classified bootstrap copy (quota → "do not clear site
data", never "your browser is unsupported" for capable browsers).

**Mandatory negative tests (10/10).** 1+9+10 quota-failed Todo write →
classified `StorageWriteError`, zero rows, retry = exactly one row (integration,
real SQLite); 2 quota-failed workout save → no partial session rows, retry
idempotent (integration); 3 interrupted generation capture → no dangling capture
metadata, user rows untouched, recovery complete (integration); 4 failed
storage init → classified copy + clean retry + handle released so OPFS
connections cannot stack (unit); 5 estimate API unavailable; 6 persistence
request rejected; 7 blocked storage access (unit); 8 write rejected after the
optimistic loading presentation → input preserved + guard released + failure
delivered to an explicit handler (unit). Plus real-engine rollback (injected
failure between two atomic writes commits NEITHER) and concurrent-writer
serialization proofs (integration).

## D. Multi-tab OPFS assessment (CORR-A-03)

Model: **one authoritative database writer per origin**, enforced through the
Web Locks API (`navigator.locks`, `superhabits.db.owner`, `ifAvailable` probing)
BEFORE the OPFS open — a contended second tab is told immediately ("already open
in another tab… close the other tab, then try again") instead of stalling in
`openDatabaseAsync` behind the first tab's write lock. PR #87's 30 s bound
remains as the fallback where Web Locks is unavailable and for wedged-worker
stalls. Held locks auto-release with the tab (mirroring OPFS handle lifecycle);
retries REUSE a held claim (no self-contention); the claim releases on unmount
(final-review correction for the ErrorBoundary-remount edge); the timed-out
probe path cannot orphan a lock. No polling anywhere. Tested: acquisition,
contention, retry-after-close, N-tabs-one-writer, API-absent and
request-rejects degradation, and the message contract (never "clear site data").
The E2E two-tabs journey asserts the new contention contract while keeping the
pre-ownership fallback copy as an accepted alternative.

Timeout/late-resolution correctness (PR #87 review): timer cleanup in `finally`;
late rejection consumed by the race (no unhandled rejection); a timed-out open
is re-adopted by `getDatabase()`'s memoized promise — exactly one
`openDatabaseAsync`, no stacked handles (pinned by tests); the success path now
clears a stale `dbError` (F3); abandoned runs stop between pipeline stages and
cannot steal the account-task token (F4); the web timeout copy now names the one
real exit for a wedged worker — "If it keeps happening, reload this page" (F1).

## E. Transaction atomicity (CORR-A-04)

`withSQLiteTransaction`'s non-transactional fallback was reachable only by
unit-test doubles (Expo SQLite native and web, and the better-sqlite3 harness,
all implement `withTransactionAsync` — verified across the adapter surface and
~90 doubles). It is now **fail-closed** (`SQLiteTransactionUnavailableError`);
test compatibility lives in the doubles (57 updated), separating test
convenience from production atomicity. Storage-failure classification was added
at the gate itself after an integration test proved the backup-capture path
bypassed the mutation-level wrap. Rollback is asserted on the REAL engine:
failure between two writes commits neither; concurrent transactional writers
serialize without interleaving. Migration-6's transactional correction (PR #86)
is preserved and independently reviewed (section G).

Residual, documented: on web, a non-transactional write issued concurrently with
a transaction can still interleave at the adapter level (the app's
serialization tail covers transactional callers); impact is bounded to
local-only metadata writes and is recorded as a precise next action.

## F. PR #85 visual closure

Both hosted failures (run `39814238152`, head `c88b4d40`):
`settings-top-390-light-linux.png` 443 px and `settings-top-1280-dark-linux.png`
575 px. Artifact-level proof (expected/actual/diff triples in
`.agent/evidence/campaign-a/run-39814238152/`): the diff masks confine every
changed pixel to ONE line — the Settings Theme-mode helper text where the
canonical branding rename renders `super-habits` instead of `SuperHabits`.
Wrapping, truncation, contrast and layout are identical; no unrelated UI change.

Correction: exactly 2 of 30 goldens updated per platform — `linux` baselines
from the hosted actual captures (the canonical Linux capture environment),
`win32` baselines from fresh local Windows captures of the same screens (428/612
px, same single-line confinement) — never bulk-regenerated, never copied across
platforms. `maxDiffPixels: 0` preserved, no masks. Reviewed note in
`docs/ui-ux/v3-audit/w15/golden-manifest.md`. Full visual suite: **34/34 green**
(30 goldens + 4 harness self-checks) on win32.

A local capture during this work exposed a real product crash this campaign had
introduced (`useAppNavigation` above `NavigationProvider` in the tree):
fixed in `b67be422`, and the episode is retained as evidence that the visual
gate catches non-visual regressions.

Planning flake ("rejected goal rename…", run 39814238152's recovered failure):
classified **KNOWN_TEST_SYNC** with source-level proof — the renamed-row wait
was the sole sync point for a transaction-commit → remount → `Promise.all`
reload → render chain on the 5 s default budget, violating the repo's own
WM2.4/CG-9 bounds-sized-to-meaning contract. Fixed with an explicit 20 s bound
on that single locator (assertions unchanged); the product save/retry path was
verified correct.

## G. PR #86 independent review

Independent review verdict: **OK with notes**. The migration-6 correction is
real and correctly placed: DDL + ordering backfill + version bump share ONE
`applyMigration` transaction (base had the ALTER outside); SQLite DDL rollback
is proven on the real engine; retry re-enters correctly (rolled-back attempt
leaves no column, so `addedSortOrder` re-fires the backfill); exactly-once
version advancement; `EXPECTED_SCHEMA_VERSION` post-assertion intact; the
failure-injection test is genuinely discriminating (it fails on the old
placement — verified by reasoning through the injected crash window). Backfill
ranks `created_at` ascending over live rows; a pre-migration v5 UI persisted no
custom ordering in that column, so nothing user-authored is rewritten.
Dependency work: brace-expansion overrides sit inside the parents' declared
ranges; the lockfile's resolved inventory is byte-equivalent to PR #86's
validated lock (0 version diffs) with exactly the two intended bumps vs `main`;
no platform-optional packages pruned (131 platform entries intact across
esbuild/rollup/unrs/lightningcss/supabase-cli); allowlist empty; the audit
honestly reports only `braces` + `node-forge`.

Open P2 (recorded, not fixed — append-only migration rule): a database left by
the BASE code's crash window (autocommitted `sort_order` ALTER + version still 5) re-enters block 6, sees `addedSortOrder === false`, skips the backfill and
keeps `sort_order = 0`; neither block 6 nor block 24's repair detects this
cohort. Reachability is narrow (the base placement was never deployed). Precise
next action in section Q.

## H. PR #87 independent review

Two review passes (both runners lacked shell; source-level with file:line
proof). Mechanism verdict: timer cleanup PASS; late rejection consumed PASS;
late-success re-adoption PASS (one `openDatabaseAsync`, no stacked OPFS
handles); retry ownership PASS for connections; copy accuracy PASS; ownership +
timeout composition PASS. Findings corrected in this campaign: F1 (timeout copy
omitted the only real exit for a wedged worker — fixed), F2 (two-tabs journey
contract vs the new ownership gate — updated, not weakened), F3 (stale
`dbError` race on retry — fixed), F4 (abandoned pipeline runs + account-token
theft — fixed). Residual P2s recorded (F6 `dbReady` marker skip on late
success; the stale-copy hedge when ownership is held).

## I. PR #88–#90 acceptance

All three were reviewed adversarially; the review returned **BLOCK** on seven
P1 guard-effectiveness gaps (the guards delivered less than their claims). All
seven were corrected and are now mutation-proven by the rewritten hermetic
suite `tests/backupGenerationSchemaGuard.test.ts` (23 cases; temp-copy fixture
that also removes the in-place-mutation race with
`planningSchemaConvergence.test.ts`):

- per-table RLS (the old test's `\$` template literal made it vacuous — each
  table now gets a behavioral removal mutation);
- owner predicates allow-listed to strict `user_id = auth.uid()` shape —
  disjunctions (`… OR true`), comment smuggling (`true /* … */`) and blanket
  predicates all reject (final-review P1);
- privilege reset scoped to the provenance migration's five-table block;
  deleting it rejects;
- `SECURITY DEFINER` + `search_path` bound per function block with comments
  stripped and line-bound ALTER fallback — one surviving pin, a commented pin,
  or a sibling's ALTER no longer masks an unpinned definer;
- write-shaped grants banned across the WHOLE chain, with or without the
  `public.` qualifier, plus `ON ALL TABLES IN SCHEMA` and `ALTER DEFAULT
PRIVILEGES` bans (final-review P1s);
- retired v1 publisher: re-grant ban spans the entire chain plus schema-wide
  EXECUTE shapes; generation functions never grantable to `anon`;
- the PASS output itself now states "static source validation only — NOT hosted
  certification" and a test asserts the honesty claim.

PR #89: the `credentialsSource` record check is now two-sided (an unpinned
profile requires the record to assert the unpinned reality AND forbids pin
claims; a pinned profile requires the actual value), with the M4 falsification
("`credentialsSource` is pinned in `eas.json`") pinned as a regression test.
Fabrication detection widened to paraphrases ("production-signed"). Keystore /
artifact-signature distinction preserved; no signed artifact is ever claimed.

PR #90: the verdict can no longer read release-ready from repository-local
checks — `computeVerdict` returns `REPO_CHECKS_CLEAR` (explicitly not release
authorization) or `BLOCKED`, `releaseAuthorized: false` is constant, and a
negative control proves no verdict shape can claim release readiness. Owner
action accounting now scans the actionable surfaces recursively (NC-2: an
out-of-tree marker counts), accepts bold/1-2-digit inventory rows, and turns
unreadable documents into named blockers (never a crash). The production hold
check treats ANY pattern-shaped deployment key with a non-false value as a
conservative bypass (NC-1). Exit code and header now match the verdict
semantics.

## J. Combined integration

Single acceptance branch `integration/full-spectrum-correction-a` from
`origin/main`; the six branches merged `--no-ff` in the order 86 → 87 → 88 →
89 → 90 → 85 with **zero textual conflicts**. Git's automatic results were not
accepted blindly: the merged `package.json`/`package-lock.json` were verified
semantically (root name `super-habits`; #86's brace-expansion overrides intact
inside parent ranges; #90's `release:readiness` script present; resolved
package-key inventory identical to PR #86's validated lock; exactly the two
intended `brace-expansion` version bumps vs `main`; 131 platform-optional
entries intact). One integration-breakage surfaced and was fixed:
`tests/releaseReadiness.test.ts` could not even COLLECT on the merged tree —
PR #90's script carried a `#!/usr/bin/env node` shebang that Vite's transform
rejects on import (the other scripts have none); removed, suite green.

## K. Validation ledger (exact candidate SHA `1ff894cd`→`e5176952`)

| Command                                     | Result                                                                                                     |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `npm run typecheck`                         | 0 errors                                                                                                   |
| `npm run lint` (`--max-warnings 0`)         | 0 errors / 0 warnings                                                                                      |
| `npx vitest run` (unit + integration)       | **3174 passed / 3 skipped / 0 failed** (308 files)                                                         |
| `npx playwright test --project=visual`      | **34/34 passed** (win32; 30 goldens + 4 self-checks)                                                       |
| `node scripts/validate-supabase-schema.mjs` | PASS + honesty disclosure                                                                                  |
| `node scripts/audit-runtime-deps.mjs`       | FAIL by design — exactly `braces` + `node-forge` HIGH, allowlist empty                                     |
| `npm run release:readiness`                 | BLOCKED, exit 1 (advisories + 58 owner markers + R01–R16)                                                  |
| `npm run brand:inventory`                   | OK                                                                                                         |
| `npm run agent:plan:validate`               | valid                                                                                                      |
| `npm run build:e2e`                         | hermetic export OK (0 Supabase hosts)                                                                      |
| Hosted CI on PR #91                         | `quality` red on the advisory gate only; `e2e` green incl. Linux visual corpus (run recorded in section P) |

Skipped / not executed (never described as passed): native Maestro lanes
(no provisioned device in this environment), simulation scenario lanes beyond
the CI-included self-tests, hosted Supabase certification (no credentials).
Flakes: one Vitest worker-RPC timeout under full-suite CPU load
(`Timeout calling "onTaskUpdate"`, no product error; suite still 0 failed) —
classified ENVIRONMENT. Retry ledger: the planning flake's single hosted retry
is the documented KNOWN_TEST_SYNC fix (section F); no retries were needed for
any campaign test.

Tooling limitation recorded honestly: the campaign's delta-mode lint tracker
repeatedly re-reported two **stale** findings on `core/providers/AppProviders.tsx`
(its coordinates predate the fixes) that contradict `eslint --no-cache`, `tsc`,
`npm run lint`, an active LSP probe (0 findings) and direct grep evidence; the
repo gates are the contract and are green.

## L. Security posture

`braces` GHSA-vfj7-8cjw-p6xm and `node-forge` GHSA-86w9-cpqp-85rv remain
**unresolved and red** (both `first_patched_version: null` across affected
ranges; build-time-only reachability). No waiver, no allowlist entry, no
severity change was made; the allowlist stays empty so any regression is
visible. PR #86's real remediation of the `brace-expansion` family is preserved
(overrides inside parent ranges; lockfile proves the two bumps). Source
integration is explicitly NOT security-risk acceptance: the advisory gate stays
a named release blocker in `release:readiness` and the report.

## M. Hosted cloud certification

Actual hosted evidence: GitHub Actions CI on the integration PR (section P).
Static/local only, explicitly NOT hosted certification: the backup-generation
schema validator (its own output now says so), the release-readiness verdict,
and the signing-posture record. Hosted Supabase RLS/Auth/backup verification,
Vercel live-API re-verification, and device-native certification remain
EXTERNAL (no credentials/devices in this environment) — no PASS is claimed for
any of them.

## N. Independent reviewer findings

Three adversarial lanes reviewed work they did not implement (separate engines;
the two external CLI lanes failed for infrastructure reasons — Claude OAuth
expired, Codex sandbox rejection — and are recorded as ENVIRONMENT, their
reviews relaunched on the builtin reviewer). Final combined-diff review verdict:
**OK with notes** after correction of its P1s.

| Finding                                                                           | Sev  | Disposition                                                                         |
| --------------------------------------------------------------------------------- | ---- | ----------------------------------------------------------------------------------- |
| Guard predicate check bypassable (`OR true`, comment smuggling)                   | P1   | FIXED (allow-listed predicate shape + evasion mutation tests)                       |
| Write-grant regex misses unqualified/schema-wide/off-pattern grants               | P1   | FIXED (whole-chain scan + qualified-optional match + two new bans + mutation tests) |
| `search_path` pin masked within block (comments, sibling ALTER)                   | P1   | FIXED (comment stripping + line-bound ALTER + mutation test)                        |
| Vacuous per-table RLS test (escaped template literal)                             | P1   | FIXED (behavioral per-table removal mutations)                                      |
| Privilege-reset check satisfied anywhere in chain                                 | P1   | FIXED (scoped to provenance five-table block + mutation)                            |
| `credentialsSource` record check one-sided                                        | P1   | FIXED (two-sided + M4 falsification regression)                                     |
| Owner-action under-count + READY-from-local-verdict                               | P1   | FIXED (recursive scan, NC-1/NC-2 controls, `REPO_CHECKS_CLEAR` semantics)           |
| Timeout copy lacked the wedged-worker exit (reload)                               | P1   | FIXED                                                                               |
| two-tabs journey vs ownership gate contract                                       | P1   | FIXED (spec updated, assertions retained)                                           |
| Stale `dbError` race / abandoned-run token theft                                  | P2   | FIXED                                                                               |
| Quick-add validation cleared typed input                                          | P2   | FIXED (reject-on-validation + single notice)                                        |
| `release-readiness` exit code/doc mismatch                                        | P2   | FIXED                                                                               |
| Dead `core/storage/**` lint exemption                                             | P2   | FIXED (removed)                                                                     |
| Ownership lock after ErrorBoundary remount                                        | P2   | FIXED (release on unmount)                                                          |
| Misclassification surfaces (bare "quota" wording, SQLite code 22, legacy Firefox) | P2   | FIXED (tightened + collision negative controls)                                     |
| Migration crash-window cohort unrepaired                                          | P2   | OPEN → section Q (append-only migration rule; next campaign block 26)               |
| Web non-transactional write interleave (adapter level)                            | P2   | OPEN → section Q (documented; bounded impact)                                       |
| Release-readiness inventory regex under-counts restyled rows                      | P2   | OPEN → section Q (fail-closed floor is the marker scan)                             |
| `dbReady` marker skipped on late-success adoption                                 | INFO | OPEN → section Q                                                                    |
| Backfill tie/undelete ordering semantics                                          | INFO | OPEN (deterministic; recorded)                                                      |

## O. Production safety

Vercel hold: `vercel.json` `git.deploymentEnabled.main: false` is present and
**byte-unchanged** in the candidate (0-line delta vs `origin/main`) — the merge
carries exactly the configuration that was empirically proven on BOTH projects
(`super-habits` `prj_lv9lvnsEH1hLuiRNCFIRQCz16ZQr`, `superhabits`
`prj_RYrRGteH3w6pSYERrPDL27DJJAAd`) by the prior campaign's read-only
verification (both: `main` is the production branch, pre-hold every `main` push
built a production target; post-hold verified). Live re-verification is
EXTERNAL (no Vercel token in this environment) and is listed in section Q. The
PR-level Vercel activity on #91 is a **preview** deployment, which does not
touch production. GitHub Actions failure is treated as no evidence about Vercel
behavior, per policy.

## P. Integration result

Integration was performed as ONE non-force merge of PR #91
(`integration/full-spectrum-correction-a`) into `main`, after hosted CI on the
exact candidate: `quality` red **only** on the pre-existing dependency-advisory
gate (all other quality steps green) and `e2e` green including the Linux visual
corpus validating the two updated goldens. Final state recorded after the
push (all re-verified against remote GitHub):

| Evidence                                        | Value                                                                           |
| ----------------------------------------------- | ------------------------------------------------------------------------------- |
| Merge commit (PR #91, non-force)                | `3022e9dd64e3a692d144fd02ec87fe711999022b`                                      |
| Final `origin/main`                             | `d682abaf0bd8c44bd302071d39b9a4d56e59fa6c` (ExecPlan closure on top)            |
| Six PR heads in `main` ancestry                 | `c88b4d40`, `f632b00b`, `4132a23c`, `cda1e378`, `a0a4e2ce`, `0bf967be` — all OK |
| PR states                                       | #85–#91 all `MERGED` (GitHub auto-reconciled; none manually closed)             |
| Production-environment deployments, all history | **0**                                                                           |
| Deployments created after the merge             | **none**                                                                        |
| CI on the integrated head                       | triggered (`d682abaf`, `3022e9dd`)                                              |

Hosted CI on the candidate (`0c05c74f`, run `39887821954`): `e2e` **PASS**
(48m39s, 0 failing steps — feature suite plus the Linux visual corpus
validating the two updated goldens); `quality` red on the dependency-advisory
step only (step-by-step verified). No force push, no protection bypass (the
`Protect Main` ruleset was `enforcement: disabled` throughout), and no manual
PR closure. Two hosted E2E failures found on the first candidate push were
triaged rather than ignored: one was a real stale contract of this campaign's
own making (`infrastructure.spec.ts` asserted the superseded OPFS lock-error
mechanism; fixed to assert the guarantee) and one was a pre-existing flake
(gamification overlay: failed-then-passed, retry gate green, 12/12 locally).

## Q. Remaining release requirements

1. **Dependency advisory policy decision** (owner): remediate `braces`/`node-forge`
   via a framework upgrade path or a governed, dated, path-scoped acceptance —
   the gate stays red until then.
2. **Hosted Supabase/RLS certification** (needs credentials/project access):
   applied migration state, live `pg_policies`/ACLs, PostgREST exposure,
   backup-generation publication and restore authorization.
3. **Vercel live re-verification** (needs token): both projects' deployment
   history and serving production SHA before/after, hold still effective.
4. **Migration block 26** (data integrity, next campaign): repair the
   crash-window cohort (DB at head version with all live rows
   `sort_order = 0` → creation-order backfill), append-only, with regression
   tests for "repairs cohort / never overwrites authored ordering".
5. **Web transaction interleave** (bounded): serialize non-transactional local
   writes through the same tail or route them through `withSQLiteTransaction`.
6. **Native SH-11 runtime certification** on a provisioned device; Android
   signing + artifact provenance (owner custody: `credentialsSource` decision,
   keystore, `apksigner verify` evidence); iOS certification (Apple hardware).
7. Store readiness (console access, ratings, trader status, privacy forms) and
   owner privacy/legal actions (R01–R16, 58 `[OWNER ACTION]` markers).
8. **Branch protection enablement** (admin) — the `Protect Main` ruleset is
   currently `enforcement: disabled`; governance is documentation-only.
9. **Legacy branding compatibility register** (CORR-D items) and the final
   release authorization decision (hold removal — explicit owner act).

## R. Next correction campaign

**Correction Campaign B — native certification + migration cohort repair.**
Highest value from actual evidence: (1) provision the API-36 x86_64 target and
execute the native lane (SH-11 rejection path has never run on a device; the
Pomodoro/AppState/lifecycle classes are the known gaps); (2) append migration
block 26 for the crash-window cohort with discriminating tests; (3) with owner
credentials, run the hosted Supabase certification and the Vercel live audit;
(4) the owner advisory-policy decision so the security gate's state becomes
decidable. A broad re-audit is NOT warranted — the combined candidate has
current adversarial review with every P1 corrected and mutation-proven.
