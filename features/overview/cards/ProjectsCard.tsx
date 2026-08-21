import { Text, View } from 'react-native';

import { useAppTheme } from '@/core/providers/themeContext';

import type { ProjectsSummary } from '../overview.domain';
import { OVERVIEW_CARD_META } from '../overviewCards';
import { CardEmptyMessage, DashboardCard } from './DashboardCard';

export function ProjectsCard({ summary, loading }: { summary: ProjectsSummary; loading: boolean }) {
  const { tokens } = useAppTheme();

  return (
    <DashboardCard
      meta={OVERVIEW_CARD_META.projects}
      loading={loading}
      empty={
        summary.activeCount === 0 ? (
          <CardEmptyMessage
            title="No active projects"
            description="Create a project in the planning hub."
          />
        ) : undefined
      }
    >
      <View className="gap-2">
        <Text className="text-lg font-semibold tabular-nums" style={{ color: tokens.text }}>
          {summary.activeCount} active
        </Text>
        {summary.preview.map((project) => (
          <View key={project.id} className="flex-row items-center gap-2.5">
            <View className="h-3 w-3 rounded-full" style={{ backgroundColor: project.color }} />
            <Text className="flex-1 text-sm" style={{ color: tokens.text }} numberOfLines={1}>
              {project.name}
            </Text>
          </View>
        ))}
        {summary.activeCount > summary.preview.length ? (
          <Text className="text-xs" style={{ color: tokens.textMuted }}>
            +{summary.activeCount - summary.preview.length} more
          </Text>
        ) : null}
      </View>
    </DashboardCard>
  );
}
