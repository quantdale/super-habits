import { useCallback, useMemo, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { FlashList } from "@shopify/flash-list";
import { Screen } from "@/core/ui/Screen";
import { Card } from "@/core/ui/Card";
import { TextField } from "@/core/ui/TextField";
import { Button } from "@/core/ui/Button";
import { SectionTitle } from "@/core/ui/SectionTitle";
import type { Todo } from "./types";
import { addTodo, listTodos, removeTodo, toggleTodo } from "@/features/todos/todos.data";

export function TodosScreen() {
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<Todo[]>([]);
  const [createExpanded, setCreateExpanded] = useState(false);

  const pendingTasks = useMemo(() => items.filter((t) => t.completed === 0), [items]);

  const refresh = useCallback(() => {
    listTodos().then(setItems);
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const onCreate = async () => {
    if (!title.trim()) {
      Alert.alert("Missing title", "Please enter a to-do title.");
      return;
    }
    await addTodo({ title: title.trim(), notes: notes.trim() || undefined });
    setTitle("");
    setNotes("");
    refresh();
  };

  const toggleCreate = () => setCreateExpanded((e) => !e);
  const collapseCreate = () => {
    setCreateExpanded(false);
    setTitle("");
    setNotes("");
  };

  const createDropdownContent = (
    <View className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <Pressable
        onPress={toggleCreate}
        className="flex-row items-center justify-between p-4"
      >
        <Text className="font-medium text-slate-700">Make a Task</Text>
        <MaterialIcons
          name={createExpanded ? "expand-less" : "expand-more"}
          size={24}
          color="#64748b"
        />
      </Pressable>
      {createExpanded ? (
        <View className="border-t border-slate-200 p-4">
          <TextField label="Title" value={title} onChangeText={setTitle} placeholder="Add a task..." />
          <TextField label="Notes" value={notes} onChangeText={setNotes} placeholder="Optional notes" />
          <View className="mt-3 flex-row gap-2">
            <Button label="Cancel" variant="ghost" onPress={collapseCreate} />
            <Button label="Add task" onPress={onCreate} />
          </View>
        </View>
      ) : null}
    </View>
  );

  return (
    <Screen>
      <View className="flex-1">
        <SectionTitle title="To-do List" subtitle="Offline-first task manager." />

        {pendingTasks.length === 0 ? (
          <View className="mb-3">
            <Text className="mb-3 text-center text-slate-600">No Pending Tasks</Text>
            {createDropdownContent}
          </View>
        ) : null}

        {pendingTasks.length > 0 ? (
          <>
            <View className="min-h-0 flex-1">
              <FlashList
                data={items}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <Card>
                    <Pressable
                      onPress={async () => {
                        await toggleTodo(item);
                        refresh();
                      }}
                    >
                      <Text className={`text-base ${item.completed ? "text-slate-400 line-through" : "text-slate-900"}`}>
                        {item.title}
                      </Text>
                      {item.notes ? <Text className="mt-1 text-sm text-slate-500">{item.notes}</Text> : null}
                    </Pressable>
                    <View className="mt-3">
                      <Button
                        label="Delete"
                        variant="danger"
                        onPress={async () => {
                          await removeTodo(item.id);
                          refresh();
                        }}
                      />
                    </View>
                  </Card>
                )}
              />
            </View>
            <View className="mt-3 shrink-0">
              {createDropdownContent}
            </View>
          </>
        ) : null}
      </View>
    </Screen>
  );
}
