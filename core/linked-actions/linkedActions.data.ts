import { getDatabase } from "@/core/db/client";
import { createId } from "@/lib/id";
import { nowIso } from "@/lib/time";
import {
  type CreateLinkedActionRuleInput,
  type LinkedActionEventRecord,
  type LinkedActionEventRow,
  type LinkedActionExecutionRecord,
  type LinkedActionExecutionRow,
  type LinkedActionFeature,
  type LinkedActionRuleDefinition,
  type LinkedActionRuleRow,
  type SaveLinkedActionRuleForSourceInput,
  type LinkedActionSourceEntityType,
  type LinkedActionSourceAction,
  type LinkedActionTriggerType,
  buildLinkedActionEventRow,
  buildLinkedActionExecutionRow,
  buildLinkedActionRuleRow,
  normalizeLinkedActionEventRow,
  normalizeLinkedActionExecutionRow,
  normalizeLinkedActionRuleRow,
} from "@/core/linked-actions/linkedActions.types";

async function insertLinkedActionRuleRow(
  db: Awaited<ReturnType<typeof getDatabase>>,
  row: LinkedActionRuleRow,
): Promise<void> {
  await db.runAsync(
    `INSERT INTO linked_action_rules (
       id,
       status,
       direction_policy,
       bidirectional_group_id,
       source_feature,
       source_entity_type,
       source_entity_id,
       trigger_type,
       target_feature,
       target_entity_type,
       target_entity_id,
       effect_type,
       effect_payload,
       created_at,
       updated_at,
       deleted_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.id,
      row.status,
      row.direction_policy,
      row.bidirectional_group_id,
      row.source_feature,
      row.source_entity_type,
      row.source_entity_id,
      row.trigger_type,
      row.target_feature,
      row.target_entity_type,
      row.target_entity_id,
      row.effect_type,
      row.effect_payload,
      row.created_at,
      row.updated_at,
      row.deleted_at,
    ],
  );
}

async function updateLinkedActionRuleRow(
  db: Awaited<ReturnType<typeof getDatabase>>,
  row: LinkedActionRuleRow,
): Promise<void> {
  await db.runAsync(
    `UPDATE linked_action_rules
     SET status = ?,
         direction_policy = ?,
         bidirectional_group_id = ?,
         source_feature = ?,
         source_entity_type = ?,
         source_entity_id = ?,
         trigger_type = ?,
         target_feature = ?,
         target_entity_type = ?,
         target_entity_id = ?,
         effect_type = ?,
         effect_payload = ?,
         updated_at = ?,
         deleted_at = ?
     WHERE id = ?`,
    [
      row.status,
      row.direction_policy,
      row.bidirectional_group_id,
      row.source_feature,
      row.source_entity_type,
      row.source_entity_id,
      row.trigger_type,
      row.target_feature,
      row.target_entity_type,
      row.target_entity_id,
      row.effect_type,
      row.effect_payload,
      row.updated_at,
      row.deleted_at,
      row.id,
    ],
  );
}

export async function listLinkedActionRules(): Promise<LinkedActionRuleDefinition[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<LinkedActionRuleRow>(
    `SELECT *
     FROM linked_action_rules
     WHERE deleted_at IS NULL
     ORDER BY created_at DESC`,
  );
  return rows.map(normalizeLinkedActionRuleRow);
}

export async function listMatchingLinkedActionRules(
  source: Pick<LinkedActionSourceAction, "feature" | "entityType" | "entityId" | "triggerType">,
): Promise<LinkedActionRuleDefinition[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<LinkedActionRuleRow>(
    `SELECT *
     FROM linked_action_rules
     WHERE deleted_at IS NULL
       AND status = 'active'
       AND source_feature = ?
       AND source_entity_type = ?
       AND trigger_type = ?
       AND (source_entity_id = ? OR source_entity_id IS NULL)
     ORDER BY created_at ASC`,
    [source.feature, source.entityType, source.triggerType, source.entityId],
  );
  return rows.map(normalizeLinkedActionRuleRow);
}

export async function getLinkedActionRule(
  id: string,
): Promise<LinkedActionRuleDefinition | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<LinkedActionRuleRow>(
    `SELECT *
     FROM linked_action_rules
     WHERE id = ?
       AND deleted_at IS NULL`,
    [id],
  );
  return row ? normalizeLinkedActionRuleRow(row) : null;
}

export async function listActiveLinkedActionRulesForSource(input: {
  feature: LinkedActionFeature;
  entityType: LinkedActionSourceEntityType;
  entityId: string;
  triggerType: LinkedActionTriggerType;
}): Promise<LinkedActionRuleDefinition[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<LinkedActionRuleRow>(
    `SELECT *
     FROM linked_action_rules
     WHERE deleted_at IS NULL
       AND status = 'active'
       AND source_feature = ?
       AND source_entity_type = ?
       AND source_entity_id = ?
       AND trigger_type = ?
     ORDER BY created_at DESC`,
    [input.feature, input.entityType, input.entityId, input.triggerType],
  );
  return rows.map(normalizeLinkedActionRuleRow);
}

export async function listLinkedActionRulesForSourceEntity(input: {
  feature: LinkedActionFeature;
  entityType: LinkedActionSourceEntityType;
  entityId: string;
}): Promise<LinkedActionRuleDefinition[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<LinkedActionRuleRow>(
    `SELECT *
     FROM linked_action_rules
     WHERE deleted_at IS NULL
       AND source_feature = ?
       AND source_entity_type = ?
       AND source_entity_id = ?
     ORDER BY created_at DESC`,
    [input.feature, input.entityType, input.entityId],
  );
  return rows.map(normalizeLinkedActionRuleRow);
}

export async function createLinkedActionRule(
  input: CreateLinkedActionRuleInput,
): Promise<LinkedActionRuleDefinition> {
  const now = nowIso();
  const rule: LinkedActionRuleDefinition = {
    id: createId("link"),
    status: input.status ?? "active",
    directionPolicy: input.directionPolicy ?? "one_way",
    bidirectionalGroupId: input.bidirectionalGroupId ?? null,
    source: input.source,
    target: input.target,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };

  const row = buildLinkedActionRuleRow(rule);
  const db = await getDatabase();
  await insertLinkedActionRuleRow(db, row);

  return rule;
}

export async function replaceLinkedActionRulesForSourceEntity(input: {
  feature: LinkedActionFeature;
  entityType: LinkedActionSourceEntityType;
  entityId: string;
  rules: SaveLinkedActionRuleForSourceInput[];
}): Promise<void> {
  const db = await getDatabase();
  const existingRows = await db.getAllAsync<LinkedActionRuleRow>(
    `SELECT *
     FROM linked_action_rules
     WHERE deleted_at IS NULL
       AND source_feature = ?
       AND source_entity_type = ?
       AND source_entity_id = ?`,
    [input.feature, input.entityType, input.entityId],
  );
  const existingById = new Map(
    existingRows.map((row) => [row.id, normalizeLinkedActionRuleRow(row)]),
  );
  const keptRuleIds = new Set<string>();
  const now = nowIso();

  for (const ruleInput of input.rules) {
    const source = {
      feature: input.feature,
      entityType: input.entityType,
      entityId: input.entityId,
      triggerType: ruleInput.triggerType,
    };
    const existingRule =
      ruleInput.existingRuleId ? existingById.get(ruleInput.existingRuleId) : undefined;

    if (existingRule) {
      const updatedRule: LinkedActionRuleDefinition = {
        id: existingRule.id,
        status: ruleInput.status ?? existingRule.status,
        directionPolicy: ruleInput.directionPolicy ?? existingRule.directionPolicy,
        bidirectionalGroupId:
          ruleInput.bidirectionalGroupId ?? existingRule.bidirectionalGroupId,
        source,
        target: ruleInput.target,
        createdAt: existingRule.createdAt,
        updatedAt: now,
        deletedAt: null,
      };
      await updateLinkedActionRuleRow(db, buildLinkedActionRuleRow(updatedRule));
      keptRuleIds.add(existingRule.id);
      continue;
    }

    const createdRule: LinkedActionRuleDefinition = {
      id: createId("link"),
      status: ruleInput.status ?? "active",
      directionPolicy: ruleInput.directionPolicy ?? "one_way",
      bidirectionalGroupId: ruleInput.bidirectionalGroupId ?? null,
      source,
      target: ruleInput.target,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    await insertLinkedActionRuleRow(db, buildLinkedActionRuleRow(createdRule));
    keptRuleIds.add(createdRule.id);
  }

  for (const existingRow of existingRows) {
    if (keptRuleIds.has(existingRow.id)) {
      continue;
    }
    await db.runAsync(
      `UPDATE linked_action_rules
       SET deleted_at = ?, updated_at = ?
       WHERE id = ?
         AND deleted_at IS NULL`,
      [now, now, existingRow.id],
    );
  }
}

export async function updateLinkedActionRuleStatus(
  id: string,
  status: LinkedActionRuleDefinition["status"],
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE linked_action_rules
     SET status = ?, updated_at = ?
     WHERE id = ?
       AND deleted_at IS NULL`,
    [status, nowIso(), id],
  );
}

