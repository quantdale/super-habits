/**
 * Representative scenarios for the parent journeys whose core interactions the
 * semantic catalog cannot yet express (`add-user-simulation-platform` task 6.3).
 *
 * These are honest stand-ins: they capture the parts of J5/J6/J8/J9/J10 that
 * IS expressible and say in their `description` exactly what is not. The gaps:
 *   - J5 restore lifecycle  — needs a `restore` step + a remote boundary
 *     (the parent itself quarantines parts behind the dist-sync lane).
 *   - J6 linked-action rule authoring — needs rule-editor steps.
 *   - J8 HEAVY volume + perf ceilings — `seedFixture('HEAVY')` carries a
 *     UNIQUE-collision defect (see the parent's J8 header) and perf
 *     ceiling/timing assertions are not expressible as semantic steps.
 *   - J9 multi-tab OPFS lock — needs a second-tab step.
 *   - J10 settings mutation — needs a settings-change step (see `changeSetting`).
 *
 * Each scenario still validates and runs; the gaps are catalog gaps, not
 * weakened assertions.
 */

import { defineScenario } from '../model/builders';
import { typicalPreamble } from '../fixtures/seeders';

/* ------------------------------------------------------------------ */
/* J5 — "New phone" (P6, Jordan)                                        */
/* ------------------------------------------------------------------ */

export const j5NewPhone = defineScenario({
  id: 'j5-new-phone',
  personaId: 'new-device-migrator',
  goal: 'On a fresh device the first todo lands as exactly one row',
  description:
    'Expressible slice of the parent J5 "New phone": a fresh (empty) device, the user adds a todo, and exactly one row is persisted — the local-write half that holds on both builds. The restore-prompt lifecycle (dismiss → no re-prompt → accept → what is not restored) needs a restore step and the dist-sync lane; not expressible with the current catalog.',
  risks: ['R3'],
  tags: ['journey', 'j5'],
  steps: [
    {
      kind: 'createTodo',
      title: 'New phone todo',
      oracles: [
        {
          kind: 'rows',
          sql: "SELECT COUNT(*) AS n FROM todos WHERE title = 'New phone todo' AND deleted_at IS NULL",
          expected: [{ n: 1 }],
        },
        {
          kind: 'across-surfaces',
          text: 'New phone todo',
          tabs: ['todos', 'overview'],
        },
      ],
    },
  ],
});

/* ------------------------------------------------------------------ */
/* J6 — "Chain reaction" (P3, Priya)                                    */
/* ------------------------------------------------------------------ */

export const j6ChainReaction = defineScenario({
  id: 'j6-chain-reaction',
  personaId: 'power-user',
  goal: 'The source + target todos of a linked action persist exactly once each',
  description:
    'Expressible slice of the parent J6 "Chain reaction": the two todos a linked rule ties together are created through the real write path and each persists exactly once — the pre-requisite state of the journey. Authoring the `todo.completed → todo.complete` rule through the Linked Actions editor, the exactly-once execution row, re-fire suppression, and the `target_missing` skip need rule-editor semantic steps; not expressible with the current catalog.',
  risks: ['R4'],
  tags: ['journey', 'j6'],
  steps: [
    {
      kind: 'createTodo',
      title: 'Drink water after the retro',
      oracles: [
        {
          kind: 'rows',
          sql: "SELECT COUNT(*) AS n FROM todos WHERE title = 'Drink water after the retro' AND deleted_at IS NULL",
          expected: [{ n: 1 }],
        },
      ],
    },
    {
      kind: 'createTodo',
      title: 'Finish retro review report',
      oracles: [
        {
          kind: 'rows',
          sql: "SELECT COUNT(*) AS n FROM todos WHERE title = 'Finish retro review report' AND deleted_at IS NULL",
          expected: [{ n: 1 }],
        },
      ],
    },
    {
      kind: 'expectOracle',
      note: 'scoped to the two rule todos (robust to the SMALL baseline), each persisted exactly once',
      oracle: {
        kind: 'rows',
        sql: "SELECT COUNT(*) AS n FROM todos WHERE deleted_at IS NULL AND title IN ('Finish retro review report', 'Drink water after the retro')",
        expected: [{ n: 2 }],
      },
    },
  ],
});

/* ------------------------------------------------------------------ */
/* J8 — "Three months in" (P2, Tom)                                     */
/* ------------------------------------------------------------------ */

export const j8ThreeMonthsIn = defineScenario({
  id: 'j8-three-months-in',
  personaId: 'weekend-returner',
  goal: 'Walk every section of a populated device and check the seeded aggregates',
  description:
    'Expressible slice of the parent J8 "Three months in": a TYPICAL (~14 days) device is seeded, then the walk visits every one of the six permanently-mounted sections, and row-level oracles check the seeded volumes survived the walk unchanged. The HEAVY 90-day volume, the D14 perf ceilings, the 364/52 heatmap boundaries, and the diary search are not expressible as semantic steps; and the parent\'s own `seedFixture("HEAVY")` aborts on a UNIQUE collision (documented in its J8 header).',
  risks: ['R6', 'R9'],
  tags: ['journey', 'j8'],
  fixture: 'TYPICAL',
  steps: [
    { kind: 'switchSection', tab: 'overview', note: 'cold Overview over the seeded device' },
    { kind: 'switchSection', tab: 'todos' },
    { kind: 'switchSection', tab: 'habits' },
    { kind: 'switchSection', tab: 'pomodoro' },
    { kind: 'switchSection', tab: 'workout' },
    { kind: 'switchSection', tab: 'calories' },
    {
      kind: 'expectOracle',
      oracle: {
        kind: 'rows',
        sql: 'SELECT COUNT(*) AS n FROM habits WHERE deleted_at IS NULL',
        expected: [{ n: 4 }],
      },
    },
    {
      kind: 'expectOracle',
      oracle: {
        kind: 'rows',
        sql: 'SELECT COUNT(*) AS n FROM calorie_entries WHERE deleted_at IS NULL',
        expected: [{ n: 40 }],
      },
    },
    {
      kind: 'expectOracle',
      oracle: {
        kind: 'rows',
        sql: 'SELECT COUNT(*) AS n FROM pomodoro_sessions',
        expected: [{ n: 8 }],
      },
    },
    {
      kind: 'expectOracle',
      note: 'TYPICAL seeds 2 routines, the first soft-deleted → 1 live',
      oracle: {
        kind: 'rows',
        sql: 'SELECT COUNT(*) AS n FROM workout_routines WHERE deleted_at IS NULL',
        expected: [{ n: 1 }],
      },
    },
  ],
});

