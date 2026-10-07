import { Text } from '@/core/ui/Text';
import { View, Pressable } from 'react-native';
import { Button } from '@/core/ui/Button';
import { PillChip } from '@/core/ui/PillChip';
import { useAppTheme } from '@/core/providers/themeContext';
import { spacing } from '@/core/theme/designTokens';
import type { TodoPriority } from './types';

/**
 * Action bar shown while a bulk multi-select is active (campaign brief §21).
 * A flat bar with hairline top rule — not a card — so bulk mode reads as a
 * distinct chrome state without a nested surface: selected count and Cancel
 * live in the page header, actions stay grouped here, and nothing reserves
 * screen space outside selection mode.
 *
 * There is intentionally no Reopen action: selection rows are built from the
 * pending list only, so completed items can never be selected in this mode
 * (product decision — see TodosScreen's selection view).
 */

type ProjectOption = { id: string; name: string };

type Props = {
  selectedCount: number;
  totalCount: number;
  allSelected: boolean;
  onToggleSelectAll: () => void;
  onComplete: () => void;
  onDelete: () => void;
  onPriorityChange: (priority: TodoPriority) => void;
  projects: ProjectOption[];
  onAssignProject: (projectId: string | null) => void;
  onExit: () => void;
  accentColor: string;
};

export function TodoBulkBar({
  selectedCount,
  totalCount,
  allSelected,
  onToggleSelectAll,
  onComplete,
  onDelete,
  onPriorityChange,
  projects,
  onAssignProject,
  onExit,
  accentColor,
}: Props) {
  const { tokens } = useAppTheme();
  const disabled = selectedCount === 0;

  return (
    <View
      accessibilityLabel={`Bulk actions for ${selectedCount} selected tasks`}
      style={{
        borderTopWidth: 1,
        borderTopColor: tokens.border,
        paddingTop: spacing.md,
        paddingBottom: spacing.sm,
        gap: spacing.sm,
      }}
    >
      <View className="flex-row items-center justify-between gap-2">
        <Pressable
          onPress={onToggleSelectAll}
          accessibilityRole="button"
          accessibilityLabel={allSelected ? 'Deselect all tasks' : 'Select all tasks'}
          hitSlop={6}
        >
          <Text variant="label" style={{ color: accentColor }}>
            {allSelected ? 'Deselect all' : `Select all (${totalCount})`}
          </Text>
        </Pressable>
        <Pressable
          onPress={onExit}
          accessibilityRole="button"
          accessibilityLabel="Exit selection mode"
          hitSlop={6}
        >
          <Text variant="label" tone="muted">
            Cancel
          </Text>
        </Pressable>
      </View>
      <View className="flex-row flex-wrap">
        {(['urgent', 'normal', 'low'] as TodoPriority[]).map((priority) => (
          <PillChip
            key={priority}
            label={priority}
            active={false}
            color={accentColor}
            onPress={() => {
              // Same 0-selected guard as Complete/Delete so a stray tap can't
              // run a no-op batch that silently exits selection mode.
              if (disabled) return;
              onPriorityChange(priority);
            }}
          />
        ))}
        {projects.length > 0 ? (
          <>
            <PillChip
              label="No project"
              active={false}
              color={accentColor}
              onPress={() => {
                if (disabled) return;
                onAssignProject(null);
              }}
            />
            {projects.slice(0, 6).map((project) => (
              <PillChip
                key={project.id}
                label={project.name}
                active={false}
                color={accentColor}
                onPress={() => {
                  if (!disabled) onAssignProject(project.id);
                }}
              />
            ))}
          </>
        ) : null}
      </View>
      <View className="flex-row gap-2">
        <View className="flex-1">
          <Button
            label="Complete"
            onPress={() => {
              if (!disabled) onComplete();
            }}
            disabled={disabled}
            color={accentColor}
          />
        </View>
        <View className="flex-1">
          <Button
            label="Delete"
            variant="ghost"
            onPress={() => {
              if (!disabled) onDelete();
            }}
            disabled={disabled}
          />
        </View>
      </View>
    </View>
  );
}
