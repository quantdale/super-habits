import { useCallback, useEffect, useMemo, useState } from "react";
import { Platform, Pressable, Text, View, useWindowDimensions } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import DraggableFlatList, { type RenderItemParams, ScaleDecorator } from "react-native-draggable-flatlist";
import { Screen } from "@/core/ui/Screen";
import { Modal } from "@/core/ui/Modal";
import { Card } from "@/core/ui/Card";
import { EmptyStateCard } from "@/core/ui/EmptyStateCard";
import { PageHeader } from "@/core/ui/PageHeader";
import { ScreenSection } from "@/core/ui/ScreenSection";
import { TextField } from "@/core/ui/TextField";
import { Button } from "@/core/ui/Button";
import { PillChip } from "@/core/ui/PillChip";
import { SECTION_COLORS } from "@/constants/sectionColors";
import { toDateKey } from "@/lib/time";
import { useFocusForegroundRefresh } from "@/lib/useForegroundRefresh";
import { validateTodo } from "@/lib/validation";
import { ValidationError } from "@/core/ui/ValidationError";
import type { Todo, TodoPriority, TodoViewMode } from "./types";
import { TodoItem } from "./TodoItem";
import { findMissingRecurrenceIds, getTodayDateKey } from "./todos.domain";
import {
  addTodo,
  createRecurringInstance,
  getRecurringTodosByIds,
  listAllActiveTodosForRecurrence,
  listTodos,
  removeTodo,
  toggleTodo,
  updateTodo,
  updateTodoOrder,
} from "@/features/todos/todos.data";

const COLOR = SECTION_COLORS.todos;
const COLOR_TEXT = "#1D4ED8";
const MUTED_ICON = "#94a3b8";
const VIEW_MODE_OPTIONS: ReadonlyArray<{
  mode: TodoViewMode;
  icon: keyof typeof MaterialIcons.glyphMap;
}> = [
  { mode: "content", icon: "view-agenda" },
  { mode: "list", icon: "format-list-bulleted" },
  { mode: "grid", icon: "grid-view" },
];

