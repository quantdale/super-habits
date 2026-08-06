import { supportsLinkedActionDirectionPolicy } from '@/core/linked-actions/linkedActions.policy';
import {
  isAllowedLinkedActionEffect,
  isAllowedLinkedActionSourceEntity,
  isAllowedLinkedActionTargetEntity,
  isAllowedLinkedActionTrigger,
  isLinkedActionDirectionPolicy,
  isLinkedActionEffectType,
  isLinkedActionExecutionStatus,
  isLinkedActionFeature,
  isLinkedActionRuleStatus,
  isLinkedActionSourceEntityType,
  isLinkedActionTargetEntityType,
  isLinkedActionTriggerType,
  isSupportedLinkedActionEffect,
  isSupportedLinkedActionTargetEntity,
  isSupportedLinkedActionTriggerType,
} from '@/core/linked-actions/linkedActions.guards';
import {
  LINKED_ACTION_UNSUPPORTED_RULE_MESSAGE,
  isSupportedLinkedActionRulePath,
} from '@/core/linked-actions/linkedActions.supportedPaths';
import type {
  LinkedActionDateStrategy,
  LinkedActionEffectDefinition,
  LinkedActionMealType,
  LinkedActionPomodoroSessionType,
} from '@/core/linked-actions/linkedActions.effects.types';
import type {
  LinkedActionDirectionPolicy,
  LinkedActionEffectType,
  LinkedActionRuleStatus,
} from '@/core/linked-actions/linkedActions.enums';
import type {
  LinkedActionEventRecord,
  LinkedActionEventRow,
} from '@/core/linked-actions/linkedActions.events.types';
import type {
  LinkedActionEffectProducedEntityType,
  LinkedActionExecutionRecord,
  LinkedActionExecutionRow,
} from '@/core/linked-actions/linkedActions.executions.types';
import type { LinkedActionOriginKind } from '@/core/linked-actions/linkedActions.metadata.types';
import type { LinkedActionsNoticePayload } from '@/core/notifications/inAppNotices.types';
import type {
  LinkedActionRuleDefinition,
  LinkedActionRuleRow,
  LinkedActionRuleSource,
  LinkedActionRuleTarget,
  LinkedActionUnsupportedRuleDefinition,
} from '@/core/linked-actions/linkedActions.rules.types';

function expectObject(value: unknown, context: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${context} must be a JSON object`);
  }
  return value as Record<string, unknown>;
}

function expectJsonObject(value: string, context: string): Record<string, unknown> {
  return expectObject(JSON.parse(value), context);
}

function expectString(value: unknown, context: string): string {
  if (typeof value !== 'string') {
    throw new Error(`${context} must be a string`);
  }
  return value;
}

function expectNullableString(value: unknown, context: string): string | null {
  if (value === null || value === undefined) return null;
  return expectString(value, context);
}

function expectNumber(value: unknown, context: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${context} must be a finite number`);
  }
  return value;
}

function expectDateStrategy(value: unknown): LinkedActionDateStrategy {
  const dateStrategy = expectString(value, 'dateStrategy');
  if (!['today', 'source_date'].includes(dateStrategy)) {
    throw new Error('dateStrategy must be today or source_date');
  }
  return dateStrategy as LinkedActionDateStrategy;
}

function expectMealType(value: unknown): LinkedActionMealType {
  const mealType = expectString(value, 'calorie.log mealType');
  if (!['breakfast', 'lunch', 'dinner', 'snack'].includes(mealType)) {
    throw new Error('calorie.log mealType must be breakfast, lunch, dinner, or snack');
  }
  return mealType as LinkedActionMealType;
}

function expectPomodoroSessionType(value: unknown): LinkedActionPomodoroSessionType {
  const sessionType = expectString(value, 'pomodoro.log sessionType');
  if (!['focus', 'short_break', 'long_break'].includes(sessionType)) {
    throw new Error('pomodoro.log sessionType must be focus, short_break, or long_break');
  }
  return sessionType as LinkedActionPomodoroSessionType;
}

