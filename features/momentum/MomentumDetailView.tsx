import { Text } from '@/core/ui/Text';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useAppTheme } from '@/core/providers/themeContext';
import { useDayRolloverGeneration } from '@/core/providers/dayRolloverContext';
import { useForegroundRefresh } from '@/lib/useForegroundRefresh';
import { useGuardedAsyncRefresh } from '@/lib/useGuardedAsyncRefresh';
import { Card } from '@/core/ui/Card';
import { Button } from '@/core/ui/Button';
import { PillChip } from '@/core/ui/PillChip';
import { EmptyStateCard } from '@/core/ui/EmptyStateCard';
import { GARDEN_SUN, GARDEN_SPECIES } from './momentumGarden.visual';
import { getMomentumGarden } from './momentum.data';
import {
  buildMomentumSourceExplanations,
  formatMomentumDateLabel,
  formatMomentumTodaySummary,
} from './momentum.domain';
import { MomentumGardenArt } from './MomentumGardenArt';
import type { MomentumGardenModel, MomentumSource } from './momentum.types';
import { radius, spacing } from '@/core/theme/designTokens';

type MomentumDetailViewProps = {
  initialDays?: 7 | 28;
};

/**
 * The area's own text tone (never the `bright` fill): a bright section hue
 * painted as 11–15px text measures ~2:1 on a white card, while the resolved
 * accent text clears the floor in both appearances. Planning keeps the Gold
 * reward tone because it is the garden's reward bed.
 */
function sourceColor(
  source: MomentumSource,
  sectionAccents: ReturnType<typeof useAppTheme>['sectionAccents'],
  tokens: ReturnType<typeof useAppTheme>['tokens'],
): string {
  const hue = GARDEN_SPECIES[source].hue;
  if (hue === 'gold') return GARDEN_SUN.fill;
  return sectionAccents[hue].text;
}

/** Section accent key a garden species paints with (Gold maps to the Focus slot). */
function accentKeyFor(
  source: MomentumSource,
): keyof ReturnType<typeof useAppTheme>['sectionAccents'] {
  const hue = GARDEN_SPECIES[source].hue;
  return hue === 'gold' ? 'focus' : hue;
}

/** A small plant pictogram matching the garden's species for that area. */
function SourceMarker({
  source,
  tint,
  ink,
}: {
  source: MomentumSource;
  tint: string;
  ink: string;
}) {
  return (
    <View
      style={{
        width: 22,
        height: 22,
        borderRadius: radius.full,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: tint,
      }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: GARDEN_SPECIES[source].species === 'cactus' ? 2 : radius.full,
          backgroundColor: ink,
        }}
      />
    </View>
  );
}

function MomentumDayRow({ model, dateKey }: { model: MomentumGardenModel; dateKey: string }) {
  const { tokens, sectionAccents } = useAppTheme();
  const day = model.days.find((candidate) => candidate.dateKey === dateKey);
  if (!day) return null;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        borderRadius: radius.sm,
        borderWidth: 2,
        borderColor: tokens.border,
        borderBottomWidth: 4,
        borderBottomColor: tokens.borderStrong,
        backgroundColor: tokens.surface,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
      }}
      accessible
      accessibilityRole="text"
      accessibilityLabel={day.accessibilityLabel}
    >
      <View style={{ width: 84 }}>
        <Text variant="bodyMd" style={{ color: tokens.text }} numberOfLines={1}>
          {formatMomentumDateLabel(day.dateKey, model.todayKey)}
        </Text>
        <Text variant="caption" tone="muted" numberOfLines={1}>
          {day.dateKey}
        </Text>
      </View>
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: spacing.xs,
          flex: 1,
          minWidth: 0,
        }}
      >
        {day.activeSources.length > 0 ? (
          day.activeSources.map((source) => {
            const ink = sourceColor(source, sectionAccents, tokens);
            return (
              <View
                key={source}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  borderRadius: radius.full,
                  paddingHorizontal: spacing.sm,
                  paddingVertical: 3,
                  backgroundColor:
                    sectionAccents[
                      GARDEN_SPECIES[source].hue === 'gold' ? 'focus' : GARDEN_SPECIES[source].hue
                    ].tint,
                }}
              >
                <SourceMarker
                  source={source}
                  tint={`${
                    sectionAccents[
                      GARDEN_SPECIES[source].hue === 'gold' ? 'focus' : GARDEN_SPECIES[source].hue
                    ].fill
                  }22`}
                  ink={
                    sectionAccents[
                      GARDEN_SPECIES[source].hue === 'gold' ? 'focus' : GARDEN_SPECIES[source].hue
                    ].fill
                  }
                />
                <Text variant="caption" style={{ color: ink }}>
                  {day.contributions[source].label}
                </Text>
              </View>
            );
          })
        ) : (
          <Text variant="caption" tone="muted">
            Ready for new growth
          </Text>
        )}
      </View>
    </View>
  );
}

