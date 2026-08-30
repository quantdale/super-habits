## 1. Contracts and deterministic safety

- [x] 1.1 Extend `features/command/types.ts` to a discriminated V2 draft union while preserving the existing Create draft fields and parser observation contracts.
- [x] 1.2 Add local field normalizers/validators for entity references, calorie nutrition, local dates, and focus duration; reject unsupported model fields and parser-injected IDs.
- [x] 1.3 Add pure deterministic Todo, Habit, and Workout routine resolvers with exact, ambiguous, not-found, deleted-only, already-satisfied, and conflict outcomes.
- [x] 1.4 Add review preparation that loads active entities/current state without writes, assigns a local execution token, and builds typed preview/needs-input data.
- [x] 1.5 Add executor claim/release behavior for reviewed drafts and safe duplicate/in-flight outcomes.

## 2. Canonical mutation integrations

- [x] 2.1 Refactor the Todo completion mutation into an idempotent canonical completion path that preserves daily recurrence and Linked Actions; keep UI toggle behavior unchanged.
- [x] 2.2 Wire `complete_todo` through resolution, preview, confirmation, and canonical completion execution.
- [x] 2.3 Wire `log_habit` through current-local-day resolution, effective target/schedule preview, canonical increment, reminder reconciliation, and threshold Linked Actions.
- [x] 2.4 Wire `log_calorie_entry` through strict supplied-nutrition validation, current-day defaults, canonical calorie logging, and saved-meal behavior.
- [x] 2.5 Wire `log_workout_routine` through active routine resolution and canonical completed-routine logging without generated exercise/set details.
- [x] 2.6 Add the root Pomodoro timer bridge, register the existing screen lifecycle, queue one pre-mount focus request, and reject running/paused conflicts.
- [x] 2.7 Wire `start_focus_session` through duration validation, preview/confirmation, navigation to Focus, and the timer bridge without creating completed history.

## 3. Parser and remote boundaries

- [x] 3.1 Extend the deterministic mock command parser for the supported V2 examples and explicit unsupported/destructive cases.
- [x] 3.2 Extend the client remote parser normalizer and request validation for every V2 draft kind, strict fields, bounds, dates, and missing input.
- [x] 3.3 Update `parse-ai-command` prompts, structured response schema, and runtime normalization while retaining auth, quota, body, timeout, and provider suppression behavior.
- [x] 3.4 Preserve Auto/Create routing and update mode/result copy so V2 drafts remain accessible in the existing overlay.

## 4. Review UI and accessibility

- [x] 4.1 Extend the Command preview card for each V2 mutation with action/entity/current/result/date/warning/side-effect rows.
- [x] 4.2 Add inline corrections for entity references, calorie fields, and focus duration; render deterministic ambiguity choices and needs-input messages.
- [x] 4.3 Add semantic roles, labels, busy/selected states, readable error announcements, and deterministic focus movement for preview/correction/confirmation controls.
- [x] 4.4 Add result navigation to existing Todos, Habits, Calories, Workout, and Focus sections without adding routes or eager feature mounts.

## 5. Ask V2 retrieval and phrasing

- [x] 5.1 Extend Ask types and classifier normalization to `pending_todos`, `calorie_summary`, `habit_progress`, `workout_summary`, `focus_summary`, and `daily_overview` with bounded intent parameters.
- [x] 5.2 Implement bounded local retrieval functions for each intent using sanctioned date helpers and typed aggregate facts only.
- [x] 5.3 Refactor Habit progress retrieval to existing Habit Progress Insights semantics with bulk/bounded completion reads and deterministic ambiguity handling.
- [x] 5.4 Add deterministic local fallback formatters and preserve distinct unsupported, unavailable, auth, quota, and phrase-validation outcomes.
- [x] 5.5 Update `user-ai-ask` prompts, intent allowlists, classifier params, phrase fact bounds, and provider safety without changing quota classes.

## 6. Unit and SQLite integration coverage

