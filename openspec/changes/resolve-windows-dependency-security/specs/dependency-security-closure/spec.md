## Purpose

Define a truthful, fail-closed dependency-security closure process that repairs the current Windows CI blocker without weakening advisory policy, absorbing unrelated work, or implying overall release certification.

## ADDED Requirements

### Requirement: Current repository state is verified and foreign state is preserved

The campaign SHALL fetch and establish actual branch, HEAD, remote main, history, stash, worktree, local-change and exact-head CI state before any repair. It MUST preserve foreign files, evidence, stashes and unrelated branches/worktrees, and MUST rebase its diagnosis on new evidence rather than the historical handoff.

#### Scenario: Main advances after the supplied brief

- **WHEN** fetched main or dependency state differs from the brief's starting commit
- **THEN** the campaign records the actual state and any existing security work before selecting a repair
- **AND** it does not overwrite, reset, delete or absorb foreign work.

### Requirement: Validation uses the pinned supported toolchain

Local campaign validation SHALL use Node 22.23.2 and the repository-supported npm tooling, recording both versions. Ambient unsupported tools MUST NOT be presented as equivalent gate evidence.

#### Scenario: The default shell resolves Node 24

- **WHEN** a campaign gate is about to execute under the ambient shell
- **THEN** the supported pinned toolchain is selected and verified before that gate runs.

### Requirement: Security diagnosis covers every dependency path

The campaign SHALL reproduce the exact audit gate and retain full and production-only npm reports, installed and locked versions, every distinct parent/path, copy count, dependency lineage, advisory metadata, patch availability and offered fixes. It MUST distinguish a grouped audit range or propagated parent entry from the individual advisory's affected range and severity.

#### Scenario: Two parents share a vulnerable package instance

- **WHEN** dependency inspection shows two parent paths resolving to one package copy
- **THEN** both paths and the single physical copy are recorded and assessed
- **AND** remediation is not accepted while either vulnerable path remains.

#### Scenario: npm offers a breaking framework downgrade

- **WHEN** npm's suggested fix changes the framework family or major version
- **THEN** that suggestion is recorded as a compatibility risk, not applied blindly or through a forced audit fix.

### Requirement: Exposure is proven independently of dependency labels

The campaign SHALL trace parent execution and affected verification-API reachability using source and source-bound artifact evidence. It MUST distinguish shipped web/native/Android/edge/server exposure from build/development/test tooling and from npm's production-tree label, and MUST disclose incomplete scans or missing provenance rather than claim absence.

#### Scenario: App code has no direct forge import

- **WHEN** application-source searches find no direct import but a parent helper calls the affected verifier
- **THEN** the helper call path remains part of the security assessment
- **AND** the package is not declared unused or harmless from direct-import absence.

#### Scenario: An artifact scan lacks current source identity

- **WHEN** a historical binary or incomplete export has no matching source/hash/module graph
- **THEN** its scan is supplementary or unverified evidence, not proof of current shipped-runtime absence.

### Requirement: Remediation is the smallest proven safe option

The campaign SHALL compare compatible parent upgrades, compatible fixed-package overrides, limited family updates and supported unused-path removal/substitution before considering any exception. It MUST demonstrate version-range/API compatibility, supported functionality, complete-path resolution and actual audit clearance for the selected option. It MUST NOT silently vendor an unreviewed patch, force a breaking framework migration or alter product behavior merely for a green gate.

#### Scenario: Latest published package remains vulnerable

- **WHEN** the installed latest package is still affected and a proposed upstream patch is unreleased
- **THEN** the campaign records that fact and checks supported parent/removal alternatives
- **AND** it does not invent a fixed target version or treat a source pull request as a released repair.

#### Scenario: A compatible fixed release becomes available

- **WHEN** a release or supported parent change is independently proven to remove the vulnerability from all affected paths
- **THEN** the least invasive compatible option is selected with before/after resolution and API evidence.

### Requirement: Exceptions require every strict eligibility predicate

A new exception SHALL be considered only after proving no safe fixed package or parent upgrade exists, shipped artifacts cannot reach the dependency, the affected API is not used, the classification is reproducible, exact advisory/package/paths are named, and a date, rationale and removal condition are supplied. The policy MUST NOT exempt a whole package, dependency family or all high findings. If any predicate fails, the exception MUST NOT be added.

#### Scenario: Build tooling calls the affected API

- **WHEN** shipped-app absence is established but build/development tooling uses the vulnerable verification API
- **THEN** exception eligibility fails and the advisory remains gating.

#### Scenario: An otherwise eligible exception gains another path or advisory

