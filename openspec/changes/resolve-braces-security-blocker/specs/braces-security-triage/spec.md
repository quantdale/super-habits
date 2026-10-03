## Purpose

Define a bounded, machine-verifiable triage for the transitive `braces`
advisory `GHSA-vfj7-8cjw-p6xm` so the repository can either land a genuinely
safe non-breaking remediation or record a precise upstream-blocked state
without weakening the dependency-audit gate.

## ADDED Requirements

### Requirement: Complete dependency-path ledger

The triage SHALL record every installed copy of the vulnerable package, every
direct parent with its required range and dev/production status, and every
production consumer path that reaches the package, before any remediation is
accepted or rejected.

#### Scenario: A vulnerable package is reachable through more than one parent

- **WHEN** the lockfile shows a single physical copy required by more than one
  direct parent
- **THEN** the ledger names every direct parent with its required range and dev
  flag
- **AND** it names every production consumer of the intervening hoisted package
  so a fix that removes only one parent lineage is not mistaken for a fix.

#### Scenario: A proposed fix removes only one lineage

- **WHEN** a candidate change would remove one direct parent path but leave
  another production path to the same copy
- **THEN** the candidate is rejected as insufficient rather than recorded as a
  remediation.

### Requirement: Authoritative advisory truth

The triage SHALL verify the advisory against the GitHub advisory API and the
npm registry advisory endpoint and MUST distinguish the advisory's published
affected range from npm's derived finding-level `range` field.

#### Scenario: npm reports a wildcard range

- **WHEN** `npm audit` serializes a finding-level `range` of `*`
- **THEN** the triage records the individual advisory range from the report's
  `via` entry and the registry advisory metadata
- **AND** it states that the wildcard is npm's derived tree range, not a claim
  that a future patched release is affected.

### Requirement: Source-bound shipped-artifact exclusion

The triage SHALL prove shipped-artifact exclusion with source-map module
identities, not a package-name grep alone, and MUST corroborate with
whole-output byte scans, edge-function source inspection, and an APK scan where
an APK is available (with its provenance limits recorded).

#### Scenario: A byte-level hit matches the package name

- **WHEN** a whole-output byte scan reports a hit for the package name
- **THEN** the hit is classified (for example, an unrelated string or generated
  asset) and the module-graph evidence is presented as the primary result
- **AND** a raw substring hit is never reported as package presence.

#### Scenario: An export predates later commits

- **WHEN** the retained source-bound export was produced from an earlier commit
- **THEN** the triage shows that no application or bundling source changed
  between that commit and the current head before reusing the export evidence.

### Requirement: Tooling input provenance

For every call site of the vulnerable package in installed tooling, the triage
SHALL identify the source of the pattern or string that reaches the vulnerable
code path and MUST state whether untrusted input can reach it.

#### Scenario: A build tool passes configuration globs

- **WHEN** a tool invokes the vulnerable parser with patterns read from a
  repository-owned configuration file
- **THEN** the call site is recorded as trusted-input tooling execution
- **AND** the absence of a runtime or user-controlled path is recorded
  separately from shipped-artifact exclusion.

### Requirement: Exhaustive remediation ladder

The triage SHALL evaluate, in order, a patched release, a compatible parent
update, an npm override target, path removal, the smallest possible
dependency-family upgrade, and a major tooling upgrade, recording for each the
evidence and the acceptance or rejection reason.

#### Scenario: npm offers a major-version fix

- **WHEN** npm's suggested fix is a major upgrade of a framework-owned package
- **THEN** the triage checks whether that upgrade removes every production path
  to the vulnerable copy
- **AND** it checks whether the upgrade is compatible with the installed
  package ecosystem before accepting or rejecting it.

#### Scenario: An upstream fix exists only as an unmerged pull request

- **WHEN** an upstream repository has an open, unreleased fix pull request
- **THEN** the triage records it as an upstream condition, not as a remediation
- **AND** a git-ref override to that unreleased commit is rejected unless a
  published, provenance-checked release exists.

### Requirement: Bounded refresh of the retained blocker

The triage SHALL refresh the previously blocked advisory only for material
upstream change (published versions, advisory patched-version metadata,
upstream fix status, parent ranges) and MUST record an explicit no-material-
change result rather than repeating the prior exposure campaign.

#### Scenario: Nothing upstream changed

- **WHEN** the latest release, advisory metadata, upstream fix status, and
  parent ranges are unchanged
- **THEN** the triage records `NO MATERIAL UPSTREAM CHANGE` and spends no
  further work on that blocker.

### Requirement: Precise blocked terminal state and resume matrix

When no safe remediation exists, the triage SHALL make no dependency or policy
change, keep the audit gate truthfully red, and record the exact unblock
condition and resume action for each remaining blocker in a compact matrix.

#### Scenario: The audit gate stays red

- **WHEN** the triage concludes that no safe remediation exists
- **THEN** `DOCUMENTED_BUILD_TIME_ADVISORIES` is unchanged, no forced fix is
  run, no dependency is relocated to hide the finding, and the gate remains
  fail-closed for new advisories
- **AND** the terminal verdict is an explicit precisely-blocked statement with
  a resume matrix that names the release event and the commands to rerun.
