import { useCallback, useEffect } from 'react';
import { Platform } from 'react-native';
import { useAppBootstrapState } from '@/core/providers/appBootstrapContext';
import { useDayRolloverGeneration } from '@/core/providers/dayRolloverContext';
import { useForegroundRefresh } from '@/lib/useForegroundRefresh';
import {
  reconcileHabitReminders,
  setHabitReminderReconciliationHandler,
} from '@/features/habits/habitReminders.service';

/**
 * App-wide, non-blocking reminder owner. It reuses the existing foreground
 * and local-day boundaries and keeps one reconciliation pass in flight.
 */
export function HabitReminderHost() {
  const { authBootstrapReady } = useAppBootstrapState();
  const dayGeneration = useDayRolloverGeneration();

  const reconcile = useCallback(async () => {
    if (!authBootstrapReady) return;
    const result = await reconcileHabitReminders();
    if (result.status === 'failed') {
      console.error('[habit-reminders] reconciliation failed', result.error);
    }
  }, [authBootstrapReady]);

  useEffect(() => {
    if (!authBootstrapReady || Platform.OS === 'web') return undefined;
    setHabitReminderReconciliationHandler(reconcile);
    void reconcile();
    return () => setHabitReminderReconciliationHandler(null);
  }, [authBootstrapReady, reconcile]);

  useForegroundRefresh(reconcile);

  useEffect(() => {
    if (authBootstrapReady) void reconcile();
  }, [authBootstrapReady, dayGeneration, reconcile]);

  return null;
}
