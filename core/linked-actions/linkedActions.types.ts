export const LINKED_ACTION_RULE_STATUSES = ["active", "paused"] as const;
export type LinkedActionRuleStatus = (typeof LINKED_ACTION_RULE_STATUSES)[number];

export const LINKED_ACTION_DIRECTION_POLICIES = [
  "one_way",
  "bidirectional_peer",
] as const;
export type LinkedActionDirectionPolicy = (typeof LINKED_ACTION_DIRECTION_POLICIES)[number];

export const LINKED_ACTION_FEATURES = [
  "todos",
  "habits",
  "calories",
  "workout",
  "pomodoro",
] as const;
export type LinkedActionFeature = (typeof LINKED_ACTION_FEATURES)[number];

export const LINKED_ACTION_SOURCE_ENTITY_TYPES_BY_FEATURE = {
  todos: ["todo"],
  habits: ["habit"],
  calories: ["calorie_log"],
  workout: ["workout_routine"],
  pomodoro: ["pomodoro_timer"],
} as const;

export const LINKED_ACTION_TARGET_ENTITY_TYPES_BY_FEATURE = {
  todos: ["todo"],
  habits: ["habit"],
  calories: ["calorie_log"],
  workout: ["workout_routine"],
  pomodoro: ["pomodoro_session"],
} as const;

type ValueOfConstArrays<T extends Record<string, readonly string[]>> = T[keyof T][number];

export type LinkedActionSourceEntityType = ValueOfConstArrays<
  typeof LINKED_ACTION_SOURCE_ENTITY_TYPES_BY_FEATURE
>;

export type LinkedActionTargetEntityType = ValueOfConstArrays<
  typeof LINKED_ACTION_TARGET_ENTITY_TYPES_BY_FEATURE
>;

export const LINKED_ACTION_TRIGGER_TYPES_BY_SOURCE_ENTITY = {
  todo: ["todo.completed"],
  habit: ["habit.progress_incremented", "habit.completed_for_day"],
  calorie_log: ["calorie.entry_logged"],
  workout_routine: ["workout.completed"],
  pomodoro_timer: ["pomodoro.focus_completed"],
} as const;

export type LinkedActionTriggerType = ValueOfConstArrays<
  typeof LINKED_ACTION_TRIGGER_TYPES_BY_SOURCE_ENTITY
>;

export const LINKED_ACTION_EFFECT_TYPES_BY_TARGET_ENTITY = {
  todo: ["todo.complete"],
  habit: ["habit.increment", "habit.ensure_daily_target"],
  calorie_log: ["calorie.log"],
  workout_routine: ["workout.log"],
  pomodoro_session: ["pomodoro.log"],
} as const;

export type LinkedActionEffectType = ValueOfConstArrays<
  typeof LINKED_ACTION_EFFECT_TYPES_BY_TARGET_ENTITY
>;

export type LinkedActionDateStrategy = "today" | "source_date";
export type LinkedActionMealType = "breakfast" | "lunch" | "dinner" | "snack";
export type LinkedActionPomodoroSessionType = "focus" | "short_break" | "long_break";

export type LinkedActionBinaryEffectDefinition = {
  kind: "binary";
  type: "todo.complete";
};

export type LinkedActionHabitIncrementEffectDefinition = {
  kind: "progress";
  type: "habit.increment";
  amount: number;
  dateStrategy: LinkedActionDateStrategy;
};

export type LinkedActionHabitEnsureTargetEffectDefinition = {
  kind: "progress";
  type: "habit.ensure_daily_target";
  minimumCount: number | "target_per_day";
  dateStrategy: LinkedActionDateStrategy;
};

export type LinkedActionCalorieLogEffectDefinition = {
  kind: "log";
  type: "calorie.log";
  dateStrategy: LinkedActionDateStrategy;
  templateSource: "inline" | "saved_meal";
  savedMealId: string | null;
  foodName: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  fiber: number;
  mealType: LinkedActionMealType;
};

