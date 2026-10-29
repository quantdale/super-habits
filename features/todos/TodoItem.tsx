import { Text } from '@/core/ui/Text';
import { MaterialIcons } from '@expo/vector-icons';
import { Animated, Pressable, View } from 'react-native';
import { memo, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Swipeable } from 'react-native-gesture-handler';
import { MenuSheet } from '@/core/ui/MenuSheet';
import { SwipeRightActions } from '@/core/ui/SwipeRightActions';
import { useCheckBurst } from '@/core/ui/motion/useCheckBurst';
import { useAppTheme } from '@/core/providers/themeContext';
import { useMotionDuration, useReducedMotion } from '@/core/theme/motion';
import { radius, size, springs } from '@/core/theme/designTokens';
import { SECTION_COLORS, SECTION_HUES } from '@/constants/sectionColors';
import { toDateKey } from '@/lib/time';
import { buildTodoRowMeta, type TodoRowMetaTone } from './todos.domain';
import type { Todo } from './types';

type Props = {
  todo: Todo;
  /** Long-press starts drag-reorder when manual order is active. */
  onLongPress: () => void;
  isActive: boolean;
  onToggle: () => void;
  onDelete: () => void;
  /** Row disclosure: tapping the row opens the task editor. */
  onEdit: () => void;
  /** Resolved project name for the metadata line (omitted when unknown). */
  projectName?: string | null;
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
      className="h-11 w-11 items-center justify-center rounded-full"
    >
      <MaterialIcons name="more-vert" size={20} color={tokens.iconMuted} />
    </Pressable>
  );
}

/**
 * The v2 chunky completion control (Playful Momentum §6 CheckNode visual):
 * a 32px face circle with a 2px border riding a 2px lip — done = Sky bright
 * fill, white ✓ glyph, lip = the Sky solid. The 48pt semantic wrapper keeps
 * the checkbox contract (role, label, checked state) and is the measured
 * touch target (`todos-convergence` asserts the role box ≥ 48).
 *
 * The completion pop + 6-dot burst ride `useCheckBurst` (Reanimated worklets,
 * §5.8 `light` row), so the celebration runs off the JS critical path and
 * never delays the state update or the durable write. Reduced motion: no
 * scale, no dots — state change is instant.
 */
function TodoCheckControl({
  title,
  done,
  onPress,
}: {
  title: string;
  done: boolean;
  onPress: () => void;
}) {
  const { tokens } = useAppTheme();
  const reducedMotion = useReducedMotion();
  const burst = useCheckBurst();
  const [scale] = useState(() => new Animated.Value(1));
  const circleSize = 32;
  const targetSize = size.touchTargetMin;
  const hue = SECTION_HUES.todos;

  const settle = (toValue: number) => {
    if (reducedMotion) {
      scale.setValue(toValue);
      return;
    }
    Animated.spring(scale, { toValue, useNativeDriver: true, ...springs.press }).start();
  };

  const handlePress = () => {
    // Juice follows causality (§4): the burst fires from the touched control
    // and the toggle commits immediately — the pop never gates persistence.
    burst.trigger();
    onPress();
  };

  return (
    <Pressable
      onPress={handlePress}
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
      <View style={{ width: circleSize, height: circleSize + 2 }}>
        {/* Lip slab (§5.7): the Sky solid under the face, collapsing on press. */}
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 2,
            height: circleSize,
            borderRadius: radius.full,
            backgroundColor: done ? hue.lip : tokens.borderStrong,
          }}
        />
        {burst.burstCount > 0 ? (
          <Animated.View
            pointerEvents="none"
            style={[
              burst.burstStyle,
              {
                position: 'absolute',
                top: 0,
                left: 0,
                width: circleSize,
                height: circleSize,
              },
            ]}
          >
            {Array.from({ length: burst.burstCount }, (_, index) => {
              const angle = (index / burst.burstCount) * Math.PI * 2;
              return (
                <View
                  key={index}
                  style={{
                    position: 'absolute',
                    top: circleSize / 2 - 2.5 + Math.sin(angle) * 22,
                    left: circleSize / 2 - 2.5 + Math.cos(angle) * 22,
                    width: 5,
                    height: 5,
                    borderRadius: radius.full,
                    backgroundColor: hue.bright,
                  }}
                />
              );
            })}
          </Animated.View>
        ) : null}
        <Animated.View
          style={{
            width: circleSize,
            height: circleSize,
            borderRadius: circleSize / 2,
            borderWidth: 2,
            borderColor: done ? hue.bright : tokens.border,
            backgroundColor: done ? hue.bright : tokens.surface,
            alignItems: 'center',
            justifyContent: 'center',
            transform: [{ scale }],
          }}
        >
          {done ? (
            <MaterialIcons name="check" size={circleSize * 0.6} color={tokens.onSolid} />
          ) : null}
        </Animated.View>
      </View>
    </Pressable>
  );
}