export async function deleteLinkedActionRule(id: string): Promise<void> {
  const db = await getDatabase();
  const now = nowIso();
  await db.runAsync(
    `UPDATE linked_action_rules
     SET deleted_at = ?, updated_at = ?
     WHERE id = ?
       AND deleted_at IS NULL`,
    [now, now, id],
  );
}

export async function getLinkedActionEvent(
  eventId: string,
): Promise<LinkedActionEventRecord | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<LinkedActionEventRow>(
    `SELECT *
     FROM linked_action_events
     WHERE id = ?`,
    [eventId],
  );
  return row ? normalizeLinkedActionEventRow(row) : null;
}

export async function createLinkedActionEvent(
  event: LinkedActionEventRecord,
): Promise<LinkedActionEventRecord> {
  const row = buildLinkedActionEventRow(event, nowIso());
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO linked_action_events (
       id,
       chain_id,
       root_event_id,
       parent_event_id,
       chain_depth,
       origin_kind,
       origin_rule_id,
       origin_event_id,
       source_feature,
       source_entity_type,
       source_entity_id,
       trigger_type,
       source_record_id,
       source_date_key,
       source_label,
       occurred_at,
       payload,
       created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.id,
      row.chain_id,
      row.root_event_id,
      row.parent_event_id,
      row.chain_depth,
      row.origin_kind,
      row.origin_rule_id,
      row.origin_event_id,
      row.source_feature,
      row.source_entity_type,
      row.source_entity_id,
      row.trigger_type,
      row.source_record_id,
      row.source_date_key,
      row.source_label,
      row.occurred_at,
      row.payload,
      row.created_at,
    ],
  );
  return event;
}

