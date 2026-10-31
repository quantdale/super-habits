# Correction Campaign B — Native runtime, migration recovery and controlled integration

Date: 2026-10-23 UTC. ExecPlan:
`.agent/execplans/native-migration-recovery-campaign-b.md`.
Draft PR: https://github.com/quantdale/super-habits/pull/93.

## A. Executive verdict

**PARTIAL_PROGRESS_VALIDATED.** Source candidates are published as a **draft**, not
merged. Real-SQLite fixtures prove the historical migration window and preservation
requirements; ambiguous ordering is deliberately not rewritten. A participating
metadata/transaction FIFO, native resource admission/replay tooling and read-only
cloud preflight are implemented. Combined local unit/integration, focused browser,
visual and P0 gates pass. Independent source reviews completed after correction
of three P2 findings. Full broad regression, fresh native runtime and hosted
authorization certification remain open. Production is **not
authorized**; no production deployment, cloud migration or security waiver occurred.

## B. Git provenance

Starting and last reverified remote main:
`02d43088e10170d03f9db44c887227a9705f8dff`. PRs #85–#91 were verified merged;
#91 merge is `3022e9dd64e3a692d144fd02ec87fe711999022b`. Main had not advanced
beyond the supplied historical SHA. Original checkout was clean; unrelated
`sh-branding` holding local main at0259c2a7 was preserved.

Candidate branch: `integration/native-migration-campaign-b`.
Final engineering/test qualification SHA: **`0d8475af7f8f7a3b7ea07d5f8b0981807a5f3256`**.
Initial combined review/test SHA was1afe03a1;0d8475af closes the three reviewed
P2s and adds seven collector tests. This report/checkpoint follows as documentation-only
commits; use the PR's
`headRefOid` for the exact publication head, never confuse it with main.

| Isolated component branch | Preserved commit | Candidate cherry-pick |
| ------------------------- | ---------------- | --------------------- |
| campaign/b1-migration     | d878b92f         | c3ebb6f6              |
| campaign/b1-transactions  | 0a459498         | 3c630657              |
| campaign/b2-native        | bfaba93a         | 89c8639e              |
| campaign/b3-cloud         | 50e41af5         | 09c716b1              |
| campaign/b4-security      | 01e7b39f         | b0b9d6e9              |

Parent commits5ff019ef/254b92fe establish recovery state, historical corrections and
hermetic policy tests;1afe03a1 fixes scoped-handle assertions and records advisory
chronology. Parent recovered partial files only after all workers terminated and
the user requested resume. No concurrent writer was overwritten. All five
worktrees/branches remain available. Publication used ordinary push and draft PR;
**no merge, force push or history rewrite**. Recovery reference is starting main.

## C. Migration cohort investigation

Detailed source/history/distribution analysis:
[`campaign-b-migration.md`](campaign-b-migration.md).

The vulnerable b899a871 placement autocommits `sort_order` before the inner
migration transaction. Real SQLite reproduces version5 + surviving zero column
following inner rollback. Current migration6 prevents that new window, but an
already-affected database can advance to25 with zeros unchanged.

**Reachable does not establish a user cohort.** Production-named GitHub deployment
attempts exist for vulnerable source; inspected statuses failed. These do not
prove successful serving, nor absence of native/off-platform distribution.
Campaign A's categorical “never deployed” claim cannot be established with the
available provenance. No real user database was used.

**No safe head predicate was established.** All-zero ordering also exists in
accepted, checksummed historical portable files. Version/timestamps/live-row
counts cannot distinguish intent. A transient v5/column-only signature is lost
when migration6 commits; a fault at7 proves it disappears before any appended26
could reliably repair it on retry. Never reset the schema marker to force replay.

## D. Migration implementation

**No automatic repair migration shipped.** Runtime head remains25; slot26 is
unused. No historical migration, row identity, rank, tombstone or backup format
was changed. This is the conservative deferral explicitly allowed by the brief,
not a claim that affected rows were repaired.

Sixteen new real-engine tests cover clean5, valid6, interrupted historical6,
column-present5, zeros/authored/mixed ranks, completed/deleted rows, archived
parents, ties, empty/current/already-ranked states, older Portable V1 import,
rollback/retry and restart preservation. The focused four-file suite passes38/38.
Whole-table snapshots include owner/outbox state. Existing manual reordering is
tested as the explicit opt-in alternative: second-row failure rolls back data
and outbox; retry commits the chosen order once, leaving tombstones untouched.

