import { MaterialIcons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';
import { TextField } from '@/core/ui/TextField';
import { PillChip } from '@/core/ui/PillChip';
import { useAppTheme } from '@/core/providers/themeContext';
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
  accentColor: string;
};

/**
 * Search + filter + sort toolbar for the todo list. Purely presentational:
 * all query logic lives in todos.domain.ts (applyTodoListQuery).
 */
export function TodoListToolbar({
  search,
  onSearchChange,
  filters,
  onFiltersChange,
  sort,
  onSortChange,
  accentColor,
}: Props) {
  const { tokens } = useAppTheme();
  const hasActiveQuery =
    search.trim().length > 0 ||
    (filters.priority && filters.priority !== 'all') === true ||
    (filters.dueWindow && filters.dueWindow !== 'all') === true ||
    filters.projectId !== undefined ||
    filters.goalId !== undefined ||
    sort !== 'manual';

  return (
    <View className="mb-3">
      <TextField
        label=""
        value={search}
        onChangeText={onSearchChange}
        placeholder="Search tasks..."
      />
      <View className="mt-2 flex-row flex-wrap gap-2">
        {SORT_OPTIONS.map((option) => (
          <PillChip
            key={`sort-${option.value}`}
            label={`⇅ ${option.label}`}
            active={sort === option.value}
            color={accentColor}
            onPress={() => onSortChange(option.value)}
          />
        ))}
      </View>
      <View className="mt-2 flex-row flex-wrap gap-2">
        {DUE_WINDOW_OPTIONS.map((option) => (
          <PillChip
            key={`due-${option.value}`}
            label={option.label}
            active={(filters.dueWindow ?? 'all') === option.value}
            color={accentColor}
            onPress={() => onFiltersChange({ ...filters, dueWindow: option.value })}
          />
        ))}
      </View>
      <View className="mt-2 flex-row flex-wrap gap-2">
        {PRIORITY_OPTIONS.map((option) => (
          <PillChip
            key={`prio-${option.value}`}
            label={option.label}
            active={(filters.priority ?? 'all') === option.value}
            color={accentColor}
            onPress={() => onFiltersChange({ ...filters, priority: option.value })}
          />
        ))}
        {hasActiveQuery ? (
          <Pressable
            onPress={() => {
              onSearchChange('');
              onFiltersChange({ priority: 'all', dueWindow: 'all' });
              onSortChange('manual');
            }}
            accessibilityRole="button"
            accessibilityLabel="Clear search, filters, and sorting"
            className="flex-row items-center gap-1 rounded-full px-3 py-1.5"
            style={{ backgroundColor: tokens.surfaceElevated }}
          >
            <MaterialIcons name="clear" size={14} color={tokens.textMuted} />
            <Text className="text-xs font-semibold" style={{ color: tokens.textMuted }}>
              Reset
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