export type LinkedActionWorkoutLogEffectDefinition = {
  kind: "log";
  type: "workout.log";
  notes: string | null;
};

export type LinkedActionPomodoroLogEffectDefinition = {
  kind: "log";
  type: "pomodoro.log";
  sessionType: LinkedActionPomodoroSessionType;
  durationSeconds: number;
};

export type LinkedActionEffectDefinition =
  | LinkedActionBinaryEffectDefinition
  | LinkedActionHabitIncrementEffectDefinition
  | LinkedActionHabitEnsureTargetEffectDefinition
  | LinkedActionCalorieLogEffectDefinition
  | LinkedActionWorkoutLogEffectDefinition
  | LinkedActionPomodoroLogEffectDefinition;

export type LinkedActionRuleSource = {
  feature: LinkedActionFeature;
  entityType: LinkedActionSourceEntityType;
  entityId: string | null;
  triggerType: LinkedActionTriggerType;
};

export type LinkedActionRuleTarget = {
  feature: LinkedActionFeature;
  entityType: LinkedActionTargetEntityType;
  entityId: string | null;
  effect: LinkedActionEffectDefinition;
};

export type LinkedActionRuleDefinition = {
  id: string;
  status: LinkedActionRuleStatus;
  directionPolicy: LinkedActionDirectionPolicy;
  bidirectionalGroupId: string | null;
  source: LinkedActionRuleSource;
  target: LinkedActionRuleTarget;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type CreateLinkedActionRuleInput = {
  status?: LinkedActionRuleStatus;
  directionPolicy?: LinkedActionDirectionPolicy;
  bidirectionalGroupId?: string | null;
  source: LinkedActionRuleSource;
  target: LinkedActionRuleTarget;
};

export type LinkedActionRuleRow = {
  id: string;
  status: string;
  direction_policy: string;
  bidirectional_group_id: string | null;
  source_feature: string;
  source_entity_type: string;
  source_entity_id: string | null;
  trigger_type: string;
  target_feature: string;
  target_entity_type: string;
  target_entity_id: string | null;
  effect_type: string;
  effect_payload: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type LinkedActionOriginKind = "user" | "linked_action" | "system";

export type LinkedActionOriginMetadata = {
  originKind: LinkedActionOriginKind;
  originRuleId: string | null;
  originEventId: string | null;
};

export type LinkedActionChainMetadata = {
  chainId: string;
  rootEventId: string;
  parentEventId: string | null;
  depth: number;
};

export type LinkedActionDedupeMetadata = {
  sourceEventId: string;
  sourceRecordId: string | null;
  idempotencyKey: string;
  effectFingerprint: string;
};

export type LinkedActionNotificationRecord = {
  id: string;
  status: "pending" | "shown" | "read" | "dismissed";
  title: string;
  body: string;
  targetFeature: LinkedActionFeature;
  targetEntityType: LinkedActionTargetEntityType | null;
  targetEntityId: string | null;
  createdAt: string;
  readAt: string | null;
  dismissedAt: string | null;
};

function objectValues<T extends Record<string, readonly string[]>>(record: T) {
  return Object.values(record) as Array<T[keyof T]>;
}

function isStringArrayMember<T extends readonly string[]>(
  values: T,
  value: string,
): value is T[number] {
  return values.includes(value);
}

function flattenConstArrays<T extends Record<string, readonly string[]>>(
  record: T,
): Array<T[keyof T][number]> {
  return objectValues(record).flatMap((value) => [...value]);
}

const ALL_LINKED_ACTION_SOURCE_ENTITY_TYPES = flattenConstArrays(
  LINKED_ACTION_SOURCE_ENTITY_TYPES_BY_FEATURE,
);
const ALL_LINKED_ACTION_TARGET_ENTITY_TYPES = flattenConstArrays(
  LINKED_ACTION_TARGET_ENTITY_TYPES_BY_FEATURE,
);
const ALL_LINKED_ACTION_TRIGGER_TYPES = flattenConstArrays(
  LINKED_ACTION_TRIGGER_TYPES_BY_SOURCE_ENTITY,
);
const ALL_LINKED_ACTION_EFFECT_TYPES = flattenConstArrays(
  LINKED_ACTION_EFFECT_TYPES_BY_TARGET_ENTITY,
);

function expectObject(value: unknown, context: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${context} must be a JSON object`);
  }
  return value as Record<string, unknown>;
}

function expectString(value: unknown, context: string): string {
  if (typeof value !== "string") {
    throw new Error(`${context} must be a string`);
  }
  return value;
}

function expectNullableString(value: unknown, context: string): string | null {
  if (value === null || value === undefined) return null;
  return expectString(value, context);
}

function expectNumber(value: unknown, context: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${context} must be a finite number`);
  }
  return value;
}

