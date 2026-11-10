import { MaterialIcons } from '@expo/vector-icons';
import { View } from 'react-native';
import { useAppTheme } from '@/core/providers/themeContext';
import { Button } from '@/core/ui/Button';
import { Card } from '@/core/ui/Card';
import { Text } from '@/core/ui/Text';
import { GardenIcon } from '@/core/ui/illustrations/icons';
import { MOMENTUM_SOURCE_LABELS } from './momentum.types';
import { formatMomentumTodaySummary } from './momentum.domain';
import { MomentumGardenArt } from './MomentumGardenArt';
import type { MomentumGardenModel } from './momentum.types';
import { radius, spacing } from '@/core/theme/designTokens';

type MomentumCardProps = {
  model: MomentumGardenModel;
  onViewGarden: () => void;
};

/**
 * Momentum Garden on Today.
 *
 * P20 (`docs/ui-ux/16-playful-momentum.md` §7 "Momentum Garden"): the art sits
 * in a soft sky-band panel so the middle of the card is a *scene* — a flat
 * illustrated garden with one plant species per contributing area — rather than
 * empty space. Today's contributing sources are listed as chips underneath: the
 * same information the art encodes, spelled out for anyone who does not read
 * the garden yet. Nothing wilts and no state is punitive: an empty day reads
 * "ready", and returning after a gap keeps every prior plant.
 *
 * Presentation only — the model, the summary line and the accessible label all
 * come from `momentum.domain.ts` unchanged.
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
              backgroundColor: accent.tint,
              borderWidth: 2,
              borderColor: `${accent.fill}33`,
              borderBottomWidth: 4,
              borderBottomColor: `${accent.fill}55`,
            }}
          >
            <GardenIcon size={26} bright={accent.fill} lip={accent.fill} />
          </View>
          <View style={{ flexGrow: 1, flexBasis: 200, minWidth: 0 }}>
            <Text variant="titleMd">Momentum Garden</Text>
            <Text variant="caption" tone="muted" numberOfLines={2}>
              Useful actions grow separate roots. There is no score to chase.
            </Text>
          </View>
          <Button
            label="View garden"
            accessibilityLabel="View Momentum Garden"
            variant="secondary"
            size="sm"
            icon="chevron-right"
            onPress={onViewGarden}
          />
        </View>

        <View
          style={{
            borderRadius: radius.md,
            paddingVertical: spacing.xs,
            backgroundColor: accent.tint,
            borderWidth: 1,
            borderColor: `${accent.fill}22`,
          }}
        >
          {/* Compact art (W5 SUR-01): the garden is secondary motivational
              content — it fits its content and never competes with UP NEXT. */}
          <MomentumGardenArt day={model.today} height={104} />
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
                  backgroundColor: accent.tint,
                }}
              >
                {/* Chip ink is the resolved accent TEXT tier: the bright fill
                    as 13px text on its own wash measures ~2:1. */}
                <MaterialIcons name="eco" size={13} color={accent.text} />
                <Text variant="caption" style={{ color: accent.text }}>
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
