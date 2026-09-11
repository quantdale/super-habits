import type { ReactNode } from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';

import { useAppNavigation } from '@/core/providers/navigationContext';
import { useAppTheme } from '@/core/providers/themeContext';
import { Card } from '@/core/ui/Card';
import { SkeletonBlock } from '@/core/ui/SkeletonBlock';
import { Text } from '@/core/ui/Text';
import { radius, spacing } from '@/core/theme/designTokens';

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
    <View style={{ gap: spacing.sm }}>
      <SkeletonBlock height={34} width="45%" radius={radius.sm} />
      <SkeletonBlock height={16} width="100%" radius={radius.sm} />
      <SkeletonBlock height={16} width="70%" radius={radius.sm} />
      <View style={{ height: 1, backgroundColor: tokens.border, opacity: 0.4 }} />
    </View>
  );
}

/**
 * Shared dashboard card shell: deep-links to the card's section on press,
 * renders a loading skeleton or per-card empty state, and lays out content.
 *
 * Pop treatment: the whole tile is tinted with the card's own hue, carries a
 * colored shadow, and leads with a filled icon bubble — so a glance down the
 * Today feed reads as colored signposts instead of a list of identical boxes.
 */
export function DashboardCard({ meta, loading = false, empty, children }: DashboardCardProps) {
  const { tokens, sectionAccents } = useAppTheme();
  const navigation = useAppNavigation();
  const accent = sectionAccents[meta.section ?? 'focus'].fill;

  const handlePress = () => {
    openCardTarget(navigation, meta);
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        meta.overlay === 'achievements'
          ? `${meta.title} card — open achievements`
          : `${meta.title} card — open ${meta.section ?? meta.planningHubView}`
      }
      onPress={handlePress}
      style={({ pressed }) => ({ opacity: pressed ? 0.94 : 1 })}
    >
      <Card accentColor={meta.accentColor} className="mb-0" innerClassName="p-0">
        <View style={{ padding: spacing.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <View
              style={{
                width: 46,
                height: 46,
                borderRadius: radius.md,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: `${accent}22`,
                borderWidth: 1.5,
                borderColor: `${accent}33`,
              }}
            >
              <MaterialIcons name={meta.icon} size={23} color={accent} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text variant="titleMd" numberOfLines={1}>
                {meta.title}
              </Text>
              <Text variant="caption" tone="muted" numberOfLines={1}>
                {meta.subtitle}
              </Text>
            </View>
            <View
              style={{
                width: 34,
                height: 34,
                borderRadius: radius.full,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: tokens.surfaceSunken,
              }}
            >
              <MaterialIcons name="chevron-right" size={22} color={tokens.textMuted} />
            </View>
          </View>
          <View style={{ marginTop: spacing.lg }}>
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
    <View
      style={{
        alignItems: 'center',
        gap: spacing.xs,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
        borderRadius: radius.md,
        backgroundColor: tokens.surfaceSunken,
      }}
    >
      <Text variant="bodyMd" style={{ color: tokens.text, textAlign: 'center' }}>
        {title}
      </Text>
      {description ? (
        <Text variant="caption" tone="muted" style={{ textAlign: 'center' }}>
          {description}
        </Text>
      ) : null}
    </View>
  );
}
