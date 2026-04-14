import { getDatabase } from "@/core/db/client";
import { createId } from "@/lib/id";
import { nowIso } from "@/lib/time";
import {
  type CreateLinkedActionRuleInput,
  type LinkedActionFeature,
  type LinkedActionRuleDefinition,
  type LinkedActionRuleRow,
  type LinkedActionSourceEntityType,
  type LinkedActionTriggerType,
  buildLinkedActionRuleRow,
  normalizeLinkedActionRuleRow,
} from "@/core/linked-actions/linkedActions.types";

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

  return rule;
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
