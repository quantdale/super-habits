# ExecPlan: SuperHabits Command Center V2

Plan-Version: 2
Status: COMPLETED

## Purpose / User Outcome

Turn the existing global Command Center into a useful, bounded cross-feature
interface. Users can create or complete/log/start only the explicitly supported
actions through a deterministic parse → normalize → resolve → preview →
confirm → execute pipeline. Users can ask bounded read-only questions over
local SQLite facts without mutation confirmation. Existing feature behavior,
offline-first semantics, ownership/security, Linked Actions, reminders, and
date-key rules remain authoritative.

## Context

- Canonical checkout is the clean `main` worktree at `31c582c`; the user’s
  main-only policy overrides the repository’s generic branch-per-task guidance.
- The app is a single-page Expo/React Native shell. The Command Center is a
  global overlay mounted by `GlobalCommandCenterHost`, not a route.
- SQLite is the local source of truth. Feature data modules own persistence,
  sync enqueue, soft-delete, IDs, and time semantics; domain modules are pure.
- Existing Command Create supports `create_todo` and `create_habit` with
  confirmation-first drafts. Existing Ask has bounded local retrieval for
  `pending_todos`, `calorie_summary`, and `habit_streak` plus remote classify /
  phrase stages.
- Existing OpenSpec source of truth includes `openspec/specs/ai-ask/spec.md`,
  navigation, linked actions, habit scheduling/reminders/insights, sync /
  restore, ownership/security, and simulation contracts. This change adds a
  focused `openspec/changes/command-center-v2/` proposal, design, tasks, and
  delta spec.
- Relevant canonical integrations are in `features/{todos,habits,calories,
workout,pomodoro}/*.data.ts` and their domain/insight modules, with Linked
  Actions in `core/linked-actions/` and remote boundaries in
  `supabase/functions/{parse-ai-command,user-ai-ask}/`.

## Scope

### Existing Create capabilities

- Preserve `create_todo` and `create_habit`, including current local fallback,
  edit/needs-input behavior, strict normalization, and confirmation.

### Proposed supported mutation intents

- `create_todo`
- `complete_todo`
- `create_habit`
- `log_habit`
- `log_calorie_entry`
- `log_workout_routine`
- `start_focus_session`

All mutation drafts are discriminated unions with explicit status,
confidence, warnings, missing fields, and intent-specific fields. Entity
references are human-facing names/titles; local code resolves IDs.

### Proposed Ask intents

- `pending_todos` with deterministic due-today, overdue, and priority filters
  where current data APIs support them.
- `calorie_summary` for today, a date, or a bounded local-date range.
- `habit_progress` using existing Habit Progress Insights and streak math.
- `workout_summary` for bounded session counts, last session, and routine
  frequency.
- `focus_summary` for bounded completed-session counts and focused minutes.
- `daily_overview` across todos, habits, calories, focus, and workout.
- `weekly_overview` only if it remains a bounded extension of the same
  deterministic retrieval contracts.

### Explicit unsupported intents

Deletes, bulk destructive actions, arbitrary edits, reminder/schedule/target
changes, historical habit schedule changes, settings/theme changes, Linked
Action rule administration, backup/restore/account administration, arbitrary
SQL/code/shell, invented nutrition, arbitrary exercise/set construction,
silent timer replacement/stop, and opaque conversational references such as
“complete that one” without an explicit deterministic selection.

## Non-Goals

- No generic autonomous agent, arbitrary database/query/code execution, or
  model-selected IDs/ownership.
- No new primary domain schema, remote analytics tables, command history, or
  full two-way sync/restore expansion.
- No silent mutation, auto-run shortcut, bulk destructive action, free-form
  reminder/schedule/target editing, nutrition estimation, arbitrary workout
  construction, or active timer replacement.
- No broad redesign of the app shell or new route architecture.

## Mutation safety model

