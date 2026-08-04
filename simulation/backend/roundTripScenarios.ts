/**
 * Backend round-trip scenario set — DISPOSABLE-BACKEND LANE ONLY (task 8.5).
 *
 * These scenarios validate the real sync / restore / edge-function contracts
 * against a throwaway Supabase project (design D8). They are authored with the
 * model builders (`simulation/model/builders.ts`) and the semantic step
 * catalog (`simulation/model/steps.ts`), and are tagged `lane:disposable`.
 *
 * NOT EXECUTABLE IN THIS ENVIRONMENT: they require the disposable project the
 * guarded CI job provisions (`simulation/backend/provision.ts` + the
 * `dist-live/` build). The runner that resolves them is the disposable-lane
 * wiring (tasks 3.1/3.2/9.2); when it runs, it MUST verify every step from
 * BOTH sides:
 *   - local SQLite rows — via the `rows`/`outbox` oracles here, and
 *   - remote table contents — via the Supabase client, per the `[remote]`
 *     assertions in each step's `note`. (The model's `Oracle` type only
 *     expresses local SQL today; the remote assertions are the real contract
 *     checks and live in the notes by design. A future catalog extension —
 *     e.g. a non-mutating `httpCall`/`remoteRows` step — should absorb them.)
 *
 * Model-validator compatibility: `validateSimulationModel` requires every
 * mutating step (apiLeg included) to carry a persisted-row or second-surface
 * oracle. The edge-function-contract scenario makes NO local writes, so its
 * apiLeg steps carry placeholder `rows` oracles asserting local state is
 * unchanged (the negative evidence); the real HTTP-response assertions are in
 * the notes.
 */

import { defineModel, definePersona, defineScenario } from '../model/builders';
import type { SimulationModel } from '../model/types';

/** Explicit disposable-lane marker; also referenced by the lane matrix (task 9.1). */
export const DISPOSABLE_LANE_TAG = 'lane:disposable';

/**
 * Prefix for the runner contract notes that assert against the REMOTE tables
 * via the Supabase client. Every local `rows` oracle below has a paired
 * remote assertion of this form.
 */
export const REMOTE_VERIFY =
  '[remote] Disposable-lane runner: after this step, query the remote table via the Supabase client ' +
  '(supabase.from(<table>).select("*")) and assert it agrees with the local rows oracle. ' +
  'App and remote must describe the same truth — a green UI over a divergent remote is a failed step.';

/**
 * The persona all backend round-trips use: a deterministic, mistake-free
 * operator; the backend lane is not about human realism (design D10).
 */
export const backendProbePersona = definePersona({
  id: 'backend-probe',
  name: 'Backend Probe (System)',
  description:
    'A deterministic headless operator that exercises the sync engine, restore coordinator, and edge function through the real data layer (design D9). No mistakes, no variability.',
  goals: [
    'prove SQLite rows reach the disposable Supabase project byte-for-byte',
    'prove restore imports exactly the restorable entities and nothing else',
    'prove the parse-ai-command contract on the deployed function',
  ],
  traits: ['system', 'disposable-lane'],
});

/* ------------------------------------------------------------------------ */
/* Scenario 1 — sync upsert round trip                                       */
/* ------------------------------------------------------------------------ */