export function parseLinkedActionEffectPayload(
  effectType: LinkedActionEffectType,
  rawPayload: string,
): LinkedActionEffectDefinition {
  const parsed = expectJsonObject(rawPayload, `${effectType} payload`);

  switch (effectType) {
    case 'todo.complete':
      return { kind: 'binary', type: 'todo.complete' };
    case 'habit.increment':
      return {
        kind: 'progress',
        type: 'habit.increment',
        amount: expectNumber(parsed.amount, 'habit.increment amount'),
        dateStrategy: expectDateStrategy(parsed.dateStrategy),
      };
    case 'habit.ensure_daily_target': {
      const minimumCount = parsed.minimumCount;
      if (
        minimumCount !== 'target_per_day' &&
        (typeof minimumCount !== 'number' || !Number.isFinite(minimumCount))
      ) {
        throw new Error(
          'habit.ensure_daily_target minimumCount must be a finite number or target_per_day',
        );
      }
      return {
        kind: 'progress',
        type: 'habit.ensure_daily_target',
        minimumCount,
        dateStrategy: expectDateStrategy(parsed.dateStrategy),
      };
    }
    case 'calorie.log': {
      const templateSource = expectString(parsed.templateSource, 'calorie.log templateSource');
      if (!['inline', 'saved_meal'].includes(templateSource)) {
        throw new Error('calorie.log templateSource must be inline or saved_meal');
      }
      return {
        kind: 'log',
        type: 'calorie.log',
        dateStrategy: expectDateStrategy(parsed.dateStrategy),
        templateSource: templateSource as 'inline' | 'saved_meal',
        savedMealId: expectNullableString(parsed.savedMealId, 'calorie.log savedMealId'),
        foodName: expectString(parsed.foodName, 'calorie.log foodName'),
        calories: expectNumber(parsed.calories, 'calorie.log calories'),
        protein: expectNumber(parsed.protein, 'calorie.log protein'),
        carbs: expectNumber(parsed.carbs, 'calorie.log carbs'),
        fats: expectNumber(parsed.fats, 'calorie.log fats'),
        fiber: expectNumber(parsed.fiber, 'calorie.log fiber'),
        mealType: expectMealType(parsed.mealType),
      };
    }
    case 'workout.log':
      return {
        kind: 'log',
        type: 'workout.log',
        notes: expectNullableString(parsed.notes, 'workout.log notes'),
      };
    case 'pomodoro.log':
      return {
        kind: 'log',
        type: 'pomodoro.log',
        sessionType: expectPomodoroSessionType(parsed.sessionType),
        durationSeconds: expectNumber(parsed.durationSeconds, 'pomodoro.log durationSeconds'),
      };
  }
}

export function serializeLinkedActionEffectPayload(effect: LinkedActionEffectDefinition): string {
  switch (effect.type) {
    case 'todo.complete':
      return JSON.stringify({});
    case 'habit.increment':
      return JSON.stringify({
        amount: effect.amount,
        dateStrategy: effect.dateStrategy,
      });
    case 'habit.ensure_daily_target':
      return JSON.stringify({
        minimumCount: effect.minimumCount,
        dateStrategy: effect.dateStrategy,
      });
    case 'calorie.log':
      return JSON.stringify({
        dateStrategy: effect.dateStrategy,
        templateSource: effect.templateSource,
        savedMealId: effect.savedMealId,
        foodName: effect.foodName,
        calories: effect.calories,
        protein: effect.protein,
        carbs: effect.carbs,
        fats: effect.fats,
        fiber: effect.fiber,
        mealType: effect.mealType,
      });
    case 'workout.log':
      return JSON.stringify({ notes: effect.notes });
    case 'pomodoro.log':
      return JSON.stringify({
        sessionType: effect.sessionType,
        durationSeconds: effect.durationSeconds,
      });
  }
}

