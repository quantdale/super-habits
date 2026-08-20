import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useAppTheme } from '@/core/providers/themeContext';
import { PillChip } from '@/core/ui/PillChip';
import { EmptyStateCard } from '@/core/ui/EmptyStateCard';
import { SECTION_COLORS } from '@/constants/sectionColors';
import { toDateKey } from '@/lib/time';
import { buildActivityTimeline } from '@/features/activity/activityTimeline.data';
import {
  filterTimelineByDay,
  filterTimelineByRange,
  filterTimelineBySources,
  getTimelineDayKeys,
  groupTimelineByDay,
} from '@/features/activity/activityTimeline.domain';
import type {
  ActivityTimelineItem,
  ActivityTimelineRangeFilter,
  ActivityTimelineSourceFilter,
} from '@/features/activity/activityTimeline.types';

const SOURCE_FILTERS: { key: ActivityTimelineSourceFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'todos', label: 'Todos' },
  { key: 'habits', label: 'Habits' },
  { key: 'focus', label: 'Focus' },
  { key: 'workout', label: 'Workout' },
  { key: 'calories', label: 'Calories' },
  { key: 'planning', label: 'Planning' },
];

const RANGE_FILTERS: { key: ActivityTimelineRangeFilter; label: string }[] = [
  { key: '7', label: '7d' },
  { key: '30', label: '30d' },
  { key: '90', label: '90d' },
  { key: 'all', label: 'All' },
];

const CATEGORY_COLOR: Record<string, string> = {
  productivity: SECTION_COLORS.todos,
  health: SECTION_COLORS.habits,
  planning: SECTION_COLORS.focus,
};

function formatDayLabel(dateKey: string): string {
  if (dateKey === 'unknown') return 'Earlier';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(`${dateKey}T00:00:00`);
  const diffDays = Math.round((today.getTime() - d.getTime()) / (24 * 60 * 60 * 1000));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return dateKey;
}

export function ActivityTimelineView() {
  const { tokens } = useAppTheme();
  const [items, setItems] = useState<ActivityTimelineItem[]>([]);
  const [sourceFilter, setSourceFilter] = useState<ActivityTimelineSourceFilter>('all');
  const [rangeFilter, setRangeFilter] = useState<ActivityTimelineRangeFilter>('30');
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      // Widest bounded window; narrower ranges are pure domain filtering.
      setItems(await buildActivityTimeline({ days: 90 }));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const todayKey = toDateKey();

  const ranged = useMemo(
    () => filterTimelineByRange(items, rangeFilter, todayKey),
    [items, rangeFilter, todayKey],
  );
  const typed = useMemo(
    () => filterTimelineBySources(ranged, sourceFilter),
    [ranged, sourceFilter],
  );
  const dayKeys = useMemo(() => getTimelineDayKeys(typed), [typed]);
  const visible = useMemo(() => filterTimelineByDay(typed, selectedDay), [typed, selectedDay]);
  const groups = groupTimelineByDay(visible);

  return (
    <View className="gap-3">
      <Text className="text-lg font-bold" style={{ color: tokens.text }}>
        Timeline
      </Text>

      <View className="flex-row flex-wrap">
        {SOURCE_FILTERS.map((f) => (
          <PillChip
            key={f.key}
            label={f.label}
            active={sourceFilter === f.key}
            color={SECTION_COLORS.todos}
            onPress={() => setSourceFilter(f.key)}
          />
        ))}
      </View>

      <View className="flex-row flex-wrap">
        {RANGE_FILTERS.map((f) => (
          <PillChip
            key={f.key}
            label={f.label}
            active={rangeFilter === f.key}
            color={SECTION_COLORS.focus}
            onPress={() => setRangeFilter(f.key)}
          />
        ))}
      </View>

      {dayKeys.length > 0 ? (
        <View className="flex-row flex-wrap">
          <PillChip
            label="All days"
            active={selectedDay === null}
            color={SECTION_COLORS.habits}
            onPress={() => setSelectedDay(null)}
          />
          {dayKeys.slice(0, 14).map((key) => (
            <PillChip
              key={key}
              label={formatDayLabel(key)}
              active={selectedDay === key}
              color={SECTION_COLORS.habits}
              onPress={() => setSelectedDay(selectedDay === key ? null : key)}
            />
          ))}
        </View>
      ) : null}

      {!isLoading && groups.length === 0 ? (
        <EmptyStateCard
          accentColor={SECTION_COLORS.todos}
          title="Nothing to show yet"
          description="Your completed tasks, habits, focus sessions, workouts, and plans will appear here."
          icon={<Text style={{ fontSize: 18 }}>•</Text>}
        />
      ) : (
        groups.map((group) => (
          <View key={group.dateKey} className="gap-2">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Jump to ${formatDayLabel(group.dateKey)}`}
              onPress={() => setSelectedDay(selectedDay === group.dateKey ? null : group.dateKey)}
            >
              <Text className="text-sm font-semibold" style={{ color: tokens.textMuted }}>
                {formatDayLabel(group.dateKey)}
              </Text>
            </Pressable>
            {group.items.map((item) => (
              <View
                key={item.id}
                className="flex-row items-center gap-3 rounded-2xl border p-3"
                style={{ borderColor: tokens.border, backgroundColor: tokens.surface }}
              >
                <View
                  className="h-9 w-9 items-center justify-center rounded-xl"
                  style={{ backgroundColor: `${CATEGORY_COLOR[item.category]}22` }}
                >
                  <Text style={{ fontSize: 18 }}>•</Text>
                </View>
                <View className="min-w-0 flex-1">
                  <Text
                    className="text-sm font-medium"
                    style={{ color: tokens.text }}
                    numberOfLines={1}
                  >
                    {item.title}
                  </Text>
                  {item.subtitle ? (
                    <Text className="text-xs" style={{ color: tokens.textMuted }} numberOfLines={1}>
                      {item.subtitle}
                    </Text>
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        ))
      )}
    </View>
  );
}