export const syncUpsertRoundTrip = defineScenario({
  id: 'backend-sync-upsert-round-trip',
  personaId: 'backend-probe',
  goal: 'Every synced entity written locally reaches the disposable remote exactly once, and a re-flush is idempotent.',
  fixture: 'SMALL',
  mode: 'deterministic',
  tags: [DISPOSABLE_LANE_TAG],
  description:
    'Write one row per synced entity through the real data layer, flush, then flush again. Proves upsert-on-id conflict (no duplicates), full-column fidelity, and idempotency.',
  steps: [
    {
      kind: 'apiLeg',
      functionName: 'data:todos/addTodo',
      args: { title: 'Upsert probe todo', priority: 'urgent' },
      note:
        'LOCAL oracle: exactly one todo row. ' +
        `${REMOTE_VERIFY} Remote todos must contain this row after the flush with identical column values (id/text keys, timestamps, priority).`,
      oracles: [
        {
          kind: 'rows',
          sql: "SELECT COUNT(*) AS n FROM todos WHERE title = 'Upsert probe todo' AND deleted_at IS NULL",
          expected: [{ n: 1 }],
        },
      ],
    },
    {
      kind: 'apiLeg',
      functionName: 'data:habits/addHabit',
      args: { name: 'Drink water', targetPerDay: 8 },
      note: `LOCAL oracle: exactly one habit row. ${REMOTE_VERIFY}`,
      oracles: [
        {
          kind: 'rows',
          sql: "SELECT COUNT(*) AS n FROM habits WHERE name = 'Drink water' AND deleted_at IS NULL",
          expected: [{ n: 1 }],
        },
      ],
    },
    {
      kind: 'apiLeg',
      functionName: 'data:calories/addCalorieEntry',
      args: {
        foodName: 'Oatmeal',
        calories: 350,
        protein: 12,
        carbs: 60,
        fats: 5,
        mealType: 'breakfast',
      },
      note: `LOCAL oracle: exactly one calorie row. ${REMOTE_VERIFY} Note: addCalorieEntry also upserts a saved_meal locally — saved_meals is NOT a sync entity and must NOT appear remotely (remote tables for it do not exist in schema.sql).`,
      oracles: [
        {
          kind: 'rows',
          sql: "SELECT COUNT(*) AS n FROM calorie_entries WHERE food_name = 'Oatmeal' AND deleted_at IS NULL",
          expected: [{ n: 1 }],
        },
      ],
    },
    {
      kind: 'apiLeg',
      functionName: 'data:workout/addRoutine',
      args: { name: 'Push day' },
      note:
        'LOCAL oracle: exactly one routine row. ' +
        `${REMOTE_VERIFY} Only the parent workout_routines row is synced; nested exercises/sets stay local-only.`,
      oracles: [
        {
          kind: 'rows',
          sql: "SELECT COUNT(*) AS n FROM workout_routines WHERE name = 'Push day' AND deleted_at IS NULL",
          expected: [{ n: 1 }],
        },
      ],
    },
    {
      kind: 'apiLeg',
      functionName: 'engine:flush',
      note:
        'The engine must push all four entities (upsert onConflict id). ' +
        `${REMOTE_VERIFY} After this step remote todos/habits/calorie_entries/workout_routines each contain exactly ONE row for the written ids — no duplicates.`,
      oracles: [
        { kind: 'outbox' },
        {
          kind: 'rows',
          sql: "SELECT COUNT(*) AS n FROM todos WHERE title = 'Upsert probe todo' AND deleted_at IS NULL",
          expected: [{ n: 1 }],
        },
      ],
    },
    {
      kind: 'apiLeg',
      functionName: 'engine:flush',
      note:
        'Second flush with an empty outbox must be a no-op at the remote: row counts stay exactly 1 per entity (idempotency). ' +
        `${REMOTE_VERIFY}`,
      oracles: [
        {
          kind: 'rows',
          sql:
            'SELECT (SELECT COUNT(*) FROM todos WHERE deleted_at IS NULL) AS todos, ' +
            '(SELECT COUNT(*) FROM habits WHERE deleted_at IS NULL) AS habits, ' +
            '(SELECT COUNT(*) FROM calorie_entries WHERE deleted_at IS NULL) AS calories, ' +
            '(SELECT COUNT(*) FROM workout_routines WHERE deleted_at IS NULL) AS wrk',
          expected: [{ todos: 1, habits: 1, calories: 1, wrk: 1 }],
        },
        { kind: 'outbox' },
      ],
    },
  ],
});

/* ------------------------------------------------------------------------ */
/* Scenario 2 — sync dedupe round trip                                       */
/* ------------------------------------------------------------------------ */

