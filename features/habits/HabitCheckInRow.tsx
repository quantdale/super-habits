import { Pressable, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { MaterialIcons } from '@expo/vector-icons';
import { Text } from '@/core/ui/Text';
import { useAppTheme } from '@/core/providers/themeContext';
import { useKeyboardFocusRing } from '@/core/ui/useKeyboardFocusRing';
import { useCheckBurst } from '@/core/ui/motion/useCheckBurst';
import { radius } from '@/core/theme/designTokens';
import { SECTION_HUES } from '@/constants/sectionColors';
import type { HabitCheckInRowModel } from './habitCheckIn.domain';
import type { Habit } from './types';
import { useHabitCheckboxKeyboard } from './useHabitCheckboxKeyboard';
import { ProgressRing } from './ProgressRing';

type Props = {
  habit: Habit;
  row: HabitCheckInRowModel;
  busy?: boolean;
  onIncrement: () => void;
  onDecrement: () => void;
  onOpen: () => void;
};

/** §6 CheckNode geometry: 32px face + 2px lip inside a 48pt target. */
const NODE_FACE = 32;
const HUE = SECTION_HUES.habits;

function BurstDots({ burst }: { burst: ReturnType<typeof useCheckBurst> }) {
  const dotSpread = useAnimatedStyle(() => ({
    transform: [{ scale: Math.max(0.01, burst.burstProgress.value) }],
  }));
  if (burst.burstCount === 0) return null;
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        burst.burstStyle,
        dotSpread,
        {
          position: 'absolute',
          top: 0,
          left: 0,
          width: NODE_FACE,
          height: NODE_FACE,
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
              top: NODE_FACE / 2 - 2.5 + Math.sin(angle) * 22,
              left: NODE_FACE / 2 - 2.5 + Math.cos(angle) * 22,
              width: 5,
              height: 5,
              borderRadius: radius.full,
              backgroundColor: HUE.bright,
            }}
          />
        );
      })}
    </Animated.View>
  );
}

/**
 * The trailing binary check node (Playful Momentum §6 CheckNode visual, kept
 * feature-local so the W7 contracts hold): a 32px face with a 2px lip riding
 * the 48pt semantic checkbox wrapper (role, label, checked state are the
 * measured contract). Pressing plays the check-in burst via `useCheckBurst`
 * and commits immediately — the pop never gates the durable write. Reduced
 * motion: opacity cross-fade only, no scale, no dots.
 */
function HabitCheckNode({
  checked,
  disabled,
  busy,
  label,
  onToggle,
}: {
  checked: boolean;
  disabled: boolean;
  busy: boolean;
  label: string;
  onToggle: () => void;
}) {
  const { tokens } = useAppTheme();
  const burst = useCheckBurst();
  const focus = useKeyboardFocusRing(HUE.bright);
  const activate = () => {
    if (disabled) return;
    burst.trigger();
    onToggle();
  };
  const actionRef = useHabitCheckboxKeyboard(true, disabled, activate);
  return (
    <Pressable
      ref={actionRef}
      onPress={activate}
      disabled={disabled}
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      aria-checked={checked}
      aria-busy={busy}
      accessibilityState={{ disabled, busy, checked }}
      onFocus={focus.onFocus}
      onBlur={focus.onBlur}
      className="h-12 w-12 items-center justify-center"
      style={focus.focusRingStyle}
    >
      <Animated.View style={[burst.nodeStyle, { opacity: disabled ? 0.55 : 1 }]}>
        <BurstDots burst={burst} />
        <View style={{ width: NODE_FACE, height: NODE_FACE + 2 }}>
          {/* Lip slab (§5.7): the Sprout lip under the done face. */}
          <View
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: 2,
              height: NODE_FACE,
              borderRadius: radius.full,
              backgroundColor: checked ? HUE.lip : tokens.borderStrong,
            }}
          />
          <View
            style={{
              width: NODE_FACE,
              height: NODE_FACE,
              borderRadius: radius.full,
              borderWidth: 2,
              borderColor: checked ? HUE.bright : tokens.border,
              backgroundColor: checked ? HUE.bright : tokens.surface,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {checked ? <MaterialIcons name="check" size={20} color={tokens.onSolid} /> : null}
          </View>
        </View>
      </Animated.View>
    </Pressable>
  );
}

/**
 * The trailing quantitative ring node (§7 "ring node with '2/8'"): a progress
 * ring around the count label; pressing it adds one (role button, W7 label).
 * `0/x` reads neutral — no accent before there is progress.
 */
