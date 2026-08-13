import { createContext, useContext } from 'react';
import type { AppNotice } from '@/core/notifications/inAppNotices.types';

export type InAppNoticeContextValue = {
  currentNotice: AppNotice | null;
  notices: AppNotice[];
  showNotice: (notice: AppNotice) => void;
  dismissNotice: (noticeId: string) => void;
};

const InAppNoticeContext = createContext<InAppNoticeContextValue | null>(null);

export function useInAppNotices(): InAppNoticeContextValue {
  const context = useContext(InAppNoticeContext);
  if (!context) {
    throw new Error('useInAppNotices must be used within InAppNoticeProvider');
  }
  return context;
}

export { InAppNoticeContext };
