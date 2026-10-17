## Why

PR #78 closed the post-W17 correction, but three release-truth gaps remained: the parent recovery text still tells a new agent to resume that completed plan, no gated Calories test exercises a day above the calorie goal, and two Android persistence flows failed once each on navigation/scroll misses rather than on a durable-state assertion. This change closes those gaps without reopening W12–W17.

## What Changes

- Replace the parent Calm Momentum recovery pointer so it does not resume `frontend-v3-post-w17-correction` (Status COMPLETED, Exact next action None). Point living work at this successor while it is ACTIVE. Leave the parent ACTIVE for the unwaived audit and owner-deferred iOS.
- Add gated Playwright coverage for an over-goal day, an exactly-at-goal day, and a deletion that crosses back under the goal, with browser-local `consumed_on` and SQLite oracles. Do not restore a `Goal N` chip.
- Keep the habit editor's primary action (Create habit / Save changes) in the modal footer so it is reachable without scrolling past optional linked actions. The 2026-10-14 `habit-reminder-disable` failure never found the in-content Save changes button.
- Harden `workout-gym-v2-persistence` so a bottom-edge field tap cannot land on the centered capture button and a center-origin scroll cannot wander into the Plan sheet. Assert the typed routine name before searching for Add routine.
- Re-verify `braces` GHSA-vfj7-8cjw-p6xm and `node-forge` GHSA-86w9-cpqp-85rv. Do not waive, allowlist, or soften the audit gate.

## Capabilities

### New Capabilities

- `over-goal-day-grammar`: a day at, above, and crossing back under the calorie goal uses the W10 remaining/over title and consumed-of-goal context, with no separate goal chip.
- `habit-editor-primary-action`: the habit editor's create/save action stays in the dialog viewport.
- `successor-recovery-pointer`: present-tense recovery instructions do not send an agent to implement a completed correction.

### Modified Capabilities

- None.

## Impact

- Product: `features/habits/HabitsScreen.tsx` footer only. No schema, sync, backup, or dependency change.
- Tests: `e2e/calories-w10.spec.ts`, `e2e/habits.spec.ts`, `.maestro/flows/habit-reminder-disable.yaml`, `.maestro/flows/workout-gym-v2-persistence.yaml`.
- Plans: parent Calm Momentum recovery/checkpoint, this change's ExecPlan, and `docs/ui-ux/v3-audit/post-w17-overnight/`.
