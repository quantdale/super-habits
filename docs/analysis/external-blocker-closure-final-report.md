# External blocker closure — final report

**Draft state:** The prior exact-source run 36346516389 timed out after one failed flow. The bounded-timeout fix and regression tests are committed. New run 36368093388 targets exact SHA f93dddc5f67b7ff48061b652fe476feefa89ccc8; source/toolchain verification, npm ci, Maestro CLI installation, iOS 26.2 simulator boot, workspace/CocoaPods preparation, and unsigned Release simulator build passed. The build completed at 03:45:20 UTC after 1h28m24s; simctl install/launch is now in progress. The opt-in label has been removed, and no app-launch or flow result is inferred yet.

**Provisional terminal state:** `NOT CERTIFIED`. The production backup schema and historical integrity gate is substantively red; a passing local, disposable, Android, or iOS check cannot clear that production gate.

## Workstream summary

| Workstream                                       | Current status                                                                                                                                    |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Production incident residue and backup integrity | `NOT CERTIFIED`; cleanup and schema rollout remain owner-gated.                                                                                   |
| Disposable Supabase                              | Scoped authenticated-owner backup/restore battery passed; anonymous bootstrap is untested.                                                        |
| AI Command Center                                | Local deterministic/security work passed; provider evaluation and rollout are blocked on credentials and owner authorization.                     |
| iOS/EAS and Android                              | Prior iOS run 36346516389 timed out; exact-SHA retry 36368093388 is in progress on f93dddc. Android runtime remains ENVIRONMENT-blocked.          |
| Store release                                    | Submission package is prepared; owner inputs, signed builds, real screenshots, and release approval remain.                                       |
| Deferred architecture/dependencies               | Gap 21 remains fail-closed pending owner choice; the resource-constrained HEAVY rerun is unresolved; no breaking dependency override was applied. |
| Adversarial certification                        | Two reviews completed and executable fixes landed; the production integrity gate remains red.                                                     |

## Source and artifact identities

| Identity                             | SHA / reference                                                    | Meaning                                                                                                                                                                              |
| ------------------------------------ | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Starting source SHA                  | `23ded6e7676f94d6ddf9337ad02d526d85973fcb`                         | Preserved campaign starting HEAD.                                                                                                                                                    |
| Prior iOS run source SHA             | 30b5619ec79d6efdfa30271cd999b5ee803131a1                           | Source tested by run 36346516389 before the timeout fix; this run did not certify the candidate.                                                                                     |
| Historical Android source SHA        | `56259876418674f85e1ca42c87f248fcf12c7d75`                         | Prior Android candidate; it is not the current product source.                                                                                                                       |
| Historical Android APK SHA-256       | `5ABF7B8CA34350C00ECE6D925C12CCBE15F519C0258D497B7654758CEDFA7A78` | Binary identity for that historical Android source only; it does not certify `30b5619`.                                                                                              |
| Timeout-fix source commit SHA        | fb5c9d1d51271ba671b6651ad35549b454ea67a0                           | Bounded simulator probes and per-flow Maestro timeout with regression coverage, exercised by exact-SHA run 36368093388 on f93dddc.                                                   |
| Exact-SHA iOS retry                  | f93dddc5f67b7ff48061b652fe476feefa89ccc8                           | Run 36368093388: source/toolchain, dependencies, Maestro CLI, simulator boot, workspace/CocoaPods, and unsigned Release build passed; simctl install/launch started at 03:45:20 UTC. |
| Prior iOS Release executable SHA-256 | ef22674b03518115bd465ac7a1293a7ad9e5439238a5af1ac9a6ac6085be9010   | Exact provenance from run 36346516389 at the prior source; it does not certify all 13 flows.                                                                                         |
| Final report document SHA-256        | To be recorded in the ExecPlan after this report is finalized      | Hash of this report file; distinct from app source and native binary hashes.                                                                                                         |

The completed live-cloud ExecPlan and stash `pre-recovery-local-changes` remain preserved as historical evidence.

