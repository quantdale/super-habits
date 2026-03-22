import { useRef } from "react";
import { MaterialIcons } from "@expo/vector-icons";
import type { Animated } from "react-native";
import { Pressable, Text, View } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { Card } from "@/core/ui/Card";
import { SECTION_COLORS } from "@/constants/sectionColors";
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
  const swipeableRef = useRef<Swipeable>(null);

  const renderRightActions = (
    _progress: Animated.AnimatedInterpolation<number>,
    _dragX: Animated.AnimatedInterpolation<number>,
  ) => (
    <Pressable
      onPress={() => {
        swipeableRef.current?.close();
        onDelete();
      }}
      className="my-0.5 items-center justify-center rounded-r-xl bg-rose-500 px-6"
    >
      <Text className="text-sm font-medium text-white">Delete</Text>
    </Pressable>
  );

  return (
    <View style={{ opacity: isActive ? 0.85 : 1 }}>
      <Swipeable
        ref={swipeableRef}
        renderRightActions={renderRightActions}
        rightThreshold={40}
        overshootRight={false}
      >
        <Card accentColor={SECTION_COLORS.todos}>
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
                  <View className="ml-1 self-start rounded border border-todos bg-todos-light px-1.5 py-0.5">
                    <Text className="text-xs text-todos">↻ daily</Text>
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
        </Card>
      </Swipeable>
    </View>
  );
}