export const syncDedupeRoundTrip = defineScenario({
  id: 'backend-sync-dedupe-round-trip',
  personaId: 'backend-probe',
  goal: 'Duplicate enqueues of the same (entity, id) collapse to one outbox record and one remote row.',
  fixture: 'SMALL',
  mode: 'deterministic',
  tags: [DISPOSABLE_LANE_TAG],
  description:
    'Create a todo, force-feed the engine the same record twice, then flush twice. Proves engine-level replaceOrAppend dedupe and remote upsert-on-id do not duplicate rows.',
  steps: [
    {
      kind: 'apiLeg',
      functionName: 'data:todos/addTodo',
      args: { title: 'Dedupe probe' },
      note: 'LOCAL oracle: exactly one todo row ready to flush.',
      oracles: [
        {
          kind: 'rows',
          sql: "SELECT COUNT(*) AS n FROM todos WHERE title = 'Dedupe probe' AND deleted_at IS NULL",
          expected: [{ n: 1 }],
        },
      ],
    },
    {
      kind: 'apiLeg',
      functionName: 'engine:enqueueDuplicate',
      note:
        'Re-enqueues the exact same record (same entity:id, same timestamps) that addTodo already enqueued. Runner must then assert the outbox holds EXACTLY ONE record for entity:todos (`syncEngine.getPendingCount()` is 1) — the engine de-dupes by (entity, id); a duplicate would double-insert on the remote. ' +
        `${REMOTE_VERIFY}`,
      oracles: [
        { kind: 'outbox' },
        {
          kind: 'rows',
          sql: "SELECT COUNT(*) AS n FROM todos WHERE title = 'Dedupe probe' AND deleted_at IS NULL",
          expected: [{ n: 1 }],
        },
      ],
    },
    {
      kind: 'apiLeg',
      functionName: 'engine:flush',
      note:
        "The single outbox record upserts once: remote todos must contain exactly ONE 'Dedupe probe' row. " +
        `${REMOTE_VERIFY}`,
      oracles: [
        {
          kind: 'rows',
          sql: "SELECT COUNT(*) AS n FROM todos WHERE title = 'Dedupe probe' AND deleted_at IS NULL",
          expected: [{ n: 1 }],
        },
        { kind: 'outbox' },
      ],
    },
    {
      kind: 'apiLeg',
      functionName: 'engine:enqueueDuplicate',
      note:
        'Second duplicate enqueue round while the row is already remote: outbox is again one record; a further flush must not grow remote row count beyond 1 (upsert overwrites by id). ' +
        `${REMOTE_VERIFY}`,
      oracles: [
        { kind: 'outbox' },
        {
          kind: 'rows',
          sql: "SELECT COUNT(*) AS n FROM todos WHERE title = 'Dedupe probe' AND deleted_at IS NULL",
          expected: [{ n: 1 }],
        },
      ],
    },
    {
      kind: 'apiLeg',
      functionName: 'engine:flush',
      note: `Final state: ONE remote row, one local row. ${REMOTE_VERIFY}`,
      oracles: [
        {
          kind: 'rows',
          sql: "SELECT COUNT(*) AS n FROM todos WHERE title = 'Dedupe probe' AND deleted_at IS NULL",
          expected: [{ n: 1 }],
        },
        { kind: 'outbox' },
      ],
    },
  ],
});

/* ------------------------------------------------------------------------ */
/* Scenario 3 — sync backoff round trip                                      */
/* ------------------------------------------------------------------------ */

