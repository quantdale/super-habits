import type { AppNotice } from "./inAppNotices.types";

export type InAppNoticeState = {
  notices: AppNotice[];
};

export const MAX_IN_APP_NOTICES = 3;

export function createInAppNoticeState(): InAppNoticeState {
  return { notices: [] };
}

export function enqueueInAppNotice(state: InAppNoticeState, notice: AppNotice): InAppNoticeState {
  return {
    notices: [notice, ...state.notices.filter((entry) => entry.id !== notice.id)].slice(
      0,
      MAX_IN_APP_NOTICES,
    ),
  };
}

export function dismissInAppNotice(state: InAppNoticeState, noticeId: string): InAppNoticeState {
  return {
    notices: state.notices.filter((notice) => notice.id !== noticeId),
  };
}

export function getCurrentInAppNotice(state: InAppNoticeState): AppNotice | null {
  return state.notices[0] ?? null;
}
