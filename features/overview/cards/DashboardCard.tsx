import type { ReactNode } from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import { useAppNavigation } from '@/core/providers/navigationContext';
import { useAppTheme } from '@/core/providers/themeContext';
import { Card } from '@/core/ui/Card';
import { spacing, radius } from '@/core/theme/designTokens';

import { openCardTarget } from './DashboardCard.shared';
import type { OverviewCardMeta } from '../overviewCards';

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
        <View className="flex-1" style={{ padding: spacing.lg }}>
          <View className="flex-row items-center" style={{ gap: spacing.md }}>
            <View
              className="items-center justify-center"
              style={{
                width: 40,
                height: 40,
                borderRadius: radius.md,
                backgroundColor: `${meta.accentColor}18`,
              }}
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
