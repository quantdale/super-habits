# Super Habits Functional Completion V1

**Status:** COMPLETED
**Exact next action:** None — terminal condition A closed 2026-09-05; full evidence in the final report below.
**Planned-From:** `76f79d90a499f3ab0e2213edd965d23393a7840c`
**Target branch:** `main`
**Campaign:** Super Habits Functional Completion V1
**Subtitle:** Correction Flows → Orphaned Capability Activation → Weekly-Review Surfacing → Planning-Surface Test Floor

---

## 0. Planner baseline (authoritative, verified 2026-09-05)

- `HEAD == origin/main == 76f79d90a499f3ab0e2213edd965d23393a7840c` (`76f79d9`), branch `main`, tree clean, single worktree, no other local/remote branches.
- Predecessor `.agent/EXECUTION_PROMPT.md` was `Status: COMPLETED` (Certification Infrastructure V2, closed `bb376bd`, final report appended in `76f79d9`). `npm run agent:plans` shows all 48 discovered plans `COMPLETED`; `agent:plan:validate:all` 48/48 PASS; `openspec:validate` 50/50 PASS. Production Hardening V1 (`harden-production-persistence-recovery-v1`) and Certification Infrastructure V2 (`certification-infrastructure-v2`) are genuinely closed with full evidence — do not reopen them. This prompt replaces the completed prompt; the V2 final report survives in Git history and `.agent/execplans/certification-infrastructure-v2.md`.
- Certification infrastructure is mature and must be **reused, not rebuilt**: `qa:repeat`, multi-AVD orchestration (`scripts/qa-native*.mjs`), auth-mock lifecycle automation, deterministic MATURE corpus (`tests/integration/fixtures/seeders.ts` `seedMature()`), J8 ceilings (`e2e/journeys/three-months-in.spec.ts`), corpus performance tripwires (`corpusPerformance.test.ts`), `web:verify` / `web:hygiene`.
- The last two campaigns were intentionally reliability/certification work and landed almost no product features (`1e1f4d0..bb376bd` touched product source only once, `app/index.tsx` FAB fix). A fresh repository-wide completion audit at this baseline found the strongest remaining evidence is **functional depth**: the data/domain layer broadly shipped full CRUD, but the UI exposes only create/read in multiple mature sections, and one flagship loop is unreachable in-app.
- Known external blockers (evaluate, never gate): iOS (no macOS/Xcode on this Windows host), disposable Supabase backend (no `SUPABASE_ACCESS_TOKEN`), internal command-parser lanes (env-gated opt-in), real-corpus migration fixtures (no anonymized real-world DB; synthetic corpus already covers the code paths).

## 1. Objective

Close the product's largest evidence-backed depth gap: users cannot **correct, edit, reorganize, or manage** substantial classes of their own data, several fully-implemented backend capabilities are unreachable from the UI, and the shipped Weekly Review loop has no in-app entry point. Deliver real correction/editing flows across Todos, Calories, Workout, and Pomodoro, surface Weekly Review per the existing disposition decision, reconcile the Linked Actions policy/engine contradiction, and raise the Planning-surface test floor so every shipped flow is proven with data oracles.

## 2. Audit evidence (planner-verified at `76f79d9`; re-verify each line in Wave 0 before implementing)

### E1 — Recurring Todo series has no management UI

- `updateTodo` accepts no recurrence fields (`features/todos/todos.data.ts:434-443`); the "Repeat daily" toggle renders only on create (`features/todos/TodosScreen.tsx:1025-1057`). Editing a recurring instance silently edits one instance; there is no stop-repeat, no edit-series-template, and delete is the only de-facto stop control (`todos.data.ts:683-703` re-spawns the next copy on completion).
- Linked Actions blocked for recurring sources with dead-end copy (`TodosScreen.tsx:1114-1117`).

### E2 — Orphaned CRUD: fully implemented data-layer functions with zero UI callers (planner grep-verified: callers are only tests)

