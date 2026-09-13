## ADDED Requirements

### Requirement: Versioned ExecPlans are structurally validated

The repository SHALL provide a deterministic validator for `Plan-Version: 2`
ExecPlans. The validator SHALL require the canonical purpose, context, scope,
non-goals, current checkpoint, progress, discoveries, decisions, validation
ledger, changed areas, recovery instructions, and outcomes sections. It SHALL
accept normal Markdown wrapping and Windows paths, and SHALL report structural
errors without claiming semantic understanding of prose.

#### Scenario: A valid ACTIVE plan passes

- **WHEN** a versioned plan has all canonical sections, a meaningful checkpoint,
  an exact next action, and remaining definition-of-done conditions
- **THEN** `agent:plan:validate` exits successfully and reports the ACTIVE
  lifecycle state

#### Scenario: A missing checkpoint fails

- **WHEN** a versioned plan omits the Current Checkpoint section
- **THEN** validation exits non-zero and identifies the missing structural
  section

#### Scenario: Wrapped fields and Windows paths remain valid

- **WHEN** checkpoint values wrap across Markdown lines and changed areas use
  backslash paths or paths containing spaces
- **THEN** validation accepts the plan when the required values are meaningful

### Requirement: Lifecycle rules prevent non-resumable or false-complete plans

The validator SHALL support exactly ACTIVE, BLOCKED, and COMPLETED for versioned
plans. ACTIVE plans SHALL require a resumable checkpoint and exact next action.
BLOCKED plans SHALL require explicit blocker, completed work, unblock condition,
and exact post-unblock resume action. COMPLETED plans SHALL require final
validation evidence, completed progress, completed definition-of-done evidence,
an Outcomes & Retrospective section, and no misleading implementation next
action. Unresolved TODO, TBD, fill-later, placeholder, and unknown values SHALL
be rejected where they make a checkpoint non-resumable; `None` SHALL remain a
valid value where no failure, blocker, or quarantine exists.

#### Scenario: A BLOCKED plan preserves safe resumption

- **WHEN** a plan is BLOCKED and records completed work, an external blocker,
  the condition required to unblock, and the exact next action after that
  condition is met
- **THEN** validation passes and resume output distinguishes the blocker from
  work that must not be repeated

#### Scenario: A COMPLETED plan requires proof

- **WHEN** a plan is marked COMPLETED without meaningful validation evidence,
  finished progress, or a completed definition of done
- **THEN** validation exits non-zero and does not permit completion enforcement

#### Scenario: An ACTIVE placeholder is rejected

- **WHEN** an ACTIVE checkpoint uses `TODO`, `TBD`, `fill later`, `placeholder`,
  or `unknown` for a required value
- **THEN** validation exits non-zero and identifies the unresolved checkpoint
  field

### Requirement: Plans are independently discoverable and resumable

The repository SHALL provide discovery for each supported plan path under
`openspec/changes/*/execplan.md` and `.agent/execplans/*.md` without a global
current-task file. A read-only resume command SHALL report the plan path,
lifecycle, objective, milestone, completed and in-progress work, Git status,
changed files, last validation, failures, quarantines, blockers, QA impact,
exact next action, and remaining definition of done.

#### Scenario: Parallel plans remain independent

- **WHEN** one ACTIVE plan exists under an OpenSpec change and another plan
  exists under `.agent/execplans/`
- **THEN** discovery lists both paths independently and resume of one plan does
  not mutate or select the other

#### Scenario: A fresh session gets immediate orientation

- **WHEN** a new agent runs `agent:resume --plan <path>` with no conversation
  context
- **THEN** the output contains enough plan and repository state to continue
  from the exact next action

### Requirement: Resume reconciles Git reality and existing QA impact

The resume command SHALL compare normalized changed-area claims against staged,
unstaged, and untracked Git paths and SHALL emit ownership-neutral warnings for
plan-listed paths without current modification and working-tree paths not
represented in the plan. It SHALL derive gates, focused tests, journeys, and
broad-regression status through the existing `qa/impact-map.json` implementation
used by `qa:impact` and `qa:affected`.

#### Scenario: Stale narrative is visible

- **WHEN** an ExecPlan lists a file that Git does not currently modify
- **THEN** resume emits a warning naming the stale plan claim without asserting
  that the current task created or removed the file

#### Scenario: Time-sensitive impact is surfaced

- **WHEN** Git reports `lib/time.ts` as changed
- **THEN** resume includes the date/time impact gates such as timezone coverage,
  affected integration, journeys, and broad regression from the shared impact
  map

### Requirement: Recovery and completion enforcement are documented

The canonical workflow SHALL document fresh-session and compaction recovery as
read instructions followed by `agent:resume`, Git reconciliation, plan update,
and continuation from the exact next action. It SHALL document the autonomous
implementation/test/fix/retest loop, the existing six failure classifications,
checkpoint waypoints, substantial delegation handoff, and a fast validation
entry point for versioned plans. The repository SHALL not require historical
plans to pass the new schema before they opt in.

#### Scenario: Versioned plans are narrow CI enforcement

- **WHEN** CI runs the all-plan validation command
- **THEN** only plans declaring the new schema are validated, so historical
  pre-schema plans do not break CI while new complex tasks receive structural
  enforcement
