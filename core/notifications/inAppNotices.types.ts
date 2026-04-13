import type { Href } from "expo-router";

export type InAppNoticeContext = {
  feature: string;
  entityType: string;
  entityId?: string;
  label?: string;
};

export type InAppNoticeDestination =
  | {
      kind: "href";
      href: Href;
      label?: string;
    }
  | {
      kind: "linked-actions-target";
      href: Href;
      feature: string;
      entityType: string;
      entityId?: string;
      label?: string;
    };

export type LinkedActionsNoticePayload = {
  kind: "linked-actions";
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
