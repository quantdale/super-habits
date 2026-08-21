import { MaterialIcons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import { useAppNavigation } from '@/core/providers/navigationContext';
import { useAppTheme } from '@/core/providers/themeContext';
import { Card } from '@/core/ui/Card';

import type { NextBestAction } from './overview.domain';
import { OVERVIEW_CARD_META } from './overviewCards';
import { openCardTarget } from './cards/DashboardCard';

/**
 * Next Best Action hero (docs/ui-ux/03-feature-blueprints.md §1B): one
 * transparent cross-feature suggestion at the top of Today. The whole card
 * deep-links exactly like the customizable DashboardCards do; the reason is
 * always visible so the suggestion never reads as an opaque score.
 */
export function NextBestActionHero({ action }: { action: NextBestAction }) {
  const { tokens, sectionAccents } = useAppTheme();
  const navigation = useAppNavigation();
  const meta = OVERVIEW_CARD_META[action.sectionKey];
  const accentText = sectionAccents[action.sectionKey].text;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Next best action: ${action.title}. ${action.reason}. Open ${meta.title}`}
      onPress={() => openCardTarget(navigation, meta)}
      className="active:opacity-90"
    >
      <Card
        variant="header"
        accentColor={meta.accentColor}
        className="mb-0"
        headerTitle={action.title}
        headerSubtitle={action.reason}
        headerRight={<MaterialIcons name="arrow-forward" size={16} color="#FFFFFF" />}
      >
        <View className="flex-row items-center gap-2">
          <MaterialIcons name="bolt" size={16} color={accentText} />
          <Text className="flex-1 text-sm font-semibold" style={{ color: accentText }}>
            Open {meta.title}
          </Text>
          <Text className="text-xs" style={{ color: tokens.textMuted }}>
            Suggested from today&apos;s data
          </Text>
        </View>
      </Card>
    </Pressable>
  );
}
