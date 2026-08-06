import type {
  LinkedActionFeature,
  LinkedActionSourceEntityType,
  LinkedActionTriggerType,
} from '@/core/linked-actions/linkedActions.enums';
import type {
  LinkedActionChainMetadata,
  LinkedActionOriginMetadata,
} from '@/core/linked-actions/linkedActions.metadata.types';

export type LinkedActionSourceActionInput = {
  eventId?: string;
  feature: LinkedActionFeature;
  entityType: LinkedActionSourceEntityType;
  entityId: string | null;
  triggerType: LinkedActionTriggerType;
  sourceRecordId?: string | null;
  sourceDateKey?: string | null;
  occurredAt?: string;
  label?: string;
  payload?: Record<string, unknown>;
  origin?: Partial<LinkedActionOriginMetadata>;
  chain?: Partial<LinkedActionChainMetadata>;
};

export type LinkedActionSourceAction = {
  eventId: string;
  feature: LinkedActionFeature;
  entityType: LinkedActionSourceEntityType;
  entityId: string | null;
  triggerType: LinkedActionTriggerType;
  sourceRecordId: string | null;
  sourceDateKey: string | null;
  occurredAt: string;
  label: string | null;
  payload: Record<string, unknown>;
  origin: LinkedActionOriginMetadata;
  chain: LinkedActionChainMetadata;
};

export type LinkedActionEventRecord = LinkedActionSourceAction;

export type LinkedActionEventRow = {
  id: string;
  chain_id: string;
  root_event_id: string;
  parent_event_id: string | null;
  chain_depth: number;
  origin_kind: string;
  origin_rule_id: string | null;
  origin_event_id: string | null;
  source_feature: string;
  source_entity_type: string;
  source_entity_id: string | null;
  trigger_type: string;
  source_record_id: string | null;
  source_date_key: string | null;
  source_label: string | null;
  occurred_at: string;
  payload: string;
  created_at: string;
};
