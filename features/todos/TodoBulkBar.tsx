import { Pressable, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Button } from '@/core/ui/Button';
import { PillChip } from '@/core/ui/PillChip';
import { useAppTheme } from '@/core/providers/themeContext';
import type { TodoPriority } from './types';

type ProjectOption = { id: string; name: string };

type Props = {
  selectedCount: number;
  onComplete: () => void;
  onReopen: () => void;
  onDelete: () => void;
  onPriorityChange: (priority: TodoPriority) => void;
  projects: ProjectOption[];
  onAssignProject: (projectId: string | null) => void;
  onExit: () => void;
  accentColor: string;
};

/** Action bar shown while a bulk multi-select is active. */
export function TodoBulkBar({
  selectedCount,
  onComplete,
  onReopen,
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
            onPress={() => onPriorityChange(priority)}
          />
        ))}
      </View>
      {projects.length > 0 ? (
        <View className="mb-2 flex-row flex-wrap gap-2">
          <PillChip
            label="No project"
            active={false}
            color={accentColor}
            onPress={() => onAssignProject(null)}
          />
          {projects.slice(0, 6).map((project) => (
            <PillChip
              key={project.id}
              label={project.name}
              active={false}
              color={accentColor}
              disabled={disabled}
              onPress={() => onAssignProject(project.id)}
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
            label="Reopen"
            variant="ghost"
            onPress={() => {
              if (!disabled) onReopen();
            }}
            disabled={disabled}
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
