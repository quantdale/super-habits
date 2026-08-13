import { useCallback, useState, type PropsWithChildren } from 'react';
import { NavigationContext, type AppSection } from '@/core/providers/navigationContext';

export type { AppSection } from '@/core/providers/navigationContext';

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
  const [pendingHabitFocusId, setPendingHabitFocusId] = useState<string | null>(null);

  const openSettings = useCallback(() => setIsSettingsOpen(true), []);
  const closeSettings = useCallback(() => setIsSettingsOpen(false), []);
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
      }}
    >
      {children}
    </NavigationContext.Provider>
  );
}
