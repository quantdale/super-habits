## Context

See [proposal.md](proposal.md) for motivation, [exploration.md](exploration.md)
for observations, and [the normative delta](specs/dependency-security-closure/spec.md)
for acceptance behavior. The complete brief is preserved verbatim in
[source-brief.txt](source-brief.txt), SHA-256
`0bf3df7b16a78e205d56913c1caca9c60bc9680e31da550ae7ff869d3cba4df4`.
This proposal does **not** execute that campaign.

Verified planning baseline: `main == origin/main == HEAD ==
891ed228ffc39f002ac13cc62aad2ee0b69ef1fe`; CI `36965502815` is red only at the
runtime-dependency audit. One locked/installed forge 1.4.0 instance is reached
directly by Expo CLI 55.0.36 and by its code-signing helper 0.0.6. The registry
has no published fixed forge version; helper 0.0.7 and inspected CLI releases
retain the vulnerable dependency. Open/unmerged upstream PR 1152 is a lead,
not a released fix. npm's proposed Expo 44 downgrade is unsuitable.

Affected verification is reachable in conditional CLI development/code-signing
paths. Product-source absence and historical byte scans are not complete
shipped-artifact proof. A fresh source-map export timed out under measured
host contention; that gap remains in the apply checklist. The existing audit
also demonstrably returns a false clean verdict for parseable npm error JSON
and empty failed output; this is a separate, narrowly bounded audit-policy bug.

## Goals / Non-Goals

**Goals:**

- Resolve the exact advisory legitimately, or establish the brief's precise
  blocked terminal branch with enough evidence to resume safely.
- Make the audit command/report boundary fail closed and guard actual
  resolution/classification behavior without weakening existing security rules.
- Keep one integrating writer, explicit task ownership, reproducible evidence,
  candidate-source validation and final exact-head CI/publication identities.
- Reconcile Windows exhaustion independently from overall certification.

**Non-Goals:**

- Broad package modernization, framework migration, unrelated advisory cleanup,
  feature/UX work, speculative refactoring or product changes merely for CI.
- Supabase access/mutation in this campaign, production DDL/catalog/cleanup,
  historical precision repair, paid AI, signing, store submission or release tags.
- iOS dispatch, monitoring, flow edits or recertification; Android repair/J8
  optimization already proven and not invalidated by current source evidence.
- Applying this campaign, committing, pushing or changing prior records during
  the owner's current explore/propose request.

## Decisions

### 1. A bounded successor and explicit protected-state inventory

Use this change for the security campaign, leaving
`final-certification-closure/tasks.md` as the canonical 22-task ledger. Planning
follows the ordinary dedicated-branch rule; later apply follows the brief's
main-only, fast-forward publication rule from then-current main. Native-only
evidence checkouts are clean source-bound worktrees, not a reason to delete
preserved untracked evidence in the primary tree.

At apply preflight, fetch first and record status, branch, HEAD, origin/main,
20-commit history, stash/worktree lists, runtime versions, latest exact-head
Actions and any already-started security work. Read the brief's named plans,
closure report/tasks/checkpoint, reconciliation artifacts, package/lockfile,
audit script/tests and CI. Compare current facts to planning facts before edits.
Capture a content/link preservation manifest for foreign state and relevant
ignored evidence, task-file hashes and stash object. Use explicit paths for
staging and impact tooling; untracked status is not task ownership.

Alternative: resume the older Windows checkpoint as if nothing moved.
Rejected: current exact-head CI and dependency metadata outrank historical green
claims, and the input filename was reused with different contents.

### 2. Treat resolution, execution exposure and exploitation as separate facts

Reproduce `node scripts/audit-runtime-deps.mjs`, full and `--omit=dev` audit JSON,
`npm ls node-forge --all` and `npm explain node-forge` on pinned Node 22.23.2/npm
10.9.8. Compare semantic lock entries to installed manifests and all parent
resolutions. Capture both npm's aggregate range and the individual advisory's
range, severity, affected API, update date, offered fix and patch status.

