import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  deleteLinkedActionRulesForTargetEntity,
  getAppliedHabitIncrementExecution,
  getAppliedHabitDayCalorieExecution,
  listLinkedActionRulesForSourceEntity,
  replaceLinkedActionRulesForSourceEntity,
} from '@/core/linked-actions/linkedActions.data';
import type { LinkedActionRuleRow } from '@/core/linked-actions/linkedActions.types';

const { getDatabase } = vi.hoisted(() => ({
  getDatabase: vi.fn(),
}));

vi.mock('@/core/db/client', () => ({
  getDatabase,
}));

describe('core/linked-actions/linkedActions.data', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('normalizes stored rows when listing a source entity without crashing on legacy targets', async () => {
    const row: LinkedActionRuleRow = {
      id: 'link_1',
      status: 'active',
      direction_policy: 'one_way',
      bidirectional_group_id: null,
      source_feature: 'workout',
      source_entity_type: 'workout_routine',
      source_entity_id: 'wrk_1',
      trigger_type: 'workout.completed',
      target_feature: 'pomodoro',
      target_entity_type: 'pomodoro_session',
      target_entity_id: null,
      effect_type: 'pomodoro.log',
      effect_payload: JSON.stringify({
        sessionType: 'focus',
        durationSeconds: 900,
      }),
      created_at: '2026-04-13T00:00:00.000Z',
      updated_at: '2026-04-13T00:00:00.000Z',
      deleted_at: null,
    };

    const db = {
      getAllAsync: vi.fn().mockResolvedValue([row]),
      getFirstAsync: vi.fn().mockResolvedValue(row),
    };
    getDatabase.mockResolvedValue(db);

    await expect(
      listLinkedActionRulesForSourceEntity({
        feature: 'workout',
        entityType: 'workout_routine',
        entityId: 'wrk_1',
      }),
    ).resolves.toEqual([
      {
        id: 'link_1',
        status: 'active',
        directionPolicy: 'one_way',
        bidirectionalGroupId: null,
        source: {
          feature: 'workout',
          entityType: 'workout_routine',
          entityId: 'wrk_1',
          triggerType: 'workout.completed',
        },
        target: {
          feature: 'pomodoro',
          entityType: 'pomodoro_session',
          entityId: null,
          effect: {
            kind: 'unsupported',
            type: 'pomodoro.log',
            rawPayload: JSON.stringify({
              sessionType: 'focus',
              durationSeconds: 900,
            }),
          },
        },
        isUnsupported: true,
        unsupportedReason: 'Trigger workout.completed is not currently supported.',
        rawTargetFeature: 'pomodoro',
        rawTargetEntityType: 'pomodoro_session',
        rawEffectType: 'pomodoro.log',
        createdAt: '2026-04-13T00:00:00.000Z',
        updatedAt: '2026-04-13T00:00:00.000Z',
        deletedAt: null,
      },
    ]);
  });

  it('soft deletes rules when a linked target entity is removed', async () => {
    const db = {
      withTransactionAsync: async (task: () => Promise<void>) => {
        await task();
      },
      getFirstAsync: vi.fn().mockResolvedValue({ owner_user_id: null }),
      // The soft-delete now also reads the touched rule ids (post-update
      // SELECT) so it can enqueue one tombstone intent per rule.
      getAllAsync: vi.fn().mockResolvedValue([]),
      runAsync: vi.fn().mockResolvedValue(undefined),
    };
    getDatabase.mockResolvedValue(db);

    await deleteLinkedActionRulesForTargetEntity({
      feature: 'habits',
      entityType: 'habit',
      entityId: 'habit_target',
      deletedAt: '2026-04-15T00:00:00.000Z',
    });

    expect(db.runAsync).toHaveBeenCalledWith(expect.stringContaining('target_feature = ?'), [
      '2026-04-15T00:00:00.000Z',
      '2026-04-15T00:00:00.000Z',
      'habits',
      'habit',
      'habit_target',
    ]);
  });

  it('looks up prior applied calorie executions for the same habit and day', async () => {
    const executionRow = {
      id: 'lexec_1',
      rule_id: 'link_calorie',
      source_event_id: 'levt_1',
      chain_id: 'lchain_1',
      root_event_id: 'levt_1',
      origin_rule_id: null,
      effect_type: 'calorie.log',
      effect_fingerprint: 'fingerprint',
      status: 'applied',
      target_feature: 'calories',
      target_entity_type: 'calorie_log',
      target_entity_id: null,
      produced_entity_type: 'calorie_log',
      produced_entity_id: 'cal_1',
      notice_payload: null,
      error_message: null,
      created_at: '2026-04-14T00:00:00.000Z',
      updated_at: '2026-04-14T00:00:00.000Z',
    };
    const db = {
      getFirstAsync: vi.fn().mockResolvedValue(executionRow),
    };
    getDatabase.mockResolvedValue(db);

    await expect(
      getAppliedHabitDayCalorieExecution('link_calorie', 'habit_1', '2026-04-14'),
    ).resolves.toMatchObject({
      id: 'lexec_1',
      effectType: 'calorie.log',
      producedEntityId: 'cal_1',
    });

    expect(db.getFirstAsync).toHaveBeenCalledWith(
      expect.stringContaining('ev.source_date_key = ?'),
      ['link_calorie', 'habit_1', '2026-04-14'],
    );
  });

  it('looks up an applied habit increment by source identity and day', async () => {
    const executionRow = {
      id: 'lexec_increment',
      rule_id: 'link_increment',
      source_event_id: 'levt_1',
      chain_id: 'lchain_1',
      root_event_id: 'levt_1',
      origin_rule_id: null,
      effect_type: 'habit.increment',
      effect_fingerprint: 'fingerprint',
      status: 'applied',
      target_feature: 'habits',
      target_entity_type: 'habit',
      target_entity_id: 'habit_1',
      produced_entity_type: null,
      produced_entity_id: null,
      notice_payload: null,
      error_message: null,
      created_at: '2026-04-14T00:00:00.000Z',
      updated_at: '2026-04-14T00:00:00.000Z',
    };
    const db = {
      getFirstAsync: vi.fn().mockResolvedValue(executionRow),
    };
    getDatabase.mockResolvedValue(db);

    await expect(
      getAppliedHabitIncrementExecution(
        'link_increment',
        'todos',
        'todo',
        'todo_1',
        'todo.completed',
        '2026-04-14',
      ),
    ).resolves.toMatchObject({
      id: 'lexec_increment',
      effectType: 'habit.increment',
    });

    expect(db.getFirstAsync).toHaveBeenCalledWith(
      expect.stringContaining("e.effect_type = 'habit.increment'"),
      ['link_increment', 'todos', 'todo', 'todo_1', 'todo.completed', '2026-04-14'],
    );
  });

  it('lists all non-deleted rules for a source entity across triggers', async () => {
    const db = {
      getAllAsync: vi.fn().mockResolvedValue([
        {
          id: 'link_3',
          status: 'paused',
          direction_policy: 'one_way',
          bidirectional_group_id: null,
          source_feature: 'habits',
          source_entity_type: 'habit',
          source_entity_id: 'habit_1',
          trigger_type: 'habit.completed_for_day',
          target_feature: 'todos',
          target_entity_type: 'todo',
          target_entity_id: 'todo_1',
          effect_type: 'todo.complete',
          effect_payload: JSON.stringify({}),
          created_at: '2026-04-13T00:00:00.000Z',
          updated_at: '2026-04-13T00:00:00.000Z',
          deleted_at: null,
        },
      ]),
    };
    getDatabase.mockResolvedValue(db);

    await expect(
      listLinkedActionRulesForSourceEntity({
        feature: 'habits',
        entityType: 'habit',
        entityId: 'habit_1',
      }),
    ).resolves.toHaveLength(1);

    expect(db.getAllAsync).toHaveBeenCalledWith(expect.stringContaining('source_entity_id = ?'), [
      'habits',
      'habit',
      'habit_1',
    ]);
  });

  it('replaces rules for a source entity by updating kept rules, creating new ones, and soft deleting removed ones', async () => {
    const existingRow: LinkedActionRuleRow = {
      id: 'link_existing',
      status: 'active',
      direction_policy: 'one_way',
      bidirectional_group_id: null,
      source_feature: 'habits',
      source_entity_type: 'habit',
      source_entity_id: 'habit_1',
      trigger_type: 'habit.completed_for_day',
      target_feature: 'todos',
      target_entity_type: 'todo',
      target_entity_id: 'todo_old',
      effect_type: 'todo.complete',
      effect_payload: JSON.stringify({}),
      created_at: '2026-04-13T00:00:00.000Z',
      updated_at: '2026-04-13T00:00:00.000Z',
      deleted_at: null,
    };
    const removedRow: LinkedActionRuleRow = {
      ...existingRow,
      id: 'link_removed',
      target_entity_id: 'todo_removed',
    };
    const db = {
      withTransactionAsync: async (task: () => Promise<void>) => {
        await task();
      },
      getFirstAsync: vi.fn().mockResolvedValue({ owner_user_id: null }),
      getAllAsync: vi.fn().mockResolvedValue([existingRow, removedRow]),
      runAsync: vi.fn().mockResolvedValue(undefined),
    };
    getDatabase.mockResolvedValue(db);

    await replaceLinkedActionRulesForSourceEntity({
      feature: 'habits',
      entityType: 'habit',
      entityId: 'habit_1',
      rules: [
        {
          existingRuleId: 'link_existing',
          triggerType: 'habit.completed_for_day',
          target: {
            feature: 'todos',
            entityType: 'todo',
            entityId: 'todo_updated',
            effect: {
              kind: 'binary',
              type: 'todo.complete',
            },
          },
        },
        {
          triggerType: 'habit.completed_for_day',
          target: {
            feature: 'habits',
            entityType: 'habit',
            entityId: 'habit_2',
            effect: {
              kind: 'progress',
              type: 'habit.increment',
              amount: 1,
              dateStrategy: 'source_date',
            },
          },
        },
      ],
    });

    expect(db.runAsync).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('UPDATE linked_action_rules'),
      [
        'active',
        'one_way',
        null,
        'habits',
        'habit',
        'habit_1',
        'habit.completed_for_day',
        'todos',
        'todo',
        'todo_updated',
        'todo.complete',
        JSON.stringify({}),
        expect.any(String),
        null,
        'link_existing',
      ],
    );
    expect(db.runAsync).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('INSERT INTO linked_action_rules'),
      expect.arrayContaining([
        expect.stringMatching(/^link_/),
        'active',
        'one_way',
        null,
        'habits',
        'habit',
        'habit_1',
        'habit.completed_for_day',
        'habits',
        'habit',
        'habit_2',
        'habit.increment',
        JSON.stringify({ amount: 1, dateStrategy: 'source_date' }),
      ]),
    );
    expect(db.runAsync).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('SET deleted_at = ?, updated_at = ?'),
      [expect.any(String), expect.any(String), 'link_removed'],
    );
  });

  it('refuses to overwrite an unsupported existing rule', async () => {
    const db = {
      withTransactionAsync: async (task: () => Promise<void>) => {
        await task();
      },
      getAllAsync: vi.fn().mockResolvedValue([
        {
          id: 'link_legacy',
          status: 'active',
          direction_policy: 'one_way',
          bidirectional_group_id: null,
          source_feature: 'workout',
          source_entity_type: 'workout_routine',
          source_entity_id: 'wrk_1',
          trigger_type: 'workout.completed',
          target_feature: 'pomodoro',
          target_entity_type: 'pomodoro_session',
          target_entity_id: null,
          effect_type: 'pomodoro.log',
          effect_payload: JSON.stringify({
            sessionType: 'focus',
            durationSeconds: 1500,
          }),
          created_at: '2026-04-13T00:00:00.000Z',
          updated_at: '2026-04-13T00:00:00.000Z',
          deleted_at: null,
        },
      ]),
      runAsync: vi.fn().mockResolvedValue(undefined),
    };
    getDatabase.mockResolvedValue(db);

    await expect(
      replaceLinkedActionRulesForSourceEntity({
        feature: 'habits',
        entityType: 'habit',
        entityId: 'habit_1',
        rules: [
          {
            existingRuleId: 'link_legacy',
            triggerType: 'habit.completed_for_day',
            target: {
              feature: 'todos',
              entityType: 'todo',
              entityId: 'todo_1',
              effect: {
                kind: 'binary',
                type: 'todo.complete',
              },
            },
          },
        ],
      }),
    ).rejects.toThrow('Unsupported linked action rules must be removed or replaced before saving.');
  });
});
