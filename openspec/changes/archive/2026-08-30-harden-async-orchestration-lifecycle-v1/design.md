## Context

The planner audited `main` at
`c823ab3520da22caec6d5502d395dd296e589d58`. The predecessor
`openspec/changes/harden-whole-system-resilience-v1/` is COMPLETED and its final
commit fixed the Pomodoro refresh-ownership regression and added monotonic
account-state task sequencing. No open GitHub issue currently defines the next
campaign; this change is driven by code/test/lint/document evidence.

The architecture remains intentionally simple: local SQLite is authoritative,
feature screens mostly use local React state, section navigation is in-memory,
remote Supabase is backup-oriented, and lifecycle signals (foreground,
rollover, connectivity, timers, notifications) trigger refresh or side-effect
work. That simplicity is valuable, but it means async-result ownership must be
made explicit at each boundary instead of being delegated to a state/query
framework.

Planner evidence that shapes this change:

- `useGuardedAsyncRefresh` is used by Todos, Habits, Pomodoro, Workout, and
  Calories only. Overview has a bespoke request-id/mounted guard; several
  Planning/Goals/Projects/History views do not use an equivalent latest-only
  generation.
- `DailyPlanView.refresh()` fans several reads in parallel and then writes both
  reference data and editable draft fields. An interaction that occurs while
  the read is in flight therefore needs an explicit precedence contract.
- `remotePhase.withRemoteTimeout()` intentionally does not cancel the
  underlying task. `AppProviders` protects account-state adoption with
  monotonic task IDs, while restore-preview adoption still has independent
  late-settlement and post-maintenance/post-flush paths that require proof.
- The final-tree lint baseline is 13 warnings, nine of them
  `react-hooks/set-state-in-effect` around async/effect-driven views. These are
  not automatically bugs, but they identify lifecycle-heavy code that deserves
  explicit audit.
- AsyncStorage readers span theme/preferences, command, overview layout/
  onboarding, workout rest preferences, Pomodoro, notifications, planning,
  habit lifecycle, quick capture, backup settings, and Calories. The recent
  Calories bug proves that persisted hydration must lose to a newer explicit
  user action where those streams compete.
- Timer/listener usage is finite and concentrated, making full cleanup/fan-in
  review practical.
- Documentation has minor truth drift: schema v24 is current, while one
  structure-map authority row still says `current v23`; known-gap load/stress
  wording predates the completed deterministic soak lane.

## Goals / Non-Goals

### Goals

- Account for every tracked file and explicitly audit every async/lifecycle
  authority surface.
- Establish one understandable ownership model for latest-only UI refreshes and
  other stale-result hazards without introducing a general state framework.
- Make user intent newer than mount-time/persisted hydration and prove both
  touched and untouched cases.
- Prove or fix remote-phase/restore-preview stale adoption in AppProviders.
- Prove timer/listener/subscription registration, cleanup, and side-effect
  idempotency through repeated lifecycle transitions.
- Drive lifecycle-related lint warnings to zero without suppression/config
  relaxation.
- Add deterministic regression proof and reconcile docs/known gaps/QA mapping.

### Non-Goals

- New feature/UI work, visual redesign, analytics, or product-scope expansion.
- Replacing local React state with Redux/Zustand/React Query or similar.
- Rebuilding sync, backup, account, timer, notification, or navigation systems.
- Serializing safe independent reads merely to avoid parallelism.
- Live Supabase mutation without an explicitly authorized disposable target.
- Reopening completed migration/recovery/soak campaigns except where this audit
  finds a new ordering defect at their boundary.
- Changing schema unless a demonstrated data-correctness defect requires it.

## Decisions

### D1 — Latest-result adoption is an operation-level contract

A generation token belongs to one **logical operation**, not one helper call.
For a refresh that fans out to N sibling reads, the parent refresh acquires one
current-generation predicate and every sibling shares it. Starting another
logical refresh invalidates the old generation. Standalone loader calls may
start their own generation only when they truly represent a distinct operation.

Rationale: the Pomodoro regression demonstrated that loader-level ownership can
make a correct concurrency optimization self-cancel.

### D2 — Preserve parallel reads; guard adoption, not execution

`Promise.all` is not a defect. Safe independent reads remain parallel. The
campaign audits who is allowed to adopt results and whether writes/side effects
are transactional/idempotent. Do not fix ordering by serializing unrelated
reads or adding arbitrary waits.

### D3 — User interaction outranks earlier hydration

For editable/preferences state, establish this precedence unless a more
specific product contract says otherwise:

1. explicit user action after the read began;
2. newer authoritative operation/restore result;
3. persisted/mount-time hydration;
4. default.

An untouched control still hydrates normally. A dirty/version token should be
scoped to the exact state it protects; do not globally freeze refresh.

### D4 — Cancellation and stale-result rejection are distinct

Use real cancellation only where the underlying API supports it and cancellation
is semantically appropriate. SQLite/AsyncStorage/remote operations may not be
cancellable; their result must simply be rejected if no longer current. A
cleanup flag that only prevents post-unmount setState does not by itself solve
older-request-after-newer-request races.

### D5 — Reuse the existing guard primitive unless evidence demands a small generalization

`createAsyncRefreshGuard()` is framework-free and already tested. Prefer
converging bespoke latest-only patterns on it or minimally generalizing its API
rather than creating another hook/manager. Naming may change if it makes
operation ownership harder to misuse, but migration must be focused and tests
must pin semantics.