## 1. Production incident residue and backup integrity

**Starting evidence:** The prior live-cloud campaign left J8-like production residue and Restore V2 production-schema parity unverified. Production target is `superhabits` / `kruubbynsmxzxfdunaal`.

**Current state:** Read-only investigation classified 482 records: 135 `CONFIRMED_SYNTHETIC`, 96 `PROBABLE_SYNTHETIC`, 251 `AMBIGUOUS`, and 0 `LEGITIMATE_OR_UNRELATED`. The proposal limits any future cleanup to the 135 confirmed records and is `OWNER_APPROVAL_REQUIRED`; no production deletion or DDL ran. The private evidence snapshot is gitignored at `simulation-output/incident-residue-2026-09-25.json` (SHA-256 `22E543A860A0CF75A686A73663242538D290AF6F062783FD91B4EDD0F9D52207`).

Read-only inspection on 2026-09-28 found production `ACTIVE_HEALTHY`, with 12 migrations applied through `20260822000000`. Three repository migrations are missing: `20260824010000_add_gym_training_v2_backup_scope.sql`, `20260824020000_add_gym_workout_deep_expansion.sql`, and `20260925125655_backup_numeric_precision.sql`. Four required tables are absent (`custom_exercises`, `workout_weekly_plan`, `workout_schedule_overrides`, `body_weight_entries`); nine existing target measurement columns remain `REAL`. The project has 41 manifests and 10 saved meals. Historical `REAL` writes may already have rounded values, which a type migration cannot restore.

**Work and validation:** Read-only project/migration/table inspection only. The exact-target, transaction-aware cleanup proposal describes backup, requery, row locking, exact-key checks, dependency order, rollback, and read-back. The schema rollout runbook requires recovery-point proof, an exact three-file dry run, explicit DDL authorization, post-migration checks, and owner-scoped historical manifest audit/source-device recapture. The disposable round trip found and fixed numeric precision locally; Restore V2 was not weakened.

**Residual blockers:**

### P1. Exact-target incident cleanup

- **WHY:** The 135-record proposal includes deleting auth users and cascading session effects; only five exact anonymous owners and their correlated rows are proposed. The other 347 candidate records must remain untouched.
- **CLASSIFICATION:** `OWNER_APPROVAL_REQUIRED`.
- **WHAT IS REQUIRED:** Owner approval of the five exact owner IDs, 135 exact row IDs, auth/session effects, maintenance time, and a proven restorable backup. Requery the full owner/table footprint and auth state; stop on any drift.
- **EXACT RESUME ACTION:** Follow `openspec/changes/external-blocker-closure/incident-residue.md` steps 1–5 on the named production project only; execute the single transaction only after the exact-target approval is recorded.

### P2. Production schema and historical Restore V2 integrity

- **WHY:** Missing migrations/tables currently break complete Scope-7 production reads, and remote `REAL` storage may have invalidated existing manifest checksums.
- **CLASSIFICATION:** `NOT CERTIFIED` / `OWNER_APPROVAL_REQUIRED` for production writes.
- **WHAT IS REQUIRED:** A current restorable `public` and `auth` recovery point; exact linked dry run containing only the three named migrations; owner authorization; catalog/RLS/advisor checks; then per-owner manifest checksum audit and source-device recapture where possible.
- **EXACT RESUME ACTION:** Execute `openspec/changes/external-blocker-closure/production-schema-rollout.md` in order, stopping on any target, migration, recovery-point, catalog, or owner-data mismatch. Do not delete incident records as part of schema rollout.

## 2. Disposable Supabase certification

**Starting evidence:** The original guarded CLI provisioning route could not resolve/reach the disposable project's AAAA-only database host, so that attempt aborted before schema writes. The named project was separately identified as `superhabits-disposable-202609240546-tqp3`, distinct from production.