Trace each parent through executable/runtime entrypoints, every actual verifier
call site and configuration branch. Inspect inputs, whether user-controlled
certificates/low-exponent keys are possible, and whether execution is CLI,
development server, static rendering, shipped client or server. Do not claim
that every export invokes signing, or that available helper calls prove an
actual attack against this app. Use synthetic diagnostics only; do not inspect
or change signing material, credentials or production records.

Complete the artifact gap before concluding exposure: produce task-owned
hermetic web and Android JS exports with source maps at the verified candidate
source, enumerate every map and nested section's module sources, and check all
forge/parent paths. Distinguish Expo's static-rendering build graph from files
actually deployed. Source-map module identities are primary; package/error
string scans are corroboration. For deployed edge functions or any server
artifact, record the complete import graph and deployed/output identity where
available; missing access is an explicit scope limit, not a safe result.

Reuse `runHermeticBuild`/`scanDirectoryForNeedle` in
`scripts/hermetic-build.mjs` and ZIP helpers in `scripts/native-apk-scan.mjs`.
Check that all candidate ZIP entries were actually read/inflated; a scanner's
zero-hit return alone is insufficient if entries were skipped. Match APK SHA,
source SHA, clean-tree provenance, expected JS entries and build record. Do not
transfer the retained green record to the currently unmatched APK. A native JS
export is not a device qualification, and an old Supabase-host scan is not a
forge-absence proof.

Alternative: label the dependency build-only from `npm explain` or app grep.
Rejected: the helper uses affected verification and npm metadata does not
establish shipped module inclusion or absence.

### 3. Use an ordered, evidence-gated remediation decision tree

No target version is preselected because a safe published fix is not currently
observed. Re-query the advisory, npm registry, parent release manifests and
upstream PR at apply time; do not wait by polling an open PR while independent
investigation is executable.

| Priority | Candidate                                       | Required evidence before editing                                                                                                                                            |
| -------- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1        | Compatible direct-parent patch/minor update     | Both affected paths removed/fixed, supported Expo family, release notes and actual parent requirements.                                                                     |
| 2        | Compatible fixed forge override                 | Published advisory-fixed version; every parent's range and API use compatible; installed and locked paths all resolve safely.                                               |
| 3        | Small compatible family update                  | Smallest justified resolution diff, no framework migration by accident, supported APIs and actual audit outcome.                                                            |
| 4        | Remove an unused path or supported substitution | Every path removed or safely replaced; CLI/build/runtime functionality preserved; maintained source/license/provenance, signing/verifier compatibility and full validation. |
| 5        | Narrow exemption                                | Every brief predicate independently proven; current helper API use makes this branch ineligible.                                                                            |
| None     | Precise upstream blocker                        | Current release/path/exposure evidence rules out safe executable alternatives; audit remains red, with exact resume condition.                                              |

For any candidate, retain a before/after semantic graph and candidate diff;
perform only the targeted manifest/lock refresh, not an unrelated wholesale
upgrade. Then `npm ci`, rerun audit and `npm ls`, and inspect all resolved
copies. Do not hand-edit node_modules, blindly accept `fixAvailable: true`, run
`npm audit fix --force`, or assume that the registry's `latest` is fixed.

An upstream PR's suggested 1.4.1 is not a version available for override.
Vendoring an unreviewed patch, fabricating a version or installing a random fork
is not an authorized shortcut. A genuinely supported substitution still needs
its own compatibility/security provenance; discovery of one changes the option
ledger, not the safety standard.

A last-resort exemption requires **all** of: no safe fixed package; no safe
parent upgrade; demonstrated shipped non-reachability; affected API unused;
reproducible classification; exact package/path/advisory; date/rationale/removal
condition. It cannot broadly match forge, all highs, a family or future paths.
Current evidence fails the API-unused condition. Neither dependency relocation
to devDependencies nor bundler-only filtering can be used to hide it.

Alternative: add a dated build-only forge entry now. Rejected: it violates an
explicit brief predicate even if future module-graph evidence proves no app
bundle inclusion. Alternative: Expo 44 downgrade/latest CLI 57 upgrade.
Rejected: breaking compatibility, with no demonstrated removal of forge.

### 4. Harden the real audit boundary and test behavior

