import { useCallback, useEffect, useState } from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';
import { useAppTheme } from '@/core/providers/themeContext';
import { IconButton } from '@/core/ui/IconButton';
import { EmptyStateCard } from '@/core/ui/EmptyStateCard';
import { SECTION_COLORS } from '@/constants/sectionColors';
import { listGoals } from '@/features/goals/goals.data';
import { GOAL_HORIZON_LABELS, GOAL_STATUS_LABELS } from '@/features/goals/goals.types';
import type { Goal } from '@/core/db/types';

type GoalListViewProps = {
  onOpenGoal: (id: string | null) => void;
};

export function GoalListView({ onOpenGoal }: GoalListViewProps) {
  const { tokens } = useAppTheme();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      setGoals(await listGoals());
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <View className="gap-3">
      <View className="flex-row items-center justify-between">
        <Text className="text-lg font-bold" style={{ color: tokens.text }}>
          Goals
        </Text>
        <IconButton
          icon="add"
          onPress={() => onOpenGoal(null)}
          accessibilityLabel="Create goal"
          accentColor={SECTION_COLORS.todos}
        />
      </View>

      {!isLoading && goals.length === 0 ? (
        <EmptyStateCard
          accentColor={SECTION_COLORS.todos}
          title="No goals yet"
          description="Set measurable outcomes and track manual progress toward them."
          icon={<Text style={{ fontSize: 18 }}>•</Text>}
        />
      ) : (
        goals.map((goal) => (
          <Pressable
            key={goal.id}
            accessibilityRole="button"
            accessibilityLabel={goal.title}
            className="flex-row items-center gap-3 rounded-2xl border p-3"
            style={{ borderColor: tokens.border, backgroundColor: tokens.surface }}
            onPress={() => onOpenGoal(goal.id)}
          >
            <View
              className="h-10 w-10 items-center justify-center rounded-xl"
              style={{ backgroundColor: `${SECTION_COLORS.todos}22` }}
            >
              <Text style={{ fontSize: 18 }}>•</Text>
            </View>
            <View className="min-w-0 flex-1">
              <Text
                className="text-base font-semibold"
                style={{ color: tokens.text }}
                numberOfLines={1}
              >
                {goal.title}
              </Text>
              <Text className="text-sm" style={{ color: tokens.textMuted }} numberOfLines={1}>
                {GOAL_STATUS_LABELS[goal.status]} · {GOAL_HORIZON_LABELS[goal.horizon]} ·{' '}
                {goal.progress_percent}%
              </Text>
            </View>
            <Text style={{ fontSize: 18 }}>•</Text>
          </Pressable>
        ))
      )}
    </View>
  );
}
