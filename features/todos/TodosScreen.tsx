import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Platform, Pressable, Text, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useFocusEffect } from "expo-router";
import DraggableFlatList, { type RenderItemParams, ScaleDecorator } from "react-native-draggable-flatlist";
import { Screen } from "@/core/ui/Screen";
import { TextField } from "@/core/ui/TextField";
import { Button } from "@/core/ui/Button";
import { SectionTitle } from "@/core/ui/SectionTitle";
import { toDateKey } from "@/lib/time";
import type { Todo, TodoPriority } from "./types";
import { TodoItem } from "./TodoItem";
import {
  addTodo,
  listTodos,
  removeTodo,
  toggleTodo,
  updateTodo,
  updateTodoOrder,
} from "@/features/todos/todos.data";

export function TodosScreen() {
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [priority, setPriority] = useState<TodoPriority>("normal");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [items, setItems] = useState<Todo[]>([]);
  const [createExpanded, setCreateExpanded] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const pendingTasks = useMemo(() => items.filter((t) => t.completed === 0), [items]);
  const hasCompleted = useMemo(() => items.some((t) => t.completed === 1), [items]);
  const listData = useMemo(
    () => (showCompleted ? items : pendingTasks),
    [showCompleted, items, pendingTasks],
  );

  const refresh = useCallback(() => {
    listTodos().then(setItems);
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

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
    setEditingId(null);
    setShowDatePicker(false);
  };

  const onSave = async () => {
    if (!title.trim()) {
      Alert.alert("Missing title", "Please enter a to-do title.");
      return;
    }
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
      });
    }
    resetForm();
    setCreateExpanded(false);
    refresh();
  };

  const toggleCreate = () => {
    if (!createExpanded) {
      resetForm();
    }
    setCreateExpanded((e) => !e);
  };

  const collapseCreate = () => {
    setCreateExpanded(false);
    resetForm();
  };

  const startEdit = (todo: Todo) => {
    setEditingId(todo.id);
    setTitle(todo.title);
    setNotes(todo.notes ?? "");
    setDueDate(todo.due_date);
    setPriority(todo.priority);
    setCreateExpanded(true);
  };

  const createDropdownContent = (
    <View className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <Pressable onPress={toggleCreate} className="flex-row items-center justify-between p-4">
        <Text className="font-medium text-slate-700">{editingId ? "Edit task" : "Make a Task"}</Text>
        <MaterialIcons name={createExpanded ? "expand-less" : "expand-more"} size={24} color="#64748b" />
      </Pressable>
      {createExpanded ? (
        <View className="border-t border-slate-200 p-4">
          <TextField label="Title" value={title} onChangeText={setTitle} placeholder="Add a task..." />
          <TextField label="Notes" value={notes} onChangeText={setNotes} placeholder="Optional notes" />
          <View className="mb-3 flex-row gap-2">
            {(["urgent", "normal", "low"] as TodoPriority[]).map((p) => (
              <Pressable
                key={p}
                onPress={() => setPriority(p)}
                className={`rounded-lg border px-3 py-1.5 ${
                  priority === p ? "border-brand-500 bg-brand-500" : "border-slate-200 bg-white"
                }`}
              >
                <Text
                  className={`text-xs font-medium capitalize ${
                    priority === p ? "text-white" : "text-slate-600"
                  }`}
                >
                  {p}
                </Text>
              </Pressable>
            ))}
          </View>
          {Platform.OS === "web" ? (
            <TextField
              label="Due date (YYYY-MM-DD)"
              value={dueDate ?? ""}
              onChangeText={(t) => setDueDate(t.trim() || null)}
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
                  <Pressable onPress={() => setDueDate(null)} hitSlop={8}>
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
                      setDueDate(toDateKey(selectedDate));
                    }
                  }}
                />
              ) : null}
            </>
          )}
          <View className="mt-3 flex-row gap-2">
            <Button label="Cancel" variant="ghost" onPress={collapseCreate} />
            <Button label={editingId ? "Save changes" : "Add task"} onPress={onSave} />
          </View>
        </View>
      ) : null}
    </View>
  );

  const emptyPending =
    pendingTasks.length === 0 && !showCompleted && items.length > 0 && hasCompleted;
  const totallyEmpty = items.length === 0;

  return (
    <Screen>
      <View className="flex-1">
        <SectionTitle title="To-do List" subtitle="Offline-first task manager." />

        {totallyEmpty ? (
          <View className="mb-3">
            <Text className="mb-3 text-center text-slate-600">No Pending Tasks</Text>
            {createDropdownContent}
          </View>
        ) : null}

        {!totallyEmpty ? (
          <>
            {emptyPending ? (
              <View className="mb-3">
                <Text className="mb-3 text-center text-slate-600">No Pending Tasks</Text>
                {hasCompleted ? (
                  <Pressable onPress={() => setShowCompleted((v) => !v)} className="mb-2 px-1 py-2">
                    <Text className="text-xs text-brand-500">
                      {showCompleted
                        ? "▲ hide completed"
                        : `▼ show completed (${items.filter((t) => t.completed === 1).length})`}
                    </Text>
                  </Pressable>
                ) : null}
                {createDropdownContent}
              </View>
            ) : null}

            {!emptyPending ? (
              <>
                {hasCompleted ? (
                  <Pressable onPress={() => setShowCompleted((v) => !v)} className="mb-2 px-1 py-2">
                    <Text className="text-xs text-brand-500">
                      {showCompleted
                        ? "▲ hide completed"
                        : `▼ show completed (${items.filter((t) => t.completed === 1).length})`}
                    </Text>
                  </Pressable>
                ) : null}

                <View className="min-h-0 flex-1">
                  {listData.length > 0 ? (
                    <DraggableFlatList
                      data={listData}
                      keyExtractor={(item) => item.id}
                      containerStyle={{ flex: 1 }}
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
                      renderItem={({ item, drag, isActive }: RenderItemParams<Todo>) => (
                        <ScaleDecorator>
                          <TodoItem
                            todo={item}
                            onLongPress={drag}
                            isActive={isActive}
                            onToggle={() => toggleTodo(item).then(refresh)}
                            onDelete={() => removeTodo(item.id).then(refresh)}
                            onEdit={() => startEdit(item)}
                          />
                        </ScaleDecorator>
                      )}
                    />
                  ) : (
                    <Text className="py-4 text-center text-slate-500">Nothing to show here.</Text>
                  )}
                </View>
                <View className="mt-3 shrink-0">{createDropdownContent}</View>
              </>
            ) : null}
          </>
        ) : null}
      </View>
    </Screen>
  );
}