The unchanged CLI source was executed in a VM with only its command-result
boundary replaced. Valid empty report => exit 0; undocumented forge high =>
exit 1; registry-error JSON and empty failed output => **false exit 0**. This
qualifies the audit script for a narrow correctness repair; it is not a reason
to change the live advisory classification or suppress the forge red.

Introduce the smallest testable command-result/report evaluation seam in the
existing audit module or one adjacent pure helper. Keep the public CLI and CI
command unchanged. Separate command transport, report validation, advisory
extraction, exact documented matching and exit/reporting decisions. No new
state framework, audit provider or broad production-tree classifier is needed.

Validate supported audit-report shape, command completion and coherent status
before evaluating findings. Reject `error` results, failed/empty output,
unsupported schema, malformed JSON, signalled/transport failures and invalid
finding shapes with bounded diagnostics. Distinguish npm status 1 with a valid
advisory report from command failure; valid documented findings remain visible
and lower severities retain current report-only policy. Invalid input cannot
be substituted with `{}` or become an empty clean verdict.

Extend `tests/auditRuntimeDeps.test.ts` with executing fixtures and a CLI-level
contract test where feasible. Keep its meaningful existing policy/override
assertions. Required controls: clean valid report, valid documented findings,
undocumented forge high, future critical, known advisory at uncovered path,
new advisory on a known package/path, registry-error JSON, empty failure,
malformed/unsupported report, and spawn/termination failure. Demonstrate the
error fixtures' false green against the original seam and failure after repair.
Do not weaken exact advisory+package+all-path matching.

This guard can be developed independently, but passing it alone is not security
closure. If the dependency decision remains blocked, do not publish a "repaired"
candidate or declare CI green from only parser tests.

Alternative: add more source-string expectations to the existing tests.
Rejected: current textual tests passed while executable error handling was
false green. Alternative: change audit failures into warnings. Rejected:
weakens the very gate being repaired.

### 5. Make dependency and cryptographic guards non-vacuous

For the selected repair, guard the semantic lock/installed resolution from
both parent contexts, including nested copies; do not require forever exactly
one physical instance or snapshot lockfile text. Reconstruct the current bad
graph or an equivalent fixture and demonstrate the guard rejects it. Record
the before/after outcome and what invariant prevents recurrence.

Test the exact **nested** DigestAlgorithm flaw, not just the outer DigestInfo
count fixed by 1.4.0. Use vetted synthetic fixtures from the advisory/upstream
work, positive valid RSA/certificate/CSR controls and malformed nested input.
Verify that the selected fixed API or supported replacement rejects that input
while preserving needed helper behavior. Never use real keys or alter signing.
Upstream release notes alone cannot substitute for compatibility/regression
proof, and a version guard alone cannot prove a custom substitution safe.

Alternative: assert only `node-forge` version is not 1.4.0. Rejected: permits
another vulnerable version, nested copy, unsafe alias or future advisory.

### 6. Match validation cost to actual scope, not desired duration

Always resolve `npm run qa:affected -- --files <owned paths>` first. Planning
artifacts alone map to documentation (`qa:fast`, focused ExecPlan coverage),
not new native/full-QA certification. During apply, current package/lockfile
and unmapped audit/test paths conservatively require `qa:full`; follow that
actual impact rather than reusing the earlier Windows full-QA pass.

Minimum apply gates:

```bash
export PATH="/c/Users/palac/AppData/Local/tools/node-v22.23.2-win-x64:$PATH"
node --version
npm --version
npm ci
npm run qa:affected -- --files <actual task-owned changed files>
npm run typecheck
npm run lint
node scripts/audit-runtime-deps.mjs
npm ls node-forge --all
npm test
npx vitest run tests/auditRuntimeDeps.test.ts
npm run openspec:validate
npm run agent:plan:validate:all
```

Run `qa:fast` if selected and `qa:full` for broad resolution/runtime/bundle/shared
QA impact. Those wrappers contain some minimum gates; distinguish actual
wrapper evidence from commands not run standalone. Do not freeze current test
counts into acceptance. Use supported Vitest/Metro worker limits if needed,
without repository-semantic or timeout changes. Measure RAM, CPU, owned
processes and unrelated consumers after a resource-related red; preserve first
failure and classify before a controlled rerun. Do not kill unrelated processes.

