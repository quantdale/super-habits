## 1. Audit and contract

- [x] 1.1 Record the V1 response lifecycle, Expo action API, navigation readiness boundary, Habit mutation/Linked Actions path, native harness, dirty-file overlap, and final V2 decisions in the ExecPlan.
- [x] 1.2 Validate the OpenSpec artifacts and keep this task-specific Plan-Version 2 ExecPlan resumable.

## 2. Metadata, category, and dispatch

- [x] 2.1 Add stable Habit Reminder category/actions and normal/snoozed occurrence metadata/identities in the existing notification wrapper.
- [x] 2.2 Centralize listener and cold-start response classification/dispatch; safely ignore unknown/Pomodoro responses and clear handled startup responses.
- [x] 2.3 Add exact-habit navigation state with one-shot pending focus and safe missing/deleted fallback through the existing Habits edit interaction.

## 3. Durable completion/idempotency

- [x] 3.1 Add local-only append-only SQLite migration 13 and bounded processed-action claim/cleanup helpers.
- [x] 3.2 Implement notification Mark complete with current-date/schedule/active/target validation, one canonical increment, deterministic Linked Action event replay, and targeted reminder cancellation/reconciliation.
- [x] 3.3 Cover target-one, partial target, already complete, stale date, schedule edit race, deletion race, duplicate/concurrent/restart replay, and linked effect exactly-once behavior.

## 4. Snooze and reconciliation

- [x] 4.1 Implement fixed 15-minute same-day snooze with durable repair, one deterministic replacement, no configuration mutation, and duplicate protection.
- [x] 4.2 Preserve valid snoozes in V1 reconciliation and cancel them on completion, deletion, unscheduling, stale date, permission loss, or midnight crossing.
- [x] 4.3 Cover duplicate snooze, completion-before-fire, deleted/unscheduled/disabled, midnight, two-habit isolation, and normal reminder persistence.

## 5. Simulation, native, and regression QA

- [x] 5.1 Extend deterministic simulation minimally for Mark complete replay/threshold cancellation and one-replacement snooze.
- [x] 5.2 Add same-path test-only response injection/native probes and Maestro flows for exact tap, Mark complete, replay, cold start, and Snooze.
- [x] 5.3 Run affected fast/integration/timezone/journey/simulation/sync/OpenSpec/impact gates and V1/Pomodoro regressions.
- [x] 5.4 Run Android native smoke/targeted/lifecycle/action probes, classify iOS/visual limitations honestly, and preserve reports.

## 6. Closure

- [x] 6.1 Update QA/known-gap documentation, mark tasks complete only with evidence, validate the COMPLETED ExecPlan, and report exact verdicts/limitations.