**Current state:** The exact disposable project was guarded and its schema applied. The app-source Scope-7 backup/Restore V2 battery passed for the tested authenticated-owner path, including 21 recoverable entities, decimal round trips, RLS write isolation, wrong-owner rejection, durable outbox retry, workout hard deletes, and exact-owner cleanup. All 17 targeted numeric columns were verified `NUMERIC`. Disposable Edge probes returned 401/403 without provider calls. This is scoped disposable evidence, not production certification.

**Residual blocker P3. Anonymous bootstrap coverage**

- **WHY:** Anonymous signups are disabled on the disposable project, so anonymous bootstrap was not exercised; the battery used authenticated email owners.
- **CLASSIFICATION:** `ENVIRONMENT` / disposable-project configuration gap.
- **WHAT IS REQUIRED:** A separately guarded disposable project or an owner-authorized disposable configuration that permits anonymous signup, with the same production-host exclusion and cleanup controls.
- **EXACT RESUME ACTION:** Re-run the guarded disposable certification setup, prove the marker/project ref/host before any write, then execute the anonymous-bootstrap case and verify exact-owner cleanup. Do not use production for this test.

## 3. AI Command Center readiness

**Starting evidence:** The parse function requires `OPENAI_API_KEY` plus `AI_COMMAND_MODEL`; Ask uses `DEEPSEEK_API_KEY`. The prior security review found content-bearing provider errors in logs and a client-only rollout guard that direct authenticated calls could bypass.

**Current state:** Deterministic, mock, static, privacy, and direct-call security corrections are complete. Provider error bodies and model-derived errors are not logged; both Edge Functions check server-side rollout flags and an exact UID allowlist before body, quota, or provider work. Ask/Auto remain default-off. The privacy analysis and staged rollout package are drafted. The AI-focused Vitest corpus passed 685/685, direct Edge log/rollout/security tests passed 15/15, the default-off hermetic build passed, the dummy-host Ask/Auto journey passed 13/13, and the affected full QA on the AI fix passed 2,290 tests, 60 OpenSpec items, 233 browser passes/49 intentional skips, and 23/23 deterministic scenarios. Read-only secret inventory found `OPENAI_API_KEY` absent, `AI_COMMAND_MODEL` absent, and `DEEPSEEK_API_KEY` present but unverified. No provider request or deployment was made.

**Residual blocker P4. Authenticated provider evaluation and rollout**

- **WHY:** Credentials, provider contract verification, approved spend, measured evaluation, and rollout authorization are missing. Secret-name presence alone is not a successful provider gate.
- **CLASSIFICATION:** `BLOCKED` on credentials and owner authorization.
- **WHAT IS REQUIRED:** Valid parse credential pair and verified Ask key; approved synthetic-data budget; provider retention/subprocessor review; authenticated parse and Ask evaluations with accuracy, safety, isolation, failure, latency, quota, and cost results; approved disclosures and explicit rollout authorization.
- **EXACT RESUME ACTION:** Follow `.agent/execplans/ai-command-center-production-v1.md` from its provider-blocked checkpoint. Recheck secret presence without exposing values, run the existing authenticated evaluation gates, record measured evidence, and keep defaults off unless the owner separately authorizes rollout.

## 4. iOS/EAS and Android runtime qualification

**Starting evidence:** Existing Android proof is bound to historical source SHA `56259876418674f85e1ca42c87f248fcf12c7d75` and APK SHA-256 `5ABF7B8CA34350C00ECE6D925C12CCBE15F519C0258D497B7654758CEDFA7A78`. It does not qualify the current candidate. EAS static configuration was reviewed; no paid EAS job, signing change, or store workflow was started.