For hermetic builds/full lanes, unset the two ambient Supabase public variables
and use the existing envelope (which strips all ambient public flags), never
plain `build:web` with local credentials. Run artifact checks after the repair.
If actual native/runtime impact requires Android, use the existing API-36 x86_64
`Nitro_API_36` path from a clean exact-source checkout; the primary worktree's
foreign evidence must not be deleted to satisfy cleanliness. Do not touch iOS.
No fresh Android battery is required solely by an audit-script/docs-only edit
whose source/runtime impact does not invalidate retained qualification.

Alternative: skip `qa:full` because it is long or because prior QA passed.
Rejected: package resolution can change current bundles; previous evidence
only covers its own source. Optional exploratory export timeout is retained
as a gap and does not loosen any required apply gate.

### 7. Keep failure classification and safety stops executable

Every red result gets **WHY / CLASSIFICATION / EVIDENCE / WHAT IS REQUIRED /
EXACT NEXT ACTION**. Use the supplied taxonomy: `PRODUCT_BUG`,
`DEPENDENCY_VULNERABILITY`, `DEPENDENCY_RESOLUTION`, `AUDIT_POLICY_BUG`,
`TEST_BUG`, `CI_CONFIGURATION`, `FLAKY_TEST`, `ENVIRONMENT`,
`CREDENTIAL / EXTERNAL`, `DEFERRED_BY_OWNER`, `NOT_TRIGGERED`,
`OWNER_APPROVAL_REQUIRED`, or `UNKNOWN_NEEDS_TRIAGE`.

Stop for a knowingly accepted runtime high/critical, broad exception,
insufficiently validated framework migration, production mutation,
signing/release/secret changes, force push or history rewrite. A transient tool
or host problem is not proof that no safe dependency repair exists. Preserve
failed inputs/repro identity and fix only evidenced issues directly in this
lineage/audit boundary. Another CI high is investigated only if directly within
this chain; unrelated modernization remains out of scope.

Alternative: label every failure environment or precisely blocked by default.
Rejected: the live forge report is a valid dependency-security red and no
resource classification can waive it.

### 8. Serialize mutation; optional research lanes remain read-only

Direct execution is the default. The brief permits independent read-only graph,
exposure, policy and regression-planning lanes if useful during later apply.
They must have bounded outputs, isolated contexts/worktrees where appropriate,
and no simultaneous writers to package/lockfile/audit/canonical records.
The integrating agent alone selects remediation, owns edits, validates,
commits, publishes and reconciles. Follow active delegation instructions before
launch; no delegation has occurred during this planning request.

Alternative: let parallel agents apply their own package fixes. Rejected:
shared resolution ownership and assumptions make that unsafe.

### 9. Publish only a proven candidate and avoid stale exact-head evidence

Create logical task-owned commits, not unnecessary bookkeeping. Before each:
`git diff --check`, `git status --short`, explicit-path staging, staged-scope
review and required validation. Preserve stash/evidence and foreign dirs.
Once source is stable and local repair gates are green, fetch again, check
unexpected divergence, integrate/publish by normal fast-forward to main and
record the exact pushed SHA. Never force push or rewrite history.

Inspect that SHA's completed Actions jobs/steps: quality success, the audit
step success, combined tests success, E2E success, strict retry-report gates
still enforced, expected schedule-only nightly skip and main-lane/PR skips.
Verify full `head_sha`, event, run ID, job/step conclusions and absence of a
cancelled/superseded ancestor being reused. A documentation-only later commit
also needs its own run. Do not push bookkeeping that cancels the run still
being treated as the acceptance record.

Prepare canonical reconciliation after the first proven security candidate,
retaining that candidate's tested identity. If reconciliation creates a later
commit, verify CI again on that final pushed tip. The committed report cannot
contain its own commit hash: link final publishing identity to Git and an
immutable commit-linked post-CI receipt with final SHA, run/jobs/audit/retry,
report permalink, validation scope and residuals. Record post-publication
results without another unnecessary source mutation; any later edit invalidates
that final-tip claim and needs another run. Keep the ExecPlan's repository-work
and post-publication verification milestones distinct; never pre-record a PASS.

