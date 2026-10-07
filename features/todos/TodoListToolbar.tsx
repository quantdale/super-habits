import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Text } from '@/core/ui/Text';
import { Modal } from '@/core/ui/Modal';
import { Button } from '@/core/ui/Button';
import { PillChip } from '@/core/ui/PillChip';
import { useAppTheme } from '@/core/providers/themeContext';
import { radius, size, spacing } from '@/core/theme/designTokens';
import type { TodoDueWindow, TodoSortMode, TodoListFilters } from './todos.domain';
import type { TodoPriority } from './types';

const DUE_WINDOW_OPTIONS: { value: TodoDueWindow; label: string }[] = [
  { value: 'all', label: 'Any due' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This week' },
  { value: 'later', label: 'Later' },
  { value: 'no_due', label: 'No date' },
];

const PRIORITY_OPTIONS: { value: TodoPriority | 'all'; label: string }[] = [
  { value: 'all', label: 'Any priority' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'normal', label: 'Normal' },
  { value: 'low', label: 'Low' },
];

const SORT_OPTIONS: { value: TodoSortMode; label: string }[] = [
  { value: 'manual', label: 'Manual' },
  { value: 'due_date', label: 'Due date' },
  { value: 'priority', label: 'Priority' },
  { value: 'created', label: 'Newest' },
];

type Props = {
  search: string;
  onSearchChange: (value: string) => void;
  filters: TodoListFilters;
  onFiltersChange: (filters: TodoListFilters) => void;
  sort: TodoSortMode;
  onSortChange: (sort: TodoSortMode) => void;
};

/**
 * Flat search + filter/sort access for the To Do list (campaign SUR-03): one
 * unframed search well and an adjacent filter/sort button — no card-in-card
 * chrome. Frequent retrieval stays one tap away (type to search); infrequent
 * sort/due/priority controls live in a compact bottom sheet instead of
 * permanent chip rows. Purely presentational: all query logic lives in
 * todos.domain.ts (applyTodoListQuery).
 */
export function TodoListToolbar({
  search,
  onSearchChange,
  filters,
  onFiltersChange,
  sort,
  onSortChange,
}: Props) {
  const { tokens } = useAppTheme();
  const [sheetOpen, setSheetOpen] = useState(false);
  const activeFilterCount =
    ((filters.priority ?? 'all') !== 'all' ? 1 : 0) +
    ((filters.dueWindow ?? 'all') !== 'all' ? 1 : 0) +
    (filters.projectId !== undefined ? 1 : 0) +
    (filters.goalId !== undefined ? 1 : 0) +
    (sort !== 'manual' ? 1 : 0);

  return (
    <View className="mb-2 flex-row items-center" style={{ gap: spacing.sm }}>
      <View
        className="min-w-0 flex-1 flex-row items-center"
        style={{
          minHeight: size.touchTargetMin,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: tokens.border,
          backgroundColor: tokens.surfaceSunken,
          paddingHorizontal: spacing.md,
          gap: spacing.sm,
        }}
      >
        <MaterialIcons name="search" size={18} color={tokens.iconMuted} />
        <TextInput
          accessibilityLabel="Search tasks"
          className="min-w-0 flex-1 text-base"
          style={{ color: tokens.text, paddingVertical: spacing.sm }}
          value={search}
          onChangeText={onSearchChange}
          placeholder="Search tasks"
          placeholderTextColor={tokens.textMuted}
          returnKeyType="search"
        />
        {search.length > 0 ? (
          <Pressable
            onPress={() => onSearchChange('')}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
            hitSlop={8}
          >
            <MaterialIcons name="close" size={18} color={tokens.iconMuted} />
          </Pressable>
        ) : null}
      </View>
      <Pressable
        onPress={() => setSheetOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={
          activeFilterCount > 0 ? `Filter and sort, ${activeFilterCount} active` : 'Filter and sort'
        }
        accessibilityState={{ selected: activeFilterCount > 0 }}
        className="items-center justify-center"
        style={{
          width: size.touchTargetMin,
          height: size.touchTargetMin,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: activeFilterCount > 0 ? tokens.accent : tokens.border,
          backgroundColor: tokens.surface,
        }}
      >
        <MaterialIcons
          name="tune"
          size={20}
          color={activeFilterCount > 0 ? tokens.accent : tokens.iconMuted}
        />
      </Pressable>

      <Modal
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Filter & sort"
        modalLayout="bottom-sheet"
      >
        <Text variant="label" tone="muted" className="mb-1">
          Sort
        </Text>
        <View className="mb-2 flex-row flex-wrap">
          {SORT_OPTIONS.map((option) => (
            <PillChip
              key={`sort-${option.value}`}
              label={option.label}
              active={sort === option.value}
              color={tokens.accent}
              onPress={() => onSortChange(option.value)}
            />
          ))}
        </View>
        <Text variant="label" tone="muted" className="mb-1">
          Due
        </Text>
        <View className="mb-2 flex-row flex-wrap">
          {DUE_WINDOW_OPTIONS.map((option) => (
            <PillChip
              key={`due-${option.value}`}
              label={option.label}
              active={(filters.dueWindow ?? 'all') === option.value}
              color={tokens.accent}
              onPress={() => onFiltersChange({ ...filters, dueWindow: option.value })}
            />
          ))}
        </View>
        <Text variant="label" tone="muted" className="mb-1">
          Priority
        </Text>
        <View className="mb-3 flex-row flex-wrap">
          {PRIORITY_OPTIONS.map((option) => (
            <PillChip
              key={`prio-${option.value}`}
              label={option.label}
              active={(filters.priority ?? 'all') === option.value}
              color={tokens.accent}
              onPress={() => onFiltersChange({ ...filters, priority: option.value })}
            />
          ))}
        </View>
        <Button
          label="Reset filters"
          variant="ghost"
          onPress={() => {
            onSearchChange('');
            onFiltersChange({ priority: 'all', dueWindow: 'all' });
            onSortChange('manual');
            setSheetOpen(false);
          }}
        />
      </Modal>
    </View>
  );
}