function expectDateStrategy(value: unknown): LinkedActionDateStrategy {
  const dateStrategy = expectString(value, "dateStrategy");
  if (!["today", "source_date"].includes(dateStrategy)) {
    throw new Error("dateStrategy must be today or source_date");
  }
  return dateStrategy as LinkedActionDateStrategy;
}

function expectMealType(value: unknown): LinkedActionMealType {
  const mealType = expectString(value, "calorie.log mealType");
  if (!["breakfast", "lunch", "dinner", "snack"].includes(mealType)) {
    throw new Error("calorie.log mealType must be breakfast, lunch, dinner, or snack");
  }
  return mealType as LinkedActionMealType;
}

function expectPomodoroSessionType(value: unknown): LinkedActionPomodoroSessionType {
  const sessionType = expectString(value, "pomodoro.log sessionType");
  if (!["focus", "short_break", "long_break"].includes(sessionType)) {
    throw new Error("pomodoro.log sessionType must be focus, short_break, or long_break");
  }
  return sessionType as LinkedActionPomodoroSessionType;
}

export function isLinkedActionRuleStatus(value: string): value is LinkedActionRuleStatus {
  return isStringArrayMember(LINKED_ACTION_RULE_STATUSES, value);
}

export function isLinkedActionDirectionPolicy(
  value: string,
): value is LinkedActionDirectionPolicy {
  return isStringArrayMember(LINKED_ACTION_DIRECTION_POLICIES, value);
}

export function isLinkedActionFeature(value: string): value is LinkedActionFeature {
  return isStringArrayMember(LINKED_ACTION_FEATURES, value);
}

export function isLinkedActionSourceEntityType(
  value: string,
): value is LinkedActionSourceEntityType {
  return ALL_LINKED_ACTION_SOURCE_ENTITY_TYPES.includes(value as LinkedActionSourceEntityType);
}

export function isLinkedActionTargetEntityType(
  value: string,
): value is LinkedActionTargetEntityType {
  return ALL_LINKED_ACTION_TARGET_ENTITY_TYPES.includes(value as LinkedActionTargetEntityType);
}

export function isLinkedActionTriggerType(value: string): value is LinkedActionTriggerType {
  return ALL_LINKED_ACTION_TRIGGER_TYPES.includes(value as LinkedActionTriggerType);
}

export function isLinkedActionEffectType(value: string): value is LinkedActionEffectType {
  return ALL_LINKED_ACTION_EFFECT_TYPES.includes(value as LinkedActionEffectType);
}

export function isAllowedLinkedActionSourceEntity(
  feature: LinkedActionFeature,
  entityType: LinkedActionSourceEntityType,
): boolean {
  return LINKED_ACTION_SOURCE_ENTITY_TYPES_BY_FEATURE[feature].includes(entityType as never);
}