export function TodosScreen() {
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [priority, setPriority] = useState<TodoPriority>("normal");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isRecurring, setIsRecurring] = useState(false);
  const [items, setItems] = useState<Todo[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [todoError, setTodoError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<TodoViewMode>("content");
  const { width: screenWidth } = useWindowDimensions();
  const gridColumns = screenWidth >= 1200 ? 4 : screenWidth >= 768 ? 3 : 2;
  const gridCardWidth = (screenWidth - 32 - 4 * (gridColumns * 2)) / gridColumns;

  const pendingTasks = useMemo(() => items.filter((t) => t.completed === 0), [items]);
  const completedTasks = useMemo(() => items.filter((t) => t.completed === 1), [items]);
  const hasCompleted = useMemo(() => completedTasks.length > 0, [completedTasks]);
  const recurringTasksCount = useMemo(
    () => pendingTasks.filter((todo) => todo.recurrence === "daily").length,
    [pendingTasks],
  );
  const overdueTasksCount = useMemo(() => {
    const today = toDateKey();
    return pendingTasks.filter((todo) => todo.due_date && todo.due_date < today).length;
  }, [pendingTasks]);

  const refresh = useCallback(() => {
    listTodos().then(setItems);
  }, []);

  const loadTodosOnFocus = useCallback(async () => {
    const allTodos = await listAllActiveTodosForRecurrence();
    const todayKey = getTodayDateKey();
    const missingIds = findMissingRecurrenceIds(allTodos, todayKey);

    if (missingIds.length > 0) {
      const templates = await getRecurringTodosByIds(missingIds);
      for (const template of templates) {
        const recurrenceId = template.recurrence_id;
        if (!recurrenceId) continue;
        await createRecurringInstance({
          title: template.title,
          notes: template.notes,
          priority: template.priority,
          recurrenceId,
          dueDate: todayKey,
        });
      }
    }
    const list = await listTodos();
    setItems(list);
  }, []);

  useFocusForegroundRefresh(loadTodosOnFocus);

  useEffect(() => {
    if (!editingId) return;
    const t = items.find((x) => x.id === editingId);
    if (t) {
      setTitle(t.title);
      setNotes(t.notes ?? "");
      setDueDate(t.due_date);
      setPriority(t.priority);
    }
  }, [editingId, items]);

  const resetForm = () => {
    setTitle("");
    setNotes("");
    setDueDate(null);
    setPriority("normal");
    setIsRecurring(false);
    setEditingId(null);
    setShowDatePicker(false);
    setTodoError(null);
  };

  const closeModal = () => {
    setModalVisible(false);
    resetForm();
  };

  const openNewTodoModal = () => {
    resetForm();
    setModalVisible(true);
  };

  const onSave = async () => {
    const err = validateTodo(title, notes, dueDate);
    if (err) {
      setTodoError(err);
      return;
    }
    setTodoError(null);
    if (editingId) {
      await updateTodo(editingId, {
        title: title.trim(),
        notes: notes.trim() || undefined,
        dueDate: dueDate ?? null,
        priority,
      });
    } else {
      await addTodo({
        title: title.trim(),
        notes: notes.trim() || undefined,
        dueDate: dueDate ?? null,
        priority,
        recurrence: isRecurring ? "daily" : null,
      });
    }
    setModalVisible(false);
    resetForm();
    refresh();
  };

  const startEdit = (todo: Todo) => {
    setEditingId(todo.id);
    setTitle(todo.title);
    setNotes(todo.notes ?? "");
    setDueDate(todo.due_date);
    setPriority(todo.priority);
    setTodoError(null);
    setModalVisible(true);
  };

  const emptyPending =
    pendingTasks.length === 0 && !showCompleted && items.length > 0 && hasCompleted;
  const totallyEmpty = items.length === 0;
  const todosEmptyCardSubtitle = totallyEmpty || emptyPending;

  const noPendingTasksCard = (
    <EmptyStateCard
      accentColor={SECTION_COLORS.todos}
      className="mb-0"
      icon={<MaterialIcons name="checklist" size={22} color={COLOR_TEXT} />}
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
              subtitle={todosEmptyCardSubtitle ? undefined : "Offline-first task manager."}
              actions={
                <>
                  {VIEW_MODE_OPTIONS.map(({ mode, icon }) => (
                    <Pressable
                      key={mode}
                      onPress={() => setViewMode(mode)}
                      className={`rounded-lg p-2 ${viewMode === mode ? "bg-todos-light" : ""}`}
                      accessibilityState={{ selected: viewMode === mode }}
                      accessibilityLabel={`${mode} view`}
                    >
                      <MaterialIcons
                        name={icon}
                        size={24}
                        color={viewMode === mode ? COLOR : MUTED_ICON}
                      />
                    </Pressable>
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
                    <MaterialIcons name="checklist" size={22} color={COLOR_TEXT} />
                  </View>
                  <View className="min-w-0 flex-1">
                    <Text className="text-base font-semibold text-slate-900">Today&apos;s queue</Text>
                    <Text className="mt-0.5 text-sm text-slate-500">
                      {pendingTasks.length} pending, {completedTasks.length} completed
                    </Text>
                  </View>
                </View>
                <View className="mt-4 flex-row flex-wrap gap-2">
                  <View className="rounded-full bg-slate-100 px-3 py-1.5">
                    <Text className="text-xs font-semibold text-slate-600">
                      {pendingTasks.length} open
                    </Text>
                  </View>
                  <View className="rounded-full bg-slate-100 px-3 py-1.5">
                    <Text className="text-xs font-semibold text-slate-600">
                      {recurringTasksCount} daily
                    </Text>
                  </View>
                  {overdueTasksCount > 0 ? (
                    <View className="rounded-full bg-rose-50 px-3 py-1.5">
                      <Text className="text-xs font-semibold text-rose-600">
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
              {noPendingTasksCard}
            </ScreenSection>
          ) : null}

          {!totallyEmpty ? (
            <ScreenSection className="min-h-0 mb-0 flex-1">
              <View className="mb-3 flex-row items-center justify-between gap-3 px-1">
                <View>
                  <Text className="text-sm font-semibold text-slate-900">Pending</Text>
                  <Text className="mt-0.5 text-xs text-slate-500">
                    Swipe to edit or delete. Drag to reorder.
                  </Text>
                </View>
                {hasCompleted ? (
                  <Pressable
                    onPress={() => setShowCompleted((v) => !v)}
                    className="rounded-full border border-slate-200 bg-white px-3 py-2"
                  >
                    <Text className="text-xs font-semibold text-slate-600">
                      {showCompleted ? "Hide" : "Show"} completed ({completedTasks.length})
                    </Text>
                  </Pressable>
                ) : null}
              </View>
              <DraggableFlatList
                key={viewMode}
                data={pendingTasks}
                keyExtractor={(item) => item.id}
                containerStyle={{ flex: 1 }}
                contentContainerStyle={{ flexGrow: 1, paddingBottom: 96 }}
                activationDistance={10}
                numColumns={viewMode === "grid" ? gridColumns : 1}
                onDragBegin={() => {}}
                onDragEnd={async ({ data }) => {
                  setItems((prev) =>
                    prev.map((item) => {
                      const newIndex = data.findIndex((d) => d.id === item.id);
                      return newIndex !== -1 ? { ...item, sort_order: newIndex + 1 } : item;
                    }),
                  );
                  await updateTodoOrder(data.map((d) => d.id));
                  refresh();
                }}
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
                    <View className="pt-2">
                      {showCompleted
                        ? [
                            <View
                              key="completed-header"
                              className="mb-3 flex-row items-center justify-between gap-3 px-1"
                            >
                              <View>
                                <Text className="text-sm font-semibold text-slate-900">Completed</Text>
                                <Text className="mt-0.5 text-xs text-slate-500">
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
                                onToggle={() => toggleTodo(item).then(refresh)}
                                onDelete={() => removeTodo(item.id).then(refresh)}
                                onEdit={() => startEdit(item)}
                                viewMode={viewMode}
                                cardWidth={viewMode === "grid" ? gridCardWidth : undefined}
                              />
                            )),
                          ]
                        : null}
                    </View>
                  ) : null
                }
                renderItem={({ item, drag, isActive }: RenderItemParams<Todo>) => (
                  <ScaleDecorator>
                    <TodoItem
                      todo={item}
                      onLongPress={drag}
                      isActive={isActive}
                      onToggle={() => toggleTodo(item).then(refresh)}
                      onDelete={() => removeTodo(item.id).then(refresh)}
                      onEdit={() => startEdit(item)}
                      viewMode={viewMode}
                      cardWidth={viewMode === "grid" ? gridCardWidth : undefined}
                    />
                  </ScaleDecorator>
                )}
              />
            </ScreenSection>
          ) : null}
        </View>

      <Modal visible={modalVisible} onClose={closeModal} scroll>
        <Card
          variant="header"
          accentColor={SECTION_COLORS.todos}
          headerTitle={editingId ? "Edit task" : "Add new task"}
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
            {(["urgent", "normal", "low"] as TodoPriority[]).map((p) => (
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
          {!editingId ? (
            <Pressable
              onPress={() => {
                setTodoError(null);
                setIsRecurring((v) => !v);
              }}
              className="mb-3 flex-row items-center gap-2 py-2"
            >
              <View
                className={`h-5 w-5 items-center justify-center rounded border-2 ${
                  isRecurring ? "border-todos bg-todos" : "border-slate-300"
                }`}
              >
                {isRecurring ? (
                  <Text className="text-xs font-bold text-white">↻</Text>
                ) : null}
              </View>
              <Text className="text-sm text-slate-600">Repeat daily</Text>
            </Pressable>
          ) : null}
          {Platform.OS === "web" ? (
            <TextField
              label="Due date (YYYY-MM-DD)"
              value={dueDate ?? ""}
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
                <Text className="text-sm text-slate-600">
                  {dueDate ? `Due: ${dueDate}` : "Add due date (optional)"}
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
                  value={dueDate ? new Date(dueDate + "T12:00:00") : new Date()}
                  mode="date"
                  display="default"
                  onChange={(event, selectedDate) => {
                    setShowDatePicker(false);
                    if (event.type === "set" && selectedDate) {
                      setTodoError(null);
                      setDueDate(toDateKey(selectedDate));
                    }
                  }}
                />
              ) : null}
            </>
          )}
          <ValidationError message={todoError} />
          <View className="mt-3 flex-row gap-2">
            <View className="flex-1">
              <Button label="Cancel" variant="ghost" onPress={closeModal} />
            </View>
            <View className="flex-1">
              <Button label={editingId ? "Save changes" : "Add task"} onPress={onSave} color={COLOR} />
            </View>
          </View>
        </Card>
      </Modal>
    </Screen>

    <Pressable
      onPress={openNewTodoModal}
      accessibilityRole="button"
      accessibilityLabel="Add task"
      className="absolute bottom-6 right-4 z-10 h-14 w-14 items-center justify-center rounded-full bg-todos shadow-lg"
      style={{ elevation: 4 }}
    >
      <MaterialIcons name="add" size={28} color="#ffffff" />
    </Pressable>
    </View>
  );
}