Repair-interruption/idempotency certification is **not applicable to a nonexistent
repair**. Tests instead prove current6 atomicity, historical reachability, loss of
provenance and transactional user-chosen reorder. Real Android/OPFS power-loss
behavior and original cohort prevalence remain unqualified.

## E. Transaction interleaving

[`campaign-b-transactions.md`](campaign-b-transactions.md) describes the candidate.
`sqliteWriter.ts` supplies one per-root FIFO shared by `withSQLiteTransaction`
and standalone appMeta setters/deletion. The callback receives a distinct,
method-bound, expiring capability so dependent metadata joins its transaction;
unrelated root-handle writes wait. Rejected writers do not poison later work.
Nested/lifecycle calls fail immediately; durable storage failures stay classified.

Fourteen real-SQLite controlled tests exercise web-style reused and native-style
distinct handles, dependent rollback, concurrent metadata survival, deletion,
quota, FIFO, file reopen/retry and no duplicates. These native-style adapters are
**synthetic**, not Expo-device evidence. Focused generation/concurrency replay46/46
and final full-suite gates pass.

Scope remains **participating writers**, not a universal adapter boundary. Direct
SQL, reads, maintenance and raw adapter transactions do not automatically enter
the FIFO. Bootstrap migrations use direct transactions before publication of the
singleton. Captured root-handle use inside a queued transaction can self-wait;
callers must use the callback handle and await their work. Independent reviewer A
inspected current callbacks/mutation wrappers and found no current captured-root
self-wait or unawaited dependent-write defect. Raw-writer limitations remain. No broad claim
that every metadata/read-dependent sequence is atomic is made.

## F. Android build provenance

**BLOCKED_ENVIRONMENT — no fresh APK was built or installed.** Consequently no
artifact SHA256, install timestamp, Gradle build result or installed-signature
proof exists for this campaign.

| Item                                         | Observed or intended identity; not build evidence                              |
| -------------------------------------------- | ------------------------------------------------------------------------------ |
| Host                                         | Windows10.0.26200; Node22.23.2; npm10.9.8                                      |
| Java found                                   | Microsoft OpenJDK17.0.20+8-LTS                                                 |
| Android tools                                | ADB/emulator under local Android SDK; emulator37.1.11.0; Maestro command found |
| Source for initial attempted setup           | 02d43088e10170d03f9db44c887227a9705f8dff                                       |
| Pinned app stack                             | Expo55 / React Native0.83.10; source version1.0.0                              |
| Package                                      | com.dale16.superhabits, unchanged                                              |
| Intended target/variant                      | Disposable API36 x86_64; credential-free non-production E2E equivalent         |
| SDK/target/build toolchain actually compiled | UNEXECUTED; configuration is not a compilation result                          |
| Signing                                      | No new artifact; production signing/custody remains unproven                   |

Disposable SH_Campaign_B_API36 launched on5588, launcherPID28496. Disk fell from
about10GB to under200MB. Worker38472 exited3221226505; the exact crash cause is
not established by that code alone. Parent verified/terminated only its owned
process tree and removed only this newly-created unused AVD (no app installed),
recovering3.48GB. Foreign emulator5554 and all pre-existing data were untouched.
Later resource probe saw about2.7GB free, below the proposed16GiB admission floor.
A safe build/private dependency copy cannot proceed in that space.

`native-resource-preflight.mjs`, provision/launch admission, `--no-install`, and
`scripts/qa-native-campaign-b.ps1` provide a bounded replay and prevent repeating
the observed resource exhaustion through those entry points. Floors16GiB disk /
4GiB RAM are conservative admission thresholds, not guarantees. PowerShell syntax
passed; the qualification replay itself is unexecuted. See
[`campaign-b-native.md`](campaign-b-native.md).

## G. Native certification matrix

No DEVICE_PASS or EMULATOR_PASS is claimed. Synthetic scheduler rows execute the
real JS adapter/startup with mocked Expo methods **and mocked screen effects**,
not a native module fault seam or actual SH-11 screen/command recovery boundary.

