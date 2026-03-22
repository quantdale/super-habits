import { MaterialIcons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";
import { Button } from "@/core/ui/Button";
import { Card } from "@/core/ui/Card";
import { DueDateBadge } from "./DueDateBadge";
import { PriorityBadge } from "./PriorityBadge";
import type { Todo } from "./types";

type Props = {
  todo: Todo;
  onLongPress: () => void;
  isActive: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onEdit: () => void;
};

export function TodoItem({ todo, onLongPress, isActive, onToggle, onDelete, onEdit }: Props) {
  const done = todo.completed === 1;

  return (
    <View style={{ opacity: isActive ? 0.85 : 1 }}>
      <Card>
        <View className="flex-row items-start gap-2">
          <Pressable
            onLongPress={onLongPress}
            delayLongPress={180}
            hitSlop={8}
            className="pt-0.5"
            accessibilityLabel="Drag to reorder"
          >
            <MaterialIcons name="drag-indicator" size={22} color="#94a3b8" />
          </Pressable>
          <Pressable onPress={onToggle} hitSlop={8} className="pt-0.5">
            <MaterialIcons
              name={done ? "check-box" : "check-box-outline-blank"}
              size={24}
              color={done ? "#64748b" : "#0f172a"}
            />
          </Pressable>
          <Pressable onPress={onToggle} className="min-w-0 flex-1">
            <View className="flex-row flex-wrap items-center gap-1">
              <Text className={`text-base ${done ? "text-slate-400 line-through" : "text-slate-900"}`}>
                {todo.title}
              </Text>
              {todo.recurrence === "daily" ? (
                <View className="ml-1 self-start rounded border border-brand-200 bg-brand-50 px-1.5 py-0.5">
                  <Text className="text-xs text-brand-500">↻ daily</Text>
                </View>
              ) : null}
            </View>
            {todo.notes ? <Text className="mt-1 text-sm text-slate-500">{todo.notes}</Text> : null}
            <View className="mt-2 flex-row flex-wrap gap-2">
              {todo.priority !== "normal" ? <PriorityBadge priority={todo.priority} /> : null}
              {todo.due_date ? <DueDateBadge dueDate={todo.due_date} /> : null}
            </View>
          </Pressable>
          <Pressable onPress={onEdit} hitSlop={8} className="pt-0.5">
            <MaterialIcons name="edit" size={22} color="#64748b" />
          </Pressable>
        </View>
        <View className="mt-3">
          <Button label="Delete" variant="danger" onPress={onDelete} />
        </View>
      </Card>
    </View>
  );
}
