import { getDatabase } from '@/core/db/client';
import type * as SQLite from 'expo-sqlite';
import {
  claimOwnerBindingOnFirstContent,
  getCachedLocalDatasetOwner,
  getCachedOwnerBindingProvisional,
  promoteLocalDatasetOwnerIfProvisional,
  setLocalDatasetOwner,
} from '@/core/auth/account.data';
import { appMetaKeys, setAppMetaText } from '@/core/db/appMeta';
import { withSQLiteTransaction } from '@/core/db/transactions';
import { createId } from '@/lib/id';
import { nowIso } from '@/lib/time';
import { upsertSyncOutboxRecord } from '@/core/sync/syncPersistence';
import { syncEngine, type PreparedSyncRecord, type SyncRecord } from '@/core/sync/sync.engine';
import { resolveSyncOwnerUserId } from '@/core/sync/syncedMutation';
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
  type LinkedActionTargetEntityType,
  type LinkedActionTriggerType,
  buildLinkedActionEventRow,
  buildLinkedActionExecutionRow,
  buildLinkedActionRuleRow,
  normalizeLinkedActionEventRow,
  normalizeLinkedActionExecutionRow,
  normalizeLinkedActionRuleRow,
} from '@/core/linked-actions/linkedActions.types';

/**
 * Wrap a rule write (or set of rule writes) and its durable backup intents in
 * one SQLite transaction. Rule configuration is recoverable user state, so
 * every created/updated/tombstoned rule row enqueues a `linked_action_rules`
 * outbox record in the same transaction the row lands in. Owner resolution
 * mirrors `runBackupMutation`.
 */
async function runWithBackupIntents<T>(
  db: SQLite.SQLiteDatabase,
  collect: (transactionDb: SQLite.SQLiteDatabase, intents: SyncRecord[]) => Promise<T>,
): Promise<T> {
  const ownerUserId = await resolveSyncOwnerUserId(db);
  const existingOwnerUserId = getCachedLocalDatasetOwner();
  const preparedList: PreparedSyncRecord[] = [];
  const result = await withSQLiteTransaction(db, async (transactionDb) => {
    const intents: SyncRecord[] = [];
    const value = await collect(transactionDb, intents);
    if (intents.length === 0) return value;
    if (!existingOwnerUserId && ownerUserId) {
      await setLocalDatasetOwner(transactionDb, ownerUserId);
    }
    if (getCachedOwnerBindingProvisional() === true) {
      await promoteLocalDatasetOwnerIfProvisional(transactionDb);
    }
    for (const intent of intents) {
      const prepared = syncEngine.prepare(ownerUserId ? { ...intent, ownerUserId } : intent);
      preparedList.push(prepared);
      await upsertSyncOutboxRecord(transactionDb, prepared, prepared.revision);
    }
    await setAppMetaText(transactionDb, appMetaKeys.backupDirty, '1');
    return value;
  });
  for (const prepared of preparedList) {
    syncEngine.enqueuePrepared(prepared, { durablyPersisted: true });
  }
  return result;
}

function ruleIntent(
  id: string,
  operation: 'create' | 'update' | 'delete',
  updatedAt: string,
): SyncRecord {
  return { entity: 'linked_action_rules', id, updatedAt, operation };
}

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
  // A linked-action rule is meaningful user content: it durably claims the
  // dataset for the current anonymous owner.
  await claimOwnerBindingOnFirstContent(db);
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
  source: Pick<LinkedActionSourceAction, 'feature' | 'entityType' | 'entityId' | 'triggerType'>,
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

export async function getLinkedActionRule(id: string): Promise<LinkedActionRuleDefinition | null> {
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
    id: createId('link'),
    status: input.status ?? 'active',
    directionPolicy: input.directionPolicy ?? 'one_way',
    bidirectionalGroupId: input.bidirectionalGroupId ?? null,
    source: input.source,
    target: input.target,
    isUnsupported: false,
    unsupportedReason: null,
    rawTargetFeature: input.target.feature,
    rawTargetEntityType: input.target.entityType,
    rawEffectType: input.target.effect.type,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };

  const row = buildLinkedActionRuleRow(rule);
  const db = await getDatabase();
  await runWithBackupIntents(db, async (transactionDb, intents) => {
    await insertLinkedActionRuleRow(transactionDb, row);
    intents.push(ruleIntent(rule.id, 'create', now));
  });

  return rule;
}

