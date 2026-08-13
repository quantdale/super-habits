import type {
  AppNotice,
  LinkedActionsNoticePayload,
} from '@/core/notifications/inAppNotices.types';
import type {
  LinkedActionEffectType,
  LinkedActionExecutionStatus,
  LinkedActionFeature,
  LinkedActionTargetEntityType,
} from '@/core/linked-actions/linkedActions.enums';
import type { LinkedActionEventRecord } from '@/core/linked-actions/linkedActions.events.types';
import type {
  LinkedActionChainMetadata,
  LinkedActionOriginMetadata,
} from '@/core/linked-actions/linkedActions.metadata.types';
import type { LinkedActionSupportedRuleDefinition } from '@/core/linked-actions/linkedActions.rules.types';

export type LinkedActionEffectProducedEntityType = LinkedActionTargetEntityType | 'workout_log';

export type LinkedActionEffectPlan = {
  sourceEvent: LinkedActionEventRecord;
  rule: LinkedActionSupportedRuleDefinition;
  chain: LinkedActionChainMetadata;
  origin: LinkedActionOriginMetadata;
  effectFingerprint: string;
  plannedProducedEntityType: LinkedActionEffectProducedEntityType | null;
  plannedProducedEntityId: string | null;
  executionId?: string;
  noticePreview: LinkedActionsNoticePayload | null;
};

export type LinkedActionEffectAdapterResult = {
  status: 'applied' | 'skipped';
  reason?: string | null;
  targetLabel?: string | null;
  producedEntityType?: LinkedActionEffectProducedEntityType | null;
  producedEntityId?: string | null;
  /** True when the adapter committed the execution receipt in its own transaction. */
  executionFinalized?: boolean;
};

export type LinkedActionExecutionRecord = {
  id: string;
  ruleId: string;
  sourceEventId: string;
  chainId: string;
  rootEventId: string;
  originRuleId: string | null;
  effectType: LinkedActionEffectType;
  effectFingerprint: string;
  status: LinkedActionExecutionStatus;
  targetFeature: LinkedActionFeature;
  targetEntityType: LinkedActionTargetEntityType;
  targetEntityId: string | null;
  producedEntityType: LinkedActionEffectProducedEntityType | null;
  producedEntityId: string | null;
  noticePayload: LinkedActionsNoticePayload | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

export type LinkedActionExecutionRow = {
  id: string;
  rule_id: string;
  source_event_id: string;
  chain_id: string;
  root_event_id: string;
  origin_rule_id: string | null;
  effect_type: string;
  effect_fingerprint: string;
  status: string;
  target_feature: string;
  target_entity_type: string;
  target_entity_id: string | null;
  produced_entity_type: string | null;
  produced_entity_id: string | null;
  notice_payload: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

export type LinkedActionEffectResult = {
  executionId: string | null;
  ruleId: string;
  status: LinkedActionExecutionStatus;
  effectType: string;
  effectFingerprint: string;
  targetFeature: string;
  targetEntityType: string;
  targetEntityId: string | null;
  producedEntityType: LinkedActionEffectProducedEntityType | null;
  producedEntityId: string | null;
  reason: string | null;
  errorMessage: string | null;
  notice: AppNotice | null;
  noticePreview: LinkedActionsNoticePayload | null;
};

export type LinkedActionProcessMode = 'plan' | 'apply';

export type LinkedActionProcessResult = {
  mode: LinkedActionProcessMode;
  sourceEvent: LinkedActionEventRecord;
  matchedRuleCount: number;
  effects: LinkedActionEffectResult[];
  notices: AppNotice[];
};
