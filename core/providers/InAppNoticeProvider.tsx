import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import {
  createInAppNoticeState,
  dismissInAppNotice,
  enqueueInAppNotice,
  getCurrentInAppNotice,
  type InAppNoticeState,
} from "@/core/notifications/inAppNotices.store";
import type { AppNotice } from "@/core/notifications/inAppNotices.types";

type InAppNoticeContextValue = {
  currentNotice: AppNotice | null;
  notices: AppNotice[];
  showNotice: (notice: AppNotice) => void;
  dismissNotice: (noticeId: string) => void;
};

const InAppNoticeContext = createContext<InAppNoticeContextValue | null>(null);

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

export function useInAppNotices() {
  const context = useContext(InAppNoticeContext);
  if (!context) {
    throw new Error("useInAppNotices must be used within InAppNoticeProvider");
  }
  return context;
}