- `savePomodoroPresets` (`features/pomodoro/pomodoro.presets.store.ts:88`) — no custom-preset authoring; the preset selector is read-only.
- `updateRoutine` (`features/workout/workout.data.ts:195`) — routines un-editable after creation; rename requires delete/recreate.
- `updateCustomExercise` (`workout.data.ts:1988`), `archiveCustomExercise` (`:2051`), archived listing (`:1934`) — custom exercises are create-only.
- `deleteWeeklyReview` (`features/weekly-review/weeklyReview.data.ts:120`, "future use" comment) — review history append-only.
- `reorderProjects` (`features/projects/projects.data.ts:214`) — no project ordering UI.
- `setPomodoroSessionMeta` supports note **and** `linkedTodoId` (`features/pomodoro/pomodoro.data.ts:230`); the UI edits notes only, at completion time (`SessionNotePrompt.tsx:27`) — past sessions can never be relabeled or relinked.
- `updateCalorieEntry` has no `consumedOn` field (`features/calories/calories.data.ts:212-221`) and the edit modal omits a date control — wrong-day entries must be deleted and retyped.
- Audit lead (confirm in Wave 0): `workout_logs` has no update/delete path at all — accidental quick-completes are permanent (per fresh audit; grep the workout data layer for the absence).

### E3 — Weekly Review loop shipped but undiscoverable

- `openWeeklyReview` has exactly one behavioral call-site: the notification-response path (`app/_layout.tsx:160-162` ← `core/notifications/notificationResponseDispatcher.ts:216`). No Overview, Planning Hub, or Settings button opens it.
- The disposition ledger (`docs/ui-ux/2026-09-01-feature-disposition-ledger.md:28`) already decided: **keep the modal; expose from Plan/Progress rather than competing with Today actions**. This is unexecuted, already-authorized product work.
- No E2E spec ever drives the Weekly Review guided flow (only the reminder-preference toggle in `settings-ripple`).

### E4 — Planning surfaces are an untested product area

- `features/planning-hub/PlanningHubScreen.tsx` mounts five views (Plan / Projects / Goals / Activity / Progress) with zero dedicated E2E specs and no journey visit.
- `features/progress/progress.data.ts` and `features/activity/activityTimeline.data.ts` SQL never executes against real SQLite (unit tests `vi.mock` the DB).
- Audit lead (confirm in Wave 0): vacuous assertions in feature specs (e.g. Workout "completes a workout" asserting text that is also present in the empty state; Habits increment asserting only name visibility while sibling tests use `habit_completions` oracles).

### E5 — Linked Actions policy contradicts the shipped engine

- Engine effects for `calorie.log` / `pomodoro.log` are implemented (`core/linked-actions/linkedActions.effects.ts:68,100`) with exactly-once integration proof (`tests/integration/linkedActionEffectsExactlyOnce.test.ts`), yet policy marks those target features/entities `engineSupport: 'deferred', authoringSupport: 'hidden'` (`core/linked-actions/linkedActions.policy.ts:108-110,119-121`), so the editor can never create rules that are already executable. Related triggers (`workout.completed`, `pomodoro.focus_completed`, `calorie.entry_logged`) are similarly deferred (`policy.ts:79-99`). Cross-feature automation is capped at todo/habit triggers by a label that misdescribes shipped capability.
- Latent transitive module cycle: `features/habits/habits.data.ts:23` → `linkedActions.engine.ts:14-17` → `linkedActions.effects.ts:11-18` → feature data layers. It resolves at call time and has caused no runtime defect — do **not** launch a cycle-elimination campaign; only avoid deepening it, and if Wave 2–5 work naturally decouples a path, do so.

### E6 — Documentation truth drift (fix opportunistically in the changed areas; not a campaign of its own)

- `README.md:142,148` claims draft kinds are "limited to `create_todo` and `create_habit`" and Ask is false by default; the code is `AI_ASK_EXPERIMENT_ENABLED = true` with 10 draft kinds (`features/command/types.ts:9-23`). Reconcile docs to code, or file an explicit product decision — do not silently change AI flags in this campaign.
- `AGENTS.md` / `docs/PROJECT_STRUCTURE_MAP.md` omit shipped areas now mounted by the shell (Quick Capture, Planning Hub, Weekly Review, `features/{goals,progress,activity,momentum,projects,weekly-review,daily-plan}`); stale "14 spec files" count; three conditional skips missing from the known-gaps register (`e2e/command.spec.ts:178`, `e2e/journeys/command-center-v2.spec.ts:209`, `e2e/calories-day-navigation.spec.ts:104`).

## 3. Scope (executor implements autonomously; planner did no implementation)

