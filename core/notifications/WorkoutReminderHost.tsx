import { useCallback, useEffect } from 'react';
import { Platform } from 'react-native';
import { useAppBootstrapState } from '@/core/providers/appBootstrapContext';
import { useDayRolloverGeneration } from '@/core/providers/dayRolloverContext';
import { useForegroundRefresh } from '@/lib/useForegroundRefresh';
import { reconcileWorkoutDayReminder } from '@/core/notifications/workoutReminderScheduler';
import { setWorkoutReminderReconciliationHandler } from '@/core/notifications/workoutReminderSignals';

export function WorkoutReminderHost() {
  const { authBootstrapReady } = useAppBootstrapState();
  const dayGeneration = useDayRolloverGeneration();
  const reconcile = useCallback(async () => {
    if (!authBootstrapReady) return;
    const result = await reconcileWorkoutDayReminder();
    if (result.status === 'permission_denied') {
      console.warn('[workout-reminders] notification permission is unavailable');
    }
  }, [authBootstrapReady]);

  useEffect(() => {
    if (!authBootstrapReady || Platform.OS === 'web') return undefined;
    setWorkoutReminderReconciliationHandler(reconcile);
    void reconcile();
    return () => setWorkoutReminderReconciliationHandler(null);
  }, [authBootstrapReady, reconcile]);

  useForegroundRefresh(reconcile);

  useEffect(() => {
    if (authBootstrapReady) void reconcile();
  }, [authBootstrapReady, dayGeneration, reconcile]);

  return null;
}
