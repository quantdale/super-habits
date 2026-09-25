## Context

See proposal.md for why this change exists. Exploration on 2026-09-25 found no active OpenSpec change. `git` HEAD is `23ded6e7676f94d6ddf9337ad02d526d85973fcb` (`docs(agent): close overnight live-cloud campaign`). The live-cloud ExecPlan is `COMPLETED`. Its Outcomes name code-final ancestor `56259876418674f85e1ca42c87f248fcf12c7d75` and CI `36017723458`. The campaign prompt names CI `36024910286` at the docs-close SHA. Stash `stash@{0}` is `pre-recovery-local-changes`.

Already in tree, and treated as landed unless a later run disproves it: `scripts/build-dist-e2e.mjs` (dotenv blocked, `EXPO_PUBLIC_*` stripped, `supabase.co` byte scan), `scripts/serve-e2e.js` (refuses every host except `dummy.supabase.co`), `simulation/backend/guard.ts` (production host, ambient production credentials, disposable-name marker), and `simulation/backend/provision.ts` (`--reuse=` re-checks the real project name before schema apply; default marker `superhabits-disposable`). Parse requires `OPENAI_API_KEY` and `AI_COMMAND_MODEL`. Ask requires `DEEPSEEK_API_KEY`. The AI ExecPlan is still `ACTIVE` with phase 1 done and phases 2–6 open. Gap 21 in `docs/testing/known-gaps.md` is open and spec-deferred. `docs/release` currently has eight markdown files and 54 `[OWNER ACTION` lines, which does not match the older "58 across 9 files" note. This shell's default `node` is v24.3.0; the pinned binary is v22.23.2. `.nvmrc` is `22.23.2`.

## Goals / Non-Goals

**Goals:**

- Give later execution one evidence path for all seven workstreams without reopening the completed plan.
- Keep production deletes, disposable writes, provider traffic, paid EAS, and store submission behind the gates in the delta specs.
- Leave gap 21 fail-closed and write the owner decision record the known-gaps entry asks for, without choosing the policy.

**Non-Goals:**

- Running this campaign, checking off its tasks, or creating the ExecPlan inside this planning change.
- Querying or mutating production or disposable Supabase while authoring these artifacts.
- Editing `live-cloud-verification-production-integration-v1.md`, the foreign stash, or any archived change.
- Choosing strict versus best-effort restore, adding bidirectional sync, tagging `v1.0.0`, or lowering J8/D14 ceilings.
- Repeating the previous certification battery or the production-drain experiment.

## Decisions

### 1. One active change, eight deltas, one requirement each

OpenSpec rejects a change with more than ten requirement deltas. The proposal's eight capabilities therefore each add exactly one requirement; scenarios carry the distinct cases. Detail that would have been extra requirements stays in those scenarios and in this design.

Alternative: several smaller changes, one per workstream. Rejected because the prompt is one successor campaign and a split would hide the single terminal report. Alternative: one mega-requirement. Rejected because modified capabilities must land on their existing spec paths (`user-simulation-platform`, `command-center-v2`, `ai-ask`, `native-release-qualification`, `backup-completeness-v2`, `release-candidate-closure`).

### 2. Preserve both SHAs; do not promote the docs commit to the binary SHA

`23ded6e7676f94d6ddf9337ad02d526d85973fcb` is the historical result to preserve. `5625987` is the code-final ancestor the completed plan certifies for Android. Later certification must say which SHA a binary, a CI run, and a doc-only commit belong to. CI `36024910286` and CI `36017723458` stay unverified against each other until execution reads GitHub.

Alternative: treat Outcomes' `5625987` as HEAD. Rejected; `git rev-parse HEAD` is the docs-close commit. Alternative: ignore the prompt CI id. Rejected; it is reported evidence that still needs a lookup, not a fact to delete.

### 3. Incident "closed" means the drain path, not row deletion

Hermetic `build:e2e` and the serve-e2e backstop are the recurrence controls. Cleanup SQL is still unrun. Classification must not use "created on 2026-09-24" as `CONFIRMED_SYNTHETIC`. The string needle `supabase.co` does not see a custom domain; that residual stays a hypothesis until a bypass is demonstrated. A demonstrated bypass gets a regression test. The production project is not the test fixture.

Alternative: schedule a production delete of every anonymous user from that date. Rejected; the prompt and the spec forbid date-only deletion.

### 4. Writes wait on the existing guard; the resume command is not a waiver

`npx tsx simulation/backend/provision.ts run --with-parser --no-teardown --reuse=slvctfwphtpeymzghyoc --org-id mnqrbiambekxvrtuufcn --production-hosts kruubbynsmxzxfdunaal.supabase.co` is a starting reference. `--reuse` looks up the project, then `guard.ts` aborts unless the name contains `superhabits-disposable`. `--no-teardown` leaves the project behind, so execution must record cleanup semantics before using it. The existing spec still says the guard aborts before production network use. This change does not weaken that requirement. A read-only identity lookup is not schema apply, deploy, or certification.

Alternative: rewrite the disposable-lane requirement so a Management API read is explicitly allowed first. Rejected for this change; loosening the current requirement is a separate decision if the lookup and the spec disagree during execution.

