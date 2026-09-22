# SuperHabits — Production Closure, Exact-HEAD Certification, Platform Closure, and Release Readiness Campaign

**Status:** ACTIVE
**Exact next action:** Phase 1 — reconcile `.agent/execplans/workout-history-quick-log-badge.md` (tick the landed `Single commit` task), run `npm run agent:plan:validate:all` to PASS, run the cheap gates, commit the CI/governance repair, push, and verify the exact pushed-SHA GitHub Actions run progresses past `Validate versioned ExecPlans`.
**Planned-From:** `691d2a2ef488c45d936f736d29ba81d7cea96150`
**Target branch:** `main`
**Campaign:** Production Closure, Exact-HEAD Certification, Platform Closure, and Release Readiness
**Subtitle:** Restore CI truth → reconcile stale plans → exact-HEAD certification → Android/Supabase/iOS/store/dependency closure → release verdict → v2 direction audit

> Reconciled 2026-09-22 against Git at planner handoff: `HEAD == origin/main == 691d2a2`, tree clean; Phase-0 verification confirmed the CI defect hypothesis (see `.agent/execplans/production-closure-exact-head-cert-v1.md`). The predecessor prompt (Super Habits Functional Completion V1, COMPLETED) survives in Git history.

---

You are the primary autonomous engineering agent responsible for taking the **SuperHabits** repository from its current state through the remaining production-readiness work.

Repository:

```text
quantdale/super-habits
```

This is a **long-running autonomous campaign**. Work methodically, use subagents aggressively for parallel read-only investigation and isolated implementation where safe, and continue until every repository-executable task described below has either been completed and validated or has been proven to require an external owner/device/credential action.

Do **not** stop after producing a report.

Do **not** merely audit.

Do **not** stop after finding problems.

Where an issue is clearly fixable from the repository and current machine, fix it, test it, integrate it, and continue.

---

# 1. PRIMARY OBJECTIVE

Complete the following program **in sequence**:

1. Restore trustworthy GitHub CI.
2. Reconcile stale repository governance/planning state.
3. Certify the exact current release candidate SHA.
4. Close every safely executable platform/release gap.
5. Deeply validate Supabase/cloud behavior where infrastructure permits.
6. Deeply validate Android/native behavior where infrastructure permits.
7. Validate iOS-related repository readiness and execute actual iOS validation if the environment supports it.
8. Finish every repository-side App Store / Play Store release artifact.
9. Audit dependency/security posture without unsafe blind upgrades.
10. Produce a final release-readiness verdict grounded in actual evidence.
11. Only after the release line is trustworthy, identify the strongest post-1.0 / v2 engineering direction, with preference toward:

- real multi-device synchronization; or
- productionizing the AI Command Center.

12. Do not begin speculative v2 implementation unless all 1.0 repository-executable closure work is genuinely finished and the evidence strongly supports proceeding.

The campaign must prefer **production closure over feature churn**.

---

# 2. IMPORTANT CURRENT BASELINE — VERIFY, DO NOT BLINDLY TRUST

The following information is supplied only as an initial lead.

You MUST verify it against the actual repository, Git history, GitHub state, workflows, files, and executable behavior before relying on it.

Expected recent repository state:

```text
main ≈ 691d2a2
```

Recent tip observed previously:

```text
691d2a2 docs(execplan): autonomous campaign thinning survey — declare stop (Run 2)
```

The recent campaign appears to have concluded that arbitrary micro-hardening should stop and that remaining work is primarily CI, certification, native/cloud/platform, and release closure.

Potential current CI defect:

```text
.agent/execplans/workout-history-quick-log-badge.md
```

appears to be marked:

```text
Status: COMPLETED
```

while still containing:

```text
- [ ] Single commit.
```

despite the implementation apparently already existing as commit:

```text
ac60e78 feat(workout): badge quick-logged sessions in history list and detail
```

This reportedly causes:

```text
npm run agent:plan:validate:all
```

to fail before Vitest and E2E execute.

Treat all of this as a hypothesis until verified.

---

# 3. NON-NEGOTIABLE ENGINEERING RULES

## 3.1 Repository truth beats documentation

Do not blindly trust:

- README
- ExecPlans
- OpenSpec status
- release documents
- known-gap registers
- previous completion claims
- old certification reports
- stale CI summaries

Cross-check claims against:

- current Git tree;
- Git history;
- actual source;
- actual test files;
- GitHub Actions state;
- release/config files;
- generated artifacts;
- runtime behavior where feasible.

If documentation conflicts with code or actual behavior, the code/runtime evidence wins and documentation must be corrected.

---

## 3.2 Preserve strict tests