Remote AI only extracts a strict candidate. Local code re-normalizes every
field, validates bounds/enums/dates, resolves exactly one active entity,
constructs a human-readable preview, and executes only after explicit user
confirmation. Parse never writes. Unsupported, ambiguous, deleted, missing,
already-satisfied, or active-timer-conflict results are visible states. A
deterministic execution token/guard prevents duplicate confirmation from
repeating a draft. Canonical feature data/domain entrypoints own recurrence,
habit schedule/target, reminders, Linked Actions, saved-meal, workout, and
timer semantics.

## Retrieval safety model

Ask classification returns only a strict intent and validated candidate
parameters. Local intent-specific retrieval functions validate and bound all
dates/filters, use sanctioned local date helpers, and return typed normalized
facts without raw rows or arbitrary query selection. Optional phrase AI sees
only the question and bounded facts. A deterministic local answer is retained
as the provider-failure fallback where practical. No Supabase backup-table
analytics or raw credentials reach the model.

## UI/UX flow

Preserve the compact overlay and Create/Ask/Auto mode experience. Create flows
remain input → parse → draft/needs-input → preview → confirm → result. V2
preview cards show action, affected entity, current/proposed state, local
date/time, warnings, and relevant side effects. Needs-input supports inline
correction and deterministic choice buttons for duplicate references. Ask is
question → bounded answer/result with readable unavailable/unsupported states.
Interactive controls get semantic roles/labels/states and focus/announcement
behavior appropriate to React Native Web and native accessibility.

## Domain integration matrix

| Intent              | Resolver               | Canonical execution/retrieval      | Safety-critical behavior                                        |
| ------------------- | ---------------------- | ---------------------------------- | --------------------------------------------------------------- |
| create_todo         | none                   | `addTodo`                          | existing validation/sync                                        |
| complete_todo       | todo title/reference   | todo completion path               | recurrence + Linked Actions; idempotent no-op                   |
| create_habit        | none                   | `addHabit`                         | existing schedule/target semantics                              |
| log_habit           | habit name/reference   | `incrementHabit`                   | local day, effective target/schedule, reminders, Linked Actions |
| log_calorie_entry   | none                   | `addCalorieEntry`                  | user-supplied nutrition only; no estimation                     |
| log_workout_routine | routine name/reference | canonical workout log/session path | active routine, no invented sets/weights                        |
| start_focus_session | none                   | Pomodoro timer lifecycle           | bounds, active-session conflict, no history fabrication         |
| Ask                 | intent-specific        | local data/domain/insight APIs     | bounded facts only                                              |

## Linked Action implications

Command must call the same Todo completion and Habit increment entrypoints as
the UI, never dispatch source events itself. Tests must prove Todo completion
and Habit target crossing create exactly one source event/effect even after a
replayed or double confirmation. Workout/Pomodoro behavior must not invent a
second event system.

## Notification/reminder implications

Habit logging must use the canonical increment path so target-complete reminder
suppression/reconciliation and off-day behavior remain unchanged. Command adds
no reminder-specific logic. Focus start must use the existing timer lifecycle
and notification scheduling; it must not silently replace an active session.

## Date/time semantics

Default habit/calorie/workout dates use current local calendar context via
`lib/time.ts` helpers. Habit logging is current-day-only in V2. Historical
calorie/workout dates are accepted only where existing domain/data contracts
already support them and strict normalization can prove them. Date-sensitive
tests run under the repository timezone matrix: Asia/Manila, UTC,
America/Los_Angeles, Europe/Berlin, and Pacific/Auckland.

## AI security implications

Preserve explicit bearer/JWT validation, `verify_jwt`, durable quota classes,
request body limits, upstream timeouts, provider-error suppression, and no
service-role exposure. Update prompts as defense-in-depth only; client/local
allowlists and validation remain authoritative. V2 should retain request
volume limits unless measured complexity proves otherwise.

## Database implications

Prefer no schema change. Command history is not in scope. All writes go through
existing data APIs; synced entities enqueue as those APIs already require.
If an idempotency persistence change becomes necessary, it must be a new
append-only migration and remain local-only; the default design is an in-memory
execution guard plus canonical idempotent no-op behavior.