export function assertValidLinkedActionRuleShape(
  source: LinkedActionRuleSource,
  target: LinkedActionRuleTarget,
  directionPolicy: LinkedActionDirectionPolicy = 'one_way',
): void {
  if (!isAllowedLinkedActionSourceEntity(source.feature, source.entityType)) {
    throw new Error(
      `Source entity type ${source.entityType} is not allowed for feature ${source.feature}`,
    );
  }
  if (!isAllowedLinkedActionTrigger(source.entityType, source.triggerType)) {
    throw new Error(
      `Trigger ${source.triggerType} is not allowed for source entity ${source.entityType}`,
    );
  }
  if (!isSupportedLinkedActionTriggerType(source.triggerType)) {
    throw new Error(`Trigger ${String(source.triggerType)} is not currently supported.`);
  }
  if (!isAllowedLinkedActionTargetEntity(target.feature, target.entityType)) {
    throw new Error(
      `Target entity type ${target.entityType} is not allowed for feature ${target.feature}`,
    );
  }
  if (!isSupportedLinkedActionTargetEntity(target.feature, target.entityType)) {
    throw new Error(
      `Target entity type ${target.entityType} is not currently supported for feature ${target.feature}`,
    );
  }
  if (!isAllowedLinkedActionEffect(target.entityType, target.effect.type)) {
    throw new Error(
      `Effect ${target.effect.type} is not allowed for target entity ${target.entityType}`,
    );
  }
  if (!isSupportedLinkedActionEffect(target.entityType, target.effect.type)) {
    throw new Error(
      `Effect ${target.effect.type} is not currently supported for target entity ${target.entityType}`,
    );
  }
  if (
    !supportsLinkedActionDirectionPolicy({
      directionPolicy,
      triggerType: source.triggerType,
      effectType: target.effect.type,
    })
  ) {
    throw new Error(
      `Direction policy ${directionPolicy} is not supported for trigger ${source.triggerType} and effect ${target.effect.type}.`,
    );
  }
  if (!isSupportedLinkedActionRulePath(source, target)) {
    throw new Error(LINKED_ACTION_UNSUPPORTED_RULE_MESSAGE);
  }
}

export function normalizeLinkedActionRuleRow(row: LinkedActionRuleRow): LinkedActionRuleDefinition {
  if (!isLinkedActionRuleStatus(row.status)) {
    throw new Error(`Unknown linked action rule status: ${row.status}`);
  }
  if (!isLinkedActionDirectionPolicy(row.direction_policy)) {
    throw new Error(`Unknown linked action direction policy: ${row.direction_policy}`);
  }
  if (!isLinkedActionFeature(row.source_feature)) {
    throw new Error(`Unknown linked action source feature: ${row.source_feature}`);
  }
  if (!isLinkedActionSourceEntityType(row.source_entity_type)) {
    throw new Error(`Unknown linked action source entity type: ${row.source_entity_type}`);
  }
  if (!isLinkedActionTriggerType(row.trigger_type)) {
    throw new Error(`Unknown linked action trigger type: ${row.trigger_type}`);
  }

  const source: LinkedActionRuleSource = {
    feature: row.source_feature,
    entityType: row.source_entity_type,
    entityId: row.source_entity_id,
    triggerType: row.trigger_type,
  };

  if (!isAllowedLinkedActionSourceEntity(source.feature, source.entityType)) {
    throw new Error(
      `Source entity type ${source.entityType} is not allowed for feature ${source.feature}`,
    );
  }
  if (!isAllowedLinkedActionTrigger(source.entityType, source.triggerType)) {
    throw new Error(
      `Trigger ${source.triggerType} is not allowed for source entity ${source.entityType}`,
    );
  }

  const unsupportedRule = (reason: string): LinkedActionUnsupportedRuleDefinition => ({
    id: row.id,
    status: row.status as LinkedActionRuleStatus,
    directionPolicy: row.direction_policy as LinkedActionDirectionPolicy,
    bidirectionalGroupId: row.bidirectional_group_id,
    source,
    target: {
      feature: row.target_feature,
      entityType: row.target_entity_type,
      entityId: row.target_entity_id,
      effect: {
        kind: 'unsupported',
        type: row.effect_type,
        rawPayload: row.effect_payload,
      },
    },
    isUnsupported: true,
    unsupportedReason: reason,
    rawTargetFeature: row.target_feature,
    rawTargetEntityType: row.target_entity_type,
    rawEffectType: row.effect_type,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  });

  if (!isLinkedActionFeature(row.target_feature)) {
    return unsupportedRule(`Unknown linked action target feature: ${row.target_feature}`);
  }
  if (!isLinkedActionTargetEntityType(row.target_entity_type)) {
    return unsupportedRule(`Unknown linked action target entity type: ${row.target_entity_type}`);
  }
  if (!isAllowedLinkedActionTargetEntity(row.target_feature, row.target_entity_type)) {
    return unsupportedRule(
      `Target entity type ${row.target_entity_type} is not allowed for feature ${row.target_feature}`,
    );
  }
  if (!isLinkedActionEffectType(row.effect_type)) {
    return unsupportedRule(`Unknown linked action effect type: ${row.effect_type}`);
  }
  if (!isAllowedLinkedActionEffect(row.target_entity_type, row.effect_type)) {
    return unsupportedRule(
      `Effect ${row.effect_type} is not allowed for target entity ${row.target_entity_type}`,
    );
  }
  if (
    !isSupportedLinkedActionTargetEntity(row.target_feature, row.target_entity_type) ||
    !isSupportedLinkedActionEffect(row.target_entity_type, row.effect_type)
  ) {
    return unsupportedRule(LINKED_ACTION_UNSUPPORTED_RULE_MESSAGE);
  }

  try {
    const target: LinkedActionRuleTarget = {
      feature: row.target_feature,
      entityType: row.target_entity_type,
      entityId: row.target_entity_id,
      effect: parseLinkedActionEffectPayload(row.effect_type, row.effect_payload),
    };

    assertValidLinkedActionRuleShape(source, target, row.direction_policy);

    return {
      id: row.id,
      status: row.status,
      directionPolicy: row.direction_policy,
      bidirectionalGroupId: row.bidirectional_group_id,
      source,
      target,
      isUnsupported: false,
      unsupportedReason: null,
      rawTargetFeature: row.target_feature,
      rawTargetEntityType: row.target_entity_type,
      rawEffectType: row.effect_type,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at,
    };
  } catch (error) {
    return unsupportedRule(
      error instanceof Error ? error.message : LINKED_ACTION_UNSUPPORTED_RULE_MESSAGE,
    );
  }
}

