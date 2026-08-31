import { useCallback, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import DraggableFlatList, {
  type RenderItemParams,
  ScaleDecorator,
} from 'react-native-draggable-flatlist';
import { Screen } from '@/core/ui/Screen';
import { Modal } from '@/core/ui/Modal';
import { Card } from '@/core/ui/Card';
import { LinkedActionsEditorSection } from '@/core/linked-actions/LinkedActionsEditorSection';
import { buildLinkedActionEditorRowsFromRules } from '@/core/linked-actions/linkedActionsEditor.adapter';
import { TODO_LINKED_ACTIONS_EDITOR_CONFIG } from '@/core/linked-actions/linkedActionsEditor.config';
import { createSaveLinkedActionRuleInputFromEditorRow } from '@/core/linked-actions/linkedActionsEditor.model';
import { createLinkedActionsNotice } from '@/core/linked-actions/linkedActionsNotice';
import type {
  LinkedActionEditorRowDraft,
  LinkedActionEditorSourceOption,
} from '@/core/linked-actions/linkedActionsEditor.types';
import type { SaveLinkedActionRuleForSourceInput } from '@/core/linked-actions/linkedActions.types';
import { EmptyStateCard } from '@/core/ui/EmptyStateCard';
import { IconButton } from '@/core/ui/IconButton';
import { PageHeader } from '@/core/ui/PageHeader';
import { ScreenSection } from '@/core/ui/ScreenSection';
import { TextField } from '@/core/ui/TextField';
import { Button } from '@/core/ui/Button';
import { PillChip } from '@/core/ui/PillChip';
import { useConfirmationDialog } from '@/core/ui/useConfirmationDialog';
import { useAppTheme } from '@/core/providers/themeContext';
import { useMotionDuration, useReducedMotion } from '@/core/theme/motion';
import { useDayRolloverGeneration } from '@/core/providers/dayRolloverContext';
import { SECTION_COLORS } from '@/constants/sectionColors';
import { toDateKey } from '@/lib/time';
import { useActiveForegroundRefresh } from '@/lib/useForegroundRefresh';
import { useGuardedAsyncRefresh } from '@/lib/useGuardedAsyncRefresh';
import { validateTodo } from '@/lib/validation';
import { ValidationError } from '@/core/ui/ValidationError';
import { useInAppNotices } from '@/core/providers/inAppNoticeContext';
import type { Todo, TodoPriority, TodoViewMode } from './types';
import { TodoItem } from './TodoItem';
import { TodoQuickCapture } from './TodoQuickCapture';
import { TodoListToolbar } from './TodoListToolbar';
import { TodoBulkBar } from './TodoBulkBar';
import {
  applyTodoListQuery,
  createSubmitGuard,
  findMissingRecurrenceIds,
  getTodayDateKey,
  groupTodosByDueWindow,
  type TodoListFilters,
  type TodoSortMode,
} from './todos.domain';
import {
  addTodo,
  bulkAssignTodosProject,
  bulkRemoveTodos,
  bulkSetTodoCompletion,
  bulkUpdateTodoPriority,
  createRecurringInstances,
  getRecurringTodosByIds,
  listTodoLinkedActionRules,
  listAllActiveTodosForRecurrence,
  listTodos,
  removeTodo,
  saveTodoLinkedActionRules,
  toggleTodo,
  updateTodo,
  updateTodoOrder,
} from '@/features/todos/todos.data';
import type { BulkTodoOutcome } from '@/features/todos/todos.data';
import { listProjects } from '@/features/projects/projects.data';
import { listGoals } from '@/features/goals/goals.data';

const COLOR = SECTION_COLORS.todos;
const TODO_LINKED_ACTION_SOURCE_KEY = 'todo-linked-actions-source';
const VIEW_MODE_OPTIONS: readonly {
  mode: TodoViewMode;
  icon: keyof typeof MaterialIcons.glyphMap;
}[] = [
  { mode: 'content', icon: 'view-agenda' },
  { mode: 'list', icon: 'format-list-bulleted' },
  { mode: 'grid', icon: 'grid-view' },
];

export function TodosScreen({ isActive }: { isActive: boolean }) {
  const { tokens, sectionAccents } = useAppTheme();
  const dayGeneration = useDayRolloverGeneration();
  const { begin: beginRefresh } = useGuardedAsyncRefresh();
  const colorText = sectionAccents.todos.text;
  const { showNotice } = useInAppNotices();
  const { confirm, confirmationDialog } = useConfirmationDialog();
  const reducedMotion = useReducedMotion();
  const settleDuration = useMotionDuration('feedback');
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [priority, setPriority] = useState<TodoPriority>('normal');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isRecurring, setIsRecurring] = useState(false);
  const [items, setItems] = useState<Todo[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [todoError, setTodoError] = useState<string | null>(null);
  const [linkedActionRows, setLinkedActionRows] = useState<LinkedActionEditorRowDraft[]>([]);
  const [linkedActionsError, setLinkedActionsError] = useState<string | null>(null);
  const [linkedActionsLoading, setLinkedActionsLoading] = useState(false);
  const [viewMode, setViewMode] = useState<TodoViewMode>('content');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<TodoListFilters>({ priority: 'all', dueWindow: 'all' });
  const [sortMode, setSortMode] = useState<TodoSortMode>('manual');
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [settlingIds, setSettlingIds] = useState<string[]>([]);
  const [projectOptions, setProjectOptions] = useState<{ id: string; name: string }[]>([]);
  const [goalOptions, setGoalOptions] = useState<{ id: string; title: string }[]>([]);
  const [editProjectId, setEditProjectId] = useState<string | null>(null);
  const [editGoalId, setEditGoalId] = useState<string | null>(null);
  const { width: screenWidth } = useWindowDimensions();
  const submitGuardRef = useRef(createSubmitGuard());
  const lastRecurrenceExpansionDateKeyRef = useRef<string | null>(null);
  // Bumped whenever the edit form resets/changes target so a slow linked-action
  // load for a previous edit can never land after resetForm().
  const editLoadSeqRef = useRef(0);
  const gridColumns = screenWidth >= 1200 ? 4 : screenWidth >= 768 ? 3 : 2;
  const gridCardWidth = (screenWidth - 32 - 4 * (gridColumns * 2)) / gridColumns;

  const setItemsIfChanged = useCallback((nextItems: Todo[]) => {
    setItems((currentItems) => {
      if (
        currentItems.length === nextItems.length &&
        currentItems.every((current, index) => {
          const next = nextItems[index];
          return (
            current.id === next.id &&
            current.updated_at === next.updated_at &&
            current.completed === next.completed &&
            current.sort_order === next.sort_order &&
            current.due_date === next.due_date &&
            current.deleted_at === next.deleted_at
          );
        })
      ) {
        return currentItems;
      }
      return nextItems;
    });
  }, []);

  // Just-completed rows stay listed for the settle-animation window before the
  // refresh-derived filter drops them from the pending list.
  const pendingTasks = useMemo(
    () => [
      ...items.filter((t) => t.completed === 0),
      ...items.filter((t) => t.completed === 1 && settlingIds.includes(t.id)),
    ],
    [items, settlingIds],
  );
  const todayKey = getTodayDateKey();
  // Boolean logic must not compare a string to a boolean (`(x && y) === true`
  // is always false when x is a string), or priority/due-window-only views
  // silently fall into the default branch — losing group headers/empty state
  // and enabling drag-reorder on a filtered subset.
  const queryActive =
    search.trim().length > 0 ||
    (filters.priority !== undefined && filters.priority !== 'all') ||
    (filters.dueWindow !== undefined && filters.dueWindow !== 'all') ||
    filters.projectId !== undefined ||
    filters.goalId !== undefined ||
    sortMode !== 'manual';
  const visiblePending = useMemo(
    () => applyTodoListQuery(pendingTasks, { search, ...filters, sort: sortMode, todayKey }),
    [pendingTasks, search, filters, sortMode, todayKey],
  );
  const dueGroups = useMemo(
    () => groupTodosByDueWindow(visiblePending, todayKey),
    [visiblePending, todayKey],
  );
  const completedTasks = useMemo(() => items.filter((t) => t.completed === 1), [items]);
  const hasCompleted = useMemo(() => completedTasks.length > 0, [completedTasks]);
  const recurringTasksCount = useMemo(
    () => pendingTasks.filter((todo) => todo.recurrence === 'daily').length,
    [pendingTasks],
  );
  const editingTodo = useMemo(
    () => (editingId ? (items.find((item) => item.id === editingId) ?? null) : null),
    [editingId, items],
  );
  const isRecurringLinkedActionSource =
    editingTodo?.recurrence === 'daily' || (!editingId && isRecurring);
  const overdueTasksCount = useMemo(() => {
    const today = toDateKey();
    return pendingTasks.filter((todo) => todo.due_date && todo.due_date < today).length;
  }, [pendingTasks]);

  const refresh = useCallback(() => listTodos().then(setItemsIfChanged), [setItemsIfChanged]);

  const loadTodosOnFocus = useCallback(async () => {
    const isCurrent = beginRefresh();
    const todayKey = getTodayDateKey();
    if (lastRecurrenceExpansionDateKeyRef.current !== todayKey) {
      const allTodos = await listAllActiveTodosForRecurrence();
      const missingIds = findMissingRecurrenceIds(allTodos, todayKey);

      if (missingIds.length > 0) {
        const templates = await getRecurringTodosByIds(missingIds);
        await createRecurringInstances(
          templates.flatMap((template) => {
            const recurrenceId = template.recurrence_id;
            if (!recurrenceId) return [];
            return [
              {
                title: template.title,
                notes: template.notes,
                priority: template.priority,
                recurrenceId,
                dueDate: todayKey,
              },
            ];
          }),
        );
      }
      // Same-day focus/foreground events still refresh the list, but do not
      // repeat the full recurrence snapshot scan for this mounted screen.
      lastRecurrenceExpansionDateKeyRef.current = todayKey;
    }
    const list = await listTodos();
    if (!isCurrent()) return;
    setItemsIfChanged(list);
  }, [beginRefresh, setItemsIfChanged]);

  useActiveForegroundRefresh(isActive, loadTodosOnFocus, dayGeneration);

  const resetForm = () => {
    // Invalidate any in-flight linked-action load for a previous edit target
    // so its setLinkedActionRows/setLinkedActionsError can never land after
    // this reset (cancel-mid-load race).
    editLoadSeqRef.current += 1;
    setTitle('');
    setNotes('');
    setDueDate(null);
    setPriority('normal');
    setIsRecurring(false);
    setEditingId(null);
    setEditProjectId(null);
    setEditGoalId(null);
    setShowDatePicker(false);
    setTodoError(null);
    setLinkedActionRows([]);
    setLinkedActionsError(null);
    setLinkedActionsLoading(false);
  };

  const closeModal = () => {
    if (isSubmitting) return;
    setModalVisible(false);
    resetForm();
  };

  const openNewTodoModal = () => {
    resetForm();
    void loadAssociationOptions();
    setModalVisible(true);
  };

  const onSave = async () => {
    if (!submitGuardRef.current.tryStart()) return;
    setIsSubmitting(true);

    try {
      const err = validateTodo(title, notes, dueDate);
      if (err) {
        setTodoError(err);
        return;
      }
      setTodoError(null);
      setLinkedActionsError(null);

      let linkedActionRules: SaveLinkedActionRuleForSourceInput[] = [];
      if (!isRecurringLinkedActionSource) {
        try {
          linkedActionRules = linkedActionRows.map(createSaveLinkedActionRuleInputFromEditorRow);
        } catch (error) {
          setLinkedActionsError(
            error instanceof Error
              ? error.message
              : 'Finish or remove incomplete linked actions before saving this task.',
          );
          return;
        }
      }

      if (editingId) {
        await updateTodo(editingId, {
          title: title.trim(),
          notes: notes.trim() || undefined,
          dueDate: dueDate ?? null,
          priority,
          projectId: editProjectId,
          goalId: editGoalId,
        });
        if (!isRecurringLinkedActionSource) {
          await saveTodoLinkedActionRules(editingId, linkedActionRules);
        }
      } else {
        const todoId = await addTodo({
          title: title.trim(),
          notes: notes.trim() || undefined,
          dueDate: dueDate ?? null,
          priority,
          recurrence: isRecurring ? 'daily' : null,
        });
        if (!isRecurringLinkedActionSource) {
          await saveTodoLinkedActionRules(todoId, linkedActionRules);
        }
      }
      setModalVisible(false);
      resetForm();
      void refresh();
    } finally {
      submitGuardRef.current.finish();
      setIsSubmitting(false);
    }
  };

  const loadAssociationOptions = useCallback(async () => {
    try {
      const [projects, goals] = await Promise.all([listProjects(), listGoals()]);
      setProjectOptions(projects.map((p) => ({ id: p.id, name: p.name })));
      setGoalOptions(goals.map((g) => ({ id: g.id, title: g.title })));
    } catch {
      setProjectOptions([]);
      setGoalOptions([]);
    }
  }, []);

  const startEdit = useCallback(
    async (todo: Todo) => {
      setEditingId(todo.id);
      setTitle(todo.title);
      setNotes(todo.notes ?? '');
      setDueDate(todo.due_date);
      setPriority(todo.priority);
      setEditProjectId(todo.project_id);
      setEditGoalId(todo.goal_id);
      void loadAssociationOptions();
      setTodoError(null);
      setLinkedActionsError(null);
      setLinkedActionRows([]);
      setLinkedActionsLoading(todo.recurrence !== 'daily');
      setModalVisible(true);

      if (todo.recurrence === 'daily') {
        setLinkedActionsLoading(false);
        return;
      }

      editLoadSeqRef.current += 1;
      const loadSeq = editLoadSeqRef.current;
      try {
        const rules = await listTodoLinkedActionRules(todo.id);
        const rows = await buildLinkedActionEditorRowsFromRules(rules);
        // The form was reset or retargeted while loading; drop the stale result.
        if (editLoadSeqRef.current !== loadSeq) return;
        setLinkedActionRows(rows);
      } catch (error) {
        if (editLoadSeqRef.current !== loadSeq) return;
        setLinkedActionsError(
          error instanceof Error ? error.message : 'Could not load linked actions for this task.',
        );
      } finally {
        if (editLoadSeqRef.current === loadSeq) {
          setLinkedActionsLoading(false);
        }
      }
    },
    [loadAssociationOptions],
  );

  const handleToggleTodo = useCallback(
    async (todo: Todo) => {
      const result = await toggleTodo(todo);
      for (const notice of result.linkedActions.notices) {
        showNotice(notice);
      }
      if (todo.completed === 0 && !reducedMotion) {
        // Hold the just-completed row in the list while the settle animation
        // plays, then let the normal refresh remove it.
        setSettlingIds((prev) => (prev.includes(todo.id) ? prev : [...prev, todo.id]));
        try {
          await refresh();
          await new Promise((resolve) => setTimeout(resolve, settleDuration));
        } catch {
          // A failed refresh surfaces on the next focus refresh; completion
          // itself already succeeded above.
        } finally {
          setSettlingIds((prev) => prev.filter((id) => id !== todo.id));
        }
        return;
      }
      void refresh();
    },
    [refresh, reducedMotion, settleDuration, showNotice],
  );

  const requestDeleteTodo = useCallback(
    async (todo: Todo) => {
      const confirmed = await confirm({
        title: 'Delete task',
        message: `Delete "${todo.title}"?`,
        confirmLabel: 'Delete',
        confirmVariant: 'danger',
      });
      if (!confirmed) return;
      await removeTodo(todo.id);
      void refresh();
    },
    [confirm, refresh],
  );

  const handleQuickAdd = useCallback(
    async (quickTitle: string) => {
      await addTodo({ title: quickTitle });
      void refresh();
    },
    [refresh],
  );

  const todoKeyExtractor = useCallback((item: Todo) => item.id, []);

  const toggleSelected = useCallback((id: string) => {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  }, []);

  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false);
    setSelectedIds([]);
  }, []);

  /** Past-tense verb so the partial-outcome notice reads naturally per action. */
  type BulkActionVerb = 'Completed' | 'Deleted' | 'Updated';

  const runBulkAction = useCallback(
    async (action: () => Promise<BulkTodoOutcome>, appliedVerb: BulkActionVerb) => {
      try {
        const outcome = await action();
        // Surface partial applications (same spirit as CaloriesScreen's
        // CopyDayResult handling): skipped rows were missing/tombstoned or
        // already in the desired state, and staying silent would make a
        // partially-applied batch look fully successful.
        if (outcome.skipped > 0) {
          const total = outcome.changed + outcome.skipped;
          showNotice(
            createLinkedActionsNotice({
              message: `${appliedVerb} ${outcome.changed} of ${total} selected ${
                total === 1 ? 'task' : 'tasks'
              }; ${outcome.skipped} skipped.`,
              reason: 'bulk_action_partial',
              source: { feature: 'todos', entityType: 'todo' },
              target: { feature: 'todos', entityType: 'todo' },
            }),
          );
        }
      } catch (error) {
        // A failed bulk edit must never strand the screen in selection mode
        // with stale rows or escape as an unhandled rejection.
        showNotice(
          createLinkedActionsNotice({
            message:
              error instanceof Error ? error.message : 'Bulk action failed. Please try again.',
            reason: 'bulk_action_failed',
            source: { feature: 'todos', entityType: 'todo' },
            target: { feature: 'todos', entityType: 'todo' },
          }),
        );
      } finally {
        exitSelectionMode();
        void refresh();
      }
    },
    [exitSelectionMode, refresh, showNotice],
  );

  const handleBulkComplete = useCallback(
    () => runBulkAction(() => bulkSetTodoCompletion(selectedIds, 1), 'Completed'),
    [runBulkAction, selectedIds],
  );
  const handleBulkDelete = useCallback(async () => {
    // Bulk delete gets the same guardrail as single-row swipe delete.
    const confirmed = await confirm({
      title: 'Delete tasks',
      message: `Delete ${selectedIds.length} selected ${
        selectedIds.length === 1 ? 'task' : 'tasks'
      }?`,
      confirmLabel: 'Delete',
      confirmVariant: 'danger',
    });
    if (!confirmed) return;
    await runBulkAction(() => bulkRemoveTodos(selectedIds), 'Deleted');
  }, [confirm, runBulkAction, selectedIds]);
  const handleBulkPriority = useCallback(
    (priority: TodoPriority) =>
      runBulkAction(() => bulkUpdateTodoPriority(selectedIds, priority), 'Updated'),
    [runBulkAction, selectedIds],
  );
  const handleBulkAssignProject = useCallback(
    (projectId: string | null) =>
      runBulkAction(() => bulkAssignTodosProject(selectedIds, projectId), 'Updated'),
    [runBulkAction, selectedIds],
  );

  const renderSelectableRow = useCallback(
    (todo: Todo) => {
      const selected = selectedIds.includes(todo.id);
      return (
        <Pressable
          key={todo.id}
          onPress={() => toggleSelected(todo.id)}
          accessibilityRole="checkbox"
          accessibilityLabel={`${selected ? 'Deselect' : 'Select'} ${todo.title}`}
          accessibilityState={{ checked: selected }}
          className="mb-2 flex-row items-center gap-3 rounded-2xl border px-4 py-3"
          style={{
            borderColor: selected ? COLOR : tokens.border,
            backgroundColor: tokens.surfaceElevated,
          }}
        >
          <View
            className={`h-5 w-5 items-center justify-center rounded border-2 ${
              selected ? 'border-todos bg-todos' : ''
            }`}
            style={
              !selected
                ? { borderColor: tokens.border, backgroundColor: tokens.surface }
                : undefined
            }
          >
            {selected ? <MaterialIcons name="check" size={14} color={tokens.textOnAccent} /> : null}
          </View>
          <Text className="flex-1 text-sm" style={{ color: tokens.text }} numberOfLines={2}>
            {todo.title}
          </Text>
        </Pressable>
      );
    },
    [
      selectedIds,
      tokens.border,
      tokens.surface,
      tokens.surfaceElevated,
      tokens.text,
      tokens.textOnAccent,
      toggleSelected,
    ],
  );
  // Manual reorder is only meaningful when every pending row is visible in its
  // true order. The render branches already keep DraggableFlatList out of
  // selection/filtered views; this flag additionally gates the drag activation
  // and persistence below so a filtered subset can never rewrite sort_order.
  const canReorderManually =
    !selectionMode && !queryActive && visiblePending.length === pendingTasks.length;
  const pendingIdSet = useMemo(() => new Set(pendingTasks.map((t) => t.id)), [pendingTasks]);
  const handleDragBegin = useCallback(() => {}, []);
  const handleDragEnd = useCallback(
    async ({ data }: { data: Todo[] }) => {
      // updateTodoOrder assigns ABSOLUTE sort_order 1..N to exactly the ids it
      // receives, so persisting a reordered filtered subset would corrupt the
      // global manual order. Persist only the full pending list.
      const isFullPendingList =
        data.length === pendingTasks.length && data.every((item) => pendingIdSet.has(item.id));
      if (!isFullPendingList) return;
      setItems((prev) =>
        prev.map((item) => {
          const newIndex = data.findIndex((d) => d.id === item.id);
          return newIndex !== -1 ? { ...item, sort_order: newIndex + 1 } : item;
        }),
      );
      await updateTodoOrder(data.map((d) => d.id));
      void refresh();
    },
    [pendingIdSet, pendingTasks, refresh],
  );
  const renderTodoItem = useCallback(
    ({ item, drag, isActive }: RenderItemParams<Todo>) => (
      <ScaleDecorator>
        <TodoItem
          todo={item}
          onLongPress={canReorderManually ? drag : () => {}}
          isActive={isActive}
          onToggle={() => handleToggleTodo(item)}
          onDelete={() => void requestDeleteTodo(item)}
          onEdit={() => {
            void startEdit(item);
          }}
          viewMode={viewMode}
          cardWidth={viewMode === 'grid' ? gridCardWidth : undefined}
        />
      </ScaleDecorator>
    ),
    [canReorderManually, gridCardWidth, handleToggleTodo, requestDeleteTodo, startEdit, viewMode],
  );
  const todoLinkedActionSource: LinkedActionEditorSourceOption = {
    key: TODO_LINKED_ACTION_SOURCE_KEY,
    feature: 'todos',
    entityType: 'todo',
    entityId: editingId ?? 'draft-todo',
    label: title.trim() || 'This task',
    description: 'Rules below run when this task is completed.',
  };

  const emptyPending =
    pendingTasks.length === 0 && !showCompleted && items.length > 0 && hasCompleted;
  const totallyEmpty = items.length === 0;
  const todosEmptyCardSubtitle = totallyEmpty || emptyPending;
  const noPendingTasksCard = (
    <EmptyStateCard
      accentColor={SECTION_COLORS.todos}
      className="mb-0"
      icon={<MaterialIcons name="checklist" size={22} color={colorText} />}
      title="No pending tasks"
      description="Offline-first task manager."
    />
  );

  return (
    <View className="flex-1">
      <Screen>
        <View className="flex-1">
          <ScreenSection>
            <PageHeader
              title="Todos"
              subtitle={
                selectionMode
                  ? `${selectedIds.length} selected`
                  : todosEmptyCardSubtitle
                    ? undefined
                    : 'Offline-first task manager.'
              }
              actions={
                <>
                  <IconButton
                    icon={selectionMode ? 'close' : 'playlist-add-check'}
                    onPress={() => {
                      if (selectionMode) exitSelectionMode();
                      else setSelectionMode(true);
                    }}
                    accessibilityLabel={
                      selectionMode ? 'Exit multi-select mode' : 'Enter multi-select mode'
                    }
                    selected={selectionMode}
                    accentColor={colorText}
                  />
                  {VIEW_MODE_OPTIONS.map(({ mode, icon }) => (
                    <IconButton
                      key={mode}
                      icon={icon}
                      onPress={() => setViewMode(mode)}
                      accessibilityLabel={`${mode} view`}
                      selected={viewMode === mode}
                      accentColor={colorText}
                    />
                  ))}
                </>
              }
            />
          </ScreenSection>

          <ScreenSection>
            <Card accentColor={SECTION_COLORS.todos} className="mb-0" innerClassName="p-0">
              <View className="p-4">
                <View className="flex-row items-start gap-3">
                  <View
                    className="h-11 w-11 items-center justify-center rounded-xl"
                    style={{ backgroundColor: `${COLOR}18` }}
                  >
                    <MaterialIcons name="checklist" size={22} color={colorText} />
                  </View>
                  <View className="min-w-0 flex-1">
                    <Text className="text-base font-semibold" style={{ color: tokens.text }}>
                      Today&apos;s queue
                    </Text>
                    <Text className="mt-0.5 text-sm" style={{ color: tokens.textMuted }}>
                      {pendingTasks.length} pending, {completedTasks.length} completed
                    </Text>
                  </View>
                </View>
                <View className="mt-4 flex-row flex-wrap gap-2">
                  <View className="rounded-full bg-todos-light px-3 py-1.5">
                    <Text className="text-xs font-semibold text-todos-dark">
                      {pendingTasks.length} open
                    </Text>
                  </View>
                  <View
                    className="rounded-full px-3 py-1.5"
                    style={{ backgroundColor: tokens.surfaceElevated }}
                  >
                    <Text className="text-xs font-semibold" style={{ color: tokens.textMuted }}>
                      {recurringTasksCount} daily
                    </Text>
                  </View>
                  {overdueTasksCount > 0 ? (
                    <View
                      className="rounded-full px-3 py-1.5"
                      style={{ backgroundColor: tokens.dangerBackground }}
                    >
                      <Text className="text-xs font-semibold" style={{ color: tokens.dangerText }}>
                        {overdueTasksCount} overdue
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
            </Card>
          </ScreenSection>

          {totallyEmpty ? (
            <ScreenSection>
              <TodoQuickCapture onSubmit={handleQuickAdd} onOpenDetails={openNewTodoModal} />
              {noPendingTasksCard}
            </ScreenSection>
          ) : null}

          {!totallyEmpty ? (
            <ScreenSection className="min-h-0 mb-0 flex-1">
              <TodoListToolbar
                search={search}
                onSearchChange={setSearch}
                filters={filters}
                onFiltersChange={setFilters}
                sort={sortMode}
                onSortChange={setSortMode}
                accentColor={colorText}
              />
              {selectionMode ? (
                <View className="mb-3">
                  {dueGroups.overdue.length > 0 ? (
                    <Text
                      className="mb-2 px-1 text-xs font-semibold"
                      style={{ color: tokens.dangerText }}
                    >
                      Overdue ({dueGroups.overdue.length})
                    </Text>
                  ) : null}
                  {dueGroups.overdue.map(renderSelectableRow)}
                  {dueGroups.today.length > 0 ? (
                    <Text
                      className="mb-2 px-1 text-xs font-semibold"
                      style={{ color: tokens.text }}
                    >
                      Today ({dueGroups.today.length})
                    </Text>
                  ) : null}
                  {dueGroups.today.map(renderSelectableRow)}
                  {dueGroups.upcoming.length > 0 ? (
                    <Text
                      className="mb-2 px-1 text-xs font-semibold"
                      style={{ color: tokens.textMuted }}
                    >
                      Upcoming ({dueGroups.upcoming.length})
                    </Text>
                  ) : null}
                  {dueGroups.upcoming.map(renderSelectableRow)}
                  {dueGroups.noDue.length > 0 ? (
                    <Text
                      className="mb-2 px-1 text-xs font-semibold"
                      style={{ color: tokens.textMuted }}
                    >
                      No date ({dueGroups.noDue.length})
                    </Text>
                  ) : null}
                  {dueGroups.noDue.map(renderSelectableRow)}
                  <View className="mt-2">
                    <TodoBulkBar
                      selectedCount={selectedIds.length}
                      onComplete={() => void handleBulkComplete()}
                      onDelete={() => void handleBulkDelete()}
                      onPriorityChange={(priority) => void handleBulkPriority(priority)}
                      projects={projectOptions}
                      onAssignProject={(projectId) => void handleBulkAssignProject(projectId)}
                      onExit={exitSelectionMode}
                      accentColor={colorText}
                    />
                  </View>
                </View>
              ) : queryActive ? (
                <View className="mb-4">
                  {visiblePending.length === 0 ? (
                    <EmptyStateCard
                      accentColor={SECTION_COLORS.todos}
                      className="mb-0"
                      icon={<MaterialIcons name="search-off" size={22} color={colorText} />}
                      title="No matching tasks"
                      description="Try a different search or reset the filters."
                    />
                  ) : null}
                  {(['overdue', 'today', 'upcoming', 'noDue'] as const).map((groupKey) => {
                    const groupItems = dueGroups[groupKey];
                    if (groupItems.length === 0) return null;
                    const labels = {
                      overdue: 'Overdue',
                      today: 'Today',
                      upcoming: 'Upcoming',
                      noDue: 'No date',
                    } as const;
                    return (
                      <View key={groupKey} className="mb-4">
                        <Text
                          className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide"
                          style={{
                            color: groupKey === 'overdue' ? tokens.dangerText : tokens.textMuted,
                          }}
                          accessibilityLabel={`${labels[groupKey]} group, ${groupItems.length} tasks`}
                        >
                          {labels[groupKey]} ({groupItems.length})
                        </Text>
                        {groupItems.map((item) => (
                          <TodoItem
                            key={item.id}
                            todo={item}
                            onLongPress={() => {}}
                            isActive={false}
                            onToggle={() => handleToggleTodo(item)}
                            onDelete={() => void requestDeleteTodo(item)}
                            onEdit={() => {
                              void startEdit(item);
                            }}
                            viewMode={viewMode === 'grid' ? 'list' : viewMode}
                          />
                        ))}
                      </View>
                    );
                  })}
                </View>
              ) : (
                <>
                  <TodoQuickCapture onSubmit={handleQuickAdd} onOpenDetails={openNewTodoModal} />
                  <View className="mb-4 flex-row items-center justify-between gap-3 px-1">
                    <View>
                      <Text className="text-base font-semibold" style={{ color: tokens.text }}>
                        Pending
                      </Text>
                      <Text className="mt-0.5 text-xs" style={{ color: tokens.textMuted }}>
                        Swipe to edit or delete. Drag to reorder.
                      </Text>
                    </View>
                    {hasCompleted ? (
                      <Pressable
                        onPress={() => setShowCompleted((v) => !v)}
                        accessibilityRole="button"
                        accessibilityLabel={`${showCompleted ? 'Hide' : 'Show'} completed tasks`}
                        accessibilityState={{ expanded: showCompleted }}
                        aria-expanded={showCompleted}
                        className="rounded-full border px-3 py-2.5"
                        style={{ borderColor: tokens.border, backgroundColor: tokens.surface }}
                      >
                        <Text className="text-xs font-semibold" style={{ color: tokens.textMuted }}>
                          {showCompleted ? 'Hide' : 'Show'} completed ({completedTasks.length})
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                  <DraggableFlatList
                    key={viewMode}
                    data={visiblePending}
                    keyExtractor={todoKeyExtractor}
                    containerStyle={{ flex: 1 }}
                    contentContainerStyle={{ flexGrow: 1, paddingBottom: 96 }}
                    activationDistance={10}
                    numColumns={viewMode === 'grid' ? gridColumns : 1}
                    onDragBegin={handleDragBegin}
                    onDragEnd={handleDragEnd}
                    ListEmptyComponent={
                      hasCompleted ? (
                        <View className="mb-3">{noPendingTasksCard}</View>
                      ) : (
                        <EmptyStateCard
                          accentColor={SECTION_COLORS.todos}
                          className="mb-0"
                          title="Nothing to show here"
                        />
                      )
                    }
                    ListFooterComponent={
                      hasCompleted ? (
                        <View className="pt-3">
                          {showCompleted
                            ? [
                                <View
                                  key="completed-header"
                                  className="mb-4 flex-row items-center justify-between gap-3 px-1"
                                >
                                  <View>
                                    <Text
                                      className="text-base font-semibold"
                                      style={{ color: tokens.text }}
                                    >
                                      Completed
                                    </Text>
                                    <Text
                                      className="mt-0.5 text-xs"
                                      style={{ color: tokens.textMuted }}
                                    >
                                      Completed tasks stay here until you toggle them back.
                                    </Text>
                                  </View>
                                </View>,
                                ...completedTasks.map((item) => (
                                  <TodoItem
                                    key={item.id}
                                    todo={item}
                                    onLongPress={() => {}}
                                    isActive={false}
                                    onToggle={() => handleToggleTodo(item)}
                                    onDelete={() => void requestDeleteTodo(item)}
                                    onEdit={() => {
                                      void startEdit(item);
                                    }}
                                    viewMode={viewMode}
                                    cardWidth={viewMode === 'grid' ? gridCardWidth : undefined}
                                  />
                                )),
                              ]
                            : null}
                        </View>
                      ) : null
                    }
                    renderItem={renderTodoItem}
                  />
                </>
              )}
            </ScreenSection>
          ) : null}
        </View>

        <Modal visible={modalVisible} onClose={closeModal} scroll>
          <Card
            variant="header"
            accentColor={SECTION_COLORS.todos}
            headerTitle={editingId ? 'Edit task' : 'Add new task'}
          >
            <TextField
              label="Title"
              value={title}
              onChangeText={(t) => {
                setTodoError(null);
                setTitle(t);
              }}
              placeholder="Add a task..."
            />
            <TextField
              label="Notes"
              value={notes}
              onChangeText={(t) => {
                setTodoError(null);
                setNotes(t);
              }}
              placeholder="Optional notes"
            />
            <View className="mb-3 flex-row flex-wrap">
              {(['urgent', 'normal', 'low'] as TodoPriority[]).map((p) => (
                <PillChip
                  key={p}
                  label={p}
                  active={priority === p}
                  color={COLOR}
                  onPress={() => {
                    setTodoError(null);
                    setPriority(p);
                  }}
                />
              ))}
            </View>
            {projectOptions.length > 0 ? (
              <View className="mb-3">
                <Text className="mb-1 text-sm font-medium" style={{ color: tokens.text }}>
                  Project
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  <PillChip
                    label="None"
                    active={editProjectId === null}
                    color={COLOR}
                    onPress={() => setEditProjectId(null)}
                  />
                  {projectOptions.map((project) => (
                    <PillChip
                      key={project.id}
                      label={project.name}
                      active={editProjectId === project.id}
                      color={COLOR}
                      onPress={() => setEditProjectId(project.id)}
                    />
                  ))}
                </View>
              </View>
            ) : null}
            {goalOptions.length > 0 ? (
              <View className="mb-3">
                <Text className="mb-1 text-sm font-medium" style={{ color: tokens.text }}>
                  Goal
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  <PillChip
                    label="None"
                    active={editGoalId === null}
                    color={COLOR}
                    onPress={() => setEditGoalId(null)}
                  />
                  {goalOptions.map((goal) => (
                    <PillChip
                      key={goal.id}
                      label={goal.title}
                      active={editGoalId === goal.id}
                      color={COLOR}
                      onPress={() => setEditGoalId(goal.id)}
                    />
                  ))}
                </View>
              </View>
            ) : null}
            {!editingId ? (
              <Pressable
                onPress={() => {
                  setTodoError(null);
                  setIsRecurring((v) => !v);
                }}
                accessibilityRole="checkbox"
                accessibilityLabel="Repeat task daily"
                accessibilityState={{ checked: isRecurring }}
                aria-checked={isRecurring}
                className="mb-3 flex-row items-center gap-2 py-2"
              >
                <View
                  className={`h-5 w-5 items-center justify-center rounded border-2 ${
                    isRecurring ? 'border-todos bg-todos' : ''
                  }`}
                  style={
                    !isRecurring
                      ? { borderColor: tokens.border, backgroundColor: tokens.surface }
                      : undefined
                  }
                >
                  {isRecurring ? (
                    <Text className="text-xs font-bold" style={{ color: tokens.textOnAccent }}>
                      ↻
                    </Text>
                  ) : null}
                </View>
                <Text className="text-sm" style={{ color: tokens.textMuted }}>
                  Repeat daily
                </Text>
              </Pressable>
            ) : null}
            {Platform.OS === 'web' ? (
              <TextField
                label="Due date (YYYY-MM-DD)"
                value={dueDate ?? ''}
                onChangeText={(t) => {
                  setTodoError(null);
                  setDueDate(t.trim() || null);
                }}
                placeholder="Optional"
              />
            ) : (
              <>
                <Pressable
                  onPress={() => setShowDatePicker(true)}
                  className="mb-3 flex-row items-center gap-2 py-2"
                >
                  <Text className="text-sm" style={{ color: tokens.textMuted }}>
                    {dueDate ? `Due: ${dueDate}` : 'Add due date (optional)'}
                  </Text>
                  {dueDate ? (
                    <Pressable
                      onPress={() => {
                        setTodoError(null);
                        setDueDate(null);
                      }}
                      hitSlop={8}
                    >
                      <Text className="text-xs text-rose-400">✕ clear</Text>
                    </Pressable>
                  ) : null}
                </Pressable>
                {showDatePicker ? (
                  <DateTimePicker
                    value={dueDate ? new Date(dueDate + 'T12:00:00') : new Date()}
                    mode="date"
                    display="default"
                    onChange={(event, selectedDate) => {
                      setShowDatePicker(false);
                      if (event.type === 'set' && selectedDate) {
                        setTodoError(null);
                        setDueDate(toDateKey(selectedDate));
                      }
                    }}
                  />
                ) : null}
              </>
            )}
            <ValidationError message={todoError} />
          </Card>

          <Card
            variant="header"
            accentColor={SECTION_COLORS.todos}
            headerTitle="Linked Actions"
            headerSubtitle="Optional explicit rules that run when this task is completed."
          >
            {isRecurringLinkedActionSource ? (
              <Text className="text-sm" style={{ color: colorText }}>
                Recurring tasks cannot be Linked Action sources yet.
              </Text>
            ) : linkedActionsLoading ? (
              <Text className="text-sm" style={{ color: colorText }}>
                Loading linked actions...
              </Text>
            ) : (
              <LinkedActionsEditorSection
                sourceOptions={[todoLinkedActionSource]}
                selectedSourceKey={TODO_LINKED_ACTION_SOURCE_KEY}
                rows={linkedActionRows}
                onRowsChange={(rows) => {
                  setLinkedActionsError(null);
                  setLinkedActionRows(rows);
                }}
                allowSourceSelection={false}
                allowedTargetFeatures={TODO_LINKED_ACTIONS_EDITOR_CONFIG.allowedTargetFeatures}
                allowedTriggerTypes={TODO_LINKED_ACTIONS_EDITOR_CONFIG.allowedTriggerTypes}
                allowCreateNewTarget={TODO_LINKED_ACTIONS_EDITOR_CONFIG.allowCreateNewTarget}
                introTitle="Task completion rules"
                introDescription="Choose a target task or habit and the effect that should run when this task is completed."
              />
            )}
            <ValidationError message={linkedActionsError} />

            <View className="mt-3 flex-row gap-2">
              <View className="flex-1">
                <Button
                  label="Cancel"
                  variant="ghost"
                  onPress={closeModal}
                  disabled={isSubmitting}
                />
              </View>
              <View className="flex-1">
                <Button
                  label={editingId ? 'Save changes' : 'Add task'}
                  onPress={onSave}
                  disabled={isSubmitting}
                  color={COLOR}
                />
              </View>
            </View>
          </Card>
        </Modal>

        {confirmationDialog}
      </Screen>
    </View>
  );
}