export const syncBackoffRoundTrip = defineScenario({
  id: 'backend-sync-backoff-round-trip',
  personaId: 'backend-probe',
  goal: 'A failed flush keeps the record in the outbox, records backoff status, and retries only after the backoff window.',
  fixture: 'SMALL',
  mode: 'deterministic',
  tags: [DISPOSABLE_LANE_TAG],
  description:
    'Write a todo, inject a 503 server error at the Supabase origin, flush (fails), assert backoff status (consecutiveFailures=1, nextRetryAt ≈ now+30s, shouldAttemptFlush=false), restore connectivity, flush again after the window (succeeds, outbox empty, remote has the row).',
  steps: [
    {
      kind: 'apiLeg',
      functionName: 'data:todos/addTodo',
      args: { title: 'Backoff probe' },
      note: 'LOCAL oracle: one todo row pending.',
      oracles: [
        {
          kind: 'rows',
          sql: "SELECT COUNT(*) AS n FROM todos WHERE title = 'Backoff probe' AND deleted_at IS NULL",
          expected: [{ n: 1 }],
        },
      ],
    },
    {
      kind: 'injectFailure',
      failure: 'server-error',
      status: 503,
      entities: ['todos'],
      note: 'Origin-level 503 for todos. Oracle: the todo row survives locally.',
      oracles: [
        {
          kind: 'rows',
          sql: "SELECT COUNT(*) AS n FROM todos WHERE title = 'Backoff probe' AND deleted_at IS NULL",
          expected: [{ n: 1 }],
        },
      ],
    },
    {
      kind: 'apiLeg',
      functionName: 'engine:flush',
      note:
        'Flush must REJECT (runner catches it). After the failure the outbox must contain exactly the todo record (requeued), and sync status must read consecutiveFailures=1, non-empty lastErrorMessage, nextRetryAt ≈ now + 30s (BACKOFF_SCHEDULE_MS[0]). Remote must NOT contain the row. ' +
        `${REMOTE_VERIFY}`,
      oracles: [
        { kind: 'outbox' },
        {
          kind: 'rows',
          sql: "SELECT COUNT(*) AS n FROM todos WHERE title = 'Backoff probe' AND deleted_at IS NULL",
          expected: [{ n: 1 }],
        },
      ],
    },
    {
      kind: 'apiLeg',
      functionName: 'engine:shouldAttemptFlush',
      note: 'Runner must assert shouldAttemptFlush() === false immediately after the failure (now < nextRetryAt). Then advance Date.now past nextRetryAt (parent clock helper) and assert it returns true. A fixed-interval caller must not retry inside the window.',
      oracles: [
        {
          kind: 'rows',
          sql: "SELECT COUNT(*) AS n FROM todos WHERE title = 'Backoff probe' AND deleted_at IS NULL",
          expected: [{ n: 1 }],
        },
      ],
    },
    {
      kind: 'goOnline',
      note: 'Restore connectivity; the injected 503 is removed. Todo row still pending.',
      oracles: [
        {
          kind: 'rows',
          sql: "SELECT COUNT(*) AS n FROM todos WHERE title = 'Backoff probe' AND deleted_at IS NULL",
          expected: [{ n: 1 }],
        },
      ],
    },
    {
      kind: 'apiLeg',
      functionName: 'engine:flush',
      note:
        "Flush after the backoff window succeeds: outbox empty, consecutiveFailures reset to 0, lastSuccessAt set, and the remote contains exactly one 'Backoff probe' row. " +
        `${REMOTE_VERIFY}`,
      oracles: [
        { kind: 'outbox' },
        {
          kind: 'rows',
          sql: "SELECT COUNT(*) AS n FROM todos WHERE title = 'Backoff probe' AND deleted_at IS NULL",
          expected: [{ n: 1 }],
        },
      ],
    },
  ],
});

/* ------------------------------------------------------------------------ */
/* Scenario 4 — sync partial-failure round trip                              */
/* ------------------------------------------------------------------------ */