export async function getLinkedActionExecutionByRuleAndSourceEvent(
  ruleId: string,
  sourceEventId: string,
): Promise<LinkedActionExecutionRecord | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<LinkedActionExecutionRow>(
    `SELECT *
     FROM linked_action_executions
     WHERE rule_id = ?
       AND source_event_id = ?`,
    [ruleId, sourceEventId],
  );
  return row ? normalizeLinkedActionExecutionRow(row) : null;
}

export async function getLinkedActionExecutionByChainFingerprint(
  chainId: string,
  ruleId: string,
  effectFingerprint: string,
): Promise<LinkedActionExecutionRecord | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<LinkedActionExecutionRow>(
    `SELECT *
     FROM linked_action_executions
     WHERE chain_id = ?
       AND rule_id = ?
       AND effect_fingerprint = ?`,
    [chainId, ruleId, effectFingerprint],
  );
  return row ? normalizeLinkedActionExecutionRow(row) : null;
}

export async function createLinkedActionExecution(
  execution: Omit<LinkedActionExecutionRecord, "id" | "createdAt" | "updatedAt"> & {
    id?: string;
  },
): Promise<LinkedActionExecutionRecord> {
  const now = nowIso();
  const record: LinkedActionExecutionRecord = {
    id: execution.id ?? createId("lexec"),
    ruleId: execution.ruleId,
    sourceEventId: execution.sourceEventId,
    chainId: execution.chainId,
    rootEventId: execution.rootEventId,
    originRuleId: execution.originRuleId,
    effectType: execution.effectType,
    effectFingerprint: execution.effectFingerprint,
    status: execution.status,
    targetFeature: execution.targetFeature,
    targetEntityType: execution.targetEntityType,
    targetEntityId: execution.targetEntityId,
    producedEntityType: execution.producedEntityType,
    producedEntityId: execution.producedEntityId,
    noticePayload: execution.noticePayload,
    errorMessage: execution.errorMessage,
    createdAt: now,
    updatedAt: now,
  };

  const row = buildLinkedActionExecutionRow(record);
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO linked_action_executions (
       id,
       rule_id,
       source_event_id,
       chain_id,
       root_event_id,
       origin_rule_id,
       effect_type,
       effect_fingerprint,
       status,
       target_feature,
       target_entity_type,
       target_entity_id,
       produced_entity_type,
       produced_entity_id,
       notice_payload,
       error_message,
       created_at,
       updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.id,
      row.rule_id,
      row.source_event_id,
      row.chain_id,
      row.root_event_id,
      row.origin_rule_id,
      row.effect_type,
      row.effect_fingerprint,
      row.status,
      row.target_feature,
      row.target_entity_type,
      row.target_entity_id,
      row.produced_entity_type,
      row.produced_entity_id,
      row.notice_payload,
      row.error_message,
      row.created_at,
      row.updated_at,
    ],
  );
  return record;
}

export async function updateLinkedActionExecution(
  id: string,
  updates: Partial<
    Pick<
      LinkedActionExecutionRecord,
      | "status"
      | "producedEntityType"
      | "producedEntityId"
      | "noticePayload"
      | "errorMessage"
    >
  >,
): Promise<void> {
  const db = await getDatabase();
  const fields: string[] = ["updated_at = ?"];
  const values: Array<string | null> = [nowIso()];

  if (updates.status !== undefined) {
    fields.push("status = ?");
    values.push(updates.status);
  }
  if (updates.producedEntityType !== undefined) {
    fields.push("produced_entity_type = ?");
    values.push(updates.producedEntityType);
  }
  if (updates.producedEntityId !== undefined) {
    fields.push("produced_entity_id = ?");
    values.push(updates.producedEntityId);
  }
  if (updates.noticePayload !== undefined) {
    fields.push("notice_payload = ?");
    values.push(updates.noticePayload ? JSON.stringify(updates.noticePayload) : null);
  }
  if (updates.errorMessage !== undefined) {
    fields.push("error_message = ?");
    values.push(updates.errorMessage);
  }

  values.push(id);
  await db.runAsync(
    `UPDATE linked_action_executions
     SET ${fields.join(", ")}
     WHERE id = ?`,
    values,
  );
}
