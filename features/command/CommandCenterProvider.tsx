import { type AppSection, useAppNavigation } from '@/core/providers/navigationContext';
import { type PropsWithChildren, useCallback, useMemo, useState } from 'react';
import { Platform, useWindowDimensions } from 'react-native';
import { Modal } from '@/core/ui/Modal';
import { COMMAND_EXPERIMENT_ENABLED } from '@/features/command/types';
import { type CommandCenterLaunchContext } from './commandCenterConfig';
import { CommandScreen } from './CommandScreen';
import { CommandCenterContext, useCommandCenter } from './commandCenterContext';
import { usePomodoroCommandBridge } from '@/features/pomodoro/pomodoroCommandBridgeContext';

export function CommandCenterProvider({ children }: PropsWithChildren) {
  const [isOpen, setIsOpen] = useState(false);
  const [launchContext, setLaunchContext] = useState<CommandCenterLaunchContext | null>(null);
  const [suppressionMap, setSuppressionMap] = useState<Record<string, boolean>>({});

  const openCommandCenter = useCallback((context: CommandCenterLaunchContext) => {
    setLaunchContext(context);
    setIsOpen(true);
  }, []);

  const closeCommandCenter = useCallback(() => {
    setIsOpen(false);
    setLaunchContext(null);
  }, []);

  const setLauncherSuppressed = useCallback((key: string, suppressed: boolean) => {
    setSuppressionMap((current) => {
      if (suppressed) {
        if (current[key]) return current;
        return { ...current, [key]: true };
      }

      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      isOpen,
      launchContext,
      launcherSuppressed: Object.keys(suppressionMap).length > 0,
      openCommandCenter,
      closeCommandCenter,
      setLauncherSuppressed,
    }),
    [
      closeCommandCenter,
      isOpen,
      launchContext,
      openCommandCenter,
      setLauncherSuppressed,
      suppressionMap,
    ],
  );

  return <CommandCenterContext.Provider value={value}>{children}</CommandCenterContext.Provider>;
}

export function GlobalCommandCenterHost() {
  const { width } = useWindowDimensions();
  const { setActiveSection } = useAppNavigation();
  const { requestFocusSession } = usePomodoroCommandBridge();
  const { isOpen, launchContext, closeCommandCenter } = useCommandCenter();

  const handleNavigateToDestination = useCallback(
    (section: AppSection) => {
      closeCommandCenter();
      setActiveSection(section);
    },
    [closeCommandCenter, setActiveSection],
  );

  const handleStartFocusSession = useCallback(
    (durationMinutes: number) => {
      setActiveSection('pomodoro');
      return requestFocusSession(durationMinutes);
    },
    [requestFocusSession, setActiveSection],
  );

  if (!COMMAND_EXPERIMENT_ENABLED) {
    return null;
  }

  return (
    <Modal
      visible={isOpen}
      onClose={closeCommandCenter}
      title="Command center"
      scroll
      modalLayout={Platform.OS === 'web' && width >= 960 ? 'drawer' : 'bottom-sheet'}
    >
      {launchContext ? (
        <CommandScreen
          launchContext={launchContext}
          onRequestClose={closeCommandCenter}
          onNavigateToDestination={handleNavigateToDestination}
          onStartFocusSession={handleStartFocusSession}
        />
      ) : null}
    </Modal>
  );
}
