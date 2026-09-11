import { Text } from '@/core/ui/Text';
import { View } from 'react-native';
import { Button } from '@/core/ui/Button';
import { Card } from '@/core/ui/Card';
import { PillChip } from '@/core/ui/PillChip';
import type { TodoPriority } from './types';

/**
 * Action bar shown while a bulk multi-select is active. Floated in a tinted
 * Pop card with pill chips and chunky buttons so the batch actions read as one
 * tactile surface.
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
  const disabled = selectedCount === 0;

  return (
    <Card accentColor={accentColor} className="mb-0" innerClassName="p-4">
      <View accessibilityLabel={`Bulk actions for ${selectedCount} selected tasks`}>
        <View className="mb-3 flex-row items-center justify-between gap-2">
          <Text variant="titleMd">{selectedCount} selected</Text>
          <PillChip
            label="Cancel"
            accessibilityLabel="Exit selection mode"
            active={false}
            color={accentColor}
            onPress={onExit}
          />
        </View>
        <View className="flex-row flex-wrap gap-2">
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
          <View className="mt-1 flex-row flex-wrap gap-2">
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
        <View className="mt-3 flex-row gap-2">
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
    </Card>
  );
}
