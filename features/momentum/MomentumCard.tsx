import { MaterialIcons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';
import { useAppTheme } from '@/core/providers/themeContext';
import { Card } from '@/core/ui/Card';
import { Text } from '@/core/ui/Text';
import { MOMENTUM_SOURCE_LABELS } from './momentum.types';
import { formatMomentumTodaySummary } from './momentum.domain';
import { MomentumGardenArt } from './MomentumGardenArt';
import type { MomentumGardenModel } from './momentum.types';
import { radius, size, spacing } from '@/core/theme/designTokens';

type MomentumCardProps = {
  model: MomentumGardenModel;
  onViewGarden: () => void;
};

/**
 * Momentum Garden on Today.
 *
 * Pop treatment: the art sits in its own tinted, inset panel so the middle of
 * the card is a *scene* rather than empty space, and today's contributing
 * sources are listed as chips underneath — the same information the art
 * encodes, spelled out for anyone who does not read the garden yet.
 */
export function MomentumCard({ model, onViewGarden }: MomentumCardProps) {
  const { tokens, sectionAccents } = useAppTheme();
  const accent = sectionAccents.habits;
  const activeSources = model.today.activeSources;

  return (
    <Card accentColor={accent.fill} innerClassName="p-0">
      <View style={{ padding: spacing.lg, gap: spacing.md }}>
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            alignItems: 'flex-start',
            gap: spacing.md,
          }}
        >
          <View
            style={{
              width: 46,
              height: 46,
              borderRadius: radius.md,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: `${accent.fill}22`,
              borderWidth: 1.5,
              borderColor: `${accent.fill}33`,
            }}
          >
            <MaterialIcons name="spa" size={23} color={accent.text} />
          </View>
          <View style={{ flexGrow: 1, flexBasis: 200, minWidth: 0 }}>
            <Text variant="titleMd">Momentum Garden</Text>
            <Text variant="caption" tone="muted" numberOfLines={2}>
              Useful actions grow separate roots. There is no score to chase.
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="View Momentum Garden"
            onPress={onViewGarden}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.xs,
              minHeight: size.touchTargetMin - 4,
              paddingHorizontal: spacing.md,
              borderRadius: radius.full,
              backgroundColor: tokens.chipBackground,
              borderWidth: 1.5,
              borderColor: tokens.chipBorder,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text variant="label" style={{ color: accent.text, fontSize: 12 }}>
              View garden
            </Text>
            <MaterialIcons name="chevron-right" size={18} color={accent.text} />
          </Pressable>
        </View>

        <View
          style={{
            borderRadius: radius.lg,
            paddingVertical: spacing.sm,
            backgroundColor: accent.tint,
            borderWidth: 1.5,
            borderColor: `${accent.fill}22`,
          }}
        >
          <MomentumGardenArt day={model.today} height={156} />
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
          {activeSources.length === 0 ? (
            <Text variant="caption" tone="muted" style={{ paddingHorizontal: spacing.xs }}>
              Nothing logged yet today — one habit, task, or session plants the first root.
            </Text>
          ) : (
            activeSources.map((source) => (
              <View
                key={source}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  paddingVertical: 4,
                  paddingHorizontal: spacing.sm,
                  borderRadius: radius.full,
                  backgroundColor: `${accent.fill}18`,
                }}
              >
                <MaterialIcons name="eco" size={13} color={accent.fill} />
                <Text variant="caption" style={{ color: accent.fill, fontSize: 11 }}>
                  {MOMENTUM_SOURCE_LABELS[source]}
                </Text>
              </View>
            ))
          )}
        </View>

        <Text
          accessibilityLabel={model.today.accessibilityLabel}
          variant="bodyMd"
          style={{ color: tokens.text }}
        >
          {formatMomentumTodaySummary(model)}
        </Text>
        {model.milestones.length > 0 ? (
          <Text variant="caption" tone="muted">
            {model.milestones.length === 1
              ? 'A milestone is blooming in your history.'
              : `${model.milestones.length} milestones are blooming in your history.`}
          </Text>
        ) : null}
      </View>
    </Card>
  );
}
