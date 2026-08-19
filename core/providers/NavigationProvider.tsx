import { useCallback, useState, type PropsWithChildren } from 'react';
import {
  NavigationContext,
  type AppSection,
  type PlanningHubView,
} from '@/core/providers/navigationContext';

export type { AppSection, PlanningHubView } from '@/core/providers/navigationContext';

export function NavigationProvider({ children }: PropsWithChildren) {
  const [activeSection, setActiveSectionState] = useState<AppSection>('overview');
  const [mountedSections, setMountedSections] = useState<Record<AppSection, boolean>>({
    overview: true,
    todos: false,
    habits: false,
    pomodoro: false,
    workout: false,
    calories: false,
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isWeeklyReviewOpen, setIsWeeklyReviewOpen] = useState(false);
  const [isPlanningHubOpen, setIsPlanningHubOpen] = useState(false);
  const [planningHubInitialView, setPlanningHubInitialView] = useState<PlanningHubView>('today');
  const [isQuickCaptureOpen, setIsQuickCaptureOpen] = useState(false);
  const [pendingHabitFocusId, setPendingHabitFocusId] = useState<string | null>(null);

  const openSettings = useCallback(() => setIsSettingsOpen(true), []);
  const closeSettings = useCallback(() => setIsSettingsOpen(false), []);
  const openWeeklyReview = useCallback(() => setIsWeeklyReviewOpen(true), []);
  const closeWeeklyReview = useCallback(() => setIsWeeklyReviewOpen(false), []);
  const openPlanningHub = useCallback((initialView: PlanningHubView = 'today') => {
    setPlanningHubInitialView(initialView);
    setIsPlanningHubOpen(true);
  }, []);
  const closePlanningHub = useCallback(() => setIsPlanningHubOpen(false), []);
  const openQuickCapture = useCallback(() => setIsQuickCaptureOpen(true), []);
  const closeQuickCapture = useCallback(() => setIsQuickCaptureOpen(false), []);
  const setActiveSection = useCallback((section: AppSection) => {
    setMountedSections((current) => (current[section] ? current : { ...current, [section]: true }));
    setActiveSectionState(section);
  }, []);
  const openHabit = useCallback(
    (habitId: string) => {
      setPendingHabitFocusId(habitId);
      setActiveSection('habits');
      setIsSettingsOpen(false);
    },
    [setActiveSection],
  );
  const consumePendingHabitFocus = useCallback(() => {
    let pending = pendingHabitFocusId;
    setPendingHabitFocusId((current) => {
      pending = current;
      return null;
    });
    return pending;
  }, [pendingHabitFocusId]);

  return (
    <NavigationContext.Provider
      value={{
        activeSection,
        mountedSections,
        setActiveSection,
        openHabit,
        consumePendingHabitFocus,
        isSettingsOpen,
        openSettings,
        closeSettings,
        isWeeklyReviewOpen,
        openWeeklyReview,
        closeWeeklyReview,
        isPlanningHubOpen,
        planningHubInitialView,
        openPlanningHub,
        closePlanningHub,
        isQuickCaptureOpen,
        openQuickCapture,
        closeQuickCapture,
      }}
    >
      {children}
    </NavigationContext.Provider>
  );
}