### D6 — Remote preview state needs one adoption authority if the race is proven

First use deferred promises to model:

- bootstrap preview starts;
- its bounded await times out;
- backup maintenance or a later flush obtains a newer preview;
- the original preview settles late.

If the late snapshot can overwrite newer restore state, create one monotonic
preview task/generation authority across all preview producers that can overlap.
Account-task sequencing is precedent, not code to duplicate blindly. Restore
prompt dismissal/restore transitions must also invalidate stale preview work
when necessary.

### D7 — Lint warnings are audit inputs; zero warnings is the target

Do not hide `react-hooks/set-state-in-effect` with eslint comments. Restructure
loads so lifecycle ownership is explicit, separate synchronous reset state from
async adoption where necessary, and keep tests focused on behavior. Trivial
non-lifecycle warnings (duplicate import, test console, fast-refresh mixed
exports) should be cleaned without unrelated refactoring.

### D8 — Exhaustive audit means every tracked path is accounted, not pretending binary review is semantic

Use `git ls-files` as the inventory. Code/config/test/docs are semantically
reviewed. Binary/lock/generated artifacts are inventoried and sanity-checked for
expected ownership/reference/reproducibility. The ExecPlan records coverage
counts and material findings.

### D9 — Race tests must be deterministic

Prefer deferred promises, explicit generation factories, fake/controllable
clocks, injected adapters, and narrow provider helpers over tests that hope a
5–100 ms delay produces a race. E2E/simulation proves integration only after
narrow deterministic tests establish the invariant.

## Audit Model

For every high-risk async path, record:

- producer / operation start;
- data source (SQLite, AsyncStorage, remote, timer, notification, calculation);
- trigger(s) (mount, user action, foreground, rollover, interval, reconnect,
  visibility, notification response, restore, retry);
- parallel siblings;
- state/side-effect adopter;
- generation/currentness authority;
- unmount/target-change behavior;
- explicit-user-action precedence;
- retry/timeout/late-settlement semantics;
- listener/timer cleanup owner;
- idempotency/transaction boundary if it writes;
- existing regression proof and remaining gap.

Severity guidance:

- Critical: plausible silent data corruption/loss, owner crossover, restore
  corruption, or repeated destructive side effect.
- High: user-visible stale/incorrect state, lost user edit, duplicate domain
  write/reminder/navigation, permanent stuck/loading state, or cross-day stale
  presentation under supported lifecycle.
- Medium: bounded transient stale presentation, avoidable redundant work,
  cleanup/performance debt without correctness loss.
- Low: local clarity/hygiene/document drift with no runtime consequence.

## Targeted Surface Map

### UI refresh/adoption

Audit all main sections plus Overview, Planning Hub, Daily Plan/history, Goals,
Projects, Weekly Review/history, Quick Capture, Settings, Habit detail/insights,
Workout session/detail flows, Command overlay/retrieval, and any additional
component found by static search. Read-only views still need unmount/latest-only
proof if overlapping requests can occur.

### Persistent hydration

Audit every AsyncStorage-backed value and restore-applied cross-store setting.
Differentiate pure storage helpers from UI adoption. Tests must cover late
hydration only where a newer competing source can exist.

### Core orchestration

Audit AppProviders bootstrap/account/restore/maintenance/flush, SyncEngine
coalescing and durable outbox ordering, backup/restore/portable concurrency,
notification response bridge/dispatcher/action replay, linked-action execution,
service-worker lifecycle, DayRolloverProvider, foreground refresh, connectivity,
theme motion/system-theme listener, and Supabase auth/auto-refresh callbacks.

### Timers/listeners

Inventory every `setInterval`, `setTimeout`, event subscription/listener, AppState
or NetInfo callback, notification response subscription, visibility handler,
service-worker message/update hook, and native timer loop. Repeated mount/unmount
must leave exactly one intended owner.

### Tests/QA/docs

Audit every `test.fixme`/skip, race-sensitive helper, global fake timer, shared
fixture, simulation scenario, native Maestro flow, impact-map rule, CI workflow,
and current known-gap claim. No test may hide a product bug behind environment
classification without independent evidence.

## Risks / Trade-offs

- Broad lifecycle refactors can introduce more races than they remove → change
  the narrowest owner, add deterministic tests before broad QA, and avoid
  one-shot mass rewrites.
- Forcing zero lint warnings may tempt behavior changes → each lifecycle warning
  requires focused regression proof; trivial warnings remain isolated commits.
- Provider race tests can become over-mocked → keep the invariant helper
  framework-free where possible and retain at least one integration-level test.
- E2E timing is host-sensitive → correctness oracles must be state-based rather
  than arbitrary sleeps; classify host limitations honestly.
- Native notification delivery can be environment-sensitive → preserve JSON/
  Maestro reports and exact replay commands; never infer pass from browser tests.

## Migration Plan

No database migration is planned. If the audit proves a schema/data invariant
requires one, stop and record the evidence/decision in the ExecPlan before
adding the next append-only `version < 25` block and its migration tests.

## Open Questions

- Does the restore-preview late-settlement sequence produce a real stale-state
  overwrite, or are coordinator snapshots/ordering sufficient to make it safe?
  Resolve with deterministic tests before changing production code.
- Which of the nine lifecycle lint-warning sites represent actual overlap/user-
  intent hazards versus safe initial-load structure? Classify individually.
- Which current test fixmes remain real external capability gaps after the
  resilience/soak work, and which are stale documentation/harness debt?