Never make a failing test pass by:

- deleting it;
- weakening the assertion without evidence;
- increasing limits merely because a threshold failed;
- skipping/quarantining it without justified classification;
- converting meaningful failures into advisory checks.

Use the repository's existing failure taxonomy where applicable:

```text
PRODUCT_BUG
TEST_BUG
FLAKY_TEST
ENVIRONMENT
EXPECTED_KNOWN_GAP
SPEC_AMBIGUITY
```

Fix root causes.

---

## 3.3 Git safety

Before any mutation:

```bash
git status --short
git branch --show-current
git rev-parse HEAD
git rev-parse origin/main
git log --oneline -20
git worktree list
git stash list
```

Fetch remote state.

Never:

- reset away unknown work;
- force push;
- delete another session's work;
- overwrite concurrent changes;
- assume an unclean tree is yours.

If concurrent work exists, preserve it.

Use separate worktrees/branches where appropriate.

Prefer small coherent commits with clear messages.

Before claiming final completion:

```bash
git status --short
git diff --check
git rev-parse HEAD
git rev-parse origin/main
```

The final repository state must be explicitly reported.

---

# 4. USE SUBAGENTS AGGRESSIVELY

Use multiple subagents in parallel for independent **read-only** investigations.

Suggested initial decomposition:

### Agent A — Git / governance / ExecPlan state

Inspect:

- Git topology;
- recent history;
- active/BLOCKED/COMPLETED ExecPlans;
- stale completion state;
- OpenSpec state;
- branch/worktree hygiene.

### Agent B — GitHub Actions / CI

Inspect:

- current workflow configuration;
- recent failed runs;
- exact failing steps;
- scheduled/nightly behavior;
- skipped downstream gates;
- native EAS workflow state.

### Agent C — release/store readiness

Inspect:

```text
docs/release/
app.json
eas.json
public/privacy.html
```

Identify:

- repository-executable work;
- owner-only actions;
- stale release claims.

### Agent D — test/certification landscape

Inspect:

```text
docs/testing/
qa/
e2e/
simulation/
.maestro/
```

Build the exact certification matrix required for current HEAD.

### Agent E — Supabase / backup / auth

Inspect:

```text
supabase/
core/sync/
core/backup/
core/auth/
```

Map:

- actual remote behavior;
- stubs;
- migrations;
- RLS;
- disposable backend capability;
- remaining real-boundary gaps.

### Agent F — native Android/iOS

Inspect:

```text
.eas/
.maestro/
scripts/qa-native*
app.json
plugins/
```

Determine which native validations can run on this environment.

### Agent G — dependencies/security

Inspect:

- package.json;
- lockfile;
- npm audit;
- Expo compatibility;
- overrides;
- transitive vulnerabilities.

Subagents must return evidence and proposed actions.

The primary agent decides integration and owns all mutations.

---

# 5. PHASE 0 — RECONSTRUCT REAL CURRENT STATE

Before changing anything:

1. Read completely:

```text
AGENTS.md
.agent/PLANS.md
.agent/EXECUTION_PROMPT.md
README.md
docs/testing/autonomous-qa.md
docs/testing/known-gaps.md
docs/release/app-store-readiness.md
qa/impact-map.json
```

2. Inspect all version-2 ExecPlans and determine their real lifecycle state.

Run:

```bash
npm run agent:plans
npm run agent:plan:validate:all
```

3. Inspect OpenSpec:

```bash
openspec list
openspec validate --all
```

or repository equivalents.

4. Inspect GitHub:

- current `main`;
- open PRs;
- open issues;
- recent workflows;
- latest push run;
- scheduled/nightly runs;
- exact-head status checks.

5. Record a fresh campaign ExecPlan.

Do not reuse a stale global progress document if the repository's conventions say to create a task-specific ExecPlan.

---

# 6. PHASE 1 — RESTORE CI TRUTH

This is the highest-priority action.

Investigate the current CI failure rather than assuming the supplied diagnosis is correct.

If the failure is indeed caused by:

```text
.agent/execplans/workout-history-quick-log-badge.md
```

with a completed implementation but an unchecked historical commit task:

- verify the commit exists;
- verify the feature exists;
- verify the plan's validation evidence;
- reconcile the checkbox/status honestly;
- do not falsify completion.

Then run:

```bash
npm run agent:plan:validate:all
```

It must pass.

Afterward run at least the repository's cheap gates:

```bash
npm run typecheck
npm run lint
npm run validate:themes
npm run openspec:validate
npm test
```

Repair any genuine failures discovered.

Commit the CI/governance repair.

Push only when safe and permitted.