export function buildLinkedActionRuleRow(rule: LinkedActionRuleDefinition): LinkedActionRuleRow {
  if (rule.isUnsupported) {
    throw new Error('Unsupported linked action rules must be removed or replaced before saving.');
  }

  assertValidLinkedActionRuleShape(rule.source, rule.target, rule.directionPolicy);

  return {
    id: rule.id,
    status: rule.status,
    direction_policy: rule.directionPolicy,
    bidirectional_group_id: rule.bidirectionalGroupId,
    source_feature: rule.source.feature,
    source_entity_type: rule.source.entityType,
    source_entity_id: rule.source.entityId,
    trigger_type: rule.source.triggerType,
    target_feature: rule.target.feature,
    target_entity_type: rule.target.entityType,
    target_entity_id: rule.target.entityId,
    effect_type: rule.target.effect.type,
    effect_payload: serializeLinkedActionEffectPayload(rule.target.effect),
    created_at: rule.createdAt,
    updated_at: rule.updatedAt,
    deleted_at: rule.deletedAt,
  };
}

export function parseLinkedActionRuleRecord(value: unknown): LinkedActionRuleDefinition {
  const raw = expectObject(value, 'linked action rule');
  const source = expectObject(raw.source, 'linked action source');
  const target = expectObject(raw.target, 'linked action target');
  const effect = expectObject(target.effect, 'linked action effect');
  const effectType = expectString(effect.type, 'linked action effect type');

  return normalizeLinkedActionRuleRow({
    id: expectString(raw.id, 'linked action id'),
    status: expectString(raw.status, 'linked action status'),
    direction_policy: expectString(raw.directionPolicy, 'linked action directionPolicy'),
    bidirectional_group_id: expectNullableString(
      raw.bidirectionalGroupId,
      'linked action bidirectionalGroupId',
    ),
    source_feature: expectString(source.feature, 'linked action source feature'),
    source_entity_type: expectString(source.entityType, 'linked action source entityType'),
    source_entity_id: expectNullableString(source.entityId, 'linked action source entityId'),
    trigger_type: expectString(source.triggerType, 'linked action source triggerType'),
    target_feature: expectString(target.feature, 'linked action target feature'),
    target_entity_type: expectString(target.entityType, 'linked action target entityType'),
    target_entity_id: expectNullableString(target.entityId, 'linked action target entityId'),
    effect_type: effectType,
    effect_payload: JSON.stringify(effect),
    created_at: expectString(raw.createdAt, 'linked action createdAt'),
    updated_at: expectString(raw.updatedAt, 'linked action updatedAt'),
    deleted_at: expectNullableString(raw.deletedAt, 'linked action deletedAt'),
  });
}

export function buildLinkedActionEventRow(
  event: LinkedActionEventRecord,
  createdAt: string,
): LinkedActionEventRow {
  return {
    id: event.eventId,
    chain_id: event.chain.chainId,
    root_event_id: event.chain.rootEventId,
    parent_event_id: event.chain.parentEventId,
    chain_depth: event.chain.depth,
    origin_kind: event.origin.originKind,
    origin_rule_id: event.origin.originRuleId,
    origin_event_id: event.origin.originEventId,
    source_feature: event.feature,
    source_entity_type: event.entityType,
    source_entity_id: event.entityId,
    trigger_type: event.triggerType,
    source_record_id: event.sourceRecordId,
    source_date_key: event.sourceDateKey,
    source_label: event.label,
    occurred_at: event.occurredAt,
    payload: JSON.stringify(event.payload),
    created_at: createdAt,
  };
}