export function isAllowedLinkedActionTargetEntity(
  feature: LinkedActionFeature,
  entityType: LinkedActionTargetEntityType,
): boolean {
  return LINKED_ACTION_TARGET_ENTITY_TYPES_BY_FEATURE[feature].includes(entityType as never);
}

export function isAllowedLinkedActionTrigger(
  entityType: LinkedActionSourceEntityType,
  triggerType: LinkedActionTriggerType,
): boolean {
  return LINKED_ACTION_TRIGGER_TYPES_BY_SOURCE_ENTITY[entityType].includes(triggerType as never);
}

export function isAllowedLinkedActionEffect(
  entityType: LinkedActionTargetEntityType,
  effectType: LinkedActionEffectType,
): boolean {
  return LINKED_ACTION_EFFECT_TYPES_BY_TARGET_ENTITY[entityType].includes(effectType as never);
}

export function parseLinkedActionEffectPayload(
  effectType: LinkedActionEffectType,
  rawPayload: string,
): LinkedActionEffectDefinition {
  const parsed = expectObject(JSON.parse(rawPayload), `${effectType} payload`);

  switch (effectType) {
    case "todo.complete":
      return { kind: "binary", type: "todo.complete" };
    case "habit.increment":
      return {
        kind: "progress",
        type: "habit.increment",
        amount: expectNumber(parsed.amount, "habit.increment amount"),
        dateStrategy: expectDateStrategy(parsed.dateStrategy),
      };
    case "habit.ensure_daily_target": {
      const minimumCount = parsed.minimumCount;
      if (
        minimumCount !== "target_per_day" &&
        (typeof minimumCount !== "number" || !Number.isFinite(minimumCount))
      ) {
        throw new Error(
          "habit.ensure_daily_target minimumCount must be a finite number or target_per_day",
        );
      }
      return {
        kind: "progress",
        type: "habit.ensure_daily_target",
        minimumCount,
        dateStrategy: expectDateStrategy(parsed.dateStrategy),
      };
    }
    case "calorie.log": {
      const templateSource = expectString(parsed.templateSource, "calorie.log templateSource");
      if (!["inline", "saved_meal"].includes(templateSource)) {
        throw new Error("calorie.log templateSource must be inline or saved_meal");
      }
      return {
        kind: "log",
        type: "calorie.log",
        dateStrategy: expectDateStrategy(parsed.dateStrategy),
        templateSource: templateSource as "inline" | "saved_meal",
        savedMealId: expectNullableString(parsed.savedMealId, "calorie.log savedMealId"),
        foodName: expectString(parsed.foodName, "calorie.log foodName"),
        calories: expectNumber(parsed.calories, "calorie.log calories"),
        protein: expectNumber(parsed.protein, "calorie.log protein"),
        carbs: expectNumber(parsed.carbs, "calorie.log carbs"),
        fats: expectNumber(parsed.fats, "calorie.log fats"),
        fiber: expectNumber(parsed.fiber, "calorie.log fiber"),
        mealType: expectMealType(parsed.mealType),
      };
    }
    case "workout.log":
      return {
        kind: "log",
        type: "workout.log",
        notes: expectNullableString(parsed.notes, "workout.log notes"),
      };
    case "pomodoro.log":
      return {
        kind: "log",
        type: "pomodoro.log",
        sessionType: expectPomodoroSessionType(parsed.sessionType),
        durationSeconds: expectNumber(parsed.durationSeconds, "pomodoro.log durationSeconds"),
      };
  }
}

export function serializeLinkedActionEffectPayload(
  effect: LinkedActionEffectDefinition,
): string {
  switch (effect.type) {
    case "todo.complete":
      return JSON.stringify({});
    case "habit.increment":
      return JSON.stringify({
        amount: effect.amount,
        dateStrategy: effect.dateStrategy,
      });
    case "habit.ensure_daily_target":
      return JSON.stringify({
        minimumCount: effect.minimumCount,
        dateStrategy: effect.dateStrategy,
      });
    case "calorie.log":
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
    case "workout.log":
      return JSON.stringify({ notes: effect.notes });
    case "pomodoro.log":
      return JSON.stringify({
        sessionType: effect.sessionType,
        durationSeconds: effect.durationSeconds,
      });
  }
}