/* ------------------------------------------------------------------ */
/* J9 — "Two tabs" (P4, Sam)                                            */
/* ------------------------------------------------------------------ */

export const j9TwoTabs = defineScenario({
  id: 'j9-two-tabs',
  personaId: 'error-prone-user',
  goal: 'One tab writes two todos; each lands as exactly one persisted row',
  description:
    'Expressible slice of the parent J9 "Two tabs": the healthy-tab half — two todos written through the real UI, each exactly one row, in creation order. The second-tab OPFS single-writer gate ("Unable to start" + actionable copy) and the fresh-context contrast need a multi-tab step; not expressible with the current catalog.',
  risks: ['R10'],
  tags: ['journey', 'j9'],
  workflows: [
    { workflowId: 'onboardFirstTodo', params: { title: 'Tab one first note', priority: 'normal' } },
    {
      workflowId: 'onboardFirstTodo',
      params: { title: 'Tab one second note', priority: 'normal' },
    },
  ],
  steps: [
    {
      kind: 'expectOracle',
      note: "scoped to this scenario's todos (robust to the SMALL baseline)",
      oracle: {
        kind: 'rows',
        sql: "SELECT COUNT(*) AS n FROM todos WHERE deleted_at IS NULL AND title LIKE 'Tab one %'",
        expected: [{ n: 2 }],
      },
    },
    {
      kind: 'expectOracle',
      oracle: {
        kind: 'rows',
        sql: "SELECT COUNT(*) AS n FROM todos WHERE deleted_at IS NULL AND title = 'Tab one first note'",
        expected: [{ n: 1 }],
      },
    },
    {
      kind: 'expectOracle',
      oracle: {
        kind: 'rows',
        sql: "SELECT COUNT(*) AS n FROM todos WHERE deleted_at IS NULL AND title = 'Tab one second note'",
        expected: [{ n: 1 }],
      },
    },
  ],
});

/* ------------------------------------------------------------------ */
/* J10 — "Settings ripple" (P3, Priya)                                  */
/* ------------------------------------------------------------------ */

export const j10SettingsRipple = defineScenario({
  id: 'j10-settings-ripple',
  personaId: 'power-user',
  goal: 'The settings surface opens, survives a reload, and the reload loses no device state',
  description:
    'Expressible slice of the parent J10 "Settings ripple": the Settings drawer opens/closes and the settings store is reachable (via the `changeSetting` workflow), a todo written alongside it survives a reload, and the settings surface is still openable after the reload. CHANGING a setting (calorie goal / pomodoro defaults / theme) needs a settings-mutation step the catalog does not have, and the Focus-timer rendering cannot be cross-checked because the runner\'s `switchSection` strict-mode collides with the Focus mode chip; both gaps are called out, nothing is weakened.',
  risks: ['R11'],
  tags: ['journey', 'j10'],
  workflows: [{ workflowId: 'changeSetting', params: {} }],
  steps: [
    {
      kind: 'apiLeg',
      functionName: 'createTodo',
      args: { title: 'J10 todo' },
      description: 'device state to prove the reload preserves it',
      oracles: [
        {
          kind: 'rows',
          sql: "SELECT COUNT(*) AS n FROM todos WHERE title = 'J10 todo' AND deleted_at IS NULL",
          expected: [{ n: 1 }],
        },
      ],
    },
    {
      kind: 'reloadApp',
      oracles: [
        {
          kind: 'rows',
          sql: "SELECT COUNT(*) AS n FROM todos WHERE title = 'J10 todo' AND deleted_at IS NULL",
          expected: [{ n: 1 }],
        },
      ],
    },
    {
      kind: 'expectAcrossSurfaces',
      text: 'J10 todo',
      tabs: ['todos', 'overview'],
      note: 'the settings visit + reload lost nothing',
    },
    { kind: 'openSettings', note: 'the settings surface is still reachable post-reload' },
  ],
});

/* ------------------------------------------------------------------ */
/* TYPICAL-preambled variant used by composites                         */
/* ------------------------------------------------------------------ */

export const typicalPreambleScenario = defineScenario({
  id: 'typical-device-walk',
  personaId: 'weekend-returner',
  goal: 'Build a TYPICAL-equivalent device from API legs and walk it',
  description:
    'Companion to J8: seeds the TYPICAL-equivalent corpus through the apiLeg preamble builders (task 6.5) instead of the parent fixture, then walks the sections. Demonstrates the fixture-builder path end-to-end.',
  tags: ['fixture', 'typical'],
  steps: [
    ...typicalPreamble(),
    { kind: 'switchSection', tab: 'overview' },
    { kind: 'switchSection', tab: 'calories' },
  ],
});
