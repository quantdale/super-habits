import { MaterialIcons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";
import { RectButton } from "react-native-gesture-handler";
import { SwipeableCard } from "@/core/ui/SwipeableCard";
import { SECTION_COLORS } from "@/constants/sectionColors";
import { useAppTheme } from "@/core/theme";
import { DueDateBadge } from "./DueDateBadge";
import { PriorityBadge } from "./PriorityBadge";
import type { Todo, TodoViewMode } from "./types";

type Props = {
  todo: Todo;
  onLongPress: () => void;
  isActive: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onEdit: () => void;
  viewMode?: TodoViewMode;
  cardWidth?: number;
};

export function TodoItem({
  todo,
  onLongPress,
  isActive,
  onToggle,
  onDelete,
  onEdit,
  viewMode = "content",
  cardWidth,
}: Props) {
  const { colors, getSectionColors } = useAppTheme();
  const section = getSectionColors("todos");
  const done = todo.completed === 1;
  const checkboxColor = done ? colors.textSubtle : colors.text;

  if (viewMode === "grid") {
    return (
      <SwipeableCard
        accentColor={SECTION_COLORS.todos}
        style={{ width: cardWidth, margin: 2, opacity: isActive ? 0.85 : 1 }}
        compact
        onEdit={onEdit}
        onDelete={onDelete}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Pressable onLongPress={onLongPress} delayLongPress={180} hitSlop={6} accessibilityLabel="Drag to reorder">
            <MaterialIcons name="drag-indicator" size={18} color={colors.iconMuted} />
          </Pressable>
          <RectButton onPress={onToggle} hitSlop={6} style={{ backgroundColor: "transparent" }}>
            <MaterialIcons
              name={done ? "check-box" : "check-box-outline-blank"}
              size={18}
              color={checkboxColor}
            />
          </RectButton>
          <Text
            numberOfLines={2}
            style={{ flex: 1, fontSize: 12, color: done ? colors.textSubtle : colors.text }}
            className={done ? "line-through" : ""}
          >
            {todo.title}
          </Text>
        </View>
      </SwipeableCard>
    );
  }

  if (viewMode === "list") {
    return (
      <SwipeableCard
        accentColor={SECTION_COLORS.todos}
        style={{ marginBottom: 6, opacity: isActive ? 0.85 : 1 }}
        onEdit={onEdit}
        onDelete={onDelete}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Pressable onLongPress={onLongPress} delayLongPress={180} hitSlop={8} accessibilityLabel="Drag to reorder">
            <MaterialIcons name="drag-indicator" size={18} color={colors.iconMuted} />
          </Pressable>
          <RectButton onPress={onToggle} hitSlop={8} style={{ backgroundColor: "transparent" }}>
            <MaterialIcons
              name={done ? "check-box" : "check-box-outline-blank"}
              size={20}
              color={checkboxColor}
            />
          </RectButton>
          <Text
            numberOfLines={1}
            style={{ flex: 1, fontSize: 14, color: done ? colors.textSubtle : colors.text }}
            className={done ? "line-through" : ""}
          >
            {todo.title}
          </Text>
          <View style={{ flexDirection: "row", gap: 4, alignItems: "center" }}>
            {todo.recurrence === "daily" ? (
              <Text style={{ fontSize: 10, color: colors.textSubtle }}>↻</Text>
            ) : null}
            {todo.priority !== "normal" ? <PriorityBadge priority={todo.priority} compact /> : null}
            {todo.due_date ? <DueDateBadge dueDate={todo.due_date} compact /> : null}
          </View>
        </View>
      </SwipeableCard>
    );
  }

  return (
    <SwipeableCard
      accentColor={SECTION_COLORS.todos}
      style={{ marginBottom: 12, opacity: isActive ? 0.85 : 1 }}
      onEdit={onEdit}
      onDelete={onDelete}
    >
      <View className="flex-row items-start gap-2">
        <Pressable
          onLongPress={onLongPress}
          delayLongPress={180}
          hitSlop={8}
          className="pt-0.5"
          accessibilityLabel="Drag to reorder"
        >
          <MaterialIcons name="drag-indicator" size={22} color={colors.iconMuted} />
        </Pressable>
        <RectButton onPress={onToggle} hitSlop={8} style={{ paddingTop: 2, backgroundColor: "transparent" }}>
          <MaterialIcons
            name={done ? "check-box" : "check-box-outline-blank"}
            size={24}
            color={checkboxColor}
          />
        </RectButton>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View className="flex-row flex-wrap items-center gap-1">
            <Text className="text-base" style={{ color: done ? colors.textSubtle : colors.text }}>
              {todo.title}
            </Text>
            {todo.recurrence === "daily" ? (
              <View
                className="ml-1 self-start rounded border px-1.5 py-0.5"
                style={{ borderColor: section.border, backgroundColor: section.surface }}
              >
                <Text className="text-xs" style={{ color: section.text }}>
                  ↻ daily
                </Text>
              </View>
            ) : null}
          </View>
          {todo.notes ? (
            <Text className="mt-1 text-sm" style={{ color: colors.textMuted }}>
              {todo.notes}
            </Text>
          ) : null}
          <View className="mt-2 flex-row flex-wrap gap-2">
            {todo.priority !== "normal" ? <PriorityBadge priority={todo.priority} /> : null}
            {todo.due_date ? <DueDateBadge dueDate={todo.due_date} /> : null}
          </View>
        </View>
      </View>
    </SwipeableCard>
  );
}
