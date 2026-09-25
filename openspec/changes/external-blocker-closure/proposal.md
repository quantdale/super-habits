## Why

The live-cloud campaign is historically complete at `23ded6e7676f94d6ddf9337ad02d526d85973fcb`, with hermetic E2E guards and exact-source Android evidence already landed, but production residue, disposable-backend certification, authenticated AI evaluation, iOS runtime proof, store authorization, and the gap-21 restore decision are still external or unclassified. A successor needs one spec-driven contract so later execution closes only what is authorized and never treats a missing credential, paid plan, or owner decision as a pass.

## What Changes

- Add an external-blocker closure contract for all seven workstreams: starting evidence, current state, work performed, tests, exact results, remaining blockers, and an unblock procedure. A missing prerequisite MUST NOT be recorded as `PASS`.
- Preserve the completed live-cloud ExecPlan and stash `pre-recovery-local-changes`. Require a new Plan-Version 2 ExecPlan and Node 22.23.2 for integration gates. Require adversarial review and a terminal report whose only labels are `COMPLETE`, `LOCALLY COMPLETE — EXTERNAL ACTIONS REQUIRED`, `BLOCKED`, and `NOT CERTIFIED`.
- Add production-incident residue rules limited to project `superhabits` / `kruubbynsmxzxfdunaal`: read-only classification, a cleanup proposal covering only confirmed incident records, and deletion status `OWNER_APPROVAL_REQUIRED` until the owner approves those exact targets. Do not repeat the production-drain experiment.
- Require disposable certification to prove the target is disposable and is not production before any write, abort writes if isolation fails, and refuse a paid project or billable branching without cost approval. Mock or static success is not that certification.
- Require AI Command Center readiness to follow the implemented provider split, keep secrets out of the repo and logs, and withhold default-on behavior and any production-readiness claim until the authenticated gates pass and the owner authorizes rollout.
- Require iOS/EAS runtime results to stay independent of Android results and static checks. Forbid a plan upgrade, billable workflow, signing change, or store submission without authorization.
- Require store preparation to re-audit the current release docs, list residual owner actions, and withhold `v1.0.0` and either-store submission until release authorization. Screenshots must come from a real build.
- Keep gap 21 fail-closed until the owner records a decision. Do not invent a degraded-restore policy and do not add full bidirectional sync. Keep the existing J8/D14 ceilings.

## Capabilities

### New Capabilities

- `external-blocker-closure`: Campaign evidence, historical preservation, toolchain pin, adversarial review, terminal states, and the final report.
- `production-incident-residue`: Read-only classification and owner-gated cleanup for the one authorized production project, plus recurrence guards.

### Modified Capabilities

- `user-simulation-platform`: Write-capable disposable certification aborts unless isolation is proven; unpaid-only; static or mock success is not certification.
- `command-center-v2`: Parse readiness uses `OPENAI_API_KEY` and `AI_COMMAND_MODEL` together; authenticated evaluation and explicit owner authorization precede any default-on or production-readiness claim.
- `ai-ask`: Ask readiness uses `DEEPSEEK_API_KEY`; the same authenticated-evaluation and no-default-on rules apply, and the privacy disclosure stays separate from legal sign-off.
- `native-release-qualification`: iOS runtime certification is not inferred from Android or from workflow files, and billable EAS, signing, and store submission stay unauthorized.
- `backup-completeness-v2`: The manifest-window gap stays fail-closed until an owner decision; no invented degraded mode and no bidirectional sync.
- `release-candidate-closure`: Store package preparation re-audits current placeholders; version tag and submission wait for authorization; screenshot evidence is from a real build.

## Impact

Applying this change later adds one new ExecPlan, incident evidence, release-doc and privacy-doc updates, and regression tests only where a guard bypass or a correctness defect is demonstrated. This change does not itself query or mutate Supabase, print secrets, create paid projects, trigger billable EAS, or submit a store listing. Schema version stays 25 unless a later defect fix earns its own append-only migration. Local SQLite authority, one-way backup, Restore V2, portable backup, account recovery, soft-delete, and sync-enqueue invariants stay in force.