- **WHEN** a future finding has an uncovered dependency path or a different advisory identifier
- **THEN** the exact-match exception does not cover that finding and the new high/critical result fails.

### Requirement: Audit execution fails closed on invalid command results

The audit gate SHALL report an unsuccessful audit as unsuccessful, not as zero vulnerabilities. Transport errors, parseable error objects, empty failed output, malformed or unsupported reports and inconsistent command/report results MUST fail visibly. A valid vulnerability report returned with npm's advisory-related nonzero status MUST still be evaluated according to the advisory policy.

#### Scenario: npm returns parseable registry-error JSON

- **WHEN** npm returns an error object without a valid audit report
- **THEN** the gate exits nonzero with an audit-execution diagnostic
- **AND** it does not print a clean production-tree verdict.

#### Scenario: npm fails with empty output

- **WHEN** npm fails or is interrupted without a valid report
- **THEN** the gate fails rather than substituting an empty clean report.

#### Scenario: npm exits nonzero because valid advisories exist

- **WHEN** a valid report contains only documented exact-path findings and report-only lower severities
- **THEN** the gate evaluates and visibly reports those findings under the unchanged policy, rather than treating every advisory-related nonzero exit as a transport failure.

### Requirement: New high and critical advisories remain gating

The gate SHALL fail for each undocumented high/critical advisory and SHALL continue to print documented findings. Changes to audit parsing or classification MUST NOT hide the current forge advisory, suppress future advisory identifiers, globally lower severity or weaken strict retry/test gates.

#### Scenario: The audit parser is hardened while forge remains vulnerable

- **WHEN** the report is valid and still contains the undocumented forge high
- **THEN** the gate remains nonzero and the campaign cannot claim the dependency blocker is resolved.

### Requirement: Regression protection executes the actual security behavior

Regression protection SHALL test semantic dependency resolution and executable audit decisions, not only script text or lockfile snapshots. It MUST demonstrably fail on the reconstructed vulnerable resolution or equivalent bad fixture and on the demonstrated audit false-green fixtures, while passing safe controls. A selected cryptographic repair MUST reject the nested DigestAlgorithm defect and preserve legitimate verification behavior with synthetic, non-production test material.

#### Scenario: A proposed guard only checks the presence of a script string

- **WHEN** that guard passes despite a vulnerable resolution or false-green audit result
- **THEN** it is insufficient and an executing behavioral guard is required.

#### Scenario: A fixed resolution and parser are tested

- **WHEN** safe controls, the reconstructed bad graph, malformed nested-signature input and audit-error fixtures are exercised
- **THEN** the observed red/green outcomes establish non-vacuous regression protection without altering meaningful assertions.

### Requirement: Clean dependency reconstruction proves the repair

After dependency changes, the campaign SHALL reconstruct dependencies from the candidate lockfile with the repository's intended clean-install command, rerun the exact audit and installed-path inspection, and retain before/after evidence. Manual node_modules changes or a stale installed graph MUST NOT qualify the candidate.

#### Scenario: A local patched module passes but the lockfile still resolves vulnerable code

- **WHEN** clean installation restores the affected package
- **THEN** the candidate fails acceptance and is not published as repaired.

### Requirement: Validation follows actual changed-file impact

The campaign SHALL resolve impact from task-owned changed files before gate selection and run the required static, audit, unit/integration, OpenSpec and plan gates. Broad dependency resolution, runtime/bundle or shared QA changes MUST receive full QA and required focused suites. Historical green evidence MUST NOT replace a current required gate; resource problems MUST retain measurements and failures without relaxed budgets, blind retries or unrelated process termination.

#### Scenario: Package and lockfile changes trigger broad regression

- **WHEN** impact tooling marks the actual changed boundary broad
- **THEN** current full QA and relevant artifact checks execute before repaired-candidate publication
- **AND** a long duration alone does not justify omitting them.

#### Scenario: Host contention invalidates a result

- **WHEN** a gate cannot complete credibly under measured resource contention
- **THEN** the non-pass and evidence remain explicit, supported worker limits are used where available, and no timeout/assertion/performance ceiling is weakened.

### Requirement: Runtime-adjacent artifact validation is hermetic and source-bound

Where dependency impact reaches or could reach shipped artifacts, the campaign SHALL verify the actual web/native/Android/edge/server outputs and affected API paths at the candidate source. Builds MUST preserve the repository's credential-free envelope and use existing scan infrastructure with explicit completeness/provenance checks. Android requalification SHALL occur only when actual resolution or impact rules warrant it; iOS SHALL remain owner-deferred.

#### Scenario: A runtime-adjacent dependency changes