export const syncPartialFailureRoundTrip = defineScenario({
  id: 'backend-sync-partial-failure-round-trip',
  personaId: 'backend-probe',
  goal: "One entity's failure requeues only that entity's records; every other entity still reaches the remote.",
  fixture: 'SMALL',
  mode: 'deterministic',
  tags: [DISPOSABLE_LANE_TAG],
  description:
    'Queue a todo and a habit, inject a partial failure scoped to todos, flush. The habit must land remotely while the todo is requeued (SyncPushPartialFailureError with failedRecords=[todo]); a second flush after recovery delivers the todo.',
  steps: [
    {
      kind: 'apiLeg',
      functionName: 'data:todos/addTodo',
      args: { title: 'Partial-failure todo' },
      note: 'LOCAL oracle: one todo row.',
      oracles: [
        {
          kind: 'rows',
          sql: "SELECT COUNT(*) AS n FROM todos WHERE title = 'Partial-failure todo' AND deleted_at IS NULL",
          expected: [{ n: 1 }],
        },
      ],
    },
    {
      kind: 'apiLeg',
      functionName: 'data:habits/addHabit',
      args: { name: 'Partial habit', targetPerDay: 1 },
      note: 'LOCAL oracle: one habit row.',
      oracles: [
        {
          kind: 'rows',
          sql: "SELECT COUNT(*) AS n FROM habits WHERE name = 'Partial habit' AND deleted_at IS NULL",
          expected: [{ n: 1 }],
        },
      ],
    },
    {
      kind: 'injectFailure',
      failure: 'partial',
      entities: ['todos'],
      note: 'Origin failure scoped to todos only. Habits requests pass through.',
      oracles: [
        {
          kind: 'rows',
          sql: 'SELECT COUNT(*) AS n FROM todos WHERE deleted_at IS NULL',
          expected: [{ n: 1 }],
        },
      ],
    },
    {
      kind: 'apiLeg',
      functionName: 'engine:flush',
      note:
        'Flush must reject with SyncPushPartialFailureError whose failedRecords is EXACTLY [the todo record]. The outbox after the failure must contain only the todo record — the habit record is gone (it succeeded). ' +
        'REMOTE assertion: remote habits CONTAINS the habit row; remote todos does NOT contain the todo row. ' +
        `${REMOTE_VERIFY}`,
      oracles: [
        { kind: 'outbox' },
        {
          kind: 'rows',
          sql:
            "SELECT (SELECT COUNT(*) FROM todos WHERE title = 'Partial-failure todo' AND deleted_at IS NULL) + " +
            "(SELECT COUNT(*) FROM habits WHERE name = 'Partial habit' AND deleted_at IS NULL) AS n",
          expected: [{ n: 2 }],
        },
      ],
    },
    {
      kind: 'goOnline',
      note: 'Recovery: connectivity restored, failure removed. Todo still pending in the outbox.',
      oracles: [
        {
          kind: 'rows',
          sql: "SELECT COUNT(*) AS n FROM todos WHERE title = 'Partial-failure todo' AND deleted_at IS NULL",
          expected: [{ n: 1 }],
        },
      ],
    },
    {
      kind: 'apiLeg',
      functionName: 'engine:flush',
      note:
        'Second flush delivers the requeued todo: outbox empty; remote todos now CONTAINS the todo row (and habits still has its row — no double insert, no loss). ' +
        `${REMOTE_VERIFY}`,
      oracles: [
        { kind: 'outbox' },
        {
          kind: 'rows',
          sql: "SELECT COUNT(*) AS n FROM todos WHERE title = 'Partial-failure todo' AND deleted_at IS NULL",
          expected: [{ n: 1 }],
        },
      ],
    },
  ],
});

/* ------------------------------------------------------------------------ */
/* Scenario 5 — restore lifecycle round trip                                 */
/* ------------------------------------------------------------------------ */