Alternative: reuse prior green CI, accept E2E skipped after quality failure,
or indefinitely add report commits after each run. Rejected: false identity,
missing gate, or non-convergent bookkeeping.

### 10. Reconcile closure narrowly and report honest terminal state

Only necessary current records change: this campaign's evidence/checkpoint and
`final-certification-closure/{closure-report,execplan}.md`. Completed historical
publication plans are referenced, not rewritten. Do not adjust the canonical
17/22 or successor's post-CI task ledger merely to improve counts. Record actual
checked/open counts and external-attestation semantics honestly.

Preserve retained Android provisioning PASS, smoke 2/2, persistence 11/11,
lifecycle 6/6 at their source/APK identities; J8 historical 878 ms, accepted
622/800 ms, unchanged 800 ms ceiling/15% floor and conditional 4.3 NOT_TRIGGERED;
the prior full-QA chronology/counts as historical, not magic current inventories;
owner-deferred iOS; and the production catalog credential limit/recovery absence
(`pitr_enabled: false`, `backups: []`, `physical_backup_data: {}` at its original
observation date). DDL stays stopped and **no Supabase project is mutated or
queried by this campaign**, including `superhabits`/`kruubbynsmxzxfdunaal`.
Do not promote overall status to CERTIFIED or reopen release/AI/gap-21 work.

Resolved branch: every selected-path repair/regression/local/hosted condition
is proven, no broad waiver, current records reconciled, no unrelated work.
Report **WINDOWS SECURITY FOLLOW-UP COMPLETE**, with Windows/local engineering
and exact-head CI green; Android retained/source-applicable or newly qualified
when required; iOS deferred; overall **NOT CERTIFIED**.

Blocked branch: complete path/exposure evidence and an options ledger prove no
safe executable repair, including removal/substitution and exception predicates.
Keep audit red and unfulfilled conditional apply tasks unchecked. Report
**PRECISELY BLOCKED**, naming the exact upstream condition: a published,
independently verified compatible fixed forge release (PR merge alone is
insufficient), a supported parent release removing both paths, or a proven
safe supported substitution. Exact resume: fetch then-current main and query
advisory/registry/parent metadata; repeat graph/exposure checks and pursue only
an evidenced safe candidate. An incomplete export or ordinary uncertainty alone
cannot establish this terminal outcome.

Final owner report uses all brief sections:

- **A. Repository state:** HEAD, origin/main, clean/dirty, created commits.
- **B. node-forge root cause:** version, all paths, metadata/execution class,
  vulnerable API reachability and source/artifact proof limits.
- **C. Remediation:** files, before/after versions, choice and rejected options.
- **D. Security result:** actual local audit, remaining severities, exact
  exceptions and proof no blanket exemption.
- **E. Validation:** exact commands/results/skips and evidence identities.
- **F. Hosted CI:** exact SHA/run, quality/audit/E2E/nightly, expected skips.
- **G. Regression protection:** invariant and demonstrated red/green guard.
- **H. Existing closure state:** Android, J8, historical/full current QA scope,
  iOS, production and actual canonical count.
- **I. Remaining work:** actionable local, owner, credential/external,
  deliberately deferred categories and exact resumes.
- **J. Terminal verdict:** exactly one campaign verdict, overall NOT CERTIFIED.

Alternative: declare the app certified from green Windows CI or checkbox totals.
Rejected: the production/iOS predicates remain unmet.

## Risks / Trade-offs

- [No fixed release exists when apply starts] → Complete safe-alternative and
  exposure evidence, preserve red policy and use the precise blocked branch.
- [A source patch is mistaken for a published fix] → Verify npm integrity,
  release/advisory provenance and API behavior before selecting a target.
- [A build-only label conceals verifier use] → Trace helper/configuration paths;
  current exception is ineligible, independently of app bundle absence.
- [Audit error handling produces false green] → Execute transport/report/error
  fixtures at the real seam and test CLI output/exit; no textual-only guard.
