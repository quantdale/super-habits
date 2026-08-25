import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useAppTheme } from '@/core/providers/themeContext';
import { useDayRolloverGeneration } from '@/core/providers/dayRolloverContext';
import { useForegroundRefresh } from '@/lib/useForegroundRefresh';
import { dateKeyToLocalDate } from '@/lib/time';
import { Card } from '@/core/ui/Card';
import { Button } from '@/core/ui/Button';
import { PillChip } from '@/core/ui/PillChip';
import { EmptyStateCard } from '@/core/ui/EmptyStateCard';
import { getMomentumGarden } from './momentum.data';
import { buildMomentumSourceExplanations, formatMomentumTodaySummary } from './momentum.domain';
import { MomentumGardenArt } from './MomentumGardenArt';
import type { MomentumGardenModel, MomentumSource } from './momentum.types';

type MomentumDetailViewProps = {
  initialDays?: 7 | 28;
};

function formatDateLabel(dateKey: string, todayKey: string): string {
  if (dateKey === todayKey) return 'Today';
  const today = dateKeyToLocalDate(todayKey);
  const date = dateKeyToLocalDate(dateKey);
  const difference = Math.round((today.getTime() - date.getTime()) / 86_400_000);
  if (difference === 1) return 'Yesterday';
  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function sourceColor(
  source: MomentumSource,
  sectionAccents: ReturnType<typeof useAppTheme>['sectionAccents'],
  tokens: ReturnType<typeof useAppTheme>['tokens'],
): string {
  switch (source) {
    case 'tasks':
      return sectionAccents.todos.text;
    case 'habits':
      return sectionAccents.habits.text;
    case 'focus':
      return sectionAccents.focus.text;
    case 'workout':
      return sectionAccents.workout.text;
    case 'nutrition':
      return sectionAccents.calories.text;
    case 'planning':
      return tokens.accent;
    case 'review':
      return sectionAccents.focus.text;
  }
}

function MomentumDayRow({ model, dateKey }: { model: MomentumGardenModel; dateKey: string }) {
  const { tokens, sectionAccents } = useAppTheme();
  const day = model.days.find((candidate) => candidate.dateKey === dateKey);
  if (!day) return null;
  return (
    <View
      className="flex-row items-center gap-3 rounded-2xl border px-3 py-2.5"
      style={{ borderColor: tokens.border, backgroundColor: tokens.surface }}
      accessible
      accessibilityRole="text"
      accessibilityLabel={day.accessibilityLabel}
    >
      <View className="w-[72px]">
        <Text className="text-sm font-semibold" style={{ color: tokens.text }}>
          {formatDateLabel(day.dateKey, model.todayKey)}
        </Text>
        <Text className="text-[11px]" style={{ color: tokens.textMuted }}>
          {day.dateKey}
        </Text>
      </View>
      <View className="min-w-0 flex-1 flex-row flex-wrap items-center gap-1.5">
        {day.activeSources.length > 0 ? (
          day.activeSources.map((source) => (
            <View
              key={source}
              className="rounded-full px-2 py-1"
              style={{ backgroundColor: `${sourceColor(source, sectionAccents, tokens)}1f` }}
            >
              <Text
                className="text-[11px] font-semibold"
                style={{ color: sourceColor(source, sectionAccents, tokens) }}
              >
                {day.contributions[source].label}
              </Text>
            </View>
          ))
        ) : (
          <Text className="text-xs" style={{ color: tokens.textMuted }}>
            Ready for new growth
          </Text>
        )}
      </View>
    </View>
  );
}

export function MomentumDetailView({ initialDays = 7 }: MomentumDetailViewProps) {
  const { tokens, sectionAccents } = useAppTheme();
  const gardenAccent = sectionAccents.habits;
  const dayGeneration = useDayRolloverGeneration();
  const [windowDays, setWindowDays] = useState<7 | 28>(initialDays);
  const [model, setModel] = useState<MomentumGardenModel | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async (days: 7 | 28) => {
    setIsLoading(true);
    try {
      setModel(await getMomentumGarden({ days }));
      setLoadError(null);
    } catch (error) {
      console.error('[MomentumDetailView] load failed', error);
      setLoadError(error instanceof Error ? error.message : 'Could not load your garden.');
    } finally {
      setIsLoading(false);
    }
  }, []);

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
      <View className="gap-3">
        <Text className="text-lg font-bold" style={{ color: tokens.text }}>
          Momentum Garden
        </Text>
        <Card
          variant="header"
          accentColor={gardenAccent.fill}
          headerTitle="Your garden is temporarily unavailable"
          headerSubtitle="Nothing was saved or changed."
        >
          <View className="gap-3">
            <Text className="text-sm" style={{ color: tokens.textMuted }}>
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
      <View className="min-h-[180px] items-center justify-center">
        <ActivityIndicator size="large" color={gardenAccent.text} />
        <Text className="mt-3 text-sm" style={{ color: tokens.textMuted }}>
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
        icon={<Text style={{ color: gardenAccent.text }}>•</Text>}
      />
    );
  }

  const historyDays = model.days.slice(-windowDays);
  const returningCopy =
    !model.today.hasGrowth && model.hasPriorGrowth
      ? 'Welcome back. Your previous progress is still here. Start today’s growth when you’re ready.'
      : null;

  return (
    <View className="gap-3">
      <View>
        <Text className="text-lg font-bold" style={{ color: tokens.text }}>
          Momentum Garden
        </Text>
        <Text className="mt-1 text-sm" style={{ color: tokens.textMuted }}>
          Each area grows from real work. Missing activity leaves the garden neutral, never worse.
        </Text>
      </View>

      <View className="flex-row flex-wrap">
        <PillChip
          label="7 days"
          active={windowDays === 7}
          color={gardenAccent.text}
          onPress={() => setWindowDays(7)}
        />
        <PillChip
          label="28 days"
          active={windowDays === 28}
          color={gardenAccent.text}
          onPress={() => setWindowDays(28)}
        />
      </View>

      <Card accentColor={gardenAccent.fill} innerClassName="p-3">
        <Text className="text-sm font-semibold" style={{ color: tokens.text }}>
          Today
        </Text>
        <MomentumGardenArt day={model.today} height={164} />
        <Text className="mt-1 text-sm" style={{ color: tokens.text }}>
          {formatMomentumTodaySummary(model)}
        </Text>
        <Text className="mt-1 text-xs" style={{ color: tokens.textMuted }}>
          {model.today.accessibilityLabel}
        </Text>
        {returningCopy ? (
          <Text
            className="mt-2 rounded-xl px-3 py-2 text-sm"
            style={{ color: tokens.text, backgroundColor: tokens.surfaceElevated }}
          >
            {returningCopy}
          </Text>
        ) : null}
      </Card>

      <Card accentColor={sectionAccents.todos.fill} innerClassName="p-3">
        <Text className="text-sm font-semibold" style={{ color: tokens.text }}>
          Why each area grows
        </Text>
        <Text className="mt-1 text-xs" style={{ color: tokens.textMuted }}>
          These are separate signals, not a combined rating.
        </Text>
        <View className="mt-3 gap-2">
          {explanations.map((explanation) => (
            <View key={explanation.source} className="flex-row items-start gap-2">
              <View
                className="mt-1.5 h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: sourceColor(explanation.source, sectionAccents, tokens) }}
              />
              <View className="min-w-0 flex-1">
                <Text className="text-sm font-semibold" style={{ color: tokens.text }}>
                  {explanation.label}
                </Text>
                <Text className="text-xs" style={{ color: tokens.textMuted }}>
                  {explanation.explanation}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </Card>

      <Card accentColor={sectionAccents.focus.fill} innerClassName="p-3">
        <Text className="text-sm font-semibold" style={{ color: tokens.text }}>
          Recent growth
        </Text>
        <Text className="mt-1 text-xs" style={{ color: tokens.textMuted }}>
          {model.accessibilityLabel}
        </Text>
        <View className="mt-3 gap-2">
          {historyDays.map((day) => (
            <MomentumDayRow key={day.dateKey} model={model} dateKey={day.dateKey} />
          ))}
        </View>
      </Card>

      {model.milestones.length > 0 ? (
        <Card accentColor={tokens.accent} innerClassName="p-3">
          <Text className="text-sm font-semibold" style={{ color: tokens.text }}>
            Milestones from real progress
          </Text>
          <View className="mt-2 gap-1.5">
            {model.milestones.map((milestone) => (
              <Text key={milestone.id} className="text-sm" style={{ color: tokens.text }}>
                • {milestone.label} · {milestone.dateKey}
              </Text>
            ))}
          </View>
        </Card>
      ) : null}
    </View>
  );
}
