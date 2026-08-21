# Tasks — Harden UI/UX Mass Implementation Wave V1

Do not check items without evidence. This campaign owns the post-`6dd41bb` hardening and reconciliation of the older ACTIVE hardening plan.

## 0. Repository and plan reconciliation

- [ ] 0.1 Fetch/prune latest origin/main; record exact start SHA and confirm remote main-only.
- [ ] 0.2 Read all `docs/ui-ux/**`, this change, and `openspec/changes/harden-parallel-completion-wave-v2/**`.
- [ ] 0.3 Run `npm run agent:plans`; reconcile the older ACTIVE hardening plan against current code/evidence.
- [ ] 0.4 Confirm authoritative SQLite migration head is 21 or later; new migration numbers use the next free version.
- [ ] 0.5 Inspect current working tree, local branches/worktrees/stashes, conflict markers, and prior hardening evidence before edits.

## 1. Fresh full regression baseline

- [ ] 1.1 Typecheck and lint.
- [ ] 1.2 Full Vitest/unit/integration suite.
- [ ] 1.3 OpenSpec and ExecPlan validation.
- [ ] 1.4 Build web and run focused smoke over all changed product surfaces.
- [ ] 1.5 Classify every failure as PRODUCT_BUG, TEST_DRIFT, FLAKY, ENVIRONMENT, or SPEC_AMBIGUITY.

## 2. Todo hardening

- [ ] 2.1 Verify inline quick capture, filter disclosure, bulk mode, overflow menu, swipe alternatives, delete confirmation, and completion settle behavior.
- [ ] 2.2 Update stale E2E selectors only after confirming intended product behavior.
- [ ] 2.3 Prove keyboard/screen-reader access to non-gesture equivalents and destructive confirmations.
- [ ] 2.4 Ensure no regression to canonical Todo mutation, recurrence, Daily Plan pruning, Linked Actions, reminders, or owner/sync semantics.

## 3. Habit hardening

- [ ] 3.1 Verify summary ring, quantitative steppers, detail/edit/reminder flows, day strip, lifecycle visibility, and neutral missed-day behavior.
- [ ] 3.2 Enforce historical check-in eligibility at the data/domain boundary using schedule + lifecycle history; UI checks alone are insufficient.
- [ ] 3.3 Prove paused/archived/not-yet-effective dates cannot receive invalid check-ins while legitimate historical edits remain possible.
- [ ] 3.4 Recheck Overview/Planning/Progress/Command/reminder exclusion rules for inactive habits.

## 4. Focus/Pomodoro hardening

- [ ] 4.1 Verify resting, active reduced-chrome, pause/resume/end/abandon, presets, linked task, notes, completion summary, and sprout/reduced-motion behavior.
- [ ] 4.2 Reproduce crash/reload recovery paths; recovered completion must log exactly once and reach coherent completion UX.
- [ ] 4.3 Prove no duplicate/lost session and correct timer/session state across background/foreground/reload.
- [ ] 4.4 Preserve durable session metadata, Backup Scope V5, and historical linked-title semantics.

## 5. Workout hardening

- [ ] 5.1 Verify routine landing, resume/start hero, set entry, previous-performance captions, PR banner, rest timer, volume/history, and session summary.
- [ ] 5.2 Reproduce resumed draft behavior and persist all meaningful in-progress measurement state required for faithful resume.
- [ ] 5.3 Ensure resumed sessions never fabricate completed sets, zero measurements, PRs, volume, or duration.
- [ ] 5.4 Validate persistence/recovery across app background, reload/restart, normal finish, and abandon.

## 6. Calories hardening

- [ ] 6.1 Verify neutral over-target treatment, top summary, frequent foods, quick kcal, saved meals, copy-day, target modal, diary navigation, and trends.
- [ ] 6.2 Audit Quick Add kcal path: one-off logging must not mutate saved-meal catalog/use counts unless explicitly intended.
- [ ] 6.3 Split quick-log and saved-meal mutation semantics if required.
- [ ] 6.4 Re-run local-day rollover/DST/date-navigation/copy-day correctness.

## 7. Today / Overview / onboarding hardening

- [ ] 7.1 Verify deterministic Next Best Action and explanation rules across zero/low/full-data states.
- [ ] 7.2 Verify pinned Today orientation cannot be removed by card customization.
- [ ] 7.3 Verify first-run onboarding reaches a useful action quickly and remains dismissible/non-blocking.
- [ ] 7.4 Verify daily progress strip and all Today summaries use authoritative current-day semantics and inactive-habit exclusions.
- [ ] 7.5 Verify responsive and large-text layouts do not hide primary actions.

## 8. Planning / goals / projects / progress hardening

- [ ] 8.1 Verify guided five-step Planning flow, simple-view preference, carry-over review, commitment selection, top-three priorities, focus target/intention, and confirmation save semantics.
- [ ] 8.2 Validate `daily_plans.top_todo_titles` alignment with `top_todo_ids`, pre-v21 fallback, rename/delete history, malformed JSON handling, restore/import, and backup canonicalization.
- [ ] 8.3 Verify Goal/Project next-action/rollup/horizon/text-progress behavior against actual DB data.
- [ ] 8.4 Verify Progress narratives and heatmap accessibility labels do not overstate sparse/legacy data.
- [ ] 8.5 Verify Weekly Review continuity remains idempotent after the UI wave.

