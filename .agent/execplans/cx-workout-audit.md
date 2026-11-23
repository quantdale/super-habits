# ExecPlan for the Workout adversarial review

Plan-Version: 2
Status: COMPLETED

## Purpose / User Outcome

Find and verify user-visible Workout integrity problems. Prove each fix with a regression test that fails on the original code and passes after the fix.

## Context

The driver brief is /workspace/pi-sessions/cx/cx1-workout.brief. Work on rv/cx-workout in /workspace/wt-cx-workout. Guided recovery uses SQLite app metadata. History feeds Activity, Progress, rewards, and shared backup validation.

## Scope

Workout routines, sessions, recorded sets, rest, history, Activity and Progress contributions, and portable/cloud backup compatibility.

## Non-Goals

Remote services, schema redesign, other worktrees, publishing changes, and speculative fixes.

## Current Checkpoint

- Current milestone: Complete.
- Completed: Reproduced, verified, and committed all four groups. The exercise-history browser regression now shows both sets under one catalog identity.
- In progress: None.
- Important modified files: The Workout session, progress and data paths, Overview workout aggregation, shared backup validation, and their regressions.
- Last successful validation: Full Vitest, focused Chromium and journey checks, deterministic fitness simulation, and web server hygiene.
- Current failures: None against verified changes.
- Relevant quarantines: None.
- Blockers: Native smoke preflight requires Maestro. Hosted Supabase is outside the brief.
- Exact next action: None — task complete.
- Remaining definition of done: Complete. Native gates remain blocked by the environment. The broader release suite and hosted sync lanes were outside this audit's executed checks.

## Progress

- [x] Read startup guidance and confirm worktree.
- [x] Audit and reproduce defects.
- [x] Verify and commit confirmed fixes.
- [x] Validate plan and hand off evidence.

## Surprises & Discoveries

- A failed 23:55 finish retried at 00:05 originally stamped both ended_at and completed_at at 00:05. Activity and Progress both use completed_at.
- A timed set entered as 3 seconds with a 2-second target originally stored 2 seconds at automatic completion.
- The initial body-weight writer and its current create/edit paths enforce 1,000. Portable validation originally accepted a checksummed 1,001 lb row.
- Today grouped logs by creation time and looked up the live routine name, even when the log retained a completion time and name snapshot.
- A rest draft saved above the prescribed length resumed at the prescription rather than its saved remaining time.
- Exercise progress selection used recorded labels while personal records used catalog identity. The baseline browser rendered only the newer recorded name's session and set. The fix joins both sets by the same catalog identity and presents the latest recorded label.

## Decision Log

- Use real SQLite for persistence and shared backup contracts and focused Playwright for browser-only behavior.
- Keep the assigned base. origin/main advanced independently after the first turn and has no new Workout implementation changes.
- Existing pending-save records lack an end timestamp. Their first save attempt continues to supply one. New records preserve the time the summary was reached.
- Delayed-save XP still runs on the reward day computed by the reward provider. Changing past-day quest and streak credit requires a product decision.

## Validation Ledger