export function assertValidLinkedActionRuleShape(
  source: LinkedActionRuleSource,
  target: LinkedActionRuleTarget,
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
  if (!isAllowedLinkedActionTargetEntity(target.feature, target.entityType)) {
    throw new Error(
      `Target entity type ${target.entityType} is not allowed for feature ${target.feature}`,
    );
  }
  if (!isAllowedLinkedActionEffect(target.entityType, target.effect.type)) {
    throw new Error(
      `Effect ${target.effect.type} is not allowed for target entity ${target.entityType}`,
    );
  }
}

export function normalizeLinkedActionRuleRow(
  row: LinkedActionRuleRow,
): LinkedActionRuleDefinition {
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
  if (!isLinkedActionFeature(row.target_feature)) {
    throw new Error(`Unknown linked action target feature: ${row.target_feature}`);
  }
  if (!isLinkedActionTargetEntityType(row.target_entity_type)) {
    throw new Error(`Unknown linked action target entity type: ${row.target_entity_type}`);
  }
  if (!isLinkedActionEffectType(row.effect_type)) {
    throw new Error(`Unknown linked action effect type: ${row.effect_type}`);
  }

  const source: LinkedActionRuleSource = {
    feature: row.source_feature,
    entityType: row.source_entity_type,
    entityId: row.source_entity_id,
    triggerType: row.trigger_type,
  };

  const target: LinkedActionRuleTarget = {
    feature: row.target_feature,
    entityType: row.target_entity_type,
    entityId: row.target_entity_id,
    effect: parseLinkedActionEffectPayload(row.effect_type, row.effect_payload),
  };

  assertValidLinkedActionRuleShape(source, target);

  return {
    id: row.id,
    status: row.status,
    directionPolicy: row.direction_policy,
    bidirectionalGroupId: row.bidirectional_group_id,
    source,
    target,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export function buildLinkedActionRuleRow(
  rule: LinkedActionRuleDefinition,
): LinkedActionRuleRow {
  assertValidLinkedActionRuleShape(rule.source, rule.target);

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
  const raw = expectObject(value, "linked action rule");
  const source = expectObject(raw.source, "linked action source");
  const target = expectObject(raw.target, "linked action target");
  const effect = expectObject(target.effect, "linked action effect");
  const effectType = expectString(effect.type, "linked action effect type");

  if (!isLinkedActionEffectType(effectType)) {
    throw new Error(`Unknown linked action effect type: ${effectType}`);
  }

  return normalizeLinkedActionRuleRow({
    id: expectString(raw.id, "linked action id"),
    status: expectString(raw.status, "linked action status"),
    direction_policy: expectString(raw.directionPolicy, "linked action directionPolicy"),
    bidirectional_group_id: expectNullableString(
      raw.bidirectionalGroupId,
      "linked action bidirectionalGroupId",
    ),
    source_feature: expectString(source.feature, "linked action source feature"),
    source_entity_type: expectString(source.entityType, "linked action source entityType"),
    source_entity_id: expectNullableString(source.entityId, "linked action source entityId"),
    trigger_type: expectString(source.triggerType, "linked action source triggerType"),
    target_feature: expectString(target.feature, "linked action target feature"),
    target_entity_type: expectString(target.entityType, "linked action target entityType"),
    target_entity_id: expectNullableString(target.entityId, "linked action target entityId"),
    effect_type: effectType,
    effect_payload: JSON.stringify(effect),
    created_at: expectString(raw.createdAt, "linked action createdAt"),
    updated_at: expectString(raw.updatedAt, "linked action updatedAt"),
    deleted_at: expectNullableString(raw.deletedAt, "linked action deletedAt"),
  });
}
