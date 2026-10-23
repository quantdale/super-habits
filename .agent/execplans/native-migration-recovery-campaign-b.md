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

- Current milestone: reconnaissance complete; isolated component lanes launching.
- Completed: fetched origin, main ancestry verified, clean worktree preserved,
  PR #91 merge and open PRs #57/#80/#81/#92 verified; ruleset inspected.
- In progress: five exclusive component lanes below; parent owns integration/report.
- Important modified files: this plan only.
- Last successful validation: Git remote/ancestry/worktree reconnaissance.
- Current failures: None newly tested; historical advisory gate remains unverified.
- Relevant quarantines: None.
- Blockers: hosted credentials and fresh native environment require investigation.
- Condition required to unblock: lane evidence will identify exact external needs.
- Exact resume action after unblock: run the affected lane's documented replay.
- Exact next action: launch bounded isolated B1/B1.2/B2/B3/B4 workers with fresh
  independent reviews after B1/B2 handoffs; inspect final diffs before integration.
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

Workers may commit, not push/merge/deploy or spawn children. Read-only reviewers
inspect actual lane diffs and logs; parent accepts or rejects findings.

## Surprises & Discoveries

- Main has not advanced since the corrected historical SHA; no later correction
  is already landed. Older sh-branding checkout is unrelated and preserved.
- Open security PRs are #57/#81/#92; #80 is a separate recovery successor.
- Campaign A's broad all-zero repair recommendation is not authority to overwrite
  legitimate ordering: no repair without a discriminating cohort predicate.

## Decision Log

- Reconnaissance — Preserve current main as recovery reference and use isolated
  branches; no modifications to administrator settings or production resources.
- Delegation — Split adapter serialization from migration ownership to avoid
  overlapping client.ts edits; native provisioning starts concurrently.

## Validation Ledger

- Reconnaissance — `git fetch origin`, `git status --short`, ancestry check — PASS;
  clean original checkout; main 02d43088; PR #91 merged; ruleset disabled.
- Remaining gates — NOT RUN at this checkpoint.

## Changed Files / Areas

- `.agent/execplans/native-migration-recovery-campaign-b.md` — durable campaign state.
- Component files will be recorded from committed handoffs and actual Git diffs.

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