Then inspect the exact GitHub Actions run created from that pushed SHA.

Do not treat CI as restored until the pipeline progresses past the previously blocked step.

If later jobs fail, investigate and fix them.

---

# 7. PHASE 2 — RECONCILE STALE PLANS AND REPOSITORY TRUTH

Audit all lifecycle documents for contradictions such as:

- BLOCKED plans whose blocker is gone;
- COMPLETED plans with unchecked mandatory work;
- old references to GitHub billing being blocked;
- stale SHA references;
- release documents claiming certification against superseded commits;
- unresolved "next action" fields on supposedly complete plans.

Especially inspect:

```text
.agent/execplans/repository-completion-and-truth-v1.md
.agent/execplans/release-readiness-refresh-v1.md
.agent/execplans/autonomous-campaign-thinning-stop-v1.md
```

Do not rewrite history unnecessarily.

Correct only material stale truth that currently misrepresents repository state or blocks tooling.

Validate every changed ExecPlan.

---

# 8. PHASE 3 — EXACT-HEAD RELEASE CERTIFICATION

The application has received substantial changes since earlier release certification.

Do not reuse old evidence as proof for the current exact SHA.

Create a certification plan tied to one explicit candidate SHA.

The candidate must remain stable during certification.

If source changes during certification, invalidate affected evidence and rerun the relevant lanes.

At minimum execute, when supported:

## Static / contracts

```bash
npm run typecheck
npm run lint
npm run validate:themes
npm run openspec:validate
npm run agent:plan:validate:all
npm run qa:impact:validate
```

## Unit + integration

```bash
npm test
```

Confirm actual test counts and failures from output.

Do not hard-code historical counts.

## Fast QA

```bash
npm run qa:fast
```

## Timezone behavior

```bash
npm run qa:timezones
```

if applicable.

## Web build

```bash
npm run build:web
```

## Web lifecycle/hygiene

```bash
npm run web:verify
npm run web:hygiene
```

where applicable.

## Browser E2E

Execute the repository's appropriate complete web suite.

Likely:

```bash
npm run e2e
```

or the exact lane matrix currently defined.

## Deterministic simulations

```bash
npm run sim:validate
npm run sim:run -- --mode deterministic
```

If the campaign's release criteria require repetition/soak, execute it.

## Remote-boundary dummy lane

```bash
npm run build:sync
npm run e2e:sync
```

where supported.

## PWA/service worker

Run the PWA lane independently where appropriate.

Document:

- pass;
- skip;
- environment;
- genuine known gap.

Every skip must have a reason.

---

# 9. PHASE 4 — ANDROID EXACT-BUILD CERTIFICATION

Inspect the actual native QA guidance first.

Determine:

- installed AVDs;
- adb state;
- Android API;
- ABI;
- Maestro version;
- whether provisioning is current.

Use the repository's existing scripts instead of inventing ad hoc commands where possible.

Likely lanes include:

```bash
npm run qa:native:provision
npm run qa:native:android
npm run qa:native:targeted
npm run qa:native:lifecycle
```

Execute applicable Android validation against an APK built from the exact certified candidate SHA.

Record:

- source SHA;
- APK path;
- APK SHA-256;
- package name;
- emulator/device;
- API level;
- ABI;
- smoke results;
- persistence results;
- lifecycle results.

If source changes afterward, native certification must be reconsidered.

Investigate remaining native known gaps that are feasible on this workstation:

- notification behavior;
- app process death;
- persistence;
- long-horizon recurrence where practical;
- offline transitions where practical;
- native performance profiling where practical.

Do not pretend Windows can run Xcode/iOS simulator.

---

# 10. PHASE 5 — SUPABASE / CLOUD / ACCOUNT CLOSURE

Deeply inspect:

```text
supabase/migrations/
supabase/functions/
core/sync/
core/backup/
core/auth/
```

Verify what is truly implemented versus documented.

Important distinction:

SuperHabits currently appears to implement:

```text
local SQLite source of truth
+
one-way cloud backup
+
Restore V2
+
portable backup/import
```

rather than true two-way sync.

Do not accidentally turn backup into sync during a release-closure task.

### Required work

1. Validate schema/migration coherence.
2. Validate RLS definitions statically.
3. Validate all remote tables match the local recoverable scope.
4. Validate owner stamping.
5. Validate backup manifests/checksums.
6. Validate Restore V2 empty-device guarantees.
7. Validate account recovery boundary.
8. Validate portable-import owner recovery.
9. Validate edge functions.
10. Run the disposable/live backend lane if:

    - credentials/environment exist;
    - the repository already supports it;
    - it can be done safely.

