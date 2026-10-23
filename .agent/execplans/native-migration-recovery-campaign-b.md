# ExecPlan: Native migration recovery — Correction Campaign B

Plan-Version: 2
Status: ACTIVE

## Purpose / User Outcome

Advance recoverable cross-platform release evidence without production deployment,
data-destructive repair, security waivers, or unsupported certification claims.

## Context

Starting remote main is `02d43088e10170d03f9db44c887227a9705f8dff`, fetched and
verified at reconnaissance. PR #91 is merged at `3022e9dd`. Primary checkout was
clean on integration/full-spectrum-correction-a; sh-branding remains untouched.
Campaign A report and plan are historical evidence with known erroneous final-SHA
and zero-historical-production-deployment statements; correction annotations will
preserve rather than erase history. Protect Main ruleset 15001092 remains disabled.

## Scope

B1 historical migration cohort classification and conservative repair if provable;
B1.2 transactional/nontransactional write interleaving; B2 fresh Android runtime;
B3 authorized hosted Supabase investigation; B4 advisories and release governance;
independent review, validation, conditional PR integration and final report.

## Non-Goals

No production deployment/promotion, cloud migrations, paid-resource activation,
protection changes, waivers, user-data deletion, signing secrets, ID changes,
force pushes or claims beyond actual evidence.

## Current Checkpoint

- Current milestone: all workers terminated; parent recovered and committed candidate
  components after the user's resume instruction. Independent review remains blocked.
- Completed: fetched origin, main ancestry verified, clean worktree preserved,
  PR #91 merge and open PRs #57/#80/#81/#92 verified; ruleset inspected.
- In progress: parent alone owns stopped worktrees and integration checkout. No active
  child writers. Candidate commits: B1 d878b92f; B1.2 0a459498; B2 bfaba93a;
  B3 50e41af5; B4 01e7b39f. These are not independently accepted or merged.
- Worker dispositions: migration/cloud/security hit provider usage limit; original
  native worker crashed and its same-protocol revival231a51cc hit quota; transaction
  worker timed out1800000ms. Workflow731bf16c completed with five failed children,
  mission10e5a613; receipt retained under its async run directory.
- Important modified files: this plan, Campaign A correction annotations,
  tests/releaseReadiness.test.ts; five component commits contain tests, participating
  writer FIFO, native resource admission and cloud read-only preflight.
- Last successful validation: parent recovered SQLite migration38/38 and
  concurrency/generation46/46, cloud preflight source guards6/6, readiness11/11.
  Readiness NC2 now tests owner-marker helper directly; zero-audit policy test
  stubs one audit response, retaining real CLI/audit tests and production gate.
  Starting-main hosted CI39893146510 e2e success/quality audit-only failure.
- Current failures: baseline qa:fast had 2543 passed / 1 skipped / 2 timing failures
  (qaNativeProcess elapsed1255ms vs1000; releaseReadiness CLI >30sec), plus worker RPC
  timeout. Focused reproduction had qaNativeProcess pass but two readiness tests exceed
  5sec; logs /tmp/campaign-b-base-qa-fast.log and /tmp/campaign-b-base-timing-repro.log.
  No assertions/timeouts weakened. Advisory recheck confirms exactly2 unresolved highs.
- Relevant quarantines: None.
- Blockers: independent reviewers unavailable after provider quota; no fresh APK
  due native resource limits; Vercel connected auth absent. Supabase management
  metadata GET succeeded through cached CLI auth: all3 projects INACTIVE, including
  kruubbynsmxzxfdunaal and disposable target. SQL/Auth certification remains blocked.
  PostgreSQL17 tools absent; local SQL rehearsals could not start.
- Condition required to unblock: authorized hosted read-only access; sufficient native
  build disk/RAM beyond current3.48GB free (C/D share physical volume).
- Exact resume action after unblock: B2's bounded replay on a fresh disposable target;
  B3's authorized catalog preflight and disposable qualification commands.
- Exact next action: cherry-pick preserved components to local candidate, run bounded
  aggregate validation and active changed-path diagnostics, publish only a draft PR
  with exact failures and explicit review/native/cloud blockers. Do not merge.
  Independent review cannot be replaced by worker self-reports.
- Remaining definition of done: conservative migration decision, transaction tests,
  native evidence or precise blocker, cloud/security reevaluation, independent review,
  validation ledger, safe publication/integration decision, final report and hygiene.

## Progress

- [x] Recover main, worktrees, historical evidence and governance state.
- [ ] Complete component lanes with committed handoffs.
- [ ] Reconcile independent review and integrate accepted components locally.
- [ ] Run focused and aggregate validation; publish controlled PR if safe.
- [ ] Verify hosted final-head results, decide integration, write report and hygiene.

## Lane Board

Implementation topology is multi-seam: migration classification, adapter writer
ordering, native runtime, hosted certification and governance have independent
contracts. Each writer has one explicit worktree/branch; parent is integration-only.
All paths are siblings beneath C:/Users/Michael Roy/Documents/.