## OpenSpec changes

- `openspec/changes/command-center-v2/proposal.md`
- `openspec/changes/command-center-v2/design.md`
- `openspec/changes/command-center-v2/tasks.md`
- `openspec/changes/command-center-v2/specs/command-center-v2/spec.md`
- `openspec/changes/command-center-v2/execplan.md` if required by the local
  OpenSpec schema; this plan remains the user-requested top-level recovery
  plan.

## Test matrix

- Parser/remote normalizers: every supported intent, malformed/extra/invalid
  fields, bounds, dates, unsupported, injection-like text.
- Resolvers: exact, ambiguous, not found, deleted, case variation,
  already-satisfied/conflict.
- Command domain/executor: preview, no-write-before-confirm, canonical calls,
  execution guard, double-confirm.
- Real SQLite integration: Todo recurrence/Linked Actions, Habit target /
  reminder behavior, calories, workout, Pomodoro conflict.
- Ask retrieval/parser: all intents, bounded ranges, empty data, unsupported,
  phrase failure and deterministic fallback.
- Existing unit/integration/security/restore/sync/insight/reminder suites.
- Web E2E: all V2 flows, needs-input/unsupported, no-write, double-confirm,
  provider/quota failures, and existing Create flows.
- Deterministic simulation: busy worker, fitness tracker, heavy Habit user,
  returning user, with only additive changes to existing lanes.

## Native matrix

Run current-source Android preflight/build and serialized Maestro flows for
overlay opening, Create Todo, Complete Todo, Habit log, calories, workout,
focus, Ask, needs-input, unsupported, plus existing smoke/persistence/lifecycle
coverage. iOS is run when available. Missing tooling/device/build is recorded
as `ENVIRONMENT`, never as a pass.

## Performance budget

No eager mounting of heavy feature screens. Resolver lookups should be
bounded and avoid N+1 queries. Overview/retrieval ranges are bounded and use
aggregated or existing list APIs. Screen switching and existing thresholds
must not regress. Run the existing affected/full performance gates without
raising thresholds.

## Progress

- [x] Recover clean canonical `main` and prune remote refs.
- [x] Read repository guidance and applicable skills.
- [x] Inventory current Command/Ask contracts and canonical feature APIs.
- [x] Create and validate OpenSpec change artifacts.
- [x] Implement discriminated V2 contracts, normalization, resolution, preview,
      confirmation, and idempotent execution.
- [x] Implement supported canonical mutation integrations.
- [x] Expand bounded Ask retrieval/classify/phrase/fallback.
- [x] Add unit, integration, E2E, simulation, timezone, security, and native
      coverage appropriate to changed surfaces.
- [x] Deploy and inspect Edge Functions in project `kruubbynsmxzxfdunaal`.
- [x] Reconcile, commit, push `main`, and inspect GitHub CI.
- [x] Complete this plan after recording the intended evidence and explicit
      native / credential limitations.

## Surprises & Discoveries

- Current `main` is exactly the historical SHA supplied by the user; no remote
  advancement or local changes need integration.
- The repository already contains a completed AI Ask V1 and an in-progress
  simulation OpenSpec change; V2 must extend current code rather than assume
  the earlier narrow architecture.
- Canonical mutation entrypoints are already available for Todo completion
  (`toggleTodo`), Habit logging (`incrementHabit`), calorie logging
  (`addCalorieEntry`), and routine logging (`completeRoutine`). Pomodoro start
  is currently component-local in `PomodoroScreen`, so V2 needs an explicit
  shared timer bridge/provider rather than pretending `logPomodoroSession`
  starts a live timer.
- Habit completion currently dispatches Linked Actions only on the threshold
  crossing, and requests reminder reconciliation after increments. Todo
  completion handles daily recurrence before dispatching non-recurring source
  actions. Calorie add maintains saved-meal convenience state after the
  authoritative ledger write.
