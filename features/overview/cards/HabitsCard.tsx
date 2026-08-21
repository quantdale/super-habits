import { Text, View } from 'react-native';

import { useAppTheme } from '@/core/providers/themeContext';

import type { HabitsSummary } from '../overview.domain';
import { OVERVIEW_CARD_META } from '../overviewCards';
import { CardEmptyMessage, DashboardCard } from './DashboardCard';

/** Small circular progress ring drawn with a bordered circle + fraction label. */
function HabitRing({
  name,
  color,
  count,
  target,
}: {
  name: string;
  color: string;
  count: number;
  target: number;
}) {
  const { tokens } = useAppTheme();
  const done = count >= target && target > 0;

  return (
    <View className="items-center" style={{ width: 56 }}>
      <View
        className="h-12 w-12 items-center justify-center rounded-full"
        style={{
          borderWidth: 3,
          borderColor: color,
          backgroundColor: done ? `${color}26` : 'transparent',
        }}
      >
        <Text className="text-xs font-bold tabular-nums" style={{ color: tokens.text }}>
          {count}/{target}
        </Text>
      </View>
      <Text
        className="mt-1 text-center text-[10px]"
        style={{ color: tokens.textMuted }}
        numberOfLines={1}
      >
        {name}
      </Text>
    </View>
  );
}

export function HabitsCard({ summary, loading }: { summary: HabitsSummary; loading: boolean }) {
  const { tokens } = useAppTheme();

  return (
    <DashboardCard
      meta={OVERVIEW_CARD_META.habits}
      loading={loading}
      empty={
        summary.scheduledToday === 0 ? (
          <CardEmptyMessage title="Rest day" description="No habits scheduled today." />
        ) : undefined
      }
    >
      <View className="gap-3">
        <Text className="text-sm font-semibold tabular-nums" style={{ color: tokens.text }}>
          {summary.completedToday} of {summary.scheduledToday} complete
        </Text>
        <View className="flex-row flex-wrap gap-3">
          {summary.rings.map((ring) => (
            <HabitRing
              key={ring.id}
              name={ring.name}
              color={ring.color || OVERVIEW_CARD_META.habits.accentColor}
              count={ring.count}
              target={ring.target}
            />
          ))}
        </View>
      </View>
    </DashboardCard>
  );
}
