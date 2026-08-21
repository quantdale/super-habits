import { MaterialIcons } from '@expo/vector-icons';
import { Animated, Pressable, Text, View } from 'react-native';
import { memo, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { SECTION_COLORS } from '@/constants/sectionColors';
import { useAppTheme } from '@/core/providers/themeContext';
import { useMotionDuration, useReducedMotion } from '@/core/theme/motion';
import { MenuSheet } from '@/core/ui/MenuSheet';
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

/**
 * Trailing "more" control giving every row a non-gesture route to Edit/Delete
 * (Design DNA §15: swipe/drag always has an equivalent visible control).
 */
function RowMoreButton({ title, onPress }: { title: string; onPress: () => void }) {
  const { tokens } = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`More actions for ${title}`}
      hitSlop={6}
      className="h-8 w-8 items-center justify-center rounded-full"
    >
      <MaterialIcons name="more-vert" size={20} color={tokens.iconMuted} />
    </Pressable>
  );
}

export const TodoItem = memo(function TodoItem({
  todo,
  onLongPress,
  isActive,
  onToggle,
  onDelete,
  onEdit,
  viewMode = 'content',
  cardWidth,
}: Props) {
  const { tokens, sectionAccents } = useAppTheme();
  const done = todo.completed === 1;
  const recurringTint = `${SECTION_COLORS.todos}18`;
  const [menuVisible, setMenuVisible] = useState(false);
  const reducedMotion = useReducedMotion();
  const settleDuration = useMotionDuration('feedback');
  const prevDoneRef = useRef(done);
  const [settleOpacity] = useState(() => new Animated.Value(1));

  // Completion settle: a brief opacity dip-and-recover when the row flips to
  // done. Purely cosmetic — skipped entirely under Reduce Motion and never
  // gates interaction (the row stays tappable while it plays).
  useEffect(() => {
    const wasDone = prevDoneRef.current;
    prevDoneRef.current = done;
    if (wasDone || !done || reducedMotion) {
      return;
    }
    settleOpacity.setValue(0.4);
    Animated.timing(settleOpacity, {
      toValue: 1,
      duration: settleDuration,
      useNativeDriver: true,
    }).start();
  }, [done, reducedMotion, settleDuration, settleOpacity]);

  const openMenu = useCallback(() => setMenuVisible(true), []);
  const closeMenu = useCallback(() => setMenuVisible(false), []);

  let row: ReactNode;
  if (viewMode === 'grid') {
    row = (
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
            accessibilityLabel={`Reorder ${todo.title}`}
            className="pt-0.5"
          >
            <MaterialIcons name="drag-indicator" size={18} color={tokens.iconMuted} />
          </Pressable>
          <Pressable
            onPress={onToggle}
            hitSlop={6}
            accessibilityRole="checkbox"
            accessibilityLabel={`${done ? 'Mark incomplete' : 'Mark complete'}: ${todo.title}`}
            accessibilityState={{ checked: done }}
            aria-checked={done}
            style={{ backgroundColor: 'transparent' }}
          >
            <MaterialIcons
              name={done ? 'check-box' : 'check-box-outline-blank'}
              size={18}
              color={done ? tokens.iconMuted : tokens.text}
            />
          </Pressable>
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
          <RowMoreButton title={todo.title} onPress={openMenu} />
        </View>
      </SwipeableCard>
    );
  } else if (viewMode === 'list') {
    row = (
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
            accessibilityLabel={`Reorder ${todo.title}`}
          >
            <MaterialIcons name="drag-indicator" size={18} color={tokens.iconMuted} />
          </Pressable>
          <Pressable
            onPress={onToggle}
            hitSlop={8}
            accessibilityRole="checkbox"
            accessibilityLabel={`${done ? 'Mark incomplete' : 'Mark complete'}: ${todo.title}`}
            accessibilityState={{ checked: done }}
            aria-checked={done}
            style={{ backgroundColor: 'transparent' }}
          >
            <MaterialIcons
              name={done ? 'check-box' : 'check-box-outline-blank'}
              size={20}
              color={done ? tokens.iconMuted : tokens.text}
            />
          </Pressable>
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
                  style={{ color: sectionAccents.todos.text }}
                >
                  ↻
                </Text>
              </View>
            ) : null}
            {todo.priority !== 'normal' ? <PriorityBadge priority={todo.priority} compact /> : null}
            {todo.due_date ? <DueDateBadge dueDate={todo.due_date} compact /> : null}
          </View>
          <RowMoreButton title={todo.title} onPress={openMenu} />
        </View>
      </SwipeableCard>
    );
  } else {
    // content (default)
    row = (
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
            accessibilityLabel={`Reorder ${todo.title}`}
          >
            <MaterialIcons name="drag-indicator" size={22} color={tokens.iconMuted} />
          </Pressable>
          <Pressable
            onPress={onToggle}
            hitSlop={8}
            accessibilityRole="checkbox"
            accessibilityLabel={`${done ? 'Mark incomplete' : 'Mark complete'}: ${todo.title}`}
            accessibilityState={{ checked: done }}
            aria-checked={done}
            style={{ paddingTop: 2, backgroundColor: 'transparent' }}
          >
            <MaterialIcons
              name={done ? 'check-box' : 'check-box-outline-blank'}
              size={24}
              color={done ? tokens.iconMuted : tokens.text}
            />
          </Pressable>
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
                    style={{ color: sectionAccents.todos.text }}
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
          <RowMoreButton title={todo.title} onPress={openMenu} />
        </View>
      </SwipeableCard>
    );
  }

  return (
    <>
      <Animated.View style={{ opacity: settleOpacity }}>{row}</Animated.View>
      <MenuSheet
        visible={menuVisible}
        onClose={closeMenu}
        title={todo.title}
        items={[
          { icon: 'edit', label: 'Edit', onPress: onEdit },
          { icon: 'delete', label: 'Delete', destructive: true, onPress: onDelete },
        ]}
      />
    </>
  );
}, areTodoItemPropsEqual);

function areTodoItemPropsEqual(previous: Props, next: Props): boolean {
  return (
    previous.todo.id === next.todo.id &&
    previous.todo.updated_at === next.todo.updated_at &&
    previous.todo.completed === next.todo.completed &&
    previous.todo.sort_order === next.todo.sort_order &&
    previous.todo.due_date === next.todo.due_date &&
    previous.todo.deleted_at === next.todo.deleted_at &&
    previous.viewMode === next.viewMode &&
    previous.cardWidth === next.cardWidth &&
    previous.isActive === next.isActive
  );
}