**Prior exact-source iOS run:** Run `36346516389` is for source SHA `30b5619ec79d6efdfa30271cd999b5ee803131a1`. Source/toolchain verification, dependency installation, Maestro setup, iOS 26.2 simulator boot, CocoaPods/workspace preparation, unsigned Release build, and simctl install/launch passed. Its uploaded provenance records executable SHA-256 `ef22674b03518115bd465ac7a1293a7ad9e5439238a5af1ac9a6ac6085be9010`. The first `native-smoke` flow failed when Maestro's `simctl launch` timed out; XCTest driver status checks also failed to connect and cleanup later timed out while uninstalling the driver. The screenshot is black, and captured simulator diagnostics contain no app crash entry, though the `simctl log show` capture itself timed out. The native report had no automatic classification. The preceding run `36335066339` reported `native-smoke` PASS with this identical executable SHA-256, although its source SHA differs; this supports a runner/simulator failure rather than an app-code regression. No second per-flow invocation/report appears in the job log; the subsequent iOS target preflight used unbounded `simctl` commands, so the preflight stall is the leading harness/environment explanation. The workflow job was canceled at 300 minutes; 12 flows have no result and no iOS runtime pass is claimed. The preceding run `36335066339` finished 10/13; three `TEST_BUG` failures were fixed in `30b5619`.

**Exact-SHA retry in progress:** Run 36368093388 checks out f93dddc5f67b7ff48061b652fe476feefa89ccc8. Source/toolchain verification, npm ci, Maestro CLI installation, iOS 26.2 simulator boot, workspace/CocoaPods preparation, and the unsigned Release simulator build passed. The build completed at 03:45:20 UTC; simctl install/launch is in progress, while flows and provenance remain pending. The opt-in label has been removed after kickoff. No app-launch or flow result is inferred.

**Current Android state:** No Android device or booted emulator was attached. Native smoke, targeted persistence, and lifecycle preflights returned `ENVIRONMENT` before executing flows. A local API-36 AVD boot attempt stalled under memory pressure. Do not infer Android readiness from iOS results or the historical APK.

**Residual blocker P5. Current-source iOS simulator result**

- **WHY:** The prior exact-source attempt built and installed the Release app, but its first Maestro flow could not launch it; simulator/XCUITest operations timed out, and the job cap canceled that run before the remaining 12 flows. The timeout-bounded exact-SHA retry now builds successfully on f93dddc; simctl install/launch is in progress, with no flow result yet.
- **CLASSIFICATION:** `ENVIRONMENT` at campaign level based on the simulator and XCTest command timeouts and the same executable passing `native-smoke` in run `36335066339`; the current native flow report itself left `classification` null.
- **WHAT IS REQUIRED:** The fix and three timeout/readiness regression tests pass locally. Run 36368093388 must complete all 13 Maestro flows with exact source/toolchain provenance and executable hash.
- **EXACT RESUME ACTION:** Inspect run 36368093388 on source SHA f93dddc5f67b7ff48061b652fe476feefa89ccc8 and preserve its per-flow/provenance artifact. Mark task 5.3 complete only if all 13 flows pass; otherwise classify the exact failure and continue with the smallest bounded correction and another exact-SHA run.

**Residual blocker P6. Current-source Android runtime result**

- **WHY:** No target is currently attached or booted, and the historical APK is from a different source SHA.
- **CLASSIFICATION:** `ENVIRONMENT`.
- **WHAT IS REQUIRED:** An attached/booted supported Android target with enough host resources for deterministic installation and Maestro execution on the final app source.
- **EXACT RESUME ACTION:** After a target is available, verify clean exact-source provisioning, run `qa:native:smoke`, `qa:native:targeted`, and `qa:native:lifecycle`, then preserve source and APK hashes with all per-flow evidence. Do not substitute the historical APK hash for a new build.

## 5. Store-release preparation

**Starting evidence:** Existing release docs contained repeated and stale owner-action placeholders; no exact-build asset set or final owner authorization was available.

**Current state:** `docs/release/submission-package.md` replaces the stale inventory with 16 deduplicated owner actions, R01–R16, sourced from the release docs. Copy, privacy, data declaration, age-rating/trader, assets, icon/splash, version, and submission handoffs are prepared. `eas.json` `submit.production` remains `{}`. No `v1.0.0` tag, production signing, store upload, or submission occurred. Real native-build screenshots and the feature graphic are not included.

**Residual blocker P7. Owner-controlled release inputs and authorization**

