import { createContext, useContext } from 'react';

/**
 * The primary app sections. These double as command-center launch contexts
 * and linked-action navigation targets. "pomodoro" is the canonical feature
 * name even though the user-facing section label is "Focus".
 *
 * V3 adds `health`, the phone navigation parent for workout + calories
 * (five-destination model — docs/ui-ux/13 §9). `workout` and `calories` stay
 * first-class sections: deep links, linked-action targets, and the command
 * executor keep working; the Health surface is their phone-nav home.
 */
export type AppSection =
  'overview' | 'todos' | 'habits' | 'pomodoro' | 'workout' | 'calories' | 'health';

export type PlanningHubView = 'today' | 'projects' | 'goals' | 'progress' | 'timeline';

export type NavigationContextValue = {
  activeSection: AppSection;
  mountedSections: Record<AppSection, boolean>;
  setActiveSection: (section: AppSection) => void;
  openHabit: (habitId: string) => void;
  consumePendingHabitFocus: () => string | null;
  isSettingsOpen: boolean;
  openSettings: () => void;
  closeSettings: () => void;
  isWeeklyReviewOpen: boolean;
  openWeeklyReview: () => void;
  closeWeeklyReview: () => void;
  isPlanningHubOpen: boolean;
  planningHubInitialView: PlanningHubView;
  openPlanningHub: (initialView?: PlanningHubView) => void;
  closePlanningHub: () => void;
  isQuickCaptureOpen: boolean;
  openQuickCapture: () => void;
  closeQuickCapture: () => void;
  isAchievementsOpen: boolean;
  openAchievements: () => void;
  closeAchievements: () => void;
};

const NavigationContext = createContext<NavigationContextValue | null>(null);

export function useAppNavigation(): NavigationContextValue {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useAppNavigation must be used within a NavigationProvider');
  }
  return context;
}

export { NavigationContext };
