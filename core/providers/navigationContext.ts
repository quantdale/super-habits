import { createContext, useContext } from 'react';

/**
 * The six primary app sections. These double as command-center launch contexts
 * and linked-action navigation targets. "pomodoro" is the canonical feature
 * name even though the user-facing section label is "Focus".
 */
export type AppSection = 'overview' | 'todos' | 'habits' | 'pomodoro' | 'workout' | 'calories';

export type NavigationContextValue = {
  activeSection: AppSection;
  mountedSections: Record<AppSection, boolean>;
  setActiveSection: (section: AppSection) => void;
  openHabit: (habitId: string) => void;
  consumePendingHabitFocus: () => string | null;
  isSettingsOpen: boolean;
  openSettings: () => void;
  closeSettings: () => void;
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
