## 1. Preflight and a new ExecPlan

- [x] 1.1 Read `AGENTS.md`, `.agent/PLANS.md`, and `.agent/EXECUTION_PROMPT.md`, then record git status, branch, HEAD, stash list, and worktrees without modifying stash `pre-recovery-local-changes` or the completed live-cloud ExecPlan
- [x] 1.2 Confirm HEAD `23ded6e7676f94d6ddf9337ad02d526d85973fcb` and ancestor `56259876418674f85e1ca42c87f248fcf12c7d75`, and look up CI `36024910286` and `36017723458` without treating either id as fresh proof until the lookup is saved
- [x] 1.3 Put Node `v22.23.2` on `PATH` (pinned binary, not host Node 24) and record `node --version` before any integration gate
- [x] 1.4 Create `openspec/changes/external-blocker-closure/execplan.md` with `Plan-Version: 2` and `Status: ACTIVE`, and validate it with `npm run agent:plan:validate`

## 2. Production incident residue

- [x] 2.1 Read the incident notes, hermetic build guard, and serve-e2e backstop, and list the synthetic fingerprints and timestamps that can distinguish incident rows
- [x] 2.2 Run read-only queries against project `superhabits` / `kruubbynsmxzxfdunaal` only, and classify each candidate as `CONFIRMED_SYNTHETIC`, `PROBABLE_SYNTHETIC`, `AMBIGUOUS`, or `LEGITIMATE_OR_UNRELATED` with the required row evidence
- [x] 2.3 Write a transaction-aware cleanup proposal covering only `CONFIRMED_SYNTHETIC` rows, including foreign keys, backup manifests, auth identities, and rollback, and mark execution `OWNER_APPROVAL_REQUIRED`
- [x] 2.4 Re-run the hermetic E2E, embedded-host, credential-leak, runtime server, and dummy-host guards; add a regression test only if a bypass is demonstrated, and do not drain production

## 3. Disposable Supabase certification

- [x] 3.1 Re-check IPv6 route, pooler DNS, and whether `SUPABASE_ACCESS_TOKEN` is configured, reporting presence only
- [x] 3.2 Resolve project `slvctfwphtpeymzghyoc` read-only and prove its host and name against the disposable guard and production host `kruubbynsmxzxfdunaal.supabase.co` before any write
- [x] 3.3 If isolation passes, run the repository disposable-backend battery (schema, RLS, backup, Restore V2, hard-delete, partial failure, imported-owner recovery, outbox, Edge Functions) and record project id, SHA, and cleanup; if it fails, abort writes and write the credential runbook

## 4. AI Command Center readiness

- [x] 4.1 Re-read `parse-ai-command` and `user-ai-ask` and record the live provider split (`OPENAI_API_KEY` plus `AI_COMMAND_MODEL`, and `DEEPSEEK_API_KEY`) without printing secret values
- [x] 4.2 Resume `.agent/execplans/ai-command-center-production-v1.md` from its phase-1 checkpoint and run deterministic, mock, and static-security gates that do not need a provider
- [x] 4.3 When authorized provider secrets exist, run the existing authenticated evaluation gates for both functions and record accuracy, injection, isolation, failure, latency, and cost; otherwise label the provider lane blocked
- [x] 4.4 Draft the phase-5 privacy analysis and the rollout plan (monitoring, quota, flags, incident response, rollback) and keep default-on off until owner authorization

## 5. iOS and EAS runtime

- [x] 5.1 Recheck EAS project linkage, `.eas/workflows/native-e2e.yml`, and `eas.json` without starting a billable job or changing signing
- [x] 5.2 Run the repository's non-billable workflow validation and static native checks, and record them as static evidence
- [ ] 5.3 If an authorized non-billable iOS simulator or macOS path exists, certify that source SHA there; otherwise record the paid-plan or missing-macOS owner action and leave iOS runtime `NOT RUN`

## 6. Store-release preparation

- [x] 6.1 Re-audit `docs/release` and replace the historical placeholder inventory with a current, deduped owner-action list tied to source documents
- [x] 6.2 Close repository-executable release-doc and guard drift, and keep `submit.production` empty
- [x] 6.3 Prepare the submission package for support email, privacy URL, real-build screenshots, graphics, copy, DSA/trader fields, signing, and console setup, and do not create `v1.0.0` or submit either store

## 7. Deferred architecture and dependency risk

- [x] 7.1 Write the gap-21 owner decision record (keep fail-closed, add manifest generations, or define an explicit degraded mode) without implementing a degraded restore or bidirectional sync
- [x] 7.2 Fix only a demonstrated backup or data-integrity defect, with regression coverage, and leave J8/D14 ceilings unchanged
- [x] 7.3 Recheck production dependency advisories and do not apply a breaking override without a fresh review

## 8. Adversarial review and terminal report

- [x] 8.1 Review production integrity, disposable isolation, restore safety, RLS, AI confirmation and provider failure, and release claims that exceed evidence
- [x] 8.2 Fix each safely executable defect with regression coverage and run a second adversarial review
- [ ] 8.3 Publish the final report at the actual final SHA, separating it from the Android binary SHA, using only `COMPLETE`, `LOCALLY COMPLETE — EXTERNAL ACTIONS REQUIRED`, `BLOCKED`, or `NOT CERTIFIED`, with the four blocker fields on every residual
