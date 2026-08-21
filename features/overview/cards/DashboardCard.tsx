import type { ReactNode } from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import { useAppNavigation, type AppSection } from '@/core/providers/navigationContext';
import { useAppTheme } from '@/core/providers/themeContext';
import { Card } from '@/core/ui/Card';

import type { OverviewCardMeta } from '../overviewCards';

/** Card sections use color keys; translate to navigation sections. */
const APP_SECTION_BY_CARD_SECTION: Record<string, AppSection> = {
  todos: 'todos',
  habits: 'habits',
  focus: 'pomodoro',
  workout: 'workout',
  calories: 'calories',
};

type CardNavigation = ReturnType<typeof useAppNavigation>;

/**
 * Deep-link a card/hero target exactly like DashboardCard does on press —
 * shared by the customizable cards, the Next Best Action hero, and the
 * Today progress strip so all entry points navigate identically.
 */
export function openCardTarget(
  navigation: CardNavigation,
  meta: Pick<OverviewCardMeta, 'section' | 'planningHubView'>,
) {
  if (meta.section) {
    const appSection = APP_SECTION_BY_CARD_SECTION[meta.section];
    if (appSection) {
      navigation.setActiveSection(appSection);
    } else if (meta.planningHubView) {
      navigation.openPlanningHub(meta.planningHubView);
    }
  } else if (meta.planningHubView) {
    navigation.openPlanningHub(meta.planningHubView);
  }
}

type DashboardCardProps = {
  meta: OverviewCardMeta;
  /** When true, renders a skeleton instead of content. */
  loading?: boolean;
  /** When provided (and not loading), renders an in-card empty state instead of children. */
  empty?: ReactNode;
  children?: ReactNode;
};

function CardSkeleton() {
  const { tokens } = useAppTheme();
  return (
    <View className="gap-2">
      <View
        className="h-8 w-24 animate-pulse rounded-lg"
        style={{ backgroundColor: tokens.surfaceElevated }}
      />
      <View
        className="h-4 w-full animate-pulse rounded-md"
        style={{ backgroundColor: tokens.surfaceElevated }}
      />
      <View
        className="h-4 w-2/3 animate-pulse rounded-md"
        style={{ backgroundColor: tokens.surfaceElevated }}
      />
    </View>
  );
}

/**
 * Shared dashboard card shell: deep-links to the card's section on press,
 * renders a loading skeleton or per-card empty state, and lays out content.
 */
export function DashboardCard({ meta, loading = false, empty, children }: DashboardCardProps) {
  const { tokens, sectionAccents } = useAppTheme();
  const navigation = useAppNavigation();
  const textColor = sectionAccents[meta.section ?? 'focus'].text;

  const handlePress = () => {
    openCardTarget(navigation, meta);
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${meta.title} card — open ${meta.section ?? meta.planningHubView}`}
      onPress={handlePress}
      className="active:opacity-90"
    >
      <Card accentColor={meta.accentColor} className="mb-0" innerClassName="p-0">
        <View className="flex-1 p-4">
          <View className="flex-row items-center gap-3">
            <View
              className="h-10 w-10 items-center justify-center rounded-xl"
              style={{ backgroundColor: `${meta.accentColor}18` }}
            >
              <MaterialIcons name={meta.icon} size={20} color={textColor} />
            </View>
            <View className="min-w-0 flex-1">
              <Text className="text-base font-semibold" style={{ color: tokens.text }}>
                {meta.title}
              </Text>
              <Text className="mt-0.5 text-xs" style={{ color: tokens.textMuted }}>
                {meta.subtitle}
              </Text>
            </View>
            <MaterialIcons name="chevron-right" size={20} color={tokens.textMuted} />
          </View>
          <View className="mt-4">
            {loading ? <CardSkeleton /> : empty !== undefined ? empty : children}
          </View>
        </View>
      </Card>
    </Pressable>
  );
}

/** Standard in-card empty message used by several cards. */
export function CardEmptyMessage({ title, description }: { title: string; description?: string }) {
  const { tokens } = useAppTheme();
  return (
    <View className="py-1">
      <Text className="text-sm font-semibold" style={{ color: tokens.text }}>
        {title}
      </Text>
      {description ? (
        <Text className="mt-1 text-xs leading-5" style={{ color: tokens.textMuted }}>
          {description}
        </Text>
      ) : null}
    </View>
  );
}
