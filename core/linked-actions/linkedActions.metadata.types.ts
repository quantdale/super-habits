import type {
  LinkedActionFeature,
  LinkedActionTargetEntityType,
} from '@/core/linked-actions/linkedActions.enums';

export type LinkedActionOriginKind = 'user' | 'linked_action' | 'system';

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
  status: 'pending' | 'shown' | 'read' | 'dismissed';
  title: string;
  body: string;
  targetFeature: LinkedActionFeature;
  targetEntityType: LinkedActionTargetEntityType | null;
  targetEntityId: string | null;
  createdAt: string;
  readAt: string | null;
  dismissedAt: string | null;
};