If no authorized Supabase environment exists, classify real round-trip validation as an environment/capability gap and provide the exact command/runbook needed to close it.

Never use production infrastructure destructively.

---

# 11. PHASE 6 — IOS READINESS

Determine what can be validated from the current environment.

On Windows/Linux:

- statically verify iOS configuration;
- verify Expo config;
- verify bundle identifier;
- verify required plist values;
- verify asset completeness;
- verify EAS workflow;
- verify build profile;
- verify release metadata;
- run Expo/doctor/prebuild checks where safe and appropriate.

If EAS can remotely produce an iOS simulator/device build using existing authorized credentials, do so only when this repository's workflow already supports it and credentials are available.

Otherwise document:

```text
REQUIRES EAS/macOS/Apple credentials
```

with exact next action.

Do not claim iOS runtime certification without an actual iOS runtime.

---

# 12. PHASE 7 — STORE RELEASE CLOSURE

Inspect and reconcile:

```text
docs/release/app-store-readiness.md
docs/release/privacy-policy.md
docs/release/store-data-declarations.md
docs/release/release-notes-1.0.0.md
docs/release/age-rating-and-trader.md
docs/release/store-assets-checklist.md
docs/release/version-build-consistency.md
docs/release/icon-splash-asset-audit.md
public/privacy.html
app.json
eas.json
```

Repository-side tasks should be completed where possible.

Validate:

- app name;
- package/bundle identifiers;
- version;
- versionCode;
- buildNumber;
- icon sizes;
- adaptive icon;
- monochrome icon;
- splash;
- notification icon;
- privacy text;
- public privacy URL path;
- release notes length limits;
- store descriptions;
- age-rating drafts;
- Data Safety declarations;
- App Privacy declarations;
- permissions versus declaration documents;
- EAS production profile;
- submit profile.

Clearly separate:

## Repository-executable

Examples:

- metadata corrections;
- drift guards;
- release notes;
- copy;
- manifests;
- asset dimension validation;
- store checklist corrections.

## Owner/external actions

Examples:

- App Store Connect access;
- Play Console access;
- legal/trader confirmation;
- privacy-policy public hosting confirmation;
- production credentials;
- signing;
- screenshot capture requiring final store devices;
- actual submission;
- final release/tag authorization.

Do not fabricate screenshots.

Do not submit to stores without explicit authorization.

Do not create the final production Git tag unless release intent is explicitly authorized by the repository/user instructions.

---

# 13. PHASE 8 — DEPENDENCY AND SECURITY AUDIT

Run:

```bash
npm audit
npm audit --omit=dev
npx expo-doctor
```

or repository-approved equivalents.

Investigate every high/critical advisory.

Classify advisories into:

- direct runtime dependency;
- direct dev dependency;
- transitive framework dependency;
- unreachable tooling;
- patched through override;
- upgrade available safely;
- upgrade requires Expo/RN stack migration.

Do not run:

```bash
npm audit fix --force
```

blindly.

Do not destabilize Expo 55 / React Native 0.83 simply to reduce an advisory number.

Where safe patch/minor upgrades are available and compatible:

- apply them coherently;
- update lockfile;
- run full affected QA.

Where framework-owned:

- record the exact dependency chain;
- document remediation availability;
- leave it advisory if no safe supported fix exists.

---

# 14. PHASE 9 — PERFORMANCE / RESILIENCE FOLLOW-UPS

Review remaining meaningful known gaps.

Prioritize evidence-backed gaps such as:

- sustained memory growth;
- native performance;
- real historical migration corpus;
- remote backend behavior;
- long-lived runtime behavior.

Do not manufacture work merely because the known-gap register contains capability boundaries.

For the J8 section-switch headroom issue:

- retain existing ceilings/floors;
- do not weaken them;
- reproduce before changing code;
- only implement a performance fix if profiling identifies a concrete product bottleneck.

---

# 15. PHASE 10 — CURRENT RELEASE VERDICT

After all executable closure work is complete, produce a release certification report tied to the exact final SHA.

The report must contain:

```text
Final branch
Final local HEAD
Final origin/main
Working-tree cleanliness
Commits created during campaign
Open PRs/issues
CI run IDs
CI status
Unit/integration results
Web E2E results
Simulation results
PWA results
Remote-boundary results
Android source SHA
Android APK SHA-256
Native smoke results
Native persistence results
Native lifecycle results
Supabase validation status
iOS validation status
Dependency/security status
Store artifact status
Remaining external owner actions
Known deliberate limitations
```

Use explicit classifications such as:

