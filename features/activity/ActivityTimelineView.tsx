import { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useAppTheme } from '@/core/providers/themeContext';
import { PillChip } from '@/core/ui/PillChip';
import { EmptyStateCard } from '@/core/ui/EmptyStateCard';
import { SECTION_COLORS } from '@/constants/sectionColors';
import { buildActivityTimeline } from '@/features/activity/activityTimeline.data';
import { filterTimeline, groupTimelineByDay } from '@/features/activity/activityTimeline.domain';
import type {
  ActivityTimelineFilter,
  ActivityTimelineItem,
} from '@/features/activity/activityTimeline.types';

const FILTERS: { key: ActivityTimelineFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'productivity', label: 'Productivity' },
  { key: 'health', label: 'Health' },
  { key: 'planning', label: 'Planning' },
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
  const [filter, setFilter] = useState<ActivityTimelineFilter>('all');
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      setItems(await buildActivityTimeline({ days: 30 }));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = filterTimeline(items, filter);
  const groups = groupTimelineByDay(visible);

  return (
    <View className="gap-3">
      <Text className="text-lg font-bold" style={{ color: tokens.text }}>
        Timeline
      </Text>
      <View className="flex-row flex-wrap">
        {FILTERS.map((f) => (
          <PillChip
            key={f.key}
            label={f.label}
            active={filter === f.key}
            color={SECTION_COLORS.todos}
            onPress={() => setFilter(f.key)}
          />
        ))}
      </View>

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
            <Text className="text-sm font-semibold" style={{ color: tokens.textMuted }}>
              {formatDayLabel(group.dateKey)}
            </Text>
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