| Scenario                                                                | Classification / actual boundary                      |
| ----------------------------------------------------------------------- | ----------------------------------------------------- |
| Clean install / first launch / SQLite initialization                    | BLOCKED_ENVIRONMENT — no fresh APK                    |
| Initial navigation / Today                                              | BLOCKED_ENVIRONMENT                                   |
| Todo create/edit/complete                                               | BLOCKED_ENVIRONMENT                                   |
| Habit check-in                                                          | BLOCKED_ENVIRONMENT                                   |
| Focus timer runtime                                                     | BLOCKED_ENVIRONMENT                                   |
| Workout session creation                                                | BLOCKED_ENVIRONMENT                                   |
| Workout measurements                                                    | BLOCKED_ENVIRONMENT                                   |
| Workout durable recovery                                                | BLOCKED_ENVIRONMENT                                   |
| Calories diary                                                          | BLOCKED_ENVIRONMENT                                   |
| Background / foreground                                                 | BLOCKED_ENVIRONMENT                                   |
| Force-stop / process recreate / relaunch                                | BLOCKED_ENVIRONMENT                                   |
| Offline operation / system network toggling                             | UNEXECUTED                                            |
| Interrupted persistence / failed save / storage quota                   | UNEXECUTED natively; local SQLite fault fixtures only |
| Native settings / portable backup / restore                             | BLOCKED_ENVIRONMENT                                   |
| Native permission UI                                                    | BLOCKED_ENVIRONMENT                                   |
| Upgrade older local schema on native SQLite                             | BLOCKED_ENVIRONMENT; better-sqlite3 fixtures only     |
| SH-11 schedule success + returned ID                                    | SYNTHETIC_PASS                                        |
| SH-11 scheduler rejection → recovery, later retry                       | SYNTHETIC_PASS                                        |
| SH-11 empty invalid identifier → warning/no claimed schedule            | SYNTHETIC_PASS                                        |
| SH-11 permission denied → warning-success, no scheduler call            | SYNTHETIC_PASS                                        |
| Cancellation rejects for invalid/already-fired ID                       | SYNTHETIC_PASS; suppressed rejection contract only    |
| Web adapter skips native permissions/scheduling                         | SYNTHETIC_PASS                                        |
| SH-11 timeout / native process interruption / duplicate OS schedules    | UNEXECUTED                                            |
| Lock screen / timer completion in background / resume after deadline    | BLOCKED_ENVIRONMENT                                   |
| Device clock / timezone changed                                         | UNEXECUTED                                            |
| Permission grant after denial / actual tray delivery                    | UNEXECUTED                                            |
| Multiple pending timers / manual native cancellation                    | UNEXECUTED                                            |
| Real SQLite process-kill, quota, migration or backup-restore durability | BLOCKED_ENVIRONMENT                                   |

No extra exact-alarm permission was introduced. Existing timer intent/elapsed-time
behavior was not changed; synthetic/desktop results do not prove background JS
execution or native wall-clock/notification correctness.

## H. Native defects

Confirmed environment/tooling defect: provisioning lacked an early resource
admission boundary and could consume nearly all disk before build. Candidate
preflight/resource tests reduce this recurrence risk. A CRLF-sensitive new test
was corrected without changing its launch-order assertion. No native product
lifecycle/scheduler defect was demonstrated, so no speculative timer rewrite was
performed. Real SH-11 rejection remains open and needs a justified native seam.
Independent reviewers additionally found three P2 source gaps: synchronous SQLite
lifecycle forwarding, nested external dependency links, and relocated selected AVD
data paths. All were corrected in0d8475af and independently re-reviewed: lifecycle
rejection occurs before adapter invocation; collector tests cover actual junctions,
internal cycles, absolute/relative AVD metadata and separate low-space measurements.

## I. Hosted Supabase

[`campaign-b-cloud.md`](campaign-b-cloud.md) records authenticated management GETs:
`kruubbynsmxzxfdunaal` superhabits, ap-northeast-1, **INACTIVE**; the prior disposable
target is also INACTIVE. Three projects were inventoried, none activated. This is
**HOSTED_VERIFIED identity/status only**, not Auth/RLS/SQL certification.

Backup metadata returned PITRfalse and backupsnull. Null is not a verified zero
count or a recoverable public+auth point. Hosted policies, ACLs, function privileges,
search_path, Auth/PostgREST, migration parity and A/B authorization/restore remain
**BLOCKED_EXTERNAL**. No cloud migration/test-user mutation or paid activation ran.