- **WHEN** the candidate can alter native runtime or native impact rules require qualification
- **THEN** the existing clean-checkout hermetic Android path on the verified supported target is used and its source/binary identity is recorded
- **AND** no historical APK, unavailable iOS lane or incomplete scan becomes a new native pass.

### Requirement: Failures and safety stops remain explicit

Every red result SHALL retain its WHY, CLASSIFICATION, EVIDENCE, WHAT IS REQUIRED and EXACT NEXT ACTION using the campaign taxonomy. Remediation requiring acceptance of a runtime high/critical, a broad exception, an insufficiently validated framework migration, production mutation, signing/secret changes, force-push or history rewrite MUST stop rather than be improvised.

#### Scenario: A candidate requires a prohibited security trade-off

- **WHEN** the only proposed next step violates a safety stop
- **THEN** the campaign records the precise blocker and required upstream/owner condition instead of crossing it for CI.

### Requirement: Publication is scoped and fast-forward only

A repaired candidate SHALL be locally validated and source-stable before normal fast-forward publication to main. Each logical commit MUST contain only explicit task-owned paths and pass whitespace/status review; unexpected fetched divergence MUST stop publication for reconciliation. Foreign state and prior history MUST remain intact.

#### Scenario: Remote main diverges before publication

- **WHEN** the pre-push fetch shows an unexpected remote change
- **THEN** publication pauses until the new state is understood
- **AND** no forced push, reset, unrelated-branch alteration or history rewrite is used.

### Requirement: Hosted success is tied to the exact final pushed SHA

A resolved campaign SHALL require completed quality success, audit-step success and E2E success at the final exact pushed SHA. Expected schedule-only nightly skips MUST be distinguished from E2E skipped after quality failure. Strict retry-report gates MUST remain enforced, and ancestor, cancelled or superseded runs MUST NOT qualify a later candidate.

#### Scenario: Quality fails and E2E is skipped

- **WHEN** the exact-head run skips E2E because quality failed
- **THEN** the campaign remains unresolved and does not report E2E success.

#### Scenario: A documentation follow-up creates a newer commit

- **WHEN** another repository commit is published after a green run
- **THEN** its own SHA requires fresh hosted success before the final green claim.

### Requirement: Closure reconciliation preserves external certification truth

After verified security outcomes, necessary canonical records SHALL distinguish Windows/local security closure from overall NOT CERTIFIED. They MUST preserve the canonical 17/22 ledger unless a task's actual requirement has separately been satisfied, historical Android/J8/full-QA evidence and source identities, owner-deferred iOS, credential-dependent production catalog, the observed absent recovery point, stopped DDL and zero production mutation in this campaign. Completed historical plans MUST NOT be rewritten as new attestations.

#### Scenario: Security and exact-head CI become green

- **WHEN** the Windows dependency blocker is legitimately resolved
- **THEN** canonical reporting records the security evidence and Windows exhaustion separately
- **AND** overall certification remains NOT CERTIFIED while the existing production/iOS predicates remain unmet.

### Requirement: The campaign has two truthful terminal outcomes

The final report SHALL use exactly one campaign verdict: WINDOWS SECURITY FOLLOW-UP COMPLETE only after all repaired-path local and exact-head hosted acceptance conditions pass, or PRECISELY BLOCKED only after proving no safe executable repair exists. A blocked report MUST provide dependency paths, complete exposure/reachability assessment, rejected-option evidence, why audit cannot truthfully pass, an exact upstream condition and resume action. Unmet conditional tasks MUST remain unfulfilled rather than be checked for tidiness.

#### Scenario: No safe released fix or supported replacement exists

- **WHEN** complete evidence rules out compatible updates, overrides, removal and eligible exceptions
- **THEN** the gate stays red and the report states PRECISELY BLOCKED with the exact condition and resume action
- **AND** a planning-complete status is not presented as a completed security repair.

### Requirement: Final handoff and process hygiene are auditable

The final campaign handoff SHALL contain the brief's repository, root-cause, remediation, security, validation, hosted-CI, regression, existing-closure, remaining-work and terminal-verdict sections. It MUST separate actionable local, owner, credential/external and deliberately deferred work, record exact commands/results/skips and preserve evidence. Campaign-owned servers/process trees MUST be cleaned up and final web hygiene MUST identify free test ports or unrelated owners without terminating unrelated processes.

#### Scenario: Campaign work ends with only external residuals

- **WHEN** final acceptance or a precise blocker has been audited
- **THEN** the handoff identifies each remaining-work category, records port/process hygiene and makes no unsupported certification or publication claim.