- **Wave 0 — Re-baseline.** Record Git/plan truth, hygiene, `qa:fast` + static gates; re-verify every E1–E6 citation above against the current tree and mark each CONFIRMED/CORRECTED in the ExecPlan. Confirm no new PRODUCT_BUG evidence contradicts the trusted hardening baseline.
- **Wave 1 — Contracts first (OpenSpec).** Author the change(s) at `openspec/changes/<slug>/` defining the correction contracts before UI work: series-edit semantics (this-instance vs future-instances vs whole-series), delete-then-undo posture, pomodoro session correction schema decision (soft-delete via a new append-only migration `if (version < 25)` **only if** required; otherwise an explicitly documented immutability contract with edit-metadata-only scope), workout-log correction cascade semantics, weekly-review management, filter wiring. Open one ExecPlan per substantial workstream per `.agent/PLANS.md`; a master orchestration plan is the proven shape.
- **Wave 2 — Todos correction depth.** Recurring-series management UI (stop-repeat, edit-series template for future instances, clear copy distinguishing instance vs series), decide+implement the project/goal filter dead branches (`todos.domain.ts:128-131` wired into the toolbar or removed with rationale), evaluate delete undo (Quick Capture already has undo precedent — extend or explicitly reject with recorded reasoning). Regression coverage for every semantics branch.
- **Wave 3 — Calories day-correction.** Add `consumedOn` to the update path + date control in the edit modal with correct day-total refresh, diary/form consistency, outbox and backup correctness. Cover wrong-day move including month boundaries and pre-cutover date-key rows (never rewrite legacy keys).
- **Wave 4 — Workout correction.** Routine rename/edit UI, custom-exercise edit/archive/restore UI (with `archiveCustomExercise` + archived listing activation), and — subject to Wave 1 contract — workout-log edit/delete with nested-set cascade, sync-enqueue correctness, and restore inertness. This touches the largest data file (`workout.data.ts` ≈2.6k lines): extend it in place; no greenfield rewrite.
- **Wave 5 — Pomodoro correction depth.** Custom-preset authoring wired to the existing store (`savePomodoroPresets`), post-hoc session note/relink via the existing `setPomodoroSessionMeta` contract, and the Wave-1 session-correction decision implemented with schema- and backup-validated migrations if needed.
- **Wave 6 — Weekly Review surfacing + policy honesty.** Add the in-app entry per the existing disposition (Plan/Progress surfaces, not Today competition — `docs/ui-ux/2026-09-01-feature-disposition-ledger.md:28`), wire `deleteWeeklyReview` for draft/erroneous reviews or formally retire it, and reconcile Linked Actions policy with the engine: either mark the shipped `calorie.log`/`pomodoro.log` paths authorable (with editor rows + validation + E2E proof) or record the concrete product reason they stay hidden while fixing the misleading `engineSupport` label. Recurring-source Linked Actions (E1 dead-end) closes only if the Wave-1 semantics make it safe; otherwise update the copy honestly.
- **Wave 7 — Planning-surface test floor.** E2E coverage for Planning Hub (all five views) and the Weekly Review guided flow with data oracles (no visibility-only assertions); real-SQLite contract tests for `progress.data` and `activityTimeline.data`; repair the E4 vacuous-assertion leads found in Wave 0 by aligning them to existing oracle helpers — strengthen, never weaken.
- **Wave 8 — Regression ladder.** `qa:affected` per change; unit + integration full runs; P0; Chromium; affected journeys (recurring-todo, fat-fingers, settings-ripple, workout-gym-v2, calories); corpus-backed performance for any touched hot path (Todos activation, diary read path); `web:verify`; native smoke + persistence on the existing multi-AVD automation (product UI changes make native validation mandatory); `qa:repeat` only for historically flaky changed surfaces — risk-driven, not blanket ×5.
- **Wave 9 — Adversarial verification.** Independent verifier instruction: assume the completion report is overstated; try to disprove it. Check implementation vs E-references, plan truth vs Git, artifact freshness, product invariants, E2E oracle strength, and remaining P0/P1. Fix actionable failures and re-verify.
- **Wave 10 — Residual P0/P1 sweep + docs truth.** Re-grep orphaned exported data functions (the E2 pattern may recur), reconcile E6 docs in touched areas, register any new skips in known-gaps, and confirm externals stay `EXTERNAL BLOCKER`/`NOT RUN`, never success.

## 4. Non-goals