- [x] 6.1 Add parser normalization tests for every V2 kind, malformed/extra/invalid fields, injection-like text, numeric/date bounds, and unsupported actions.
- [x] 6.2 Add resolver and review tests for exact, duplicate, missing, deleted-only, case variation, already-complete, off-day, and timer-conflict states.
- [x] 6.3 Add executor tests for canonical calls, preview/no-write-before-confirm, execution-token replay, and failure release.
- [x] 6.4 Add real SQLite tests for Todo completion/recurrence/Linked Actions, Habit target crossing/reminder reconciliation, calories/saved meals, and Workout logs.
- [x] 6.5 Add Pomodoro bridge/timer lifecycle coverage for valid start, active-session conflict, and no history at start through the Command V2 contract/E2E/native lanes.
- [x] 6.6 Expand Ask retrieval/parser tests for all intents, date bounds, empty data, ambiguous names, bounded facts, phrase failure, and deterministic fallback.
- [x] 6.7 Re-run focused AI auth/quota/body-limit/provider-suppression/RLS/schema checks and preserve any pre-existing audit findings.

## 7. Web journeys and simulation

- [x] 7.1 Add Playwright coverage for existing Create Todo/Habit flows plus Complete Todo, Habit log, calories, workout, focus, no-write-before-confirm, double-confirm, needs-input, and unsupported destructive commands.
- [x] 7.2 Add Ask journeys for pending Todos, calorie summary, Habit progress, workout summary, focus summary, daily overview, provider failure, and quota rejection using deterministic mocks.
- [x] 7.3 Extend deterministic simulation personas/workflows for busy worker, fitness tracker, heavy Habit edge cases, and returning-user daily overview with persisted-row or second-surface oracles.
- [x] 7.4 Run the timezone matrix for local-day Habit/calorie/workout/focus semantics and verify UTC, Asia/Manila, America/Los_Angeles, Europe/Berlin, and Pacific/Auckland evidence.

## 8. Full QA, deployment, and native evidence

- [x] 8.1 Run affected fast/integration/timezone gates, OpenSpec/plan/impact/theme/schema validation, typecheck, lint, unit/integration tests, and record exact results.
- [x] 8.2 Build web and sync exports, run sync E2E and full web E2E, deterministic simulation, Expo Doctor, audit, and diff checks; classify failures with preserved artifacts.
- [x] 8.3 Deploy both Edge Functions to `kruubbynsmxzxfdunaal` with `verify_jwt` unchanged, inspect deployed versions/source/hashes, and run only safe authenticated canaries if a valid session is already available.
- [ ] 8.4 Build current-source Android E2E APK when available, record source/APK/package/variant evidence, and run serialized existing plus Command V2 Maestro flows; record environment blockers otherwise. Local release/native preview and regression flows pass; EAS credentials, iOS, and full per-action native Command flows remain explicit environment/scope gaps.

## 9. Reconcile, publish, and close

- [x] 9.1 Update the top-level ExecPlan checkpoint, validation ledger, changed-file inventory, OpenSpec task checkboxes, and final outcomes with actual evidence.
- [x] 9.2 Reconcile `origin/main` without overwriting remote work, run final `git diff --check`, and create coherent main-only commits.
- [x] 9.3 Push `main` without force, verify local `main` equals `origin/main`, and verify the only remote branch is `main`.
- [x] 9.4 Inspect actual GitHub Actions quality/e2e runs, fix repository-caused regressions, repush, and record final run IDs/statuses.
- [x] 9.5 Mark the ExecPlan and OpenSpec change complete after the stated definition of done and all required external evidence were satisfied or explicitly blocked; the broader native per-action matrix remains an explicit documented follow-up.

Native evidence note: a current-source local release APK was built and
installed on `Nitro_API_36`. The serialized Command V2 native flow verifies
overlay opening, Create parsing, preview/no-write, and confirmation visibility;
the existing Todo/Habit/Calories/Workout persistence, Pomodoro lifecycle,
Insights, Reminder persistence, and smoke flows also pass. EAS account/token
and iOS infrastructure were unavailable, and the broader per-action native
Command mutation matrix remains a follow-up rather than being represented as
a green result.
