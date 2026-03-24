import { useRef } from "react";
import { MaterialIcons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";
import { RectButton, Swipeable } from "react-native-gesture-handler";
import colors from "tailwindcss/colors";
import { Card } from "@/core/ui/Card";
import { SwipeRightActions } from "@/core/ui/SwipeRightActions";
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

  return (
    <View className="mb-3" style={{ opacity: isActive ? 0.85 : 1 }}>
      <Swipeable
        ref={swipeableRef}
        renderRightActions={() => (
          <SwipeRightActions
            editColor={SECTION_COLORS.todos}
            onEdit={() => {
              swipeableRef.current?.close();
              onEdit();
            }}
            onDelete={() => {
              swipeableRef.current?.close();
              onDelete();
            }}
          />
        )}
        rightThreshold={40}
        overshootRight={false}
      >
        <Card accentColor={SECTION_COLORS.todos} className="mb-0 flex-1">
          <View className="flex-row items-start gap-2">
            <Pressable
              onLongPress={onLongPress}
              delayLongPress={180}
              hitSlop={8}
              className="pt-0.5"
              accessibilityLabel="Drag to reorder"
            >
              <MaterialIcons name="drag-indicator" size={22} color={colors.slate[400]} />
            </Pressable>
            <RectButton
              onPress={onToggle}
              hitSlop={8}
              style={{ paddingTop: 2, backgroundColor: "transparent" }}
            >
              <MaterialIcons
                name={done ? "check-box" : "check-box-outline-blank"}
                size={24}
                color={done ? colors.slate[500] : colors.slate[900]}
              />
            </RectButton>
            <View style={{ flex: 1, minWidth: 0 }}>
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
            </View>
          </View>
        </Card>
      </Swipeable>
    </View>
  );
}
