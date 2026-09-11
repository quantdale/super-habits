import { Text } from '@/core/ui/Text';
import { MaterialIcons } from '@expo/vector-icons';
import { Animated, Pressable, View } from 'react-native';
import { memo, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Swipeable } from 'react-native-gesture-handler';
import { Card } from '@/core/ui/Card';
import { MenuSheet } from '@/core/ui/MenuSheet';
import { SwipeRightActions } from '@/core/ui/SwipeRightActions';
import { useAppTheme } from '@/core/providers/themeContext';
import { useMotionDuration, useReducedMotion } from '@/core/theme/motion';
import { spacing, springs, size } from '@/core/theme/designTokens';
import { SECTION_COLORS } from '@/constants/sectionColors';
import { toDateKey } from '@/lib/time';
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
      className="h-10 w-10 items-center justify-center rounded-full"
    >
      <MaterialIcons name="more-vert" size={20} color={tokens.iconMuted} />
    </Pressable>
  );
}

/**
 * The chunky circular completion control. Sinks slightly under the finger and
 * pops with a spring when the todo flips to done; under Reduce Motion the state
 * change is instant.
 *
 * The Pressable keeps the semantic checkbox contract (role, label, checked
 * state) exactly as the previous square control did, and stays a 48pt target.
 */
function TodoCheckControl({
  title,
  done,
  onPress,
  compact = false,
}: {
  title: string;
  done: boolean;
  onPress: () => void;
  compact?: boolean;
}) {
  const { tokens, sectionAccents } = useAppTheme();
  const reducedMotion = useReducedMotion();
  const [scale] = useState(() => new Animated.Value(1));
  const wasDoneRef = useRef(done);
  const circleSize = compact ? 26 : 34;
  const targetSize = compact ? 34 : size.touchTargetMin;

  useEffect(() => {
    const wasDone = wasDoneRef.current;
    wasDoneRef.current = done;
    if (wasDone === done) return;
    if (reducedMotion || !done) {
      scale.setValue(1);
      return;
    }
    scale.setValue(0.76);
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, ...springs.pop }).start();
  }, [done, reducedMotion, scale]);

  const settle = (toValue: number) => {
    if (reducedMotion) {
      scale.setValue(toValue);
      return;
    }
    Animated.spring(scale, { toValue, useNativeDriver: true, ...springs.press }).start();
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => settle(0.88)}
      onPressOut={() => settle(1)}
      hitSlop={6}
      accessibilityRole="checkbox"
      accessibilityLabel={`${done ? 'Mark incomplete' : 'Mark complete'}: ${title}`}
      accessibilityState={{ checked: done }}
      aria-checked={done}
      style={{
        width: targetSize,
        height: targetSize,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Animated.View
        style={{
          width: circleSize,
          height: circleSize,
          borderRadius: circleSize / 2,
          borderWidth: 2.5,
          borderColor: done ? sectionAccents.todos.fill : tokens.borderStrong,
          backgroundColor: done ? sectionAccents.todos.fill : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
          transform: [{ scale }],
        }}
      >
        {done ? (
          <MaterialIcons name="check" size={circleSize * 0.58} color={tokens.onSolid} />
        ) : null}
      </Animated.View>
    </Pressable>
  );
}

/** Recurrence pill; keeps the literal `↻ daily` copy the journey suite asserts. */
function RecurringBadge({ compact = false }: { compact?: boolean }) {
  const { sectionAccents } = useAppTheme();
  return (
    <View
      className={`self-start rounded-full ${compact ? 'px-2 py-0.5' : 'px-2.5 py-1'}`}
      style={{ backgroundColor: sectionAccents.todos.tint }}
    >
      <Text variant="label" style={{ color: sectionAccents.todos.text, fontSize: 11 }}>
        {compact ? '↻' : '↻ daily'}
      </Text>
    </View>
  );
}

