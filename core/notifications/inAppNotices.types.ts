import type { AppSection } from '@/core/providers/NavigationProvider';

export type InAppNoticeContext = {
  feature: string;
  entityType: string;
  entityId?: string;
  label?: string;
};

export type InAppNoticeDestination =
  | {
      kind: 'section';
      section: AppSection;
      label?: string;
    }
  | {
      kind: 'linked-actions-target';
      section: AppSection;
      feature: string;
      entityType: string;
      entityId?: string;
      label?: string;
    };

export type LinkedActionsNoticePayload = {
  kind: 'linked-actions';
  message: string;
  reason: string;
  source: InAppNoticeContext;
  target: InAppNoticeContext;
  destination?: InAppNoticeDestination;
};

export type AppNoticePayload = LinkedActionsNoticePayload;

export type AppNotice = {
  id: string;
  createdAt: string;
  payload: AppNoticePayload;
  onPress?: () => void;
};