The inspection-only SQL preflight inventories ledgers/RLS/ACLs/functions/28 tables/
17 numeric targets and aggregate generation integrity under a READ ONLY bounded
transaction, then rollback. Six source/negative controls pass; actual PostgreSQL
execution remains **UNEXECUTED**. Existing generation/provenance rehearsals failed
to start because PG17 initdb was absent. Static schema validator passes20 files;
focused mocked-remote/real-SQLite tests253/253 are **LOCAL_ONLY**.

Rollout packet includes target/recovery verification, exact-ledger comparison,
forward migration order, cleanup-impact counts, old-client fail-closed fences and
recovery without destructive downgrade. The provenance migration removes eligible
staging rows; its committed cleanup has no safe inverse SQL. Production application
requires separate explicit authority and rehearsed recovery, neither supplied here.

## J. Security

Fresh late-campaign evidence supersedes the early worker snapshot:

- braces GHSA-vfj7-8cjw-p6xm was **withdrawn upstream2026-10-23T12:53:02Z**.
  Installed3.0.3 is unchanged; this is not a campaign dependency remediation.
- node-forge GHSA-86w9-cpqp-85rv remains HIGH, installed1.4.0, no first patched
  version. Expo CLI/code-signing tooling remain production dependency paths.
- Newly reported **Zod GHSA-mrhx-c7xc-m3w5** is HIGH; affected<4.6.6, patched4.6.6,
  latest4.6.7 at retrieval. Production root3.25.76 is required by Expo CLI^3.25.76;
  a cross-major override is not a demonstrated safe patch. Separate OpenSpec dev
  copy4.4.3 also exists. Reachability/compatible parent qualification remains open.

Unchanged audit exits1 on exactly **node-forge + Zod**; readiness exits1/BLOCKED.
No package/lock edits, waiver, allowlist change, severity reduction or audit bypass.
Two policy-only tests avoid unrelated audit-network calls; real CLI/audit coverage
and the production gate remain intact. PRs #92/#81/#57 were inspected: their broad
RN/Tailwind changes are outside Expo55/interop compatibility and do not qualify a
minimal fix. None merged. Dated owner decision request and detailed paths are in
[`campaign-b-security.md`](campaign-b-security.md); its early braces snapshot is
preserved with an explicit late-campaign correction.

## K. Release governance

Ruleset15001092 remains **disabled**; classic protection404/effective rules[] were
observed. No administrator setting changed. Inert proposals offer strict existing
quality+e2e gating (which blocks source while audit red), or separately approved
engineering/release-check separation without weakening mandatory release security.
No imaginary check is represented as currently enforceable.

`vercel.json` `git.deploymentEnabled.main:false` is byte-unchanged. Both canonical
and legacy projects remain relevant. PR93 returned successful provider statuses
for both project integrations plus Preview Comments; these are PR activity, **not
live project-control or production-history verification**. Authenticated Vercel
project/deployment API access is unavailable, so serving-production SHA and absence
of unexpected production releases remain unverified. Historical production
Vercel deployments exist; Campaign A report/plan are annotated, not rewritten.

No hold removal, project deletion/rename, manual deployment/promotion, signing
issuance, store submission or release authorization. Store/legal/support/custody
R01–R16 and58 owner markers remain unresolved; no declarations were invented.

## L. Validation ledger

Final local full-suite replay and rebuilt hermetic export bind to0d8475af.
Infrastructure/portable16/16 reran on that export. Visual34/34 and P025/25 were
executed on the earlier1afe03a1 runtime, before the narrow reviewed lifecycle guard
and native collector corrections; they are not represented as final-head reruns.
Both hermetic exports contained zero Supabase hosts. Full source impact requires broad qa:full;
the focused gates below do **not** silently discharge unexecuted lanes.

