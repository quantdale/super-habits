import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { SECTION_HUES } from '@/constants/sectionColors';
import { heroIconDecorative, type HeroIconProps } from './heroIconCommon';

/**
 * The six tab hero icons (§5.9): Today sun-path, To Do check-list, Habits
 * sprout, Focus timer-leaf, Workout dumbbell, Calories bowl. Duotone
 * bright + lip on the 32-grid, decorative-only.
 */

export function TodayIcon({
  size = 32,
  bright = SECTION_HUES.habits.bright,
  lip = SECTION_HUES.habits.lip,
}: HeroIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" {...heroIconDecorative}>
      <Circle cx={16} cy={11} r={5.5} fill={bright} />
      <Path
        d="M16 1.5v2.6M16 17.9v.1M6.6 11H4M28 11h-2.6M9.4 4.4 7.6 2.6M24.4 17.6l-1.8-1.8M22.6 4.4l1.8-1.8M7.6 17.6l1.8-1.8"
        stroke={lip}
        strokeWidth={2.2}
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d="M4 28c3.6-4.6 7.4-6.9 12-6.9s8.4 2.3 12 6.9"
        stroke={lip}
        strokeWidth={2.8}
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d="M14.2 28.6c1-1.8 2.4-2.8 4.3-3"
        stroke={bright}
        strokeWidth={2.2}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}

export function TodosIcon({
  size = 32,
  bright = SECTION_HUES.todos.bright,
  lip = SECTION_HUES.todos.lip,
}: HeroIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" {...heroIconDecorative}>
      <Rect x={4} y={4} width={24} height={24} rx={5} fill={lip} />
      <Path
        d="M8.2 11.4l2.2 2.2 4-4.2"
        stroke={bright}
        strokeWidth={2.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Path
        d="M8.2 20.6l2.2 2.2 4-4.2"
        stroke={bright}
        strokeWidth={2.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Rect x={17} y={10} width={7.5} height={2.8} rx={1.4} fill={bright} />
      <Rect x={17} y={19.2} width={7.5} height={2.8} rx={1.4} fill={bright} />
    </Svg>
  );
}

export function HabitsIcon({
  size = 32,
  bright = SECTION_HUES.habits.bright,
  lip = SECTION_HUES.habits.lip,
}: HeroIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" {...heroIconDecorative}>
      <Path d="M16 27c0-6.2 2.4-10.4 7.2-12.6-.4 6.4-2.8 10.6-7.2 12.6Z" fill={bright} />
      <Path d="M16 27c0-7.6-2.8-12.6-8.4-15 0 8 2.8 13 8.4 15Z" fill={lip} />
      <Path d="M16 28.5V16.5" stroke={lip} strokeWidth={2.6} strokeLinecap="round" fill="none" />
      <Path d="M6 28.6h20" stroke={lip} strokeWidth={2.6} strokeLinecap="round" fill="none" />
    </Svg>
  );
}

export function FocusIcon({
  size = 32,
  bright = SECTION_HUES.focus.bright,
  lip = SECTION_HUES.focus.lip,
}: HeroIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" {...heroIconDecorative}>
      <Circle cx={16} cy={18} r={10.5} fill={lip} />
      <Circle cx={16} cy={18} r={7} fill={bright} />
      <Path
        d="M16 13.4V18l3 2.2"
        stroke={lip}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Path d="M16 7.5c0-3 2-5 5.4-5.5-.2 3.2-2.2 5.2-5.4 5.5Z" fill={bright} />
    </Svg>
  );
}

export function WorkoutIcon({
  size = 32,
  bright = SECTION_HUES.workout.bright,
  lip = SECTION_HUES.workout.lip,
}: HeroIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" {...heroIconDecorative}>
      <Rect x={2} y={12} width={5.5} height={8} rx={2} fill={lip} />
      <Rect x={24.5} y={12} width={5.5} height={8} rx={2} fill={lip} />
      <Rect x={7} y={9.5} width={5} height={13} rx={2} fill={bright} />
      <Rect x={20} y={9.5} width={5} height={13} rx={2} fill={bright} />
      <Rect x={11.5} y={14.4} width={9} height={3.2} rx={1.6} fill={lip} />
    </Svg>
  );
}

export function CaloriesIcon({
  size = 32,
  bright = SECTION_HUES.calories.bright,
  lip = SECTION_HUES.calories.lip,
}: HeroIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" {...heroIconDecorative}>
      <Path d="M4 16.5h24c0 6-4.2 10.5-12 10.5S4 22.5 4 16.5Z" fill={bright} />
      <Path d="M7.5 16.5h17c0 4.4-3 7.7-8.5 7.7s-8.5-3.3-8.5-7.7Z" fill={lip} />
      <Path
        d="M11.5 11.5c-1.6-1.6-1.6-3.2 0-4.8M16 11c-1.6-1.6-1.6-3.2 0-4.8M20.5 11.5c-1.6-1.6-1.6-3.2 0-4.8"
        stroke={lip}
        strokeWidth={2}
        strokeLinecap="round"
        fill="none"
      />
      <Path d="M2 29h28" stroke={lip} strokeWidth={2.4} strokeLinecap="round" fill="none" />
    </Svg>
  );
}
