# Release Candidate Closure Specification

## ADDED Requirements

### Requirement: Fresh exact-HEAD baseline supersedes historical evidence

Release-candidate certification SHALL be based on validation commands executed against the current tree, not on committed log files or historical completion claims.

#### Scenario: Committed evidence conflicts with current tree

Given `.agent/hardening-evidence/*.log` files claim green gates,
When the same gates are re-run on the current HEAD,
Then the current run results decide certification,
And any discrepancy is investigated and classified rather than ignored.

#### Scenario: A required gate cannot run

Given a gate requires unavailable infrastructure or credentials,
When certification is assembled,
Then the gate is recorded as NOT RUN with the exact missing dependency named,
And no environment-gated result is reported as passing.

### Requirement: Plan and spec validation are part of quality

The ExecPlan structural validator and OpenSpec validation SHALL pass on the certified tree.

#### Scenario: A rewritten checkpoint drops required fields

Given a COMPLETED ExecPlan's Current Checkpoint loses required labeled fields,
When `npm run agent:plan:validate:all` executes,
Then validation fails naming the missing fields,
And the repair restores the fields without altering historical meaning.

### Requirement: Performance uncertainty is resolved with distributions

The HEAVY-device section-switch measurement SHALL be resolved by collecting repeated timing samples under controlled conditions and attributing variance to identified causes, ending in a stable gate with headroom over normal machine jitter.

#### Scenario: Ceiling breach reproduces inconsistently

Given a prior single-sample breach (~846 ms vs 800 ms ceiling),
When the measurement is repeated N>=10 times per configuration,
Then min/p50/p90/max distributions are recorded,
And the dominant cause (harness contention, dev artifacts, or product cost) is stated with evidence.

#### Scenario: Product-side cost is dominant

Given distributions attribute sustained cost to product rendering/data paths,
When optimization is implemented,
Then observable behavior is unchanged and the gate passes with margin across repeated runs.

#### Scenario: Harness-only cause

Given distributions attribute breaches to test-harness contention or development instrumentation,
When the gate is stabilized,
Then the meaningful latency assertion is preserved (method stabilized or threshold given justified headroom),
And the classification is upgraded from FLAKY_TEST to a documented, evidenced conclusion.

### Requirement: Native validation uses a build of the current source

Android validation SHALL run against an installable build produced from the current tree, covering install, launch, bootstrap/migration, each major surface, persistence across relaunch, and crash-free operation, as far as the local environment allows.

#### Scenario: A native prerequisite is missing

Given the emulator, SDK component, or credential needed for a native lane is absent,
When the lane is attempted,
Then the result records the exact unavailable dependency,
And no native PASS is claimed without execution.

#### Scenario: Native smoke runs

Given a current-build APK installs and launches on a booted target,
When smoke/lifecycle/persistence flows execute,
Then results (with ADB/logcat/screenshot artifacts for failures) are recorded per flow.

### Requirement: Production remote state matches repository contracts

The live Supabase schema/ledger and the `parse-ai-command` Edge Function deployment SHALL be audited against repository state, and converged where access exists.

#### Scenario: Repository migration ahead of live ledger

Given a repository Supabase migration is absent from the live ledger,
When access permits,
Then it is reviewed and applied in order with before/after verification,
Or the gap is recorded with the exact access limitation.

#### Scenario: Edge Function parity proven but not deployed

Given the function source reaches contract parity locally,
When live deployment credentials are unavailable,
Then the residual is documented with the exact missing credential,
And safe fallback behavior remains covered by tests.

### Requirement: Authoritative documentation matches source

Current developer-facing documentation SHALL state schema version, sync scope, platform capability, and completed-campaign status consistent with source code.

#### Scenario: Docs cite an old schema version

Given `core/db/client.ts` contains migrations through v21,
When documentation states the stored schema version,
Then it states v21 with next free version >=22,
And stale v15/v20 claims are corrected.

### Requirement: Recovery invariants are re-proven after changes

After any repository modification in this campaign, the backup/restore/portable/account invariants SHALL be re-proven by targeted suites and journeys.

#### Scenario: Restore safety after edits

Given restore/portable/owner-protection code paths exist,
When targeted disaster-recovery verification runs,
Then empty-device gating, manifest integrity, owner binding, wrong-account fail-closed, legacy compatibility, corruption rejection, and no-replay semantics all hold,
And post-restore writes enqueue and sync normally.

### Requirement: Certification is bound to the exact pushed SHA

The release-candidate declaration SHALL name the final pushed commit SHA and require GitHub `quality` and `e2e` success on that exact SHA, with no later non-docs bookkeeping commit invalidating it.

#### Scenario: Post-green edit occurs

Given CI was observed green on a SHA,
When any further repository mutation lands,
Then certification moves to the newer SHA and CI is verified again there.