export const restoreLifecycleRoundTrip = defineScenario({
  id: 'backend-restore-lifecycle-round-trip',
  personaId: 'backend-probe',
  goal: 'Restore preview → eligibility → import → non-restored entities, end to end against the disposable remote.',
  fixture: 'SMALL',
  mode: 'deterministic',
  tags: [DISPOSABLE_LANE_TAG],
  description:
    'Phase A: empty device, empty remote → preview blocked (remote_backup_unavailable). Phase B: device A publishes a backup (todo+habit+calorie+workout routine). Phase C: empty device B previews (eligible, startupPromptEligible) and imports — todo/habit/calorie land locally, workout_routines stays at 0 locally though present remotely, habit_completions stays local-only. Phase D: after import the device is non-empty → preview blocked (local_data_present).',
  steps: [
    {
      kind: 'apiLeg',
      functionName: 'restore:getRestorePreview',
      note: "PHASE A — empty device, remote tables empty (just provisioned). Runner asserts: eligibility.kind === 'blocked', reason === 'remote_backup_unavailable', remoteAvailable === false, entityStatuses.*.remoteState === 'empty', startupPromptEligible === false. LOCAL oracle: all synced tables empty.",
      oracles: [
        {
          kind: 'rows',
          sql:
            'SELECT (SELECT COUNT(*) FROM todos WHERE deleted_at IS NULL) + ' +
            '(SELECT COUNT(*) FROM habits WHERE deleted_at IS NULL) + ' +
            '(SELECT COUNT(*) FROM calorie_entries WHERE deleted_at IS NULL) + ' +
            '(SELECT COUNT(*) FROM workout_routines WHERE deleted_at IS NULL) AS n',
          expected: [{ n: 0 }],
        },
      ],
    },
    {
      kind: 'apiLeg',
      functionName: 'data:todos/addTodo',
      args: { title: 'Restore me', notes: 'backup notes', priority: 'urgent' },
      note: 'PHASE B — device A writes the backup payload. LOCAL oracle: one todo row.',
      oracles: [
        {
          kind: 'rows',
          sql: "SELECT COUNT(*) AS n FROM todos WHERE title = 'Restore me' AND deleted_at IS NULL",
          expected: [{ n: 1 }],
        },
      ],
    },
    {
      kind: 'apiLeg',
      functionName: 'data:habits/addHabit',
      args: { name: 'Restored habit', targetPerDay: 3 },
      note: 'PHASE B — LOCAL oracle: one habit row.',
      oracles: [
        {
          kind: 'rows',
          sql: "SELECT COUNT(*) AS n FROM habits WHERE name = 'Restored habit' AND deleted_at IS NULL",
          expected: [{ n: 1 }],
        },
      ],
    },
    {
      kind: 'apiLeg',
      functionName: 'data:calories/addCalorieEntry',
      args: { foodName: 'Backup meal', calories: 620, mealType: 'dinner' },
      note: 'PHASE B — LOCAL oracle: one calorie row.',
      oracles: [
        {
          kind: 'rows',
          sql: "SELECT COUNT(*) AS n FROM calorie_entries WHERE food_name = 'Backup meal' AND deleted_at IS NULL",
          expected: [{ n: 1 }],
        },
      ],
    },
    {
      kind: 'apiLeg',
      functionName: 'data:workout/addRoutine',
      args: { name: 'Not-restorable routine' },
      note: 'PHASE B — workout_routines is SYNCED but OUT of restore scope (restore.types.ts RESTORE_SCOPED_ENTITIES excludes it). LOCAL oracle: one routine row.',
      oracles: [
        {
          kind: 'rows',
          sql: "SELECT COUNT(*) AS n FROM workout_routines WHERE name = 'Not-restorable routine' AND deleted_at IS NULL",
          expected: [{ n: 1 }],
        },
      ],
    },
    {
      kind: 'apiLeg',
      functionName: 'engine:flush',
      note: 'PHASE B — push the backup. `[remote]` Runner asserts the remote now holds exactly 1 row each for todos/habits/calorie_entries/workout_routines.',
      oracles: [
        { kind: 'outbox' },
        {
          kind: 'rows',
          sql: "SELECT COUNT(*) AS n FROM todos WHERE title = 'Restore me' AND deleted_at IS NULL",
          expected: [{ n: 1 }],
        },
      ],
    },
    {
      kind: 'apiLeg',
      functionName: 'restore:getRestorePreview',
      note: "PHASE C — empty device B (runner: fresh context, clearDatabase + reload; remote still holds the backup). Runner asserts: eligibility.kind === 'empty_device', remoteAvailable === true, startupPromptEligible === true (freshnessSignature non-null and not dismissed), entityStatuses.todos.remoteState === 'available' with rowCount 1, entityStatuses.workout_routines.phaseOneStatus === 'excluded_in_phase_one'. LOCAL oracle: all synced tables still empty on this device.",
      oracles: [
        {
          kind: 'rows',
          sql:
            'SELECT (SELECT COUNT(*) FROM todos WHERE deleted_at IS NULL) + ' +
            '(SELECT COUNT(*) FROM habits WHERE deleted_at IS NULL) + ' +
            '(SELECT COUNT(*) FROM calorie_entries WHERE deleted_at IS NULL) + ' +
            '(SELECT COUNT(*) FROM workout_routines WHERE deleted_at IS NULL) AS n',
          expected: [{ n: 0 }],
        },
      ],
    },
    {
      kind: 'apiLeg',
      functionName: 'restore:restoreFromRemoteBackup',
      note: "PHASE C — import. Runner asserts: status === 'restored', freshnessSignature non-null, importedCounts { todos: 1, habits: 1, calorie_entries: 1 }. LOCAL oracle: the three restorable tables now hold their remote rows.",
      oracles: [
        {
          kind: 'rows',
          sql:
            "SELECT (SELECT COUNT(*) FROM todos WHERE title = 'Restore me' AND deleted_at IS NULL) + " +
            "(SELECT COUNT(*) FROM habits WHERE name = 'Restored habit' AND deleted_at IS NULL) + " +
            "(SELECT COUNT(*) FROM calorie_entries WHERE food_name = 'Backup meal' AND deleted_at IS NULL) AS n",
          expected: [{ n: 3 }],
        },
      ],
    },
    {
      kind: 'apiLeg',
      functionName: 'restore:restoreFromRemoteBackup',
      note: "PHASE C — idempotency guard: a second import on a now-non-empty device must return status === 'blocked' with eligibility.reason === 'local_data_present'; nothing gets overwritten/resurrected. LOCAL oracle: the three rows are untouched.",
      oracles: [
        {
          kind: 'rows',
          sql:
            "SELECT (SELECT COUNT(*) FROM todos WHERE title = 'Restore me' AND deleted_at IS NULL) + " +
            "(SELECT COUNT(*) FROM habits WHERE name = 'Restored habit' AND deleted_at IS NULL) + " +
            "(SELECT COUNT(*) FROM calorie_entries WHERE food_name = 'Backup meal' AND deleted_at IS NULL) AS n",
          expected: [{ n: 3 }],
        },
      ],
    },
    {
      kind: 'expectOracle',
      oracle: {
        kind: 'rows',
        sql: 'SELECT COUNT(*) AS n FROM workout_routines WHERE deleted_at IS NULL',
        expected: [{ n: 0 }],
      },
      note: 'PHASE C — NON-RESTORED ENTITY: workout_routines has a row on the REMOTE (the backup pushed it) but restore excludes it, so the local count stays 0. `[remote]` Runner asserts the remote workout_routines still holds its 1 row (import must not delete it either — push-only backup, no two-way sync).',
    },
    {
      kind: 'expectOracle',
      oracle: {
        kind: 'rows',
        sql: 'SELECT COUNT(*) AS n FROM habit_completions',
        expected: [{ n: 0 }],
      },
      note: 'PHASE C — LOCAL-ONLY entity: habit_completions has no remote table at all (schema.sql covers only the four synced tables); restore leaves it alone. Runner asserts zero habit_completions were imported.',
    },
    {
      kind: 'apiLeg',
      functionName: 'restore:getRestorePreview',
      note: "PHASE D — after a successful import the device is non-empty: preview blocked with reason 'local_data_present' and startupPromptEligible false. LOCAL oracle: todo row still present.",
      oracles: [
        {
          kind: 'rows',
          sql: "SELECT COUNT(*) AS n FROM todos WHERE title = 'Restore me' AND deleted_at IS NULL",
          expected: [{ n: 1 }],
        },
      ],
    },
  ],
});

