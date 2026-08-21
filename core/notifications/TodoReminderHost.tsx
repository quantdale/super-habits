import { useCallback, useEffect } from 'react';
import { Platform } from 'react-native';
import { useAppBootstrapState } from '@/core/providers/appBootstrapContext';
import { useForegroundRefresh } from '@/lib/useForegroundRefresh';
import { reconcileTodoReminders } from './todoReminderScheduler';

/**
 * App-wide, non-blocking todo-reminder owner. Runs one diff-and-cancel
 * reconcile pass at bootstrap and on every foreground return so toggle-off,
 * restore imports, and deleted/restored-away todos never leave stale native
 * notifications behind.
 */
export function TodoReminderHost() {
  const { authBootstrapReady } = useAppBootstrapState();

  const reconcile = useCallback(async () => {
    if (!authBootstrapReady) return;
    const result = await reconcileTodoReminders();
    if (result.status === 'failed') {
      console.error('[todo-reminders] reconciliation failed', result.error);
    }
  }, [authBootstrapReady]);

  useEffect(() => {
    if (!authBootstrapReady || Platform.OS === 'web') return undefined;
    void reconcile();
  }, [authBootstrapReady, reconcile]);

  useForegroundRefresh(reconcile);

  return null;
}
