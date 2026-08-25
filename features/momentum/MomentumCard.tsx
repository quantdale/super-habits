import { MaterialIcons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';
import { useAppTheme } from '@/core/providers/themeContext';
import { Card } from '@/core/ui/Card';
import type { MomentumGardenModel } from './momentum.types';
import { formatMomentumTodaySummary } from './momentum.domain';
import { MomentumGardenArt } from './MomentumGardenArt';

type MomentumCardProps = {
  model: MomentumGardenModel;
  onViewGarden: () => void;
};

export function MomentumCard({ model, onViewGarden }: MomentumCardProps) {
  const { tokens, sectionAccents } = useAppTheme();
  const accent = sectionAccents.habits;
  return (
    <Card accentColor={accent.fill} innerClassName="p-3">
      <View className="flex-row items-start justify-between gap-3">
        <View className="min-w-0 flex-1">
          <View className="flex-row items-center gap-2">
            <MaterialIcons name="spa" size={18} color={accent.text} />
            <Text className="text-base font-semibold" style={{ color: tokens.text }}>
              Momentum Garden
            </Text>
          </View>
          <Text className="mt-1 text-xs" style={{ color: tokens.textMuted }}>
            Useful actions grow separate roots. There is no score to chase.
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="View Momentum Garden"
          onPress={onViewGarden}
          className="min-h-[44px] flex-row items-center gap-1 rounded-xl px-2.5 py-2 active:opacity-70"
          style={{ backgroundColor: accent.tint }}
        >
          <Text className="text-xs font-semibold" style={{ color: accent.text }}>
            View garden
          </Text>
          <MaterialIcons name="chevron-right" size={16} color={accent.text} />
        </Pressable>
      </View>

      <View className="mt-2">
        <MomentumGardenArt day={model.today} height={148} />
      </View>
      <Text
        accessibilityLabel={model.today.accessibilityLabel}
        className="mt-1 text-sm"
        style={{ color: tokens.text }}
      >
        {formatMomentumTodaySummary(model)}
      </Text>
      {model.milestones.length > 0 ? (
        <Text className="mt-1 text-xs" style={{ color: tokens.textMuted }}>
          {model.milestones.length === 1
            ? 'A milestone is blooming in your history.'
            : `${model.milestones.length} milestones are blooming in your history.`}
        </Text>
      ) : null}
    </Card>
  );
}