## 9. Design system / shell / accessibility

- [ ] 9.1 Audit new non-color tokens and eliminate accidental duplicated/arbitrary local values in changed surfaces where practical.
- [ ] 9.2 Verify Button loading, IconButton feedback, ProgressBar, MenuSheet, SkeletonBlock, Screen width/padding, and semantic motion across light/dark/system themes.
- [ ] 9.3 Verify reduced-motion preference affects all newly introduced meaningful animations with equivalent feedback.
- [ ] 9.4 Verify visible web keyboard focus, 44–48pt touch targets, screen-reader labels/roles/states, non-color cues, and large-text resilience.
- [ ] 9.5 Verify compact phone, tablet, and web layouts around the 720px content cap.

## 10. E2E and simulation repair

- [ ] 10.1 Update Todo delete/filter/bulk/menu journeys to the intended new interaction model.
- [ ] 10.2 Update Pomodoro preset/completion/reset/abandon selectors only where contract drift is intentional.
- [ ] 10.3 Update Planning/Goal/Project labels such as `Linked Tasks` -> `Next up` only after confirming product intent.
- [ ] 10.4 Preserve semantic IDs and prefer role/label/test-id selectors over brittle text/layout selectors.
- [ ] 10.5 Add/repair focused E2E for newly introduced UI states rather than reducing assertions.
- [ ] 10.6 Full journeys + deterministic simulation pass with zero unclassified failures.

## 11. Backup / Portable / migration contract

- [ ] 11.1 Reconcile current Backup Scope V5, Portable versions, settings version, migration 20, and migration 21 against current canonical columns.
- [ ] 11.2 Ensure `top_todo_titles` is included/excluded consistently according to intended recoverability and historical scope rules.
- [ ] 11.3 Preserve all documented historical backup/portable formats without retroactively changing checksum meaning.
- [ ] 11.4 Run corruption/version/restore/owner-isolation coverage.

## 12. Live Supabase convergence — blocking

- [ ] 12.1 Snapshot live migration ledger, row counts, owners/null/orphans, RLS, policies, grants, FKs, and indexes.
- [ ] 12.2 Review pending repository migrations `20260821000000`, `20260821010000`, and `20260822000000` against live production before apply.
- [ ] 12.3 Apply required pending migrations in order when authorized live access is available.
- [ ] 12.4 Verify migration ledger and exact new tables/columns after apply.
- [ ] 12.5 Verify existing production row counts/owners preserved and RLS/grants remain safe.
- [ ] 12.6 Run `supabase:schema:validate`, remote-boundary mocks, and dist-sync E2E against the converged schema.
- [ ] 12.7 Run Supabase security/performance advisors and classify new findings.

## 13. Command / notification / platform regression

- [ ] 13.1 Re-verify remote Command parser parity and deployed Edge Function state from prior hardening.
- [ ] 13.2 Re-verify Todo mark-done/snooze exactly-once notification actions and scheduler reconciliation.
- [ ] 13.3 Verify PWA waiting-worker update, connectivity indicator, offline behavior, and no reload loop.
- [ ] 13.4 Verify notification/PWA/UI changes do not create duplicate listeners or stale state after remount.

## 14. Full final validation

- [ ] 14.1 `npm run typecheck` PASS.
- [ ] 14.2 `npm run lint` PASS under repository warning policy.
- [ ] 14.3 Full Vitest/integration PASS.
- [ ] 14.4 Timezone matrix PASS.
- [ ] 14.5 `npm run openspec:validate` PASS.
- [ ] 14.6 `npm run agent:plan:validate:all` PASS.
- [ ] 14.7 `npm run supabase:schema:validate` PASS.
- [ ] 14.8 `npm run build:web` PASS.
- [ ] 14.9 Full Playwright main/journeys/PWA PASS.
- [ ] 14.10 dist-sync / `e2e:sync` PASS.
- [ ] 14.11 deterministic simulation PASS.
- [ ] 14.12 Native Android/iOS validation PASS when environment available; otherwise record precise ENVIRONMENT evidence.

## 15. Plan reconciliation and closure

- [ ] 15.1 Reconcile `harden-parallel-completion-wave-v2` tasks/ExecPlan to actual current evidence; do not leave stale pre-wave checkpoint text.
- [ ] 15.2 Mark the older plan COMPLETED only if all non-environment requirements are genuinely satisfied; otherwise leave ACTIVE/BLOCKED with exact next action.
- [ ] 15.3 Reconcile this change tasks/ExecPlan to evidence.
- [ ] 15.4 Commit all accepted fixes to main; working tree clean; local main == origin/main; remote main-only.
- [ ] 15.5 Exact final pushed SHA has GitHub Actions `quality` PASS.
- [ ] 15.6 Exact final pushed SHA has GitHub Actions `e2e` PASS.
- [ ] 15.7 Do not create a later bookkeeping commit that invalidates exact-SHA evidence merely to record the run ID.
