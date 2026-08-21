import { MaterialIcons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import { useAppTheme } from '@/core/providers/themeContext';
import { Card } from '@/core/ui/Card';

import {
  moveCard,
  OVERVIEW_CARD_IDS,
  toggleCardVisibility,
  type OverviewCardId,
} from './overview.domain';
import { OVERVIEW_CARD_META } from './overviewCards';

type CustomizeCardsPanelProps = {
  layout: readonly OverviewCardId[];
  onChange: (next: OverviewCardId[]) => void;
};

/**
 * Inline customize-mode editor: shows every known card in display order
 * (visible first, following the persisted layout, then hidden cards at their
 * default positions) with visibility toggles and move up/down controls.
 */
export function CustomizeCardsPanel({ layout, onChange }: CustomizeCardsPanelProps) {
  const { tokens } = useAppTheme();

  // Visible cards in user order, then hidden cards in default registry order.
  const ordered: OverviewCardId[] = [
    ...layout,
    ...OVERVIEW_CARD_IDS.filter((id) => !layout.includes(id)),
  ];

  return (
    <Card accentColor={OVERVIEW_CARD_META.focus.accentColor} className="mb-4">
      <View className="gap-1">
        <Text className="text-sm font-semibold" style={{ color: tokens.text }}>
          Customize dashboard
        </Text>
        <Text className="mb-2 text-xs" style={{ color: tokens.textMuted }}>
          Toggle cards and reorder them. Changes save automatically.
        </Text>
        {ordered.map((id, index) => {
          const meta = OVERVIEW_CARD_META[id];
          const visible = layout.includes(id);
          const visibleIndex = layout.indexOf(id);
          return (
            <View
              key={id}
              className="flex-row items-center gap-2 rounded-xl px-2 py-2"
              style={{ backgroundColor: tokens.surfaceElevated }}
            >
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: visible }}
                accessibilityLabel={`${visible ? 'Hide' : 'Show'} ${meta.title} card`}
                onPress={() => onChange(toggleCardVisibility(layout, id))}
                className="h-7 w-7 items-center justify-center rounded-lg"
                style={{
                  backgroundColor: visible ? meta.accentColor : 'transparent',
                  borderWidth: 2,
                  borderColor: visible ? meta.accentColor : tokens.border,
                }}
              >
                {visible ? <MaterialIcons name="check" size={16} color="#FFFFFF" /> : null}
              </Pressable>
              <View className="min-w-0 flex-1">
                <Text
                  className="text-sm font-medium"
                  style={{ color: visible ? tokens.text : tokens.textMuted }}
                  numberOfLines={1}
                >
                  {meta.title}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Move ${meta.title} card up`}
                disabled={!visible || visibleIndex === 0}
                onPress={() => onChange(moveCard(layout, id, -1))}
                className="h-8 w-8 items-center justify-center rounded-lg active:opacity-70"
              >
                <MaterialIcons
                  name="arrow-upward"
                  size={18}
                  color={!visible || visibleIndex === 0 ? tokens.textMuted : tokens.text}
                />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Move ${meta.title} card down`}
                disabled={!visible || visibleIndex === layout.length - 1}
                onPress={() => onChange(moveCard(layout, id, 1))}
                className="h-8 w-8 items-center justify-center rounded-lg active:opacity-70"
              >
                <MaterialIcons
                  name="arrow-downward"
                  size={18}
                  color={
                    !visible || visibleIndex === layout.length - 1 ? tokens.textMuted : tokens.text
                  }
                />
              </Pressable>
              <Text
                className="w-4 text-center text-xs tabular-nums"
                style={{ color: tokens.textMuted }}
              >
                {index + 1}
              </Text>
            </View>
          );
        })}
      </View>
    </Card>
  );
}