export async function replaceLinkedActionRulesForSourceEntity(input: {
  feature: LinkedActionFeature;
  entityType: LinkedActionSourceEntityType;
  entityId: string;
  rules: SaveLinkedActionRuleForSourceInput[];
  db?: Awaited<ReturnType<typeof getDatabase>>;
  enqueue?: (record: SyncRecord) => void;
}): Promise<void> {
  const db = input.db ?? (await getDatabase());
  const apply = async (
    transactionDb: Awaited<ReturnType<typeof getDatabase>>,
    intents: SyncRecord[] | null,
  ): Promise<void> => {
    const pushIntent = (intent: SyncRecord): void => {
      if (input.enqueue) input.enqueue(intent);
      else intents?.push(intent);
    };
    const existingRows = await transactionDb.getAllAsync<LinkedActionRuleRow>(
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
      const existingRule = ruleInput.existingRuleId
        ? existingById.get(ruleInput.existingRuleId)
        : undefined;

      if (existingRule) {
        if (existingRule.isUnsupported) {
          throw new Error(
            'Unsupported linked action rules must be removed or replaced before saving.',
          );
        }

        const updatedRule: LinkedActionRuleDefinition = {
          id: existingRule.id,
          status: ruleInput.status ?? existingRule.status,
          directionPolicy: ruleInput.directionPolicy ?? existingRule.directionPolicy,
          bidirectionalGroupId: ruleInput.bidirectionalGroupId ?? existingRule.bidirectionalGroupId,
          source,
          target: ruleInput.target,
          isUnsupported: false,
          unsupportedReason: null,
          rawTargetFeature: ruleInput.target.feature,
          rawTargetEntityType: ruleInput.target.entityType,
          rawEffectType: ruleInput.target.effect.type,
          createdAt: existingRule.createdAt,
          updatedAt: now,
          deletedAt: null,
        };
        await updateLinkedActionRuleRow(transactionDb, buildLinkedActionRuleRow(updatedRule));
        pushIntent(ruleIntent(existingRule.id, 'update', now));
        keptRuleIds.add(existingRule.id);
        continue;
      }

      const createdRule: LinkedActionRuleDefinition = {
        id: createId('link'),
        status: ruleInput.status ?? 'active',
        directionPolicy: ruleInput.directionPolicy ?? 'one_way',
        bidirectionalGroupId: ruleInput.bidirectionalGroupId ?? null,
        source,
        target: ruleInput.target,
        isUnsupported: false,
        unsupportedReason: null,
        rawTargetFeature: ruleInput.target.feature,
        rawTargetEntityType: ruleInput.target.entityType,
        rawEffectType: ruleInput.target.effect.type,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      };
      await insertLinkedActionRuleRow(transactionDb, buildLinkedActionRuleRow(createdRule));
      pushIntent(ruleIntent(createdRule.id, 'create', now));
      keptRuleIds.add(createdRule.id);
    }

    for (const existingRow of existingRows) {
      if (keptRuleIds.has(existingRow.id)) {
        continue;
      }
      await transactionDb.runAsync(
        `UPDATE linked_action_rules
         SET deleted_at = ?, updated_at = ?
         WHERE id = ?
           AND deleted_at IS NULL`,
        [now, now, existingRow.id],
      );
      pushIntent(ruleIntent(existingRow.id, 'delete', now));
    }
  };

  if (input.enqueue) {
    await apply(db, null);
    return;
  }
  await runWithBackupIntents(db, async (transactionDb, intents) => {
    await apply(transactionDb, intents);
  });
}

export async function updateLinkedActionRuleStatus(
  id: string,
  status: LinkedActionRuleDefinition['status'],
): Promise<void> {
  const db = await getDatabase();
  const now = nowIso();
  await runWithBackupIntents(db, async (transactionDb, intents) => {
    await transactionDb.runAsync(
      `UPDATE linked_action_rules
       SET status = ?, updated_at = ?
       WHERE id = ?
         AND deleted_at IS NULL`,
      [status, now, id],
    );
    intents.push(ruleIntent(id, 'update', now));
  });
}

export async function deleteLinkedActionRule(id: string): Promise<void> {
  const db = await getDatabase();
  const now = nowIso();
  await runWithBackupIntents(db, async (transactionDb, intents) => {
    await transactionDb.runAsync(
      `UPDATE linked_action_rules
       SET deleted_at = ?, updated_at = ?
       WHERE id = ?
         AND deleted_at IS NULL`,
      [now, now, id],
    );
    intents.push(ruleIntent(id, 'delete', now));
  });
}