- Ask V1's `habit_streak` retrieval computes streaks with one completion query
  per habit; V2's `habit_progress` should use the existing
  `calculateHabitProgressInsights` domain and bounded bulk completion data to
  avoid expanding the N+1 pattern.
- The first current-source Android release build exposed a pre-existing-style
  SVG crash through the new timer seam: normal `onPress={start}` passed a
  React Native event into the new optional duration parameter, producing
  `NaN` geometry. Explicit zero-argument wrappers fixed the regression; the
  corrected APK passed Pomodoro lifecycle and Command V2 native smoke.
- Generic repository guidance still says branch-per-task, but the user
  explicitly requires main-only development; the user instruction controls.

## Decision Log

- 2026-08-14 — Keep Command history out of scope — it adds schema/state risk
  without being required for safe V2 execution.
- 2026-08-14 — Use human-facing entity references and local deterministic
  resolution — internal IDs must not be model-selected.
- 2026-08-14 — Prefer current-day Habit logging — historical schedule semantics
  are too easy to misinterpret and existing product behavior is current-day
  oriented.
- 2026-08-14 — Preserve server responsibilities as auth/quota/bounded
  extraction/phrasing — local code owns domain truth and retrieval.

## Validation Ledger

- 2026-08-14 — `git status --short`, branch/remote/worktree inspection — PASS;
  clean `main`, local/remote SHA `31c582c`, only `origin/main`.
- 2026-08-14 — `git fetch origin --prune` — PASS; no remote advancement.
- 2026-08-14 — `npm run qa:affected` — PASS; clean tree reports default
  `qa:fast → qa:full` impact.
- 2026-08-14 — `npm run agent:plan:validate -- --plan .agent/execplans/command-center-v2.md` — FAIL; validator required a standalone `Non-Goals` section; corrected before continuing.
- 2026-08-14 — `npm ci` — PASS; lockfile install and patch-package postinstall
  completed; npm reported 16 existing audit vulnerabilities (6 moderate,
  10 high) for later security evidence.
- 2026-08-14 — `npm run typecheck` — PASS; zero TypeScript errors.
- 2026-08-14 — `npm run lint` — PASS; zero lint errors and no warnings beyond
  the configured threshold.
- 2026-08-14 — `npm test` — PASS; 793 tests across 79 files, unit and
  integration projects, with no failures.
- 2026-08-14 — `openspec validate command-center-v2 --strict` — PASS; change
  proposal, two delta specs, design, and checkbox tasks are valid.
- 2026-08-14 — `npm run openspec:validate` — PASS; all 24 repository change /
  spec items valid.
- 2026-08-14 — `npm run agent:plan:validate -- --plan
.agent/execplans/command-center-v2.md` — PASS; plan remains ACTIVE.
- 2026-08-14 — focused V2 Vitest suites — PASS; 49 tests across five files,
  including four real-SQLite Command Center integration cases (off-day,
  ambiguity, no-write-before-confirm, canonical Linked Actions/saved-meal/
  workout behavior).
- 2026-08-14 — `npm run build:web` — PASS; current local-only web export
  generated in `dist/`.
- 2026-08-14 — V2 mutation journey — PASS; 10/10 Playwright journeys on the
  `journeys` project, including no-write, ambiguity, inline nutrition
  correction, focus conflict path, and double-confirm Todo idempotency.
- 2026-08-14 — `npm run sim:validate` and deterministic V2 scenario subset —
  PASS; semantic command preview/confirm/Ask steps validated and 4/4 V2
  persona scenarios completed against the served web export.
- 2026-08-14 — `npm run build:sync` plus deterministic Ask boundary journey —
  PASS; dummy Supabase `dist-sync/` export verified and 7/7 steps passed for
  all six V2 Ask intents with bounded phrase facts; no provider was contacted.
- 2026-08-14 — `npm run qa:affected` after native timer fix — PASS; impact map
  requires fast/full/integration/journey/simulation/native lanes and the
  affected-file set is recorded by the command.
- 2026-08-14 — corrected-source focused validation — PASS; `npm run typecheck`,
  `npm run lint`, and `npm test` completed with 838 tests across 81 files.
