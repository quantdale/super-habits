import { createContext, useContext, useEffect } from 'react';
import type { CommandCenterLaunchContext } from './commandCenterConfig';

export type CommandCenterContextValue = {
  isOpen: boolean;
  launchContext: CommandCenterLaunchContext | null;
  launcherSuppressed: boolean;
  openCommandCenter: (context: CommandCenterLaunchContext) => void;
  closeCommandCenter: () => void;
  setLauncherSuppressed: (key: string, suppressed: boolean) => void;
};

const CommandCenterContext = createContext<CommandCenterContextValue | null>(null);

export function useCommandCenter(): CommandCenterContextValue {
  const context = useContext(CommandCenterContext);
  if (!context) {
    throw new Error('useCommandCenter must be used within CommandCenterProvider');
  }
  return context;
}

export function useCommandLauncherSuppressed(key: string, suppressed: boolean): void {
  const { setLauncherSuppressed } = useCommandCenter();

  useEffect(() => {
    setLauncherSuppressed(key, suppressed);
    return () => {
      setLauncherSuppressed(key, false);
    };
  }, [key, setLauncherSuppressed, suppressed]);
}

export { CommandCenterContext };