export async function deleteLinkedActionRulesForTargetEntity(input: {
  feature: LinkedActionFeature;
  entityType: LinkedActionTargetEntityType;
  entityId: string;
  deletedAt?: string;
  db?: Awaited<ReturnType<typeof getDatabase>>;
  enqueue?: (record: SyncRecord) => void;
}): Promise<void> {
  const db = input.db ?? (await getDatabase());
  const now = input.deletedAt ?? nowIso();
  const apply = async (
    transactionDb: Awaited<ReturnType<typeof getDatabase>>,
    intents: SyncRecord[] | null,
  ): Promise<void> => {
    await transactionDb.runAsync(
      `UPDATE linked_action_rules
       SET deleted_at = ?, updated_at = ?
       WHERE deleted_at IS NULL
         AND target_feature = ?
         AND target_entity_type = ?
         AND target_entity_id = ?`,
      [now, now, input.feature, input.entityType, input.entityId],
    );
    const rows = await transactionDb.getAllAsync<{ id: string }>(
      `SELECT id
       FROM linked_action_rules
       WHERE target_feature = ?
         AND target_entity_type = ?
         AND target_entity_id = ?`,
      [input.feature, input.entityType, input.entityId],
    );
    for (const row of rows) {
      if (input.enqueue) input.enqueue(ruleIntent(row.id, 'delete', now));
      else intents?.push(ruleIntent(row.id, 'delete', now));
    }
  };

  if (input.enqueue) {
    await apply(db, null);
    return;
  }
  await runWithBackupIntents(db, async (transactionDb, intents) => {
    await apply(transactionDb, intents);
  });
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
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT DO NOTHING`,
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
  const persisted = await db.getFirstAsync<LinkedActionEventRow>(
    `SELECT * FROM linked_action_events WHERE id = ?`,
    [event.eventId],
  );
  if (!persisted) {
    throw new Error(`Linked action event ${event.eventId} was not persisted.`);
  }
  return normalizeLinkedActionEventRow(persisted);
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

export async function getAppliedHabitDayCalorieExecution(
  ruleId: string,
  habitId: string,
  sourceDateKey: string,
): Promise<LinkedActionExecutionRecord | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<LinkedActionExecutionRow>(
    `SELECT e.*
     FROM linked_action_executions e
     INNER JOIN linked_action_events ev
       ON ev.id = e.source_event_id
     WHERE e.rule_id = ?
       AND e.effect_type = 'calorie.log'
       AND e.status IN ('planned', 'running', 'applied', 'skipped', 'failed')
       AND ev.source_feature = 'habits'
       AND ev.source_entity_type = 'habit'
       AND ev.source_entity_id = ?
       AND ev.trigger_type = 'habit.completed_for_day'
       AND ev.source_date_key = ?
     ORDER BY e.created_at DESC
     LIMIT 1`,
    [ruleId, habitId, sourceDateKey],
  );
  return row ? normalizeLinkedActionExecutionRow(row) : null;
}

export async function getAppliedHabitIncrementExecution(
  ruleId: string,
  sourceFeature: LinkedActionFeature,
  sourceEntityType: LinkedActionSourceEntityType,
  sourceEntityId: string,
  triggerType: LinkedActionTriggerType,
  sourceDateKey: string,
): Promise<LinkedActionExecutionRecord | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<LinkedActionExecutionRow>(
    `SELECT e.*
     FROM linked_action_executions e
     INNER JOIN linked_action_events ev
       ON ev.id = e.source_event_id
     WHERE e.rule_id = ?
       AND e.effect_type = 'habit.increment'
       AND e.status IN ('planned', 'running', 'applied', 'skipped', 'failed')
       AND ev.source_feature = ?
       AND ev.source_entity_type = ?
       AND ev.source_entity_id = ?
       AND ev.trigger_type = ?
       AND ev.source_date_key = ?
     ORDER BY e.created_at DESC
     LIMIT 1`,
    [ruleId, sourceFeature, sourceEntityType, sourceEntityId, triggerType, sourceDateKey],
  );
  return row ? normalizeLinkedActionExecutionRow(row) : null;
}

export async function createLinkedActionExecution(
  execution: Omit<LinkedActionExecutionRecord, 'id' | 'createdAt' | 'updatedAt'> & {
    id?: string;
  },
): Promise<LinkedActionExecutionRecord> {
  const now = nowIso();
  const record: LinkedActionExecutionRecord = {
    id: execution.id ?? createId('lexec'),
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
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT DO NOTHING`,
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
  const persisted =
    (await db.getFirstAsync<LinkedActionExecutionRow>(
      `SELECT * FROM linked_action_executions WHERE id = ?`,
      [record.id],
    )) ??
    (await db.getFirstAsync<LinkedActionExecutionRow>(
      `SELECT *
       FROM linked_action_executions
       WHERE rule_id = ? AND source_event_id = ?`,
      [record.ruleId, record.sourceEventId],
    )) ??
    (await db.getFirstAsync<LinkedActionExecutionRow>(
      `SELECT *
       FROM linked_action_executions
       WHERE chain_id = ? AND rule_id = ? AND effect_fingerprint = ?`,
      [record.chainId, record.ruleId, record.effectFingerprint],
    ));
  if (!persisted) {
    throw new Error(`Linked action execution ${record.id} was not persisted.`);
  }
  return normalizeLinkedActionExecutionRow(persisted);
}