- 2026-08-14 — current-source Android release build — PASS; release APK
  installed on `Nitro_API_36`, package `com.dale16.superhabits`, version
  `1.0.0` code `1`, SHA-256
  `93A2098F6439E62AAA8C154B734E948320A835FE698F880159D6167D51E7F114`.
- 2026-08-14 — serialized native regression evidence — PASS for Command V2
  preview/no-write, smoke, Todo/Habit/Calories/Workout persistence, Pomodoro
  lifecycle, Habit Progress Insights, and Habit Reminder persistence. The
  first Pomodoro run failed with a reproducible `NaN` SVG crash; the source
  fix was rebuilt and the rerun passed.
- 2026-08-14 — EAS current-source build attempt — BLOCKED/ENVIRONMENT; EAS
  CLI required an Expo account or `EXPO_TOKEN`, so the local Android release
  build was used and the credential blocker remains explicit.
- 2026-08-14 — deployed Edge Function inspection — PASS; `parse-ai-command`
  ACTIVE version 4 and `user-ai-ask` ACTIVE version 7, both `verify_jwt=true`,
  with downloaded deployed source matching the local function files. Safe
  unauthenticated probes returned 401; no authenticated session was available
  for a live canary.
- 2026-08-14 — post-fix full validation — PASS; `npm run qa:fast` reported 743
  unit tests across 63 files, `npm run qa:integration` reported 95 tests across
  18 files, and the repository timezone matrix passed 42 tests in each of
  Asia/Manila, UTC, America/New_York, Pacific/Honolulu, and Pacific/Kiritimati
  (210 test executions).
- 2026-08-14 — post-fix web/sync/simulation validation — PASS; full web E2E
  reported 163 passed and 24 skipped out of 187, sync E2E reported 22 passed
  and 4 skipped out of 26, and deterministic simulation reported all 21
  scenarios passed.
- 2026-08-14 — final repository checks — PASS for Expo Doctor (19/19), theme
  contrast (140/140), Supabase schema, OpenSpec (24/24), QA impact map (12
  rules), all ExecPlan validation, and `git diff --check`. `npm audit` and
  `npm audit --omit=dev` retain the existing 16 findings (6 moderate, 10 high)
  whose available forced fix changes the Expo dependency line. The global
  `npm run format:check` still reports repository-wide pre-existing formatting
  findings; every V2-touched file was individually formatted and checked.
- 2026-08-14 — `npm test` final source gate — PASS; 838 tests across 81 files.
- 2026-08-14 — main-only publish — PASS; coherent commit
  `39662fe74e16c912272408a725640bf41c5d1178` pushed without force, then
  `main` and `origin/main` matched exactly and the remote branch inventory
  remained `origin/main` only.
- 2026-08-14 — GitHub Actions CI #351 — PASS; run `31799688744` for the final
  implementation commit completed `quality` successfully and `e2e`
  successfully; `nightly` was skipped by workflow design. The final
  documentation closure commit triggers the final post-closure CI run.
- 2026-08-14 — GitHub Actions CI #352 — PASS; run `31802263767` for the final
  documentation closure commit completed `quality` and `e2e` successfully,
  including the full E2E lane, deterministic scenarios, `dist-sync` build,
  remote-boundary journeys, and artifact uploads; `nightly` was skipped by
  workflow design.

## Changed Files / Areas

- `.agent/execplans/command-center-v2.md` — durable task state and recovery.
- `openspec/changes/command-center-v2/` — normative proposal/design/tasks/
  delta spec and linked implementation checkpoint.
- `features/command/` — V2 contracts, local safety pipeline, UI, Ask
  retrieval/parser integration.
- `core/providers/AppProviders.tsx` — registers the Pomodoro command bridge.
- `features/habits/habitInsights.domain.ts` — accepts bounded insight rows.
- `features/pomodoro/PomodoroScreen.tsx`,
  `features/pomodoro/pomodoroCommandBridge.tsx`, and
  `features/pomodoro/pomodoroCommandBridgeContext.ts` — canonical timer start
  bridge for overlay execution; normal UI start calls explicitly discard press
  events before invoking the optional-duration function.
