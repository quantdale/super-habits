## Purpose

This capability guarantees deterministic ownership of asynchronous work that
can update SuperHabits state or perform lifecycle-driven side effects. Older
reads, hydration, timed-out remote phases, background/foreground events,
timers, listeners, and replayed responses must never overwrite newer state,
lose newer user intent, adopt data for the wrong target/day, or duplicate a
write/action.

## ADDED Requirements

### Requirement: Async state adoption has one logical-operation owner

Every high-risk asynchronous operation that can update user-visible or
cross-cutting state MUST have an explicit currentness/ownership rule. If two
logical operations overlap, results from the older operation MUST NOT be
adopted after a newer operation has started. If one logical operation fans out
to concurrent sibling reads, the siblings MUST share that operation's ownership
and MUST NOT invalidate one another merely by starting.

#### Scenario: Older refresh settles after newer refresh

- **WHEN** refresh A starts, refresh B starts later, and A resolves after B
- **THEN** A's stale result is not applied and B remains the authoritative
  visible state

#### Scenario: Parallel siblings share one refresh generation

- **WHEN** one refresh starts multiple independent reads concurrently
- **THEN** every sibling may complete and contribute to that refresh without
  starting a sibling-local generation that invalidates another sibling

#### Scenario: Component or target is no longer current

- **WHEN** an async read settles after its component unmounts or after the view
  switches to a different target entity/day
- **THEN** the obsolete result is not adopted into the new/unmounted state

### Requirement: Explicit user intent outranks older hydration

For editable fields and user preferences, an explicit user interaction made
after an initial/persisted read begins MUST outrank that older read when it
settles. When no newer user interaction occurred, valid persisted hydration
MUST still apply normally. Implementations MUST scope dirty/version ownership
to the affected state rather than disabling unrelated refresh.

#### Scenario: User edits while initial data is pending

- **WHEN** an editable view begins loading persisted/database state and the user
  changes a field before the load settles
- **THEN** the older load cannot overwrite that newer explicit field value

#### Scenario: Untouched state hydrates normally

- **WHEN** persisted hydration settles and the user has not changed the affected
  state since the read began
- **THEN** the valid persisted value is applied

#### Scenario: Preference is switched before AsyncStorage resolves

- **WHEN** a persisted preference read begins, the user explicitly chooses a
  different valid value, and the persisted read resolves later
- **THEN** the user's newer choice remains active and may be persisted without
  a stale overwrite

### Requirement: Timed-out remote phases cannot regress newer state

A remote operation MAY continue running after a bounded startup/UI wait times
out, but any eventual settlement MUST be adopted only if that operation is
still current. Newer account, restore-preview, maintenance, retry, dismissal,
or restore state MUST NOT be overwritten by an older late settlement.

#### Scenario: Old restore preview settles after newer preview

- **WHEN** restore-preview A starts and exceeds its bounded wait, a later
  operation obtains preview B, and A eventually settles after B
- **THEN** the visible restore state remains B and A cannot re-enable, dismiss,
  or otherwise regress prompt eligibility based on stale data

#### Scenario: Remote timeout preserves local use

- **WHEN** an eligible remote phase does not settle within its bounded timeout
- **THEN** local bootstrap/use continues according to the existing local-first
  contract and a later remote settlement is processed only through currentness
  checks

### Requirement: Lifecycle trigger fan-in is coalesced and idempotent

Intervals, visibility changes, reconnect callbacks, AppState changes, day
rollover, service-worker events, notification responses, and repeated
mount/unmount cycles MUST have stable registration/cleanup ownership. Concurrent
triggers MUST NOT duplicate a domain write, sync push, reminder action, timer
completion, or navigation effect that is required to be idempotent.

#### Scenario: Repeated mount and remount leaves one active owner

- **WHEN** a surface/provider that owns a timer/listener/subscription mounts,
  unmounts, and mounts again
- **THEN** obsolete registrations are removed and exactly the intended current
  registration can react to the next event

#### Scenario: Flush triggers overlap

- **WHEN** interval, visibility, or connectivity triggers request a flush during
  the same in-flight window
- **THEN** the sync push remains coalesced according to the existing SyncEngine
  contract and surrounding maintenance/preview work does not duplicate side
  effects or adopt an older post-flush snapshot

#### Scenario: Notification response is replayed

- **WHEN** the same processed notification action is observed again after
  reload, foreground, or kill/relaunch recovery
- **THEN** durable idempotency prevents duplicate domain mutation/navigation
  while preserving the intended single action

### Requirement: Day and foreground transitions reject stale-day results

Day-scoped async work MUST be associated with the local-day generation or
otherwise prove equivalent currentness. A request started for yesterday MUST
not overwrite a refresh for today after local midnight, foreground-after-day-
change, or timezone-driven date transition.

#### Scenario: Midnight occurs during an in-flight read

- **WHEN** a day-scoped read starts before local midnight, the day-rollover
  generation advances, and the old read settles afterward
- **THEN** the old day's result is rejected and the current-day surface remains
  authoritative

### Requirement: Async ordering regressions have deterministic tests

Race-sensitive correctness MUST be proven using deterministic seams such as
deferred promises, explicit generation tokens, injected adapters, or
controllable clocks. Arbitrary sleeps, timeout inflation, or probabilistic
scheduler timing MUST NOT be the primary oracle for stale-result correctness.

#### Scenario: Race suite is replayed from fresh state

- **WHEN** the campaign's race-sensitive suites run at least twice from clean
  post-fix state
- **THEN** they deterministically reproduce the ordering setup and pass without
  relying on lucky wall-clock scheduling

### Requirement: Lifecycle lint debt is not normalized

The campaign MUST resolve the current lifecycle-related lint warning baseline
without disabling governing rules or adding blanket suppressions. Each warning
site MUST be audited for stale-result, unmount/target-change, loading/finally,
and user-intent hazards before it is restructured or classified safe.

#### Scenario: Final lint gate is clean

- **WHEN** `npm run lint` runs on the exact final campaign tree
- **THEN** it reports zero errors and zero warnings without relaxed lint
  thresholds/rules or blanket disable comments introduced by this campaign

### Requirement: Whole-repository async/lifecycle audit is traceable

The campaign MUST account for every tracked repository path using `git
ls-files`. Source/config/test/docs/harness files MUST be semantically reviewed
for relevant authority and lifecycle behavior; non-source/binary/lock/generated
artifacts MUST be inventoried and sanity-checked. Material findings MUST be
recorded with severity, root cause, proof, disposition, and regression evidence.

#### Scenario: Audit coverage closes with no silent remainder

- **WHEN** the campaign reaches completion review
- **THEN** the ExecPlan audit ledger accounts for every tracked path, every
  Critical/High in-scope finding is resolved with proof, and no unreviewed path
  is silently omitted

### Requirement: Repository truth matches runtime and test capability

Architecture/schema/known-gap documentation and current test skips MUST describe
actual runtime/test capability. Completed deterministic soak coverage MUST not
be described as absent, current schema-version claims MUST match runtime
migration authority, and skips/fixmes MUST retain an explicit real
capability/environment rationale.

#### Scenario: Documentation and skip audit matches final reality

- **WHEN** final documentation/QA reconciliation runs
- **THEN** schema/version wording, load/stress capability wording, current
  skips/fixmes, QA mapping, OpenSpec tasks, and the ExecPlan agree with the
  exact final implementation and evidence