function HabitProgressNode({
  count,
  target,
  complete,
  disabled,
  busy,
  label,
  countLabel,
  onIncrement,
}: {
  count: number;
  target: number;
  complete: boolean;
  disabled: boolean;
  busy: boolean;
  label: string;
  countLabel: string;
  onIncrement: () => void;
}) {
  const { tokens } = useAppTheme();
  const burst = useCheckBurst();
  const focus = useKeyboardFocusRing(HUE.bright);
  const onPress = () => {
    if (disabled) return;
    burst.trigger();
    onIncrement();
  };
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      aria-busy={busy}
      accessibilityState={{ disabled, busy }}
      onFocus={focus.onFocus}
      onBlur={focus.onBlur}
      className="h-12 w-12 items-center justify-center"
      style={focus.focusRingStyle}
    >
      <Animated.View style={[burst.nodeStyle, { opacity: disabled ? 0.55 : 1 }]}>
        <BurstDots burst={burst} />
        <View style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ position: 'absolute' }}>
            <ProgressRing
              size={44}
              strokeWidth={4}
              progress={target > 0 ? Math.min(1, count / target) : 0}
              backgroundColor={tokens.surfaceSunken}
              progressColor={complete ? HUE.bright : HUE.solid}
            />
          </View>
          <Text
            variant="label"
            accessibilityLabel={countLabel}
            style={{
              color: count > 0 ? HUE.solid : tokens.textMuted,
              fontWeight: '800',
            }}
          >
            {count}/{target}
          </Text>
        </View>
      </Animated.View>
    </Pressable>
  );
}

/**
 * One scheduled habit row (~60): habit-color icon tile, name 800, schedule
 * caption, and the trailing check node — CheckNode-style checkbox (binary) or
 * the count ring (quantitative). The row reverses its flex order so the action
 * cluster reads as trailing while staying first in DOM/tab order (W7: Tab
 * from action lands on details; pointer hits are never intercepted).
 */
export function HabitCheckInRow({
  habit,
  row,
  busy = false,
  onIncrement,
  onDecrement,
  onOpen,
}: Props) {
  const { tokens, sectionAccents } = useAppTheme();
  const complete = row.state === 'complete';
  const accent = sectionAccents.habits.text;
  const detailFocus = useKeyboardFocusRing(accent);
  const removeFocus = useKeyboardFocusRing(accent);
  const disabled = !row.actionable || busy;
  const countLabel = `${row.name} progress ${row.secondaryLabel ?? `${row.count} of ${row.target}`}${complete ? ', complete' : ''}`;
  const tertiary = !row.actionable
    ? row.actionLabel.replace(`${row.name}: `, '')
    : [row.scheduleLabel, row.reminderLabel ? `Reminder ${row.reminderLabel}` : null]
        .filter(Boolean)
        .join(' · ');
  const secondaryColor =
    row.tone === 'complete' || row.tone === 'accent' ? accent : tokens.textMuted;

  return (
    <View
      className="min-h-[60px] flex-row-reverse items-center gap-2 border-b py-1"
      style={{ borderColor: tokens.border }}
    >
      <View className="flex-row items-center">
        {row.quantitative && row.count > 0 ? (
          <Pressable
            onPress={onDecrement}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={row.decrementLabel}
            accessibilityState={{ disabled }}
            onFocus={removeFocus.onFocus}
            onBlur={removeFocus.onBlur}
            className="h-11 w-12 items-center justify-center rounded-lg"
            style={removeFocus.focusRingStyle}
          >
            <MaterialIcons name="remove" size={20} color={tokens.iconMuted} />
          </Pressable>
        ) : null}
        {row.quantitative ? (
          <HabitProgressNode
            count={row.count}
            target={row.target}
            complete={complete}
            disabled={disabled}
            busy={busy}
            label={row.actionLabel}
            countLabel={countLabel}
            onIncrement={onIncrement}
          />
        ) : (
          <HabitCheckNode
            checked={complete}
            disabled={disabled}
            busy={busy}
            label={row.actionLabel}
            onToggle={() => {
              if (complete) onDecrement();
              else onIncrement();
            }}
          />
        )}
      </View>
      <Pressable
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={row.detailsLabel}
        onFocus={detailFocus.onFocus}
        onBlur={detailFocus.onBlur}
        className="min-h-[48px] min-w-0 flex-1 flex-row items-center gap-3 rounded-lg py-1"
        style={detailFocus.focusRingStyle}
      >
        <View
          className="h-10 w-10 items-center justify-center rounded-xl"
          style={{ backgroundColor: `${habit.color}22` }}
          accessibilityElementsHidden
          importantForAccessibility="no"
        >
          <MaterialIcons name={habit.icon} size={22} color={habit.color} />
        </View>
        <View className="min-w-0 flex-1">
          <Text variant="bodyMd" style={{ fontWeight: '800' }}>
            {row.name}
          </Text>
          {tertiary || row.secondaryLabel ? (
            <View className="mt-0.5 flex-row flex-wrap items-center gap-2">
              {tertiary ? (
                <Text variant="caption" tone="muted">
                  {tertiary}
                </Text>
              ) : null}
              {row.secondaryLabel && !row.quantitative ? (
                <Text
                  variant="caption"
                  style={{ color: secondaryColor }}
                  accessibilityLabel={
                    row.currentStreak > 0
                      ? `Current streak: ${row.currentStreak} scheduled occurrences`
                      : row.secondaryLabel
                  }
                >
                  {row.secondaryLabel}
                </Text>
              ) : null}
            </View>
          ) : null}
        </View>
      </Pressable>
    </View>
  );
}