- `features/todos/todos.data.ts` — idempotent completion and bounded pending
  Todo retrieval.
- `features/workout/workout.data.ts` — reports canonical routine-log outcome.
- `supabase/functions/parse-ai-command/index.js`,
  `supabase/functions/parse-ai-command/normalize.js`,
  `supabase/functions/user-ai-ask/index.js`, and
  `supabase/functions/user-ai-ask/normalize.js` — strict remote
  extraction/phrase contracts and security-preserving prompts/normalizers.
- `tests/`, `tests/integration/`, `e2e/`, `simulation/` — validation evidence.
- `.maestro/flows/command-center-v2.yaml` — serialized native Command V2
  preview/no-write smoke flow.

## Current Checkpoint

- Current milestone: completed delivery — V2 implementation, broad web / sync /
  simulation coverage, deployment inspection, current-source Android evidence,
  main publication, and GitHub CI are recorded.
- Completed: clean-main recovery, guidance/skills read, architecture inventory,
  baseline QA, valid OpenSpec artifacts, V2 command contracts/review/execution,
  canonical feature integrations, bounded Ask retrieval, remote contracts,
  focused unit/integration tests, typecheck, and lint.
- In progress: None in this plan. This closure update is the final
  documentation checkpoint; its post-closure CI observation is a transport /
  verification step and must not change product content.
- Important modified files: `.agent/execplans/command-center-v2.md`,
  `openspec/changes/command-center-v2/`, `features/command/`, the canonical
  entity feature seams, remote functions, tests, and E2E coverage.
- Last successful validation: post-fix full web E2E (163 passed/24 skipped),
  sync E2E (22 passed/4 skipped), deterministic simulation (21/21), fast /
  integration/timezone gates, current Android release install, serialized
  native Command V2 preview, Pomodoro lifecycle rerun after fixing the `NaN`
  crash, and final closure CI #352 (quality/e2e PASS).
- Current failures: none in the corrected-source lanes; the first Pomodoro
  native artifact is preserved as a fixed product regression. `npm audit`
  still reports the known dependency findings.
- Relevant quarantines: E2E sync has the repository's existing four restore
  skips; no new Command V2 quarantine.
- Blockers: EAS account/token unavailable; no safe authenticated app JWT for a
  live AI canary; iOS target unavailable on Windows.
- Condition required to unblock: None for the completed repository delivery;
  the EAS, iOS, and authenticated-canary items remain explicit external
  follow-ups.
- Exact resume action after unblock: None — final closure CI is green and the
  main publication is complete.
- Exact next action: None — report the verified Git, QA, deployment, CI, and
  documented native/external limitations.
- Remaining definition of done: No remaining work in this plan; native/EAS/
  iOS limitations remain honestly classified in the handoff.

## Recovery / Resume Instructions

1. Read `AGENTS.md`, `.agent/PLANS.md`, this plan, and the OpenSpec artifacts.
2. Run `git status --short`, `git diff --stat`, `git diff --name-only`, and
   `npm run agent:resume -- --plan .agent/execplans/command-center-v2.md`.
3. Reconcile the Current Checkpoint with Git and QA artifacts; Git wins.
4. Run `npm run qa:affected` for changed files.
5. Continue only from `Exact next action`, updating this plan before each
   milestone or large validation command.

## Outcomes & Retrospective

- Status: Completed; final post-closure CI observation is green.
- Summary: V2 implementation, deterministic safety pipeline, canonical
  mutations, bounded Ask retrieval, deployed Edge Functions, broad headless
  validation, and current-source Android regression evidence are complete.
- Follow-up: Full per-action native Command coverage remains an explicit
  follow-up; EAS credentials, iOS, and a safe authenticated AI canary session
  were unavailable in this run. These are reported as partial/external status,
  never as passing evidence.