- No Production Hardening V3, Certification Infrastructure V3, generic performance, repetition-framework, or test-count campaigns — those programs are closed with strong evidence.
- No two-way sync / pull adapter, no persistence-stack rewrite, no state-management framework swap, no new top-level section, no second Gym state.
- No editing of past migration blocks; schema growth is append-only (`if (version < 25) { ... }`); `schema.sql` stays a reference snapshot.
- No cycle-elimination campaign (E5 rationale), no workout.data.ts split by size alone, no AI/Ask product-flag changes (docs reconcile or explicit decision only).
- No weakened assertions, blind retries, sleeps, added skips, or `data-testid` injections to satisfy tests.
- No production Supabase use, no real personal data in fixtures, no destructive user-data resets.
- Do not rewrite historical campaign logs; reconcile current-facing docs only.

## 5. Invariants (non-negotiable, unchanged)

Soft-delete only for main entities (documented `habit_completions` / `saved_meals` exceptions stay); every applicable write through `runSyncedMutation`/`runBackupMutation` + durable outbox enqueue from `*.data.ts` only; `getDatabase()` singleton; IDs via `createId(prefix)`; date keys via `toDateKey()`; no `getDatabase` in screens/domain; no feature import of `linkedActions.effects`/`linkedActionsTargetProviders`; single-page shell (`app/index.tsx` + `NavigationContext.activeSection`, Settings modal, Command overlay) — Weekly Review surfaces as a modal entered from Plan/Progress, never a seventh tab; Today-first hierarchy and one global Add entry; COOP/COEP preserved. New flows must preserve backup-scope membership for edited entities (all touched entities are already in the 21-table recoverable scope).

## 6. Product guardrails (verified current before encoding)

Today-first information hierarchy; six direct top-level sections; one global Add (Quick Capture) with advanced capture behind `Describe it`; no duplicate global FAB; SQLite/local-first source of truth; safe owner binding; mature Gym semantics; current input/modal determinism contracts; FINITE-vs-SERVICE server-lifecycle safety. Corrective flows add secondary affordances within existing surfaces — they never restructure the information hierarchy.

## 7. Operating rules

1. **Root-cause-first:** DISCOVER → DIAGNOSE → IMPLEMENT → TEST → VERIFY. No symptom patches.
2. **No retry-as-fix**, no weakened assertions, no sleep-injection.
3. **Process safety:** persistent services need ownership, readiness, bounded purpose, cleanup; never broadly kill processes; end with `web:hygiene` PASS and no owned emulator/mock left booted.
4. **Durable state:** update each ExecPlan `Current Checkpoint` at every milestone/decision/failure; after compaction run `npm run agent:resume -- --plan <path>`, inspect Git, reconcile, resume from `Exact next action`. Chat history is never task state.
5. **Commit/push loop:** coherent commits per scope (`feat(...)`, `fix(...)`, `test(...)`, `docs(agent): ...`), normal push, no force-push, never one giant end-of-campaign commit; final tree clean and `HEAD == origin/main`.
6. **Priority preemption:** proven P0/P1 (data loss/corruption, crash, owner breach) preempts the wave sequence.
7. **Native:** product-UI changes require the native lane on existing multi-AVD automation with canonical provenance; unavailable targets are `ENVIRONMENT`, never pass.

## 8. Validation battery (risk-adjusted)

`git diff --check`, typecheck, lint, unit, integration, OpenSpec, `agent:plan:validate:all`, `qa:impact:validate`, themes, Supabase schema validation, `qa:timezones` (date-key semantics in Waves 3/5), fresh `build:web`, `web:verify`, `web:hygiene`, Chromium, P0, affected journeys, full journeys before close, deterministic simulation (add scenarios for new correction flows), sync lane where remote-visible writes change, corpus performance where hot paths are touched, native smoke + persistence (product UI changed), adversarial verification.

## 9. Terminal conditions (stop only when)

- **A:** Waves 1–7 landed with contract specs, implementations, and oracle-grade tests; correction flows for E1/E2/E3 exist end-to-end with proof; Wave 8 ladder green on final tree; adversarial verification PASS; E6 docs reconciled in touched areas; OR
- **B:** remaining meaningful work is externally blocked and all worthwhile local work is exhausted; OR
- **C:** further changes would be speculative with no demonstrated defect.

Invalid stops: one green suite, implementation without its E2E/journey oracle, native skipped though product UI changed, orphaned function "activated" without UI proof, or elapsed hours.

