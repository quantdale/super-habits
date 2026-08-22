import { Pressable, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Button } from '@/core/ui/Button';
import { PillChip } from '@/core/ui/PillChip';
import { useAppTheme } from '@/core/providers/themeContext';
import type { TodoPriority } from './types';

/**
 * Action bar shown while a bulk multi-select is active.
 *
 * There is intentionally no Reopen action: selection rows are built from the
 * pending list only, so completed items can never be selected in this mode
 * (product decision — see TodosScreen's selection view).
 */

type ProjectOption = { id: string; name: string };

type Props = {
  selectedCount: number;
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
      className="rounded-2xl border p-3"
      style={{ borderColor: tokens.border, backgroundColor: tokens.surface }}
      accessibilityLabel={`Bulk actions for ${selectedCount} selected tasks`}
    >
      <View className="mb-2 flex-row items-center justify-between gap-2">
        <Text className="text-sm font-semibold" style={{ color: tokens.text }}>
          {selectedCount} selected
        </Text>
        <Pressable
          onPress={onExit}
          accessibilityRole="button"
          accessibilityLabel="Exit selection mode"
          className="flex-row items-center gap-1 rounded-full px-3 py-1.5"
          style={{ backgroundColor: tokens.surfaceElevated }}
        >
          <MaterialIcons name="close" size={14} color={tokens.textMuted} />
          <Text className="text-xs font-semibold" style={{ color: tokens.textMuted }}>
            Cancel
          </Text>
        </Pressable>
      </View>
      <View className="mb-2 flex-row flex-wrap gap-2">
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
      </View>
      {projects.length > 0 ? (
        <View className="mb-2 flex-row flex-wrap gap-2">
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
        </View>
      ) : null}
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
