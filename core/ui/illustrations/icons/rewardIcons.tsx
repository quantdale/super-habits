import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { REWARD_HUES, SECTION_HUES } from '@/constants/sectionColors';
import { heroIconDecorative, type HeroIconProps } from './heroIconCommon';

/**
 * Reward-layer hero icons (§5.9): flame, XP bolt, freeze shield, trophy,
 * chest, badge ribbon. Defaults paint from the reward hues (§5.1) so reward
 * objects read as Gold/Flame/Ice without caller configuration.
 */

export function FlameIcon({
  size = 32,
  bright = REWARD_HUES.streak.bright,
  lip = REWARD_HUES.streak.lip,
}: HeroIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" {...heroIconDecorative}>
      <Path
        d="M16 2c1.6 5 5.6 7.6 8.4 11.4 2.4 3.3 3.6 6.5 3.6 9.4 0 5-4.4 9.2-12 9.2S4 27.8 4 22.8c0-3.5 1.5-6.7 4.4-9.7-.2 2.7.6 4.6 2.4 5.8C9.6 13.6 12.4 7.5 16 2Z"
        fill={bright}
      />
      <Path
        d="M16 15.6c.8 2.6 2.8 4 4.2 5.8 1 1.3 1.6 2.6 1.6 4 0 2.9-2.4 5-5.8 5s-5.8-2.1-5.8-5c0-2 1-3.7 3-5.4-.1 1.4.3 2.3 1.2 2.9-.3-2.7.6-5.2 1.6-7.3Z"
        fill={lip}
      />
    </Svg>
  );
}

export function XpBoltIcon({
  size = 32,
  bright = REWARD_HUES.accent.bright,
  lip = REWARD_HUES.accent.lip,
}: HeroIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" {...heroIconDecorative}>
      <Path d="M18.6 2 7 18h6.4L11 30l12-16.6h-6.8L18.6 2Z" fill={bright} />
      <Path
        d="M17.2 6.5 11 14.6h3.9"
        stroke={lip}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

export function FreezeShieldIcon({
  size = 32,
  bright = REWARD_HUES.frozen.bright,
  lip = REWARD_HUES.frozen.lip,
}: HeroIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" {...heroIconDecorative}>
      <Path
        d="M16 2.5 28 6.4v9.1c0 7-4.6 11.9-12 14.5-7.4-2.6-12-7.5-12-14.5V6.4L16 2.5Z"
        fill={bright}
      />
      <Path
        d="M16 9.5v13M10.2 12.8l11.6 6.4M21.8 12.8l-11.6 6.4"
        stroke={lip}
        strokeWidth={2.2}
        strokeLinecap="round"
        fill="none"
      />
      <Circle cx={16} cy={16} r={2.2} fill={lip} />
    </Svg>
  );
}

export function TrophyIcon({
  size = 32,
  bright = REWARD_HUES.badge.bright,
  lip = REWARD_HUES.badge.lip,
}: HeroIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" {...heroIconDecorative}>
      <Path d="M8 4h16v7c0 4.4-3.2 7.6-7.2 8h-1.6C11.2 18.6 8 15.4 8 11V4Z" fill={bright} />
      <Path
        d="M8 6H4.5v2c0 3.1 1.8 5.2 4.7 5.7M24 6h3.5v2c0 3.1-1.8 5.2-4.7 5.7"
        stroke={lip}
        strokeWidth={2.2}
        strokeLinecap="round"
        fill="none"
      />
      <Path d="M16 19v4" stroke={lip} strokeWidth={2.6} strokeLinecap="round" fill="none" />
      <Rect x={10} y={23.5} width={12} height={4} rx={2} fill={lip} />
    </Svg>
  );
}

export function ChestIcon({
  size = 32,
  bright = REWARD_HUES.badge.bright,
  lip = REWARD_HUES.badge.lip,
}: HeroIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" {...heroIconDecorative}>
      <Path d="M4 13.5C4 9.4 7.4 6 11.5 6h9C24.6 6 28 9.4 28 13.5V15H4v-1.5Z" fill={bright} />
      <Rect x={4} y={15} width={24} height={11} rx={2.5} fill={lip} />
      <Rect x={13} y={12.5} width={6} height={7} rx={1.6} fill={bright} />
      <Path d="M16 26v-4" stroke={bright} strokeWidth={2.2} strokeLinecap="round" fill="none" />
    </Svg>
  );
}

export function BadgeRibbonIcon({
  size = 32,
  bright = REWARD_HUES.badge.bright,
  lip = REWARD_HUES.badge.lip,
}: HeroIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" {...heroIconDecorative}>
      <Path d="M10.5 17.5 7 29l5.2-2.4L16 30l3.8-3.4L25 29l-3.5-11.5" fill={lip} />
      <Circle cx={16} cy={12} r={8.5} fill={bright} />
      <Path
        d="M16 6.6l1.7 3.5 3.8.5-2.8 2.7.7 3.8-3.4-1.8-3.4 1.8.7-3.8-2.8-2.7 3.8-.5L16 6.6Z"
        fill={lip}
      />
    </Svg>
  );
}

export function SeedlingIcon({
  size = 32,
  bright = SECTION_HUES.habits.bright,
  lip = SECTION_HUES.habits.lip,
}: HeroIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" {...heroIconDecorative}>
      <Path d="M16 27.5V14" stroke={lip} strokeWidth={2.6} strokeLinecap="round" fill="none" />
      <Path d="M16 15.5c0-4.8 2.6-8 7.8-9.3.3 5.3-2.3 8.6-7.8 9.3Z" fill={bright} />
      <Path d="M16 19c0-4.2-2.3-7-6.9-8.2-.2 4.7 2 7.6 6.9 8.2Z" fill={lip} />
      <Path d="M8.5 27.5h15" stroke={lip} strokeWidth={2.6} strokeLinecap="round" fill="none" />
    </Svg>
  );
}

export function GardenIcon({
  size = 32,
  bright = SECTION_HUES.habits.bright,
  lip = SECTION_HUES.habits.lip,
}: HeroIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" {...heroIconDecorative}>
      <Circle cx={24} cy={8} r={4.5} fill={bright} />
      <Path d="M2 21c4.4-4.4 8.8-6.6 14-6.6S25.6 16.6 30 21v7H2v-7Z" fill={lip} />
      <Path d="M10 15.5c0-3 1.6-5 5-5.8.2 3.4-1.5 5.4-5 5.8Z" fill={bright} />
      <Path d="M10 21v-5" stroke={bright} strokeWidth={2.2} strokeLinecap="round" fill="none" />
      <Path d="M21.5 18.5c0-2.2 1.2-3.7 3.7-4.3.2 2.5-1.1 4-3.7 4.3Z" fill={bright} />
      <Path d="M21.5 22v-3.2" stroke={bright} strokeWidth={2} strokeLinecap="round" fill="none" />
    </Svg>
  );
}