| Lane   | Worktree / branch                                      | Exclusive ownership                                                                                                           | Next gate / handoff                                               | Independence                                    |
| ------ | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------- |
| B1     | sh-b1-migration / campaign/b1-migration                | core/db/client.ts, migration-specific new tests, docs/reports/campaign-b-migration.md                                         | real SQLite fixtures + independent reviewer; committed handoff    | no adapter changes                              |
| B1.2   | sh-b1-transactions / campaign/b1-transactions          | core/db/transactions.ts, core/db/appMeta.ts, writer-serialization helper and new tests; other callers only after coordination | deterministic concurrency tests + review; committed handoff       | excludes client.ts                              |
| B2     | sh-b2-native / campaign/b2-native                      | native QA scripts/flows, notifications/Pomodoro corrections only if demonstrated; docs/reports/campaign-b-native.md           | fresh APK/device evidence + independent review; committed handoff | no DB migration/adapter changes                 |
| B3     | sh-b3-cloud / campaign/b3-cloud                        | docs/reports/campaign-b-cloud.md and isolated read-only qualification/preflight tooling                                       | hosted/local honesty + review; committed handoff                  | no hosted mutations or shared validator changes |
| B4     | sh-b4-security / campaign/b4-security                  | docs/reports/campaign-b-security.md, proposed governance config; safe dependency correction only after parent coordination    | audit/advisory recheck + review; committed handoff                | no deployment/protection mutation               |
| Parent | super-habits / integration/native-migration-campaign-b | campaign plan, final report, historical correction annotations, integration                                                   | aggregate QA/PR/hosted verification                               | never edits active worker worktrees             |

Workers may commit, not push/merge/deploy or spawn children. All workers are now
terminal. Parent recovered their partial files in place and committed the candidates;
no replacement model/CLI was silently launched. Read-only independent reviewers
remain unavailable; parent adversarial tests are not represented as independence.

## Surprises & Discoveries

- Main has not advanced since the corrected historical SHA; no later correction
  is already landed. Older sh-branding checkout is unrelated and preserved.
- Open security PRs are #57/#81/#92; #80 is a separate recovery successor.
- Campaign A's broad all-zero repair recommendation is not authority to overwrite
  legitimate ordering: no repair without a discriminating cohort predicate.
- Native provisioning created only disposable SH_Campaign_B_API36 (emulator5588,
  launcher PID28496); disk exhaustion crashed its worker before any APK install.
  Parent verified command identity, killed exact owned tree, removed only this new
  unused AVD and recovered3.48GB. Existing emulator5554/user data untouched.
- Blanket transactions in appMeta setters would deadlock web callbacks; approved
  bounded scoped-capability FIFO design with audit of all existing callback usages.

## Decision Log

- Reconnaissance — Preserve current main as recovery reference and use isolated
  branches; no modifications to administrator settings or production resources.
- Delegation — Split adapter serialization from migration ownership to avoid
  overlapping client.ts edits; native provisioning starts concurrently.

## Validation Ledger

- Reconnaissance — `git fetch origin`, `git status --short`, ancestry check — PASS;
  clean original checkout; main 02d43088; PR #91 merged; ruleset disabled.
- Baseline qa:fast — FAIL with timing/RPC errors recorded above, not a clean pass;
  typecheck and lint passed before unit stage. Focused timing reproduction12 pass/2 fail.
- `npm run agent:plan:validate:all` — PASS for all versioned plans.
- `npm run web:hygiene` — PASS8081/8082 free.
- Native worker failure — ENVIRONMENT, partial worktree clean; same-protocol resume
  231a51cc limited to static/synthetic validation and disk-preflight/replay improvements.
- Parent full baseline maxWorkers2 — FAIL3172passed/3skipped/2readiness timeouts,
  plus RPC timeout; /tmp/campaign-b-base-tests-bounded.log.
- Parent recovery — SQLite migration38pass; concurrency/generation46pass; cloud
  source guards6pass; readiness11pass. Native first replay23pass/1CRLF assertion
  failure corrected without weakening launch order; final replay remains next gate.

## Changed Files / Areas

- `.agent/execplans/native-migration-recovery-campaign-b.md` — durable campaign state.
- `docs/reports/critical-integrity-cross-pr-acceptance-report.md` and Campaign A plan — historical corrections.
- `tests/releaseReadiness.test.ts` — isolate two policy checks from network latency without changing production checks.
- B1/B1.2/B2/B3/B4 candidate commits above — exact file inventory from Git.
- `docs/reports/native-migration-recovery-campaign-b-report.md` — final report to create.

## Recovery / Resume Instructions

Read AGENTS.md, .agent/PLANS.md and this plan completely. Run
`npm run agent:resume -- --plan .agent/execplans/native-migration-recovery-campaign-b.md`.
Inspect Git status/diffs/worktrees and subagent status/receipts before resuming.
Do not create replacement writers while lane ownership is active. Reconcile this
checkpoint with actual commits and QA artifacts, run qa:affected, then continue
from Exact next action. Main recovery reference is 02d43088.

## Outcomes & Retrospective

- Status: Active; no certification or integration claimed.
- Follow-up: determined by actual lane evidence, not a new broad audit.
