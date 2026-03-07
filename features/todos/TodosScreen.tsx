import { useCallback, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { FlashList } from "@shopify/flash-list";
import { Screen } from "@/core/ui/Screen";
import { Card } from "@/core/ui/Card";
import { TextField } from "@/core/ui/TextField";
import { Button } from "@/core/ui/Button";
import { SectionTitle } from "@/core/ui/SectionTitle";
import { Todo } from "@/core/db/types";
import { addTodo, listTodos, removeTodo, toggleTodo } from "@/features/todos/todos.data";

export function TodosScreen() {
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<Todo[]>([]);

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

  return (
    <Screen>
      <SectionTitle title="To-do List" subtitle="Offline-first task manager." />
      <Card>
        <TextField label="Title" value={title} onChangeText={setTitle} placeholder="Add a task..." />
        <TextField label="Notes" value={notes} onChangeText={setNotes} placeholder="Optional notes" />
        <Button label="Add task" onPress={onCreate} />
      </Card>

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
        ListEmptyComponent={<Text className="mt-8 text-center text-slate-500">No tasks yet.</Text>}
      />
    </Screen>
  );
}
