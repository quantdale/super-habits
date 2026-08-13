import { type PropsWithChildren, useCallback, useMemo, useState } from 'react';
import {
  createInAppNoticeState,
  dismissInAppNotice,
  enqueueInAppNotice,
  getCurrentInAppNotice,
  type InAppNoticeState,
} from '@/core/notifications/inAppNotices.store';
import { InAppNoticeContext } from '@/core/providers/inAppNoticeContext';
import type { AppNotice } from '@/core/notifications/inAppNotices.types';

export function InAppNoticeProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<InAppNoticeState>(() => createInAppNoticeState());

  const showNotice = useCallback((notice: AppNotice) => {
    setState((prev) => enqueueInAppNotice(prev, notice));
  }, []);

  const dismissNotice = useCallback((noticeId: string) => {
    setState((prev) => dismissInAppNotice(prev, noticeId));
  }, []);

  const value = useMemo(
    () => ({
      currentNotice: getCurrentInAppNotice(state),
      notices: state.notices,
      showNotice,
      dismissNotice,
    }),
    [dismissNotice, showNotice, state],
  );

  return <InAppNoticeContext.Provider value={value}>{children}</InAppNoticeContext.Provider>;
}
