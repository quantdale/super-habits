import { MaterialIcons } from '@expo/vector-icons';
import { type AppSection, useAppNavigation } from '@/core/providers/NavigationProvider';
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Platform, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { useAppTheme } from '@/core/providers/ThemeProvider';
import { Modal } from '@/core/ui/Modal';
import { COMMAND_EXPERIMENT_ENABLED } from '@/features/command/types';
import {
  type CommandCenterLaunchContext,
  getCommandCenterContextCopy,
} from './commandCenterConfig';
import { CommandScreen } from './CommandScreen';

type CommandCenterContextValue = {
  isOpen: boolean;
  launchContext: CommandCenterLaunchContext | null;
  launcherSuppressed: boolean;
  openCommandCenter: (context: CommandCenterLaunchContext) => void;
  closeCommandCenter: () => void;
  setLauncherSuppressed: (key: string, suppressed: boolean) => void;
};

const CommandCenterContext = createContext<CommandCenterContextValue | null>(null);

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

export function useCommandCenter() {
  const context = useContext(CommandCenterContext);
  if (!context) {
    throw new Error('useCommandCenter must be used within CommandCenterProvider');
  }
  return context;
}

export function useCommandLauncherSuppressed(key: string, suppressed: boolean) {
  const { setLauncherSuppressed } = useCommandCenter();

  useEffect(() => {
    setLauncherSuppressed(key, suppressed);
    return () => {
      setLauncherSuppressed(key, false);
    };
  }, [key, setLauncherSuppressed, suppressed]);
}

function FloatingCommandLauncher({
  launchContext,
  onPress,
}: {
  launchContext: CommandCenterLaunchContext;
  onPress: () => void;
}) {
  const { tokens } = useAppTheme();
  const { width } = useWindowDimensions();
  const contextCopy = getCommandCenterContextCopy(launchContext);
  const showLabel = Platform.OS === 'web' && width >= 960;

  if (!contextCopy) return null;

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        right: 16,
        bottom: 24,
        zIndex: 80,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open command center"
        onPress={onPress}
        className={`items-center justify-center rounded-2xl border ${
          showLabel ? 'flex-row gap-2 px-4 py-3' : 'h-14 w-14'
        }`}
        style={{
          borderColor: tokens.border,
          backgroundColor: tokens.surface,
          shadowColor: tokens.shadowColor,
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.08,
          shadowRadius: 16,
          elevation: 3,
        }}
      >
        <MaterialIcons name="bolt" size={20} color={contextCopy.accentColor} />
        {showLabel ? (
          <Text className="text-sm font-semibold" style={{ color: tokens.text }}>
            Command
          </Text>
        ) : null}
      </Pressable>
    </View>
  );
}

export function GlobalCommandCenterHost() {
  const { width } = useWindowDimensions();
  const { activeSection, setActiveSection, isSettingsOpen } = useAppNavigation();
  const { isOpen, launchContext, launcherSuppressed, openCommandCenter, closeCommandCenter } =
    useCommandCenter();

  const currentContext = activeSection;
  const launcherVisible = COMMAND_EXPERIMENT_ENABLED && !isOpen && !launcherSuppressed && !isSettingsOpen;

  const handleNavigateToDestination = useCallback(
    (section: AppSection) => {
      closeCommandCenter();
      setActiveSection(section);
    },
    [closeCommandCenter, setActiveSection],
  );

  if (!COMMAND_EXPERIMENT_ENABLED) {
    return null;
  }

  return (
    <>
      {launcherVisible ? (
        <FloatingCommandLauncher
          launchContext={currentContext}
          onPress={() => openCommandCenter(currentContext)}
        />
      ) : null}

      <Modal
        visible={isOpen}
        onClose={closeCommandCenter}
        title="Command center"
        scroll
        layout={Platform.OS === 'web' && width >= 960 ? 'drawer' : 'bottom-sheet'}
      >
        {launchContext ? (
          <CommandScreen
            launchContext={launchContext}
            onRequestClose={closeCommandCenter}
            onNavigateToDestination={handleNavigateToDestination}
          />
        ) : null}
      </Modal>
    </>
  );
}