- Initial worktree status showed rv/cx-workout clean at 05bc7730.
- Baseline build passed with a hermetic export. Playwright regressions returned wrong timestamps and wrong measured duration. Portable integration returned ready for 1,001 lb. Raw output is in /tmp/cx-workout-e2e-red.log, /tmp/cx-workout-timer-red.log, and /tmp/cx-workout-backup-red.log.
- Overview unit regressions originally returned the save day and live routine name. Rest Playwright regression originally rendered 01:30 after saving 01:59. See /tmp/cx-workout-overview-red.log and /tmp/cx-workout-rest-red.log.
- Post-fix, portable and cloud-restore integration passed 41 tests, Workout/Activity/Progress integration passed 53, Overview and Workout data unit passed 40, and finish celebration Chromium passed 5. npm run qa:timezones passed 5 zones. npm run qa:native:smoke stopped at preflight because Maestro is unavailable.
- Commits 0d06a8be and a7a0cde4 ran the pre-commit hook. The completion commit includes a source assertion for routing Finish through the existing summary and save button.
- npm run test:integration passed 976 tests with 2 existing skips. Native smoke, persistence, lifecycle, and iOS smoke all stopped at the same missing-Maestro preflight.
- The timer-duration Chromium assertion passed in the larger run. The post-fix rest snapshot renders the saved 1:59. The original rest snapshot renders 1:30. A test formatting correction removes only the minute padding from the expected display string.
- The new Overview assertions pass in all five timezone lanes. npm run sim:validate passed 23 scenario definitions.
- Chromium ran 36 cases across finish celebration, Gym V2, W9 and write-failure specs. The 35 other cases passed, and the corrected W9 rest assertion then passed separately. The original and corrected outputs are in /tmp/cx-workout-final-e2e.log and /tmp/cx-workout-rest-green.log.
- On the original progress code, Chromium rendered 1 session, 1 performed set, and only 20 × 8 after a rename. See /tmp/cx-workout-identity-red.log and the corresponding Playwright trace.
- The final hermetic Chromium run passed six cases, including all three guided-session regressions, both strength/reload controls, and the renamed-exercise history regression. See /tmp/cx-workout-regressions-green.log.
- The final npm run qa:fast passed typecheck, lint, 4,531 unit tests and all guard scripts. Final npm run test:integration passed 976 tests with 2 existing skips.
- `npm test` passed 5,507 tests with 2 existing skips.
- `E2E_PORT=8141 flock /tmp/sh-heavy.lock /workspace/pi-sessions/memwait.sh npm run build:e2e` passed. The build reported zero Supabase hosts.
- `E2E_PORT=8141 flock /tmp/sh-heavy.lock /workspace/pi-sessions/memwait.sh npx playwright test --project=chromium e2e/workout-{finish-celebration,gym-v2,w9,progress-identity}.spec.ts -g 'keeps its original completion day|keeps the entered duration|keeps rest time|exercise progress includes|runs a guided strength set|resumes an interrupted guided session'` passed 6 cases.
- `E2E_PORT=8141 flock /tmp/sh-heavy.lock /workspace/pi-sessions/memwait.sh npx playwright test --project=journeys e2e/journeys/fat-fingers.spec.ts` passed all 13 steps, including abandoning a workout without writing a log.
- `E2E_PORT=8141 flock /tmp/sh-heavy.lock /workspace/pi-sessions/memwait.sh npm run qa:simulation -- --scenario command-v2-fitness-tracker --mode deterministic` passed 1 scenario and 5 steps.
- `npm run web:hygiene -- 8081 8082 8141` passed with all three ports free.

## Changed Files / Areas

- core/backup/backupValidators.ts and tests/integration/portableExportImport.test.ts enforce the body-weight writer ceiling.
- features/workout/WorkoutSessionScreen.tsx, features/workout/WorkoutScreen.tsx and features/workout/workout.data.ts retain completion timestamps and guided timer state.
- features/overview/overview.domain.ts uses the completion timestamp and routine snapshot. tests/overview.test.ts covers both.
- features/workout/WorkoutGymPanels.tsx and features/workout/workout.domain.ts share the same identity for personal records and history.
- e2e/workout-finish-celebration.spec.ts, e2e/workout-gym-v2.spec.ts, e2e/workout-w9.spec.ts, and e2e/workout-progress-identity.spec.ts cover browser behavior.
- tests/integration/workoutRecoveryIdentity.test.ts and tests/workoutSessionContrast.test.ts cover recovered timestamps and the existing summary pathway.
- .agent/execplans/cx-workout-audit.md records checkpoint and verification.

## Recovery / Resume Instructions

Read AGENTS.md, .agent/PLANS.md, this plan, and the driver brief. Inspect status, diff, commits and evidence. Run npm run agent:resume with this plan and follow Exact next action.

## Outcomes & Retrospective

- Status: Complete. Each defect group has a local commit with an active pre-commit hook.
- Summary: Late saves retain the original completion day, and Today uses the recorded time and routine name. Timer expiry preserves the entered duration, resumed rest retains the extension, and renamed exercise history stays together. The shared restore validator enforces the writer's body-weight ceiling.
- Product decision: Delayed saves still earn XP on the day of the save. Backdating XP may affect daily quests, streak freezes and badges.
- Unconfirmed leads: A hard reload immediately after a rest adjustment may occur before the next draft checkpoint. A weight preference change between start and resume may reinterpret raw draft values. History sorts tied exercise snapshot timestamps by generated ID, so recovering performed order for old ties would require additional provenance.