- **WHY:** Support/privacy details, legal and trader answers, actual signed binaries, real-build screenshots, store-console records, and explicit authorization remain unavailable.
- **CLASSIFICATION:** `OWNER ACTION REQUIRED`.
- **WHAT IS REQUIRED:** Complete R01–R16 in the submission package, including counsel/provider disclosures, developer/signing accounts, real-build Apple/Play assets, resolved version identifiers, store records, and explicit R15 release approval after exact-SHA evidence review.
- **EXACT RESUME ACTION:** Work through R01–R14 and R16 in `docs/release/submission-package.md`; produce and verify signed binaries and genuine screenshots from the approved SHA; obtain R15; only then consider tagging, upload, or submission. Keep `submit.production` empty until that authorized step.

## 6. Deferred architecture and dependency risk

**Starting evidence:** Known gap 21 describes a window where remote rows/settings can outrun the singleton backup manifest; the existing Restore V2 rejection is fail-closed. J8/D14 thresholds are 800 ms and 500 ms.

**Current state:** `openspec/changes/external-blocker-closure/gap-21-decision.md` records the owner choices: retain fail-closed behavior, design retained manifest generations, or define an explicit degraded mode. No restore policy, degraded import, bidirectional sync, threshold change, or migration for this gap was implemented. Dependency review remains at 0 critical / 0 high / 14 moderate; no breaking override was applied. The earlier full QA at the workflow edit passed types, lint, 2,290 tests, 60 OpenSpec checks, and hermetic export; Playwright had 227 passes and 50 intentional skips but one HEAVY P2 workout-to-calories timing result of 878 ms against the unchanged 800 ms J8 ceiling. The trace is retained under `.cursor/playwright-output/e2e-failures/`; a full rerun and deterministic stage were deferred under low-memory conditions. Do not relabel the miss as passing.

**Residual blocker P8. Gap 21 owner decision**

- **WHY:** Changing recovery behavior affects data-loss tolerance and cannot be selected by implementation preference.
- **CLASSIFICATION:** `OWNER DECISION REQUIRED`; current restore remains fail-closed.
- **WHAT IS REQUIRED:** Owner selects A/B/C, states recovery-point objective and maximum accepted loss, decides partial recovery scope, and approves status/support language. Options B/C require a separate OpenSpec before implementation.
- **EXACT RESUME ACTION:** Record the owner choice in `gap-21-decision.md`; if B or C is selected, open the separate OpenSpec and implement only its approved contract, retaining the current fail-closed behavior until then.

**Residual blocker P9. HEAVY timing regression rerun**

- **WHY:** The last affected full browser run measured 878 ms at the 800 ms section-switch ceiling; the run was under 0.64 GB free RAM and the deterministic stage did not run, but the measurement is still a preserved failure until rechecked.
- **CLASSIFICATION:** `ENVIRONMENT` suspected; result remains failed/unresolved pending a resource-adequate rerun.
- **WHAT IS REQUIRED:** A full `qa:full` run with adequate CPU/RAM, all browser checks, and deterministic scenarios. Keep J8 at 800 ms and D14 at 500 ms.
- **EXACT RESUME ACTION:** When host resources are adequate, run pinned Node 22.23.2 `npm run qa:full`; preserve the original trace and record the complete fresh result. Fix a reproducible product regression without relaxing either ceiling.

## 7. Adversarial certification

**Starting evidence:** The campaign required a second review after correcting defects discovered in production-integrity, privacy/logging, rollout, E2E host isolation, and native UI evidence.

**Current state:** Both adversarial review passes are recorded in the ExecPlan. Executable defects were corrected with regression coverage: decimal precision uses append-only migration `20260925125655_backup_numeric_precision.sql`; provider content-bearing errors are not logged and direct Edge calls require server flag plus allowlist; the E2E server host-scan race and dummy/uppercase bypass have three regression tests; native Calories/Gym flows were corrected from screenshots and per-command iOS evidence. Second-pass review states that production schema and historical-manifest certification remain red regardless of local or native results. No production delete/DDL, provider call/deployment, signing, or store submission was inferred from local tests.

