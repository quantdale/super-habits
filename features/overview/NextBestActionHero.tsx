import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, View } from 'react-native';

import { useAppNavigation } from '@/core/providers/navigationContext';
import { useAppTheme } from '@/core/providers/themeContext';
import { Text } from '@/core/ui/Text';
import { elevation, radius, spacing } from '@/core/theme/designTokens';

import type { NextBestAction } from './overview.domain';
import { OVERVIEW_CARD_META } from './overviewCards';
import { openCardTarget } from './cards/DashboardCard.shared';

/**
 * Next Best Action hero (docs/ui-ux/03-feature-blueprints.md §1B): one
 * transparent cross-feature suggestion at the top of Today.
 *
 * Pop treatment: this is the loudest surface in the product — a full-gradient
 * panel with the action as the headline and a white pill that says exactly
 * what happens on tap. The reason stays visible so the suggestion never reads
 * as an opaque score.
 */
export function NextBestActionHero({ action }: { action: NextBestAction }) {
  const { tokens } = useAppTheme();
  const navigation = useAppNavigation();
  const meta = OVERVIEW_CARD_META[action.sectionKey];
  const gradient = tokens.brandGradient;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Next best action: ${action.title}. ${action.reason}. Open ${meta.title}`}
      onPress={() => openCardTarget(navigation, meta)}
      style={({ pressed }) => ({ opacity: pressed ? 0.96 : 1 })}
    >
      <View
        style={[
          {
            borderRadius: radius.lg,
            overflow: 'hidden',
            marginBottom: spacing.lg,
            borderWidth: 1.5,
            borderColor: `${tokens.primary}55`,
          },
          elevation.level2,
          { shadowColor: tokens.glow, shadowOpacity: 0.3, shadowRadius: 22 },
        ]}
      >
        <LinearGradient
          colors={[gradient[0], gradient[1]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={{ padding: spacing.xl, gap: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <View
              style={{
                paddingVertical: 4,
                paddingHorizontal: spacing.md,
                borderRadius: radius.full,
                backgroundColor: 'rgba(255,255,255,0.22)',
              }}
            >
              <Text
                variant="label"
                style={{ color: tokens.onSolid, fontSize: 11, letterSpacing: 0.6 }}
              >
                UP NEXT
              </Text>
            </View>
            <Text variant="caption" style={{ color: 'rgba(255,255,255,0.82)' }} numberOfLines={1}>
              {action.reason}
            </Text>
          </View>
          <Text variant="titleLg" style={{ color: tokens.onSolid }} numberOfLines={3}>
            {action.title}
          </Text>
          <View
            style={{
              alignSelf: 'flex-start',
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.sm,
              paddingVertical: spacing.sm,
              paddingHorizontal: spacing.lg,
              borderRadius: radius.full,
              backgroundColor: tokens.onSolid,
            }}
          >
            <MaterialIcons name="arrow-forward" size={18} color={tokens.primary} />
            <Text variant="label" style={{ color: tokens.primary, fontSize: 14 }}>
              Open {meta.title}
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}