## 10. Final report structure (append as `## Final report (campaign COMPLETED <date>)`)

Baseline SHA → closure commits by scope; per-wave evidence table (E-reference → flow shipped → tests → proof); contract decisions (series semantics, pomodoro session decision, log-correction decision, policy reconciliation outcome); validation battery table (command/outcome/date); native certification table (device/APK/tag/count/artifacts); failure classifications with artifacts; plan/OpenSpec lifecycle states; docs reconciled; residual blockers; exact next action.

---

## Final report (campaign COMPLETED 2026-09-05)

### Baseline → closure commits

Baseline `76f79d9` → closure chain on `main` (each pushed): `192e496` (plan), `3e05490` (Wave 0 truth/gates), `62356b5` (Wave 1 OpenSpec contracts), `0065ae9` (Wave 2 Todos series), `de9632e` (Wave 3 Calories day move), `29aacba` (Wave 4 Workout correction), `14ca4ad` (Wave 5 Pomodoro correction), `21b20e4` (Wave 6 Weekly Review + Linked Actions), `73c26cd` (Wave 7 planning test floor), `bf6fd8d` (Wave 8 ladder evidence), `6b596f2` (Wave 9 adversarial repairs), `c949458` (Wave 10 docs truth + projects reorder), plus this closure commit. `HEAD == origin/main` at close.

### Per-wave evidence (E-reference → flow → tests → proof)

| E   | Flow shipped                                                                            | Tests                                                                   | Proof                                                         |
| --- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------- |
| E1  | Recurring-series edit/complete-future/pause (Todos editor)                              | 6 unit + 3 integration + E2E                                            | todos spec 9/9; series row/intent oracles                     |
| E2  | Last orphan `reorderProjects` activated (Projects manual order) + all prior activations | domain unit + real-SQL integration + hub journey                        | `projects-manual-reorder` spec; row/intent/restart oracles    |
| E3  | Weekly Review entry on Progress + durable history delete                                | executor +3 tests + `weekly-review.spec.ts`                             | guided flow → oracle → delete coalesced-intent oracle         |
| E4  | Planning surfaces proven with real SQL                                                  | `progressData` 3 + `activityTimelineData` 3 + `planning-hub` 3 journeys | exact window matrices, row + outbox + restart oracles         |
| E5  | Linked Actions policy ↔ engine parity; log targets authorable                           | policy 4 + `linkedActionLogTargets` 3 + 2 E2E                           | author→fire→effect for pomodoro/calorie paths                 |
| E6  | README/AGENTS/known-gaps/structure docs truth                                           | —                                                                       | draft-kind list, Ask gating, dynamic inventories, skips 12–14 |
| —   | Calories day correction                                                                 | 3 integration + 5 E2E                                                   | post-reload row oracle (W9-3)                                 |
| —   | Workout rename / custom-exercise manager / log delete                                   | 4 integration + 3 E2E                                                   | cascade = one durable delete intent per removed row           |
| —   | Pomodoro preset manager + session meta correction                                       | 3 integration + 2 E2E                                                   | app_meta + single coalesced update-intent oracles             |

### Contract decisions

- Series semantics: editing a recurring todo edits the template; "complete/adjust future" re-materializes instances forward; two-phase save surfaces template-update failure with a retry message (W9-1).
- Pomodoro session decision: metadata-only correction (`setPomodoroSessionMeta`, undefined=keep/null=clear), no migration, no duration rewrite.
- Log-correction decision: completed workout-log tables have no `deleted_at` — corrections use the documented hard-delete exception with one durable delete intent per removed row (design D3 amendment); delete of an already-absent row is a no-op (W9-2).
- Policy reconciliation: `LINKED_ACTION_SUPPORTED_RULE_PATHS` is the single execution gate (D6 premise corrected by audit); only emitted triggers are authorable; drift guarded by `tests/linkedActionsPolicy.test.ts`.

### Validation battery (final tree `c949458`, 2026-09-05)

