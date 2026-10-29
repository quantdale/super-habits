import { MaterialIcons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';

import { SECTION_HUES } from '@/constants/sectionColors';
import { useAppNavigation } from '@/core/providers/navigationContext';
import { useAppTheme } from '@/core/providers/themeContext';
import { Text } from '@/core/ui/Text';
import { Sprout } from '@/core/ui/illustrations/Sprout';
import { radius, spacing } from '@/core/theme/designTokens';

import type { NextBestAction } from './overview.domain';
import { OVERVIEW_CARD_META } from './overviewCards';
import { openCardTarget } from './cards/DashboardCard.shared';

/** Ink on a bright face (§5.1 "ink `#10131A` on bright"). */
const HERO_INK = '#10131A';

/**
 * UP NEXT hero (Playful Momentum §7): the one hero Today owns. A section
 * **bright** face with ink text — "UP NEXT" overline kept, the task title as
 * `titleLg`, the reason as caption, one solid lg button ("Open …"), and Sprout
 * peeking from the card corner (`idle`, decorative). The whole card stays one
 * button with its existing accessible name.
 */
export function NextBestActionHero({ action }: { action: NextBestAction }) {
  const { tokens } = useAppTheme();
  const navigation = useAppNavigation();
  const meta = OVERVIEW_CARD_META[action.sectionKey];
  const hue = SECTION_HUES[action.sectionKey];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Next best action: ${action.title}. ${action.reason}. Open ${meta.title}`}
      onPress={() => openCardTarget(navigation, meta)}
      style={({ pressed }) => ({
        borderRadius: radius.lg,
        backgroundColor: hue.bright,
        borderBottomWidth: 4,
        borderBottomColor: hue.lip,
        padding: spacing.lg + 4,
        paddingRight: spacing.xl + spacing.xl,
        gap: spacing.sm,
        marginBottom: spacing.lg,
        opacity: pressed ? 0.96 : 1,
      })}
    >
      <View
        style={{
          alignSelf: 'flex-start',
          paddingVertical: 3,
          paddingHorizontal: spacing.sm + 2,
          borderRadius: radius.full,
          backgroundColor: 'rgba(255,255,255,0.85)',
        }}
      >
        <Text variant="label" style={{ color: HERO_INK, fontSize: 11, letterSpacing: 0.6 }}>
          UP NEXT
        </Text>
      </View>
      <Text variant="titleLg" style={{ color: HERO_INK }} numberOfLines={3}>
        {action.title}
      </Text>
      <Text variant="caption" style={{ color: HERO_INK }} numberOfLines={1}>
        {action.reason}
      </Text>
      <View
        style={{
          alignSelf: 'flex-start',
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.xs + 2,
          marginTop: spacing.xs,
          paddingVertical: spacing.md + 2,
          paddingHorizontal: spacing.xl,
          borderRadius: radius.md,
          backgroundColor: hue.solid,
          borderBottomWidth: 4,
          borderBottomColor: hue.lip,
        }}
      >
        <MaterialIcons name="arrow-forward" size={20} color={tokens.onSolid} />
        <Text variant="label" style={{ color: tokens.onSolid, fontSize: 15, fontWeight: '800' }}>
          Open {meta.title}
        </Text>
      </View>
      {/* Sprout peeks from the corner (§7 hero, mascot `idle` pose, decorative). */}
      <View
        pointerEvents="none"
        style={{ position: 'absolute', right: spacing.md, bottom: spacing.sm }}
      >
        <Sprout pose="idle" size={64} />
      </View>
    </Pressable>
  );
}