- [A replacement creates a new risky crypto implementation] → Require supported
  provenance, valid and malformed signature/certificate/CSR controls and full
  affected validation; otherwise reject it.
- [Incomplete scans or mismatched APK provenance look green] → Verify all entries,
  source-map/module coverage and hashes; disclose missing evidence.
- [Host contention creates misleading gate results] → Preserve measurements,
  exact failures, supported worker limits and ownership-safe cleanup, not weaker
  budgets or unrelated process termination.
- [Post-CI reconciliation supersedes the tested SHA] → Verify the actual final
  tip again and attach final receipt without another needless repository edit.

## Migration Plan

No database, Supabase, product API or signing migration is proposed. During
later apply:

```text
Fresh preflight and preservation
  -> reproduce audit and map every path
  -> finish source/artifact/configuration exposure evidence
  -> current upstream + compatibility options ledger
     -> no safe repair: precise blocked evidence/report, audit stays red
     -> safe repair: failing semantic/crypto guards -> targeted resolution
        -> fail-closed audit-boundary repair/behavioral guards
        -> npm ci + audit/paths -> affected/full/artifact validation
        -> logical FF candidate publication -> exact-head CI
        -> necessary canonical reconciliation -> final-tip CI/receipt
        -> requirement audit, owner report and process/port hygiene
```

Audit-boundary tests can be developed independently but cannot turn the blocked
branch into a resolved verdict. Do not push a partial security repair as green.
Rollback a later candidate through an ordinary task-owned revert with fresh
validation/CI; never restore history by force push, delete foreign evidence or
weaken the advisory gate. A reverted vulnerable dependency leaves audit red and
must be reported as such. Planning artifacts remain unarchived until actual
implementation and archive predicates are met.

## Input Coverage and Planning Definition of Done

| Brief sections               | Design / acceptance mapping                                                                                                                              |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0, 1, immediate first action | Decisions 1–2: fetched actual state, pinned tooling, preserved foreign work, current audit reproduction before edits.                                    |
| 2                            | Goals/non-goals, Decisions 1/7/10: exact lineage scope, no production/iOS/feature/release expansion.                                                     |
| 3–5                          | Decisions 1–2: named prior records, full/prod reports, installed/locked/all-parent evidence, source/API/artifact/configuration exposure and honest gaps. |
| 6                            | Decision 3: ordered five options, all compatibility/exception predicates, no forced fixes or invented version.                                           |
| 7–8                          | Decisions 3–5: smallest targeted resolution, clean reconstruction, before/after paths, non-vacuous semantic/crypto/audit behavior guards.                |
| 9–10                         | Decisions 2/6: explicit affected impact, minimum/full gates, existing hermetic scans, measured resources, conditional Android and no iOS.                |
| 11–12                        | Decision 9: logical explicit-path commits, fetch/FF, stable candidate, exact final SHA/job/step/retry/nightly evidence.                                  |
| 13–14                        | Decision 10: narrow reconciliation, NOT CERTIFIED, 17/22, source-bound Android/J8/full-QA history, deferred iOS, catalog/recovery/DDL truths.            |
| 15                           | Decision 8: optional bounded read-only lanes, sole integration writer, no concurrent package edits.                                                      |
| 16–17                        | Decision 7: full failure taxonomy/evidence fields, explicit security/production/Git/signing stops.                                                       |
| 18–19                        | Decision 10: resolved/precisely-blocked predicates, A–J owner report, categorized residuals and exact upstream resume.                                   |

Planning is complete only after proposal/design/specs/tasks exist in CLI-resolved
paths, strict validation passes, every input section is covered, every apply
task remains unchecked, planning QA/formatting/plan/preservation/hygiene are
verified, and this planning checkpoint is closed truthfully. Neither valid
Markdown nor apply readiness proves a security repair.

## Open Questions

No decision blocks the proposal. Fixed-release availability, a supported
substitution, actual configured exploitation path, complete current artifact
coverage, future host headroom and final CI results are execution observations
with defined acceptance/stopping branches. They are not assumptions of success
or permission for a currently ineligible exception.