| Gate / command                                                            | Result                                                                                                                             |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| typecheck / lint                                                          | PASS0errors /0warnings                                                                                                             |
| Whole-repository `format:check`                                           | FAIL:93 pre-existing files, all byte-unchanged in candidate; initial94th warning was this new report, corrected. No mass reformat. |
| Changed supported-file Prettier / git diff whitespace                     | PASS; final report-only formatting checked separately                                                                              |
| OpenSpec                                                                  | PASS89items /0failed                                                                                                               |
| All versioned ExecPlans                                                   | PASS before final checkpoint; final checkpoint revalidated                                                                         |
| `npm test -- --maxWorkers=2 --no-file-parallelism --cache=false`          | **3232passed /3skipped /0failed**,312passed files/1skipped; no retry flags                                                         |
| Focused migration + portable                                              | 38passed/0failed; subset of full suite                                                                                             |
| Focused generation + concurrency                                          | 46passed/0failed; subset of full suite                                                                                             |
| P2 correction gate at0d8475af                                             | 50passed/0failed: concurrency14/resource22/AVD9/provision5; subset of final full suite                                             |
| Focused scheduler/resource/habit corrections                              | 45passed/0failed; subset of full suite                                                                                             |
| Cloud read-only source guards (`node --test`)                             | 6passed/0failed, separate from Vitest                                                                                              |
| Hermetic web export                                                       | PASS,0Supabase hosts; no production export/deploy                                                                                  |
| Infrastructure + portable Playwright                                      | **16passed /0failed /0retries**                                                                                                    |
| Visual win32                                                              | **34passed /0failed /0retries**, maxDiffPixels0, no baseline edits                                                                 |
| P0 journeys                                                               | **25passed /0failed /0retries**                                                                                                    |
| Simulation model validation                                               | PASS23scenarios; scenario execution not implied                                                                                    |
| Schema validator / branding / profile / isolation / parity guards         | PASS, static scope only                                                                                                            |
| Dependency audit / release readiness                                      | FAIL exit1 / BLOCKED exit1 — genuine unresolved security/owner gates                                                               |
| Native resource admission                                                 | BLOCKED_ENVIRONMENT before new build; PowerShell replay syntax PASS                                                                |
| Fresh native smoke/lifecycle/SH-11                                        | UNEXECUTED / BLOCKED_ENVIRONMENT                                                                                                   |
| Hosted SQL/Auth/RLS / local PG rehearsal                                  | BLOCKED_EXTERNAL / ENVIRONMENT(initdb absent)                                                                                      |
| Full functional E2E/all journeys/PWA + deterministic simulation execution | NOT RUN in local combined gate; broad qa:full incomplete                                                                           |
| Final web hygiene                                                         | PASS8081/8082free                                                                                                                  |

Retained failures, not hidden: initial qa:fast2543pass/1skip/2timing failures plus
worker RPC error; baseline bounded full3172pass/3skip/2readiness timeouts; initial
candidate3223pass/3skip/2habit-handle test failures. Readiness policy tests isolated
network dependencies without longer timeouts; habit tests compare the scoped
claim/write identity without Vitest probing a revoked proxy. First attempt at the
latter still triggered Vitest's `.then` probe; final boolean identity assertions
preserve the same contract and pass. New portable fixtures initially had invalid
IDs/result status, corrected as TEST_BUG. Early native source test23pass/1CRLF
failure corrected. Worker OOM/IPC/timeouts/quota failures remain ENVIRONMENT,
not test passes. No meaningful assertion, screenshot tolerance or gate was weakened.

Active diagnostics were probed twice: TypeScript LSP could not confirm clean on
silent push-only files. Auxiliary AST reports include the pre-existing uncaught
JSON.parse contract in appMeta and style hints; typecheck/eslint gates pass.
No false “clean LSP” claim. A later active probe also reported pre-existing native
runner subprocess/shell audit patterns outside the changed launch-admission lines;
these are not new source findings. Independent source/call-site review completed.
Initial P2 correction gates exposed two inferred-options TypeScript errors and an
ESLint invocation naming ignored scripts; corrected optional default/env fixtures,
then checked scoped TS lint and script syntax. A concurrent whole-lint attempt
hit its host command deadline; the final standalone whole-repository lint rerun
passed with zero errors/warnings, as did script syntax and diff whitespace.

Evidence: `.agent/evidence/campaign-b/` in the primary checkout copies parent
`/tmp/campaign-b-*.log`; original worker evidence remains in preserved worktrees
and workflow receipt731bf16c. Logs are ignored, not a second task-state store.

