import { MaterialIcons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';
import { RectButton } from 'react-native-gesture-handler';
import { SECTION_COLORS, SECTION_TEXT_COLORS } from '@/constants/sectionColors';
import { useAppTheme } from '@/core/providers/ThemeProvider';
import { SwipeableCard } from '@/core/ui/SwipeableCard';
import { DueDateBadge } from './DueDateBadge';
import { PriorityBadge } from './PriorityBadge';
import type { Todo, TodoViewMode } from './types';

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
  viewMode = 'content',
  cardWidth,
}: Props) {
  const { tokens } = useAppTheme();
  const done = todo.completed === 1;
  const recurringTint = `${SECTION_COLORS.todos}18`;

  if (viewMode === 'grid') {
    return (
      <SwipeableCard
        accentColor={SECTION_COLORS.todos}
        style={{ width: cardWidth, margin: 2, opacity: isActive ? 0.85 : 1 }}
        compact
        onEdit={onEdit}
        onDelete={onDelete}
      >
        <View className="flex-row items-start gap-2">
          <Pressable
            onLongPress={onLongPress}
            delayLongPress={180}
            hitSlop={6}
            accessibilityLabel="Drag to reorder"
            className="pt-0.5"
          >
            <MaterialIcons name="drag-indicator" size={18} color={tokens.iconMuted} />
          </Pressable>
          <RectButton onPress={onToggle} hitSlop={6} style={{ backgroundColor: 'transparent' }}>
            <MaterialIcons
              name={done ? 'check-box' : 'check-box-outline-blank'}
              size={18}
              color={done ? tokens.iconMuted : tokens.text}
            />
          </RectButton>
          <View className="min-w-0 flex-1 gap-1">
            <Text
              numberOfLines={2}
              className={`text-xs leading-4 ${done ? 'line-through' : ''}`}
              style={{ color: done ? tokens.textMuted : tokens.text }}
            >
              {todo.title}
            </Text>
            {todo.priority !== 'normal' || todo.due_date ? (
              <View className="flex-row flex-wrap gap-1">
                {todo.priority !== 'normal' ? (
                  <PriorityBadge priority={todo.priority} compact />
                ) : null}
                {todo.due_date ? <DueDateBadge dueDate={todo.due_date} compact /> : null}
              </View>
            ) : null}
          </View>
        </View>
      </SwipeableCard>
    );
  }

  if (viewMode === 'list') {
    return (
      <SwipeableCard
        accentColor={SECTION_COLORS.todos}
        style={{ marginBottom: 8, opacity: isActive ? 0.85 : 1 }}
        onEdit={onEdit}
        onDelete={onDelete}
      >
        <View className="flex-row items-center gap-2">
          <Pressable
            onLongPress={onLongPress}
            delayLongPress={180}
            hitSlop={8}
            accessibilityLabel="Drag to reorder"
          >
            <MaterialIcons name="drag-indicator" size={18} color={tokens.iconMuted} />
          </Pressable>
          <RectButton onPress={onToggle} hitSlop={8} style={{ backgroundColor: 'transparent' }}>
            <MaterialIcons
              name={done ? 'check-box' : 'check-box-outline-blank'}
              size={20}
              color={done ? tokens.iconMuted : tokens.text}
            />
          </RectButton>
          <Text
            numberOfLines={1}
            style={{ flex: 1, fontSize: 14, color: done ? tokens.textMuted : tokens.text }}
            className={done ? 'line-through' : ''}
          >
            {todo.title}
          </Text>
          <View className="flex-row items-center gap-1">
            {todo.recurrence === 'daily' ? (
              <View className="rounded-full px-2 py-1" style={{ backgroundColor: recurringTint }}>
                <Text
                  className="text-[10px] font-semibold"
                  style={{ color: SECTION_TEXT_COLORS.todos }}
                >
                  ↻
                </Text>
              </View>
            ) : null}
            {todo.priority !== 'normal' ? <PriorityBadge priority={todo.priority} compact /> : null}
            {todo.due_date ? <DueDateBadge dueDate={todo.due_date} compact /> : null}
          </View>
        </View>
      </SwipeableCard>
    );
  }

  // content (default)
  return (
    <SwipeableCard
      accentColor={SECTION_COLORS.todos}
      style={{ marginBottom: 10, opacity: isActive ? 0.85 : 1 }}
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
          <MaterialIcons name="drag-indicator" size={22} color={tokens.iconMuted} />
        </Pressable>
        <RectButton
          onPress={onToggle}
          hitSlop={8}
          style={{ paddingTop: 2, backgroundColor: 'transparent' }}
        >
          <MaterialIcons
            name={done ? 'check-box' : 'check-box-outline-blank'}
            size={24}
            color={done ? tokens.iconMuted : tokens.text}
          />
        </RectButton>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View className="flex-row flex-wrap items-center gap-2">
            <Text
              className={`text-[15px] font-semibold ${done ? 'line-through' : ''}`}
              style={{ color: done ? tokens.textMuted : tokens.text }}
            >
              {todo.title}
            </Text>
            {todo.recurrence === 'daily' ? (
              <View
                className="self-start rounded-full px-2.5 py-1"
                style={{ backgroundColor: recurringTint }}
              >
                <Text
                  className="text-[11px] font-semibold"
                  style={{ color: SECTION_TEXT_COLORS.todos }}
                >
                  ↻ daily
                </Text>
              </View>
            ) : null}
          </View>
          {todo.notes ? (
            <Text className="mt-1 text-sm" style={{ color: tokens.textMuted }}>
              {todo.notes}
            </Text>
          ) : null}
          <View className="mt-2 flex-row flex-wrap gap-2">
            {todo.priority !== 'normal' ? <PriorityBadge priority={todo.priority} /> : null}
            {todo.due_date ? <DueDateBadge dueDate={todo.due_date} /> : null}
          </View>
        </View>
      </View>
    </SwipeableCard>
  );
}