### 5. Provider gates stay split, and phase 5 is not legal approval

Parse and ask keep separate secret sets. Missing ask credentials do not fail the parse gate, and a present parse key does not certify ask. The ACTIVE AI plan's phase 5 privacy delta can be drafted from source without a provider, then held for owner or counsel. Default-on stays off. No secret value is printed; presence only.

Alternative: one combined "AI configured" flag. Rejected; the functions read different env vars.

### 6. iOS evidence is a runtime on the applicable SHA, or an external blocker

`.eas/workflows/native-e2e.yml` already has `build_ios` and `test_ios`. `native-release-qualification` already forbids calling a missing iOS lane a cross-platform pass. This design adds the paid-plan, signing, and static-file limits. Android 19/19 remains Android evidence. This Windows host is not an iOS runtime. No plan upgrade.

Alternative: infer iOS readiness from the workflow YAML plus Android. Rejected by the spec.

### 7. Store inventory is recounted; release stays unauthorized

Execution recounts `[OWNER ACTION]` markers and dedupes repeated privacy-URL and credential lines. It does not adopt 58 or the explore-time line count of 54 as the answer. `eas.json` `submit.production` stays empty. Screenshots come from a real build. No `v1.0.0` tag.

Alternative: close the campaign by pasting the old placeholder inventory. Rejected; the prompt says the old count is not authoritative.

### 8. Gap 21 is a decision record, not a restore-mode implementation

Known-gaps asks for an OpenSpec on manifest generations and degraded modes. The prompt forbids inventing that policy. This change records the choice the owner must make (keep fail-closed, add generation history, or define an explicit degraded mode) and requires current restore to keep returning invalid without local writes. Bidirectional sync is out. J8 (800 ms section switch) and D14 (500 ms diary search) stay. The 0 critical / 0 high / 14 moderate audit is a snapshot to recheck, not permission to force overrides. The completed plan already rejected a `decode-uri-component` override.

Alternative: implement generation history now. Rejected; it changes the restore contract without an owner decision.

### 9. The ExecPlan is new, versioned, and lives with this change

On execution, create `openspec/changes/external-blocker-closure/execplan.md` with `Plan-Version: 2` and `Status: ACTIVE`, per `.agent/PLANS.md`. Do not edit the completed live-cloud plan. Integration commands run only after `node --version` prints `v22.23.2` (the installed pin is `%LOCALAPPDATA%\tools\node-v22.23.2-win-x64`). `docs/testing/known-gaps.md` E1 still describes a Node 20 default; that note is stale relative to this host's Node 24 and must not be followed blindly.

Alternative: resume the completed plan by flipping it back to ACTIVE. Rejected; the prompt requires that plan to stay historically completed.

### 10. Terminal state is chosen only after independent work is exhausted

Order: do every authorized local item; classify each external prerequisite with the four blocker fields; if a product or release gate is still failed, `NOT CERTIFIED`; if useful authorized work remains but cannot proceed, `BLOCKED`; if local work is done and only owner, paid, credential, or legal actions remain, `LOCALLY COMPLETE — EXTERNAL ACTIONS REQUIRED`; `COMPLETE` only when those external actions are actually done. Do not invent test counts when a command reports only an exit status.

## Risks / Trade-offs

- [Read-only project lookup runs before the reuse guard's second check] → Treat lookup as identity only. Abort writes when the marker, host, or ambient production credentials fail. Do not call the lookup a certification.
- [CI ids in the prompt and in Outcomes differ] → Look up both SHAs on GitHub during execution. Do not certify from either number until that lookup exists.
- [`supabase.co` scan misses a custom domain] → Leave it as a residual unless a concrete bypass is shown. Do not use production as the proof.
- [Gap 21 stays a data-loss window for a dead device] → Behavior stays fail-closed, which refuses a wrong import. The owner decision is the only path to a different restore mode.
- [`--no-teardown` can leave a disposable project allocated] → Record whether the reused project is wiped, and do not create a second project when reuse is valid.
- [Eight requirements are dense] → Scenarios are the testable slices. Execution must not satisfy one scenario and mark the whole requirement passed.
- [Host Node 24 is outside `engines`] → A green run on Node 24 is not an integration-gate result for this campaign.

## Migration Plan

These artifacts do not migrate user data and do not deploy. Execution order is: new ExecPlan and git preflight; read-only production classification; disposable route check with writes aborted on guard failure; AI deterministic work in parallel with any authorized provider evaluation; iOS static checks without a billable job; release-doc re-audit; gap-21 decision record without a code policy; adversarial review; terminal report. Rollback of this planning change is removing `openspec/changes/external-blocker-closure/`. Rollback of a later product fix is a normal revert. Production deletion, if ever approved, needs its own transaction and restore notes in the incident evidence, and does not run on the strength of this design.

## Open Questions

- Whether GitHub run `36024910286` belongs to `23ded6e` and `36017723458` belongs to `5625987`. Execution looks this up; the preserve-both-SHAs decision does not change.
- Whether project `slvctfwphtpeymzghyoc` is still present and whether its name contains `superhabits-disposable`. Execution resolves that read-only; a missing marker aborts writes either way.
- The current EAS plan tier and GitHub linkage. Execution rechecks; a paid-only result stays an owner action.