```text
PASS
FAIL
BLOCKED_EXTERNAL
ENVIRONMENT
NOT_APPLICABLE
DELIBERATE_PRODUCT_BOUNDARY
```

Do not hide skipped lanes.

---

# 16. PHASE 11 — V2 DIRECTION AUDIT

Only after release closure is stable, investigate what should be developed next.

Do not choose based on novelty.

Compare at least these two directions.

---

## Candidate A — True multi-device synchronization

Current architecture reportedly has:

```text
SupabaseSyncAdapter.pull() -> []
```

and cloud behavior is backup-first rather than bidirectional sync.

Investigate what production-quality true sync would require:

- remote pull;
- revision/version model;
- tombstones;
- conflict rules;
- idempotency;
- causal ordering;
- concurrent edits;
- deleted-row semantics;
- per-entity merge behavior;
- account recovery interactions;
- portable backup interactions;
- offline mutation replay;
- remote schema changes;
- sync health UX;
- migration path from backup-only users;
- test infrastructure.

Do not implement this as a small patch.

If selected, create a formal v2 OpenSpec/architecture campaign first.

---

## Candidate B — Production AI Command Center

Current behavior reportedly defaults to:

```text
mock
```

with model parsing behind internal rollout flags.

Investigate productionization requirements:

- model/provider strategy;
- server-side key isolation;
- latency;
- fallback behavior;
- structured output validation;
- hallucination containment;
- user confirmation boundaries;
- evaluator suite;
- cost controls;
- rate limiting;
- telemetry/privacy;
- offline degradation;
- supported-intent expansion;
- account/backend dependencies.

Again, create a proper design/spec before implementation.

---

# 17. DECISION RULE FOR V2

Recommend the next v2 initiative based on:

- user value;
- technical leverage;
- architectural fit;
- amount of foundational work;
- risk;
- release stability;
- testability.

Do not begin implementation if 1.0 still has unresolved repository-executable release blockers.

If only external owner/store actions remain, producing the v2 architecture/spec is acceptable.

---

# 18. AUTONOMOUS EXECUTION LOOP

For every phase:

1. Investigate.
2. Record evidence.
3. Identify actual gap.
4. Create/update ExecPlan.
5. Implement the smallest coherent fix.
6. Run affected QA.
7. Fix failures.
8. Run broader QA where required.
9. Commit coherently.
10. Reconcile docs.
11. Continue.

Do not repeatedly stop to ask what to do next.

Make reasonable engineering decisions autonomously.

Ask only when an operation truly requires:

- unavailable credentials;
- destructive production access;
- store submission authority;
- legal declaration;
- irreversible release/tag decision.

Otherwise continue.

---

# 19. ANTI-PREMATURE-COMPLETION RULES

You are NOT finished because:

- one test passed;
- `typecheck` passed;
- the app builds;
- one platform is green;
- old docs say "complete";
- OpenSpec has no active changes;
- a previous agent declared STOP;
- there are no GitHub issues;
- one CI job is green.

Completion requires reconciliation of the whole campaign.

Before stopping, perform an adversarial final sweep:

### Product

Is there any clear regression or unfinished path exposed by the work?

### Data

Can user data be corrupted, silently lost, duplicated, misattributed, or unrecoverable?

### Backup

Can backup/restore misrepresent completeness?

### Native

Does Android behave on the certified exact build?

### Web

Does the exact build pass full browser/runtime validation?

### CI

Is the exact final SHA actually green?

### Release

Do repository artifacts reflect what will really be submitted?

### Security

Are meaningful dependency/security issues either fixed or explicitly justified?

### Docs

Do current docs describe reality rather than historical state?

Only then close.

---

# 20. REQUIRED FINAL REPORT

Return a concise but evidence-rich terminal report with these sections:

```text
1. Executive verdict
2. Starting state
3. Final repository state
4. CI repairs
5. Bugs/fixes implemented
6. Certification results
7. Android results
8. Supabase/cloud results
9. iOS status
10. Store-release status
11. Dependency/security status
12. Remaining external-only actions
13. Known deliberate limitations
14. V2 recommendation
15. Commits created
16. Exact final SHA
```

For every incomplete item state exactly:

```text
WHY it remains
WHO/WHAT is required
EXACT next action
```

Do not end with vague statements such as:

```text
more testing may be needed
```

Specify the missing proof precisely.

---

# FINAL OPERATING PRINCIPLE

SuperHabits appears to have reached the point where **shipping discipline matters more than continuing to manufacture feature work**.

Act accordingly.

First restore the integrity of CI.

Then prove the exact candidate.

Then close real platform and release boundaries.

Then determine the next product generation.

Do not confuse more commits with more progress.