**Separate adversarial blocker:** None. Remaining certification items are listed under the workstream that owns them (P1–P9); the second-pass review does not waive those gates.

## Final validation ledger

| Date       | Evidence                                                                         | Result                                                                                                                                                                                                                                                        |
| ---------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-09-28 | Pinned `qa:fast` after the latest ExecPlan checkpoint edit                       | PASS: TypeScript, ESLint, 1,916 unit tests across 154 files, journey-label parity, quarantine parity.                                                                                                                                                         |
| 2026-09-28 | Prettier, Maestro YAML parse, `git diff --check`, `qa:affected`, plan validation | PASS for the committed flow corrections; current checkpoint-only impact maps to `qa:fast` and `tests/agent-execplan.test.ts`.                                                                                                                                 |
| 2026-09-28 | Exact-SHA iOS run `36346516389`                                                  | Release Xcode build and simctl install/launch PASS; Maestro is running; no flow verdict yet.                                                                                                                                                                  |
| 2026-09-28 | Exact-SHA iOS run `36346516389` completed                                        | `NOT CERTIFIED`: job cap canceled the Maestro step at 300 minutes. Artifact provenance matched source SHA `30b5619ec79d6efdfa30271cd999b5ee803131a1` and executable SHA above; `native-smoke` failed on simulator/XCUITest timeouts, 12 flows are unreported. |
| 2026-09-28 | Exact-SHA iOS run `36368093388` workspace/build/simctl transition                | CocoaPods/workspace preparation PASS at 02:16:56 UTC; unsigned Release simulator build PASS at 03:45:20 UTC (1h28m24s); simctl install/launch started. Flows, artifact, and executable provenance remain pending.                                             |
| 2026-09-28 | Current-head CI runs `36346487665` and `36346490487`; Vercel previews            | Both quality jobs PASS; PR browser E2E run 36346490487 PASS in 23m14s; both previews PASS.                                                                                                                                                                    |
| 2026-09-28 | Local `qa:full` at workflow edit                                                 | Partial: 227 Playwright passed, 50 intentional skips, four dependent checks not run, one 878 ms vs 800 ms timing failure; deterministic stage not reached. Trace preserved.                                                                                   |
| 2026-09-28 | Android native smoke, targeted persistence, lifecycle preflights                 | `ENVIRONMENT`: no booted Android device/emulator; no flow result claimed.                                                                                                                                                                                     |
| 2026-09-28 | Production Supabase project/migration/table inspection                           | Read-only; production schema gate red. No production mutation.                                                                                                                                                                                                |
| 2026-09-28 | Pinned `npm run qa:fast` after report/checkpoint refresh                         | PASS: Node v22.23.2, TypeScript, ESLint, 1,919 unit tests across 155 files, journey-label parity, and quarantine-register parity.                                                                                                                             |
| 2026-09-28 | Host RAM recheck before `qa:full`                                                | 2.55 GiB free of 31.73 GiB at 02:22:39 UTC; still insufficient for a meaningful HEAVY timing rerun. Preserve J8/D14 and keep the gate deferred.                                                                                                               |

| 2026-09-28 | PR CI and E2E run `36370750894` on documentation checkpoint `a78edf5` | PASS: quality checks and PR E2E (19m20s), including Chromium feature journeys, `@p0`/J1/J2a/J2b, and the `scenarios-pr` deterministic subset. Full/main and dist-sync lanes were skipped by the PR matrix; native iOS run `36368093388` remains separate on f93dddc. |

## Terminal disposition

`NOT CERTIFIED` is the only supported terminal state while the production Scope-7 schema and historical backup-integrity gate remains unresolved. This does not erase the scoped disposable pass or any local/CI result. It prevents those results from being presented as production restore readiness. Reassess this terminal state only after the owner-gated production rollout and historical manifest recovery audit have completed with direct evidence.