/* ------------------------------------------------------------------------ */
/* Scenario 6 — edge-function contract round trip                            */
/* ------------------------------------------------------------------------ */

export const edgeFunctionContractRoundTrip = defineScenario({
  id: 'backend-edge-function-contract-round-trip',
  personaId: 'backend-probe',
  goal: 'The deployed parse-ai-command edge function honors its HTTP + payload contract.',
  fixture: 'SMALL',
  mode: 'deterministic',
  tags: [DISPOSABLE_LANE_TAG],
  description:
    'POST the function (deployed by provision.ts --with-parser) with a valid create-todo command, an unsupported command, a malformed payload, oversized input, and a GET. These steps write NOTHING locally — each carries a placeholder rows oracle proving local state is unchanged (see file header) while the real assertions live in the notes. Contract reference: supabase/functions/parse-ai-command/index.js.',
  steps: [
    {
      kind: 'apiLeg',
      functionName: 'edge:parse-ai-command',
      args: {
        rawText: 'create todo Buy milk',
        nowIso: '2026-08-04T06:12:55.525Z',
        locale: 'en-US',
        timeZone: 'America/New_York',
        todayDateKey: '2026-08-04',
        tomorrowDateKey: '2026-08-05',
      },
      note: "Runner asserts HTTP 200 and JSON: outcome === 'draft', kind === 'todo', status === 'ready', fields.title === 'Buy milk', fields.notes === null, fields.priority === 'normal', warnings/missingFields empty or per schema. Placeholder oracle: local todos unchanged (the edge function never writes local rows).",
      oracles: [
        {
          kind: 'rows',
          sql: 'SELECT COUNT(*) AS n FROM todos WHERE deleted_at IS NULL',
          expected: [{ n: 0 }],
        },
      ],
    },
    {
      kind: 'apiLeg',
      functionName: 'edge:parse-ai-command',
      args: {
        rawText: 'complete the taxes thing',
        nowIso: '2026-08-04T06:12:55.525Z',
        locale: 'en-US',
        timeZone: 'America/New_York',
        todayDateKey: '2026-08-04',
        tomorrowDateKey: '2026-08-05',
      },
      note: "Runner asserts HTTP 200 and JSON outcome === 'unsupported' — destructive/edit/complete/update commands are explicitly out of scope (index.js buildPromptBody). Placeholder oracle: local todos unchanged.",
      oracles: [
        {
          kind: 'rows',
          sql: 'SELECT COUNT(*) AS n FROM todos WHERE deleted_at IS NULL',
          expected: [{ n: 0 }],
        },
      ],
    },
    {
      kind: 'apiLeg',
      functionName: 'edge:parse-ai-command',
      args: { rawText: 'create todo missing anchors' },
      note: 'Runner asserts HTTP 400 with a JSON error — the payload is missing nowIso/locale/timeZone/date-key anchors required by normalizeRequestBody. Placeholder oracle: local todos unchanged.',
      oracles: [
        {
          kind: 'rows',
          sql: 'SELECT COUNT(*) AS n FROM todos WHERE deleted_at IS NULL',
          expected: [{ n: 0 }],
        },
      ],
    },
    {
      kind: 'apiLeg',
      functionName: 'edge:parse-ai-command',
      args: {
        rawText: 'create todo ' + 'x'.repeat(320),
        nowIso: '2026-08-04T06:12:55.525Z',
        locale: 'en-US',
        timeZone: 'America/New_York',
        todayDateKey: '2026-08-04',
        tomorrowDateKey: '2026-08-05',
      },
      note: 'Runner asserts HTTP 400 — rawText over MAX_RAW_TEXT_LENGTH (280) is rejected (normalizeRequestBody). Placeholder oracle: local todos unchanged.',
      oracles: [
        {
          kind: 'rows',
          sql: 'SELECT COUNT(*) AS n FROM todos WHERE deleted_at IS NULL',
          expected: [{ n: 0 }],
        },
      ],
    },
    {
      kind: 'apiLeg',
      functionName: 'edge:parse-ai-command:get',
      note: 'Runner asserts HTTP 405 (Method not allowed) for a GET — only POST (plus OPTIONS preflight) is accepted (index.js Deno.serve). Placeholder oracle: local todos unchanged.',
      oracles: [
        {
          kind: 'rows',
          sql: 'SELECT COUNT(*) AS n FROM todos WHERE deleted_at IS NULL',
          expected: [{ n: 0 }],
        },
      ],
    },
  ],
});

/** All disposable-backend round-trip scenarios, assembled for model validation. */
export const disposableBackendModel: SimulationModel = defineModel({
  personas: [backendProbePersona],
  scenarios: [
    syncUpsertRoundTrip,
    syncDedupeRoundTrip,
    syncBackoffRoundTrip,
    syncPartialFailureRoundTrip,
    restoreLifecycleRoundTrip,
    edgeFunctionContractRoundTrip,
  ],
});
