import { createContext, useCallback, useContext, useState, type PropsWithChildren } from 'react';

/**
 * The six primary app sections. These double as command-center launch contexts
 * and linked-action navigation targets. "pomodoro" is the canonical feature
 * name even though the user-facing section label is "Focus".
 */
export type AppSection = 'overview' | 'todos' | 'habits' | 'pomodoro' | 'workout' | 'calories';

type NavigationContextValue = {
  activeSection: AppSection;
  setActiveSection: (section: AppSection) => void;
  openHabit: (habitId: string) => void;
  consumePendingHabitFocus: () => string | null;
  isSettingsOpen: boolean;
  openSettings: () => void;
  closeSettings: () => void;
};

const NavigationContext = createContext<NavigationContextValue | null>(null);

export function NavigationProvider({ children }: PropsWithChildren) {
  const [activeSection, setActiveSection] = useState<AppSection>('overview');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [pendingHabitFocusId, setPendingHabitFocusId] = useState<string | null>(null);

  const openSettings = useCallback(() => setIsSettingsOpen(true), []);
  const closeSettings = useCallback(() => setIsSettingsOpen(false), []);
  const openHabit = useCallback((habitId: string) => {
    setPendingHabitFocusId(habitId);
    setActiveSection('habits');
    setIsSettingsOpen(false);
  }, []);
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
        setActiveSection,
        openHabit,
        consumePendingHabitFocus,
        isSettingsOpen,
        openSettings,
        closeSettings,
      }}
    >
      {children}
    </NavigationContext.Provider>
  );
}

export function useAppNavigation(): NavigationContextValue {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useAppNavigation must be used within a NavigationProvider');
  }
  return context;
}