/**
 * The deeper Momentum Garden view (Plan hub → Progress, and the Today card's
 * "View garden" destination).
 *
 * P20 (`docs/ui-ux/16-playful-momentum.md` §7 "Momentum Garden"): the scene is
 * a flat illustrated garden on a soft sky band, the "Why each area grows"
 * explanation text is kept verbatim (it is the read-only contract), and every
 * state stays neutral — an empty bed reads "Ready for new growth", never a
 * withering or a loss. Behaviour is untouched: same `getMomentumGarden` read,
 * same day-rollover/foreground refresh, same 7/28-day window, same milestone
 * list.
 */
export function MomentumDetailView({ initialDays = 7 }: MomentumDetailViewProps) {
  const { tokens, sectionAccents } = useAppTheme();
  const gardenAccent = sectionAccents.habits;
  const dayGeneration = useDayRolloverGeneration();
  const [windowDays, setWindowDays] = useState<7 | 28>(initialDays);
  const [model, setModel] = useState<MomentumGardenModel | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { begin } = useGuardedAsyncRefresh();

  const load = useCallback(
    async (days: 7 | 28) => {
      // One guard instance per refresh unit (audit C §12): a newer window or
      // day-rollover load invalidates this one, so a stale run can neither
      // overwrite fresher state nor clear the newer load's spinner.
      const isCurrent = begin();
      setIsLoading(true);
      try {
        const nextModel = await getMomentumGarden({ days });
        if (!isCurrent()) return;
        setModel(nextModel);
        setLoadError(null);
      } catch (error) {
        if (!isCurrent()) return;
        console.error('[MomentumDetailView] load failed', error);
        setLoadError(error instanceof Error ? error.message : 'Could not load your garden.');
      } finally {
        if (isCurrent()) setIsLoading(false);
      }
    },
    [begin],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional async data-load
    void load(windowDays);
  }, [dayGeneration, load, windowDays]);

  useForegroundRefresh(
    useCallback(() => {
      void load(windowDays);
    }, [load, windowDays]),
  );

  const explanations = useMemo(
    () => (model ? buildMomentumSourceExplanations(model) : []),
    [model],
  );

  if (loadError && !isLoading && !model) {
    return (
      <View style={{ gap: spacing.md }}>
        <Text variant="titleMd">Momentum Garden</Text>
        <Card
          variant="header"
          accentColor={gardenAccent.fill}
          headerTitle="Your garden is temporarily unavailable"
          headerSubtitle="Nothing was saved or changed."
        >
          <View style={{ gap: spacing.md }}>
            <Text variant="bodyMd" tone="muted">
              {loadError}
            </Text>
            <Button
              label="Try again"
              onPress={() => void load(windowDays)}
              color={gardenAccent.fill}
            />
          </View>
        </Card>
      </View>
    );
  }

  if (isLoading && !model) {
    return (
      <View
        style={{
          minHeight: 180,
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.md,
        }}
      >
        <ActivityIndicator size="large" color={gardenAccent.text} />
        <Text variant="bodyMd" tone="muted">
          Looking across your recent work…
        </Text>
      </View>
    );
  }

  if (!model) {
    return (
      <EmptyStateCard
        accentColor={gardenAccent.fill}
        title="Your garden is ready"
        description="Meaningful work will appear here as it accumulates."
      />
    );
  }

  const historyDays = model.days.slice(-windowDays);
  const returningCopy =
    !model.today.hasGrowth && model.hasPriorGrowth
      ? 'Welcome back. Your previous progress is still here. Start today’s growth when you’re ready.'
      : null;

  return (
    <View style={{ gap: spacing.md }}>
      <View>
        <Text variant="titleMd">Momentum Garden</Text>
        <Text variant="caption" tone="muted" style={{ marginTop: spacing.xs }}>
          Each area grows from real work. Missing activity leaves the garden neutral, never worse.
        </Text>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        <PillChip
          label="7 days"
          active={windowDays === 7}
          color={gardenAccent.fill}
          onPress={() => setWindowDays(7)}
        />
        <PillChip
          label="28 days"
          active={windowDays === 28}
          color={gardenAccent.fill}
          onPress={() => setWindowDays(28)}
        />
      </View>

      <Card innerClassName="p-3" accentColor={gardenAccent.fill}>
        <Text variant="bodyMd" style={{ color: tokens.text }}>
          Today
        </Text>
        <MomentumGardenArt day={model.today} height={164} />
        <Text variant="bodyMd" style={{ color: tokens.text, marginTop: spacing.xs }}>
          {formatMomentumTodaySummary(model)}
        </Text>
        <Text variant="caption" tone="muted" style={{ marginTop: spacing.xs }}>
          {model.today.accessibilityLabel}
        </Text>
        {returningCopy ? (
          <View
            style={{
              marginTop: spacing.sm,
              borderRadius: radius.sm,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              backgroundColor: tokens.surfaceElevated,
            }}
          >
            <Text variant="bodyMd" style={{ color: tokens.text }}>
              {returningCopy}
            </Text>
          </View>
        ) : null}
      </Card>

      <Card accentColor={sectionAccents.todos.fill} innerClassName="p-3">
        <Text variant="bodyMd" style={{ color: tokens.text }}>
          Why each area grows
        </Text>
        <Text variant="caption" tone="muted" style={{ marginTop: spacing.xs }}>
          These are separate signals, not a combined rating.
        </Text>
        <View style={{ marginTop: spacing.md, gap: spacing.md }}>
          {explanations.map((explanation) => {
            const accent = accentKeyFor(explanation.source);
            return (
              <View
                key={explanation.source}
                style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }}
              >
                <SourceMarker
                  source={explanation.source}
                  tint={sectionAccents[accent].tint}
                  ink={sectionAccents[accent].fill}
                />
                <View style={{ minWidth: 0, flex: 1 }}>
                  <Text
                    variant="bodyMd"
                    style={{
                      color: sourceColor(explanation.source, sectionAccents, tokens),
                    }}
                  >
                    {explanation.label}
                  </Text>
                  <Text variant="caption" tone="muted">
                    {explanation.explanation}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      </Card>

      <Card accentColor={sectionAccents.focus.fill} innerClassName="p-3">
        <Text variant="bodyMd" style={{ color: tokens.text }}>
          Recent growth
        </Text>
        <Text variant="caption" tone="muted" style={{ marginTop: spacing.xs }}>
          {model.accessibilityLabel}
        </Text>
        <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
          {historyDays.map((day) => (
            <MomentumDayRow key={day.dateKey} model={model} dateKey={day.dateKey} />
          ))}
        </View>
      </Card>

      {model.milestones.length > 0 ? (
        <Card accentColor={GARDEN_SUN.fill} innerClassName="p-3">
          <Text variant="bodyMd" style={{ color: tokens.text }}>
            Milestones from real progress
          </Text>
          <View style={{ marginTop: spacing.sm, gap: spacing.xs }}>
            {model.milestones.map((milestone) => (
              <Text key={milestone.id} variant="bodyMd" style={{ color: tokens.text }}>
                • {milestone.label} · {milestone.dateKey}
              </Text>
            ))}
          </View>
        </Card>
      ) : null}
    </View>
  );
}