function metaToneColor(tone: TodoRowMetaTone, tokens: ReturnType<typeof useAppTheme>['tokens']) {
  if (tone === 'danger') return tokens.dangerText;
  if (tone === 'warning') return tokens.warningText;
  return tokens.textMuted;
}

/**
 * Flat V3 list row (docs/ui-ux/13 §6/§8): 48–56pt standard anatomy — check +
 * title + at most one compact metadata line, hairline separator, no card
 * geometry. A plain task is just checkbox + title; state is carried by quiet
 * text (never a fully tinted row). Tap opens the task editor (row disclosure),
 * long-press starts drag-reorder when manual order is active.
 */
export const TodoItem = memo(function TodoItem({
  todo,
  onLongPress,
  isActive,
  onToggle,
  onDelete,
  onEdit,
  projectName = null,
}: Props) {
  const { tokens } = useAppTheme();
  const done = todo.completed === 1;
  const [menuVisible, setMenuVisible] = useState(false);
  const reducedMotion = useReducedMotion();
  const settleDuration = useMotionDuration('feedback');
  const prevDoneRef = useRef(done);
  const [settleOpacity] = useState(() => new Animated.Value(1));
  const swipeableRef = useRef<Swipeable>(null);
  const todayKey = toDateKey();
  const metaItems = buildTodoRowMeta(todo, todayKey, { projectName });

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
  const titleWeight = done ? '600' : '700';

  let metaLine: ReactNode = null;
  if (metaItems.length > 0) {
    metaLine = (
      <Text variant="caption" numberOfLines={1} className="mt-0.5">
        {metaItems.map((item, index) => (
          <Text
            key={item.key}
            variant="caption"
            style={{ color: metaToneColor(item.tone, tokens) }}
          >
            {index > 0 ? ' · ' : ''}
            {item.text}
          </Text>
        ))}
      </Text>
    );
  }

  return (
    <>
      <Animated.View style={{ opacity: settleOpacity }}>
        <Swipeable
          ref={swipeableRef}
          renderRightActions={() => (
            <SwipeRightActions
              editColor={SECTION_COLORS.todos}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          )}
          rightThreshold={40}
          overshootRight={false}
        >
          <Pressable
            onPress={onEdit}
            onLongPress={onLongPress}
            delayLongPress={180}
            accessibilityRole="button"
            accessibilityLabel={`Edit task: ${todo.title}`}
            accessibilityHint="Opens task details"
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              paddingVertical: 3,
              paddingLeft: 2,
              paddingRight: 2,
              backgroundColor: isActive ? tokens.surfaceElevated : 'transparent',
              opacity: isActive ? 0.85 : 1,
              borderBottomWidth: 1,
              borderBottomColor: tokens.border,
            }}
          >
            <TodoCheckControl title={todo.title} done={done} onPress={onToggle} />
            <View className="min-w-0 flex-1">
              <Text
                variant="bodyMd"
                className={done ? 'line-through' : ''}
                style={{ color: titleColor, fontWeight: titleWeight }}
              >
                {todo.title}
              </Text>
              {metaLine}
            </View>
            <RowMoreButton title={todo.title} onPress={openMenu} />
          </Pressable>
        </Swipeable>
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
    previous.projectName === next.projectName &&
    previous.isActive === next.isActive
  );
}