/**
 * Pop row: a generously rounded, state-tinted card tile with a chunky circular
 * check control. Swipe actions and the visible overflow menu still cover
 * edit/delete, and long-press on the grip still starts drag-reorder.
 */
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
  const today = toDateKey();
  const isOverdue = !done && !!todo.due_date && todo.due_date < today;
  const isDueToday = !done && todo.due_date === today;
  const stateAccent = isOverdue
    ? tokens.dangerSolid
    : isDueToday
      ? sectionAccents.calories.fill
      : undefined;
  const tileFill = isOverdue
    ? tokens.dangerBackground
    : isDueToday
      ? tokens.warningBackground
      : tokens.surface;
  const hasBadges = todo.recurrence === 'daily' || todo.priority !== 'normal' || !!todo.due_date;
  const [menuVisible, setMenuVisible] = useState(false);
  const reducedMotion = useReducedMotion();
  const settleDuration = useMotionDuration('feedback');
  const prevDoneRef = useRef(done);
  const [settleOpacity] = useState(() => new Animated.Value(1));
  const swipeableRef = useRef<Swipeable>(null);

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
  const handleEdit = useCallback(() => {
    swipeableRef.current?.close();
    onEdit();
  }, [onEdit]);
  const handleDelete = useCallback(() => {
    swipeableRef.current?.close();
    onDelete();
  }, [onDelete]);

  const titleColor = done ? tokens.textMuted : tokens.text;
  const checkControl = (
    <TodoCheckControl
      title={todo.title}
      done={done}
      onPress={onToggle}
      compact={viewMode === 'grid'}
    />
  );
  const dragHandle = (
    <Pressable
      onLongPress={onLongPress}
      delayLongPress={180}
      hitSlop={8}
      accessibilityLabel={`Reorder ${todo.title}`}
      className={viewMode === 'content' ? 'pt-3' : ''}
    >
      <MaterialIcons
        name="drag-indicator"
        size={viewMode === 'grid' ? 18 : 22}
        color={tokens.iconMuted}
      />
    </Pressable>
  );

  let row: ReactNode;
  if (viewMode === 'grid') {
    row = (
      <View className="flex-row items-start gap-2">
        {dragHandle}
        {checkControl}
        <View className="min-w-0 flex-1 gap-1">
          <Text
            numberOfLines={2}
            variant="caption"
            className={`leading-4 ${done ? 'line-through' : ''}`}
            style={{ color: titleColor }}
          >
            {todo.title}
          </Text>
          {hasBadges ? (
            <View className="flex-row flex-wrap items-center gap-1">
              {todo.priority !== 'normal' ? (
                <PriorityBadge priority={todo.priority} compact />
              ) : null}
              {todo.due_date ? <DueDateBadge dueDate={todo.due_date} compact /> : null}
            </View>
          ) : null}
          <View className="flex-row items-center justify-end">
            <RowMoreButton title={todo.title} onPress={openMenu} />
          </View>
        </View>
      </View>
    );
  } else if (viewMode === 'list') {
    row = (
      <View className="flex-row items-center gap-2">
        {dragHandle}
        {checkControl}
        <Text
          numberOfLines={1}
          variant="bodyMd"
          className={`min-w-0 flex-1 ${done ? 'line-through' : ''}`}
          style={{ color: titleColor }}
        >
          {todo.title}
        </Text>
        <View className="flex-row items-center gap-1">
          {todo.recurrence === 'daily' ? <RecurringBadge compact /> : null}
          {todo.priority !== 'normal' ? <PriorityBadge priority={todo.priority} compact /> : null}
          {todo.due_date ? <DueDateBadge dueDate={todo.due_date} compact /> : null}
        </View>
        <RowMoreButton title={todo.title} onPress={openMenu} />
      </View>
    );
  } else {
    // content (default)
    row = (
      <View className="flex-row items-start gap-2">
        {dragHandle}
        {checkControl}
        <View className="min-w-0 flex-1">
          <Text
            variant="bodyLg"
            className={done ? 'line-through' : ''}
            style={{ color: titleColor }}
          >
            {todo.title}
          </Text>
          {todo.notes ? (
            <Text variant="bodyMd" tone="muted" className="mt-1" numberOfLines={2}>
              {todo.notes}
            </Text>
          ) : null}
          {hasBadges ? (
            <View className="mt-2 flex-row flex-wrap items-center gap-2">
              {todo.recurrence === 'daily' ? <RecurringBadge /> : null}
              {todo.priority !== 'normal' ? <PriorityBadge priority={todo.priority} /> : null}
              {todo.due_date ? <DueDateBadge dueDate={todo.due_date} /> : null}
            </View>
          ) : null}
        </View>
        <RowMoreButton title={todo.title} onPress={openMenu} />
      </View>
    );
  }

  const containerStyle =
    viewMode === 'grid'
      ? { width: cardWidth, margin: 2, opacity: isActive ? 0.85 : 1 }
      : { marginBottom: viewMode === 'list' ? spacing.sm : 10, opacity: isActive ? 0.85 : 1 };

  return (
    <>
      <Animated.View style={{ opacity: settleOpacity }}>
        <Card
          variant="standard"
          accentColor={stateAccent}
          className="mb-0 overflow-hidden"
          innerClassName="p-0"
          style={containerStyle}
        >
          <Swipeable
            ref={swipeableRef}
            renderRightActions={() => (
              <SwipeRightActions
                editColor={SECTION_COLORS.todos}
                onEdit={handleEdit}
                onDelete={handleDelete}
                compact={viewMode === 'grid'}
              />
            )}
            rightThreshold={40}
            overshootRight={false}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'stretch',
                backgroundColor: tileFill,
              }}
            >
              <View style={{ width: 4, backgroundColor: stateAccent ?? SECTION_COLORS.todos }} />
              <View
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  paddingLeft: 12,
                  paddingRight: 16,
                }}
              >
                {row}
              </View>
            </View>
          </Swipeable>
        </Card>
      </Animated.View>
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