export async function updateLinkedActionExecution(
  id: string,
  updates: Partial<
    Pick<
      LinkedActionExecutionRecord,
      'status' | 'producedEntityType' | 'producedEntityId' | 'noticePayload' | 'errorMessage'
    >
  >,
): Promise<void> {
  const db = await getDatabase();
  await updateLinkedActionExecutionInDatabase(db, id, updates);
}

export async function updateLinkedActionExecutionInTransaction(
  db: SQLite.SQLiteDatabase,
  id: string,
  updates: Partial<
    Pick<
      LinkedActionExecutionRecord,
      'status' | 'producedEntityType' | 'producedEntityId' | 'noticePayload' | 'errorMessage'
    >
  >,
): Promise<void> {
  await updateLinkedActionExecutionInDatabase(db, id, updates);
}

async function updateLinkedActionExecutionInDatabase(
  db: SQLite.SQLiteDatabase,
  id: string,
  updates: Partial<
    Pick<
      LinkedActionExecutionRecord,
      'status' | 'producedEntityType' | 'producedEntityId' | 'noticePayload' | 'errorMessage'
    >
  >,
): Promise<void> {
  const fields: string[] = ['updated_at = ?'];
  const values: (string | null)[] = [nowIso()];

  if (updates.status !== undefined) {
    fields.push('status = ?');
    values.push(updates.status);
  }
  if (updates.producedEntityType !== undefined) {
    fields.push('produced_entity_type = ?');
    values.push(updates.producedEntityType);
  }
  if (updates.producedEntityId !== undefined) {
    fields.push('produced_entity_id = ?');
    values.push(updates.producedEntityId);
  }
  if (updates.noticePayload !== undefined) {
    fields.push('notice_payload = ?');
    values.push(updates.noticePayload ? JSON.stringify(updates.noticePayload) : null);
  }
  if (updates.errorMessage !== undefined) {
    fields.push('error_message = ?');
    values.push(updates.errorMessage);
  }

  values.push(id);
  const result = await db.runAsync(
    `UPDATE linked_action_executions
     SET ${fields.join(', ')}
     WHERE id = ?`,
    values,
  );
  if (result.changes !== 1) {
    throw new Error(`Linked action execution ${id} was not found while finalizing.`);
  }
}

/** Claim a planned/failed execution, or reclaim a stale interrupted runner. */
export async function claimLinkedActionExecution(
  id: string,
  staleBefore: string,
): Promise<boolean> {
  const db = await getDatabase();
  const result = await db.runAsync(
    `UPDATE linked_action_executions
     SET status = 'running', updated_at = ?, error_message = NULL
     WHERE id = ?
       AND (
         status IN ('planned', 'failed')
         OR (status = 'running' AND updated_at <= ?)
       )`,
    [nowIso(), id, staleBefore],
  );
  return result.changes === 1;
}

/**
 * Restore-only import for linked-action rule configuration. Plain INSERT OR
 * REPLACE preserving ids, status, direction, effect payloads, tombstones, and
 * timestamps. Rules are inert after restore: they fire only for FUTURE source
 * events — import never dispatches anything.
 */
export async function applyRemoteLinkedActionRules(
  db: Awaited<ReturnType<typeof getDatabase>>,
  rows: LinkedActionRuleRow[],
): Promise<void> {
  for (const row of rows) {
    await db.runAsync(
      `INSERT OR REPLACE INTO linked_action_rules (
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
}