| Command                                                           | Outcome                                                                                                                                                                                                                                                                                                                                                         |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run typecheck` / `npm run lint -- --max-warnings 0`          | PASS 0/0                                                                                                                                                                                                                                                                                                                                                        |
| `npx vitest run`                                                  | PASS 1977/1977 (185 files, both projects)                                                                                                                                                                                                                                                                                                                       |
| `npm run openspec:validate`                                       | PASS (all specs incl. `projects-manual-reorder`)                                                                                                                                                                                                                                                                                                                |
| `npm run agent:plan:validate:all`                                 | PASS                                                                                                                                                                                                                                                                                                                                                            |
| `npx playwright test --project=chromium e2e/planning-hub.spec.ts` | PASS 3/3                                                                                                                                                                                                                                                                                                                                                        |
| Full `npm run e2e` battery (chromium+journeys+simulation+pwa) ×2  | 206 passed / 43 skipped / 1 documented flake / 0 product failures — J8 15%-headroom floor at 692/697 ms under battery load (known-gaps 15); the 800 ms ceiling never breached; same test passes standalone on the final tree at 646 ms (19.3% headroom, 7/7 incl. the 4 aborted successors); product diff vs last green battery touches no mounted section code |
| `sim:run --mode deterministic` (owned :8081 server)               | PASS 23/23                                                                                                                                                                                                                                                                                                                                                      |
| `npm run web:verify` / `npm run web:hygiene`                      | PASS / 8081+8082 FREE                                                                                                                                                                                                                                                                                                                                           |
| `qa:repeat --suite p0 --times 3`                                  | PASS 3/3 (Wave 8)                                                                                                                                                                                                                                                                                                                                               |

### Native certification (owned Nitro_API_36, credential-free canonical APK)

| Source                        | Tag                       | Result      | Artifact                                                             |
| ----------------------------- | ------------------------- | ----------- | -------------------------------------------------------------------- |
| `73c26cd` (SHA 3C03C258…7908) | smoke / persistence 11/11 | PASS / PASS | `…064222041Z` / `…065339570Z`                                        |
| `c949458` (rebuilt final)     | smoke                     | PASS        | `native-android-smoke-Nitro_API_36-2026-09-05T072915791Z.json`       |
| `c949458` (rebuilt final)     | persistence               | PASS        | `native-android-persistence-Nitro_API_36-2026-09-05T074043358Z.json` |

Emulators owned, stopped, no leaks; no production credentials used.

### Failure classifications (all preserved, none weakened)

- PRODUCT_BUG ×2: modal-layer stacking made Progress→Weekly Review unclickable (fixed in `openWeeklyReview`, Wave 6); recurring-template save failure was swallowed (fixed Wave 9 repair W9-1).
- TEST_BUG ×6 fixed in-flight: Playwright strict-mode collisions (`.first()`/`exact`), habit creation-date write gate, `rule_history` NOT NULL, orphan-vs-soft-deleted label semantics, weekend-dependent gym-v2 selector (scoped, assertion preserved).
- ENVIRONMENT: raw `sim:run` without an owned static server (by design — helper added); bare native run without `--avd` correctly refuses.
- Expected skips: 43 pre-existing @sync/internal-parser/capability gates, now all registered in `docs/testing/known-gaps.md` (entries 12–14 added).
- FLAKY_TEST ×1 (documented, artifacts preserved in `.cursor/playwright-output/e2e-failures/three-months-in-P2-…`): J8 headroom floor 692/697 ms in-battery vs 646 ms standalone on the identical final tree; zero mounted-section perf diff vs the last green battery; registered as known-gap 15 with a re-verify-before-touching-product rule. Assertion unchanged.

### Plan / OpenSpec lifecycle

`.agent/EXECUTION_PROMPT.md` ACTIVE → COMPLETED; `.agent/execplans/functional-completion-v1.md` ACTIVE → COMPLETED (validator PASS). OpenSpec change `complete-product-correction-flows-v1` — 7 specs (6 correction-flow + `projects-manual-reorder`), tasks fully checked, validate green; archive follows the repo's normal openspec workflow.

### Docs reconciled

`README.md` (draft kinds, Ask gating), `AGENTS.md` (dynamic E2E inventory, `ppre` prefix), `docs/testing/known-gaps.md` (12–14), design D3/D6 amendments, integration-helper comment fix.

### Residual blockers (externals, evaluated never gating)

iOS device lane (no macOS host), disposable Supabase backend (`SUPABASE_ACCESS_TOKEN`), internal-parser live lanes, real-corpus fixtures; `e2e:sync` remains the opt-in CI main/nightly remote-boundary lane.

### Exact next action

None — campaign closed. `HEAD == origin/main`, tree clean, ports free, no owned processes.