Hosted engineering SHA1afe03a1: run40037729236(PR) has **quality FAIL at audit only**,
**e2e IN_PROGRESS**, nightlySKIPPED at last observation. Push run40037722243 has
qualityFAIL audit-only, e2e/nightlySKIPPED. These are not an all-green workflow;
no pass/retry count is invented for unfinished E2E. Documentation-only final-head
runs must be checked using the PR head and are pending, not inherited from an
ancestor. Replay: `gh pr view 93 --json headRefOid,statusCheckRollup` and
`gh run list --branch integration/native-migration-campaign-b`.

## M. Independent review

**COMPLETED for the engineering source diff**, not runtime certification. Initial
writer workflow731bf16c has five failed children (quota/runtime/timeout); none is
misrepresented as an independent acceptance. After that quota window elapsed,
fresh read-only reviewers inspected exact committed diffs, actual source/contracts
and retained execution evidence under workflow34bc3889. They had no shell/Git or
device tools; parent supplied range-specific Git artifacts. They did not rerun tests.

| Reviewer           | Initial source verdict / findings                                       | Final disposition                                                             |
| ------------------ | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| A — migration/data | OK with notes; P2 withTransactionSync lifecycle escape                  | Fixed0d8475af; retained review5d298be5: SOURCE OK, no new defect              |
| B — native tooling | OK with notes; P2 nested shared links; P2 relocated AVD data filesystem | Both fixed0d8475af; retained review1208b52d: SOURCE OK, no new defect         |
| C — cloud/security | OK with notes, no P0/P1/P2 defect                                       | Source guards/visibility limitations retained; no relevant later source delta |

No P0/P1 was identified in these assigned source scopes. A confirmed no current
captured-root callback defect and accepted conservative no-repair conclusion.
B confirmed actual collector fixtures and provenance boundaries, not native
execution. C confirmed no gate weakening and inspection-only SQL, not hosted
certification. Follow-up workflow327de56d closes all three P2s. Artifacts are retained
under the workflow receipts and copied into primary ignored campaign evidence.
All reviewers keep external/native/hosted certification BLOCKED. Source verdicts
are not administrator approval, advisory waivers or production release authority.

## N. Integration outcome

**PR93 OPEN/DRAFT; main unchanged at02d43088.** Compatible components were combined
locally through cherry-picks without conflicts, then published normally. No main
integration, source acceptance, protection bypass, cloud migration or production
release. Independent source review is complete; missing full qualification,
exact-final-head hosted results and provider-control preflight remain specific
integration blockers. External native/cloud proof remains a release blocker.

## O. Remaining release blockers

1. Complete broad regression and exact-final-head hosted checks after final publication;
   preserve independent A/B/C acceptance and re-review any later source changes.
   Live dual-project provider-control preflight is still unavailable; do not infer
   integration authorization from green local subsets.
2. Sufficient native resource/private dependency capacity, fresh API36 x86_64 APK,
   installed hash/signature/provenance and complete runtime matrix. Actual native
   SH-11 rejection/tray/lifecycle/SQLite durability remain uncertified.
3. Owner-resolved inactive cloud/disposable availability, authorized read-only SQL,
   proven public+auth recovery point, deployed ledger/ACL/RLS/Auth/PostgREST checks,
   real A/B publication/restore rehearsal. No production SQL authority granted.
4. node-forge and Zod remediation/qualified compatible paths. Any owner policy
   choice is separate; no waiver exists. Refresh advisory state before decisions.
5. Administrator governance choice/activation under separate authority; live
   Vercel verification for both exact project IDs; production hold remains.
6. Signing custody/artifact provenance, store/privacy/support/incident owner work,
   iOS/device coverage and explicit final production approval. All still separate.
7. Historical cohort prevalence remains unverified; automatic reordering is not
   an approved answer. Existing explicit manual order is the safe opt-in path.

## P. Smallest next correction pass

Resume **PR93 acceptance and native-capacity closure**, not a broad new audit:
obtain terminal final-head CI and complete remaining broad gates; independent
scoped reviews have already accepted the corrected source, so repeat only for
actual subsequent changes or concrete findings. Provision adequate disposable native capacity, run the
prepared exact-SHA replay, then add a justified native SH-11 rejection seam. In
parallel, refresh node-forge/Zod compatibility and obtain owner-authorized active
disposable cloud/read-only access. Reuse these fixtures, preflight and evidence;
do not restart product features or bulk-reorder ambiguous Todos. Keep production
blocked throughout.