export function normalizeLinkedActionEventRow(row: LinkedActionEventRow): LinkedActionEventRecord {
  if (!isLinkedActionFeature(row.source_feature)) {
    throw new Error(`Unknown linked action event source feature: ${row.source_feature}`);
  }
  if (!isLinkedActionSourceEntityType(row.source_entity_type)) {
    throw new Error(`Unknown linked action event source entity type: ${row.source_entity_type}`);
  }
  if (!isLinkedActionTriggerType(row.trigger_type)) {
    throw new Error(`Unknown linked action event trigger type: ${row.trigger_type}`);
  }
  if (!['user', 'linked_action', 'system'].includes(row.origin_kind)) {
    throw new Error(`Unknown linked action event origin kind: ${row.origin_kind}`);
  }

  const payload: unknown = JSON.parse(row.payload);
  const parsedPayload =
    typeof payload === 'object' && payload !== null && !Array.isArray(payload)
      ? (payload as Record<string, unknown>)
      : {};

  return {
    eventId: row.id,
    feature: row.source_feature,
    entityType: row.source_entity_type,
    entityId: row.source_entity_id,
    triggerType: row.trigger_type,
    sourceRecordId: row.source_record_id,
    sourceDateKey: row.source_date_key,
    occurredAt: row.occurred_at,
    label: row.source_label,
    payload: parsedPayload,
    origin: {
      originKind: row.origin_kind as LinkedActionOriginKind,
      originRuleId: row.origin_rule_id,
      originEventId: row.origin_event_id,
    },
    chain: {
      chainId: row.chain_id,
      rootEventId: row.root_event_id,
      parentEventId: row.parent_event_id,
      depth: row.chain_depth,
    },
  };
}

export function buildLinkedActionExecutionRow(
  execution: LinkedActionExecutionRecord,
): LinkedActionExecutionRow {
  return {
    id: execution.id,
    rule_id: execution.ruleId,
    source_event_id: execution.sourceEventId,
    chain_id: execution.chainId,
    root_event_id: execution.rootEventId,
    origin_rule_id: execution.originRuleId,
    effect_type: execution.effectType,
    effect_fingerprint: execution.effectFingerprint,
    status: execution.status,
    target_feature: execution.targetFeature,
    target_entity_type: execution.targetEntityType,
    target_entity_id: execution.targetEntityId,
    produced_entity_type: execution.producedEntityType,
    produced_entity_id: execution.producedEntityId,
    notice_payload: execution.noticePayload ? JSON.stringify(execution.noticePayload) : null,
    error_message: execution.errorMessage,
    created_at: execution.createdAt,
    updated_at: execution.updatedAt,
  };
}

export function normalizeLinkedActionExecutionRow(
  row: LinkedActionExecutionRow,
): LinkedActionExecutionRecord {
  if (!isLinkedActionEffectType(row.effect_type)) {
    throw new Error(`Unknown linked action execution effect type: ${row.effect_type}`);
  }
  if (!isLinkedActionExecutionStatus(row.status)) {
    throw new Error(`Unknown linked action execution status: ${row.status}`);
  }
  if (!isLinkedActionFeature(row.target_feature)) {
    throw new Error(`Unknown linked action execution target feature: ${row.target_feature}`);
  }
  if (!isLinkedActionTargetEntityType(row.target_entity_type)) {
    throw new Error(
      `Unknown linked action execution target entity type: ${row.target_entity_type}`,
    );
  }

  return {
    id: row.id,
    ruleId: row.rule_id,
    sourceEventId: row.source_event_id,
    chainId: row.chain_id,
    rootEventId: row.root_event_id,
    originRuleId: row.origin_rule_id,
    effectType: row.effect_type,
    effectFingerprint: row.effect_fingerprint,
    status: row.status,
    targetFeature: row.target_feature,
    targetEntityType: row.target_entity_type,
    targetEntityId: row.target_entity_id,
    producedEntityType:
      (row.produced_entity_type as LinkedActionEffectProducedEntityType | null) ?? null,
    producedEntityId: row.produced_entity_id,
    noticePayload: row.notice_payload
      ? (JSON.parse(row.notice_payload) as LinkedActionsNoticePayload)
      : null,
    errorMessage: row.error_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
