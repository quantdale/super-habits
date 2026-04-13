import type { AppNotice, LinkedActionsNoticePayload } from "@/core/notifications/inAppNotices.types";

type CreateLinkedActionsNoticeInput = {
  message: string;
  reason: string;
  source: LinkedActionsNoticePayload["source"];
  target: LinkedActionsNoticePayload["target"];
  destination?: LinkedActionsNoticePayload["destination"];
  onPress?: () => void;
};

function createInAppNoticeId() {
  return `notice_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createLinkedActionsNotice({
  message,
  reason,
  source,
  target,
  destination,
  onPress,
}: CreateLinkedActionsNoticeInput): AppNotice {
  return {
    id: createInAppNoticeId(),
    createdAt: new Date().toISOString(),
    onPress,
    payload: {
      kind: "linked-actions",
      message,
      reason,
      source,
      target,
      destination,
    },
  };
}
