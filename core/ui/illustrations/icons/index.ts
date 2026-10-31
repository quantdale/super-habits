/**
 * P9 hero icon barrel (docs/ui-ux/16-playful-momentum.md §5.9).
 *
 * 14 duotone SVG hero icons: 6 tabs (Today sun-path, To Do check-list, Habits
 * sprout, Focus timer-leaf, Workout dumbbell, Calories bowl) plus flame, XP
 * bolt, freeze shield, trophy, chest, badge ribbon, seedling, garden. All are
 * decorative (hidden from the accessibility tree); accessible names live on the
 * surrounding control.
 */
import { TodayIcon, TodosIcon, HabitsIcon, FocusIcon, WorkoutIcon, CaloriesIcon } from './tabIcons';
import {
  FlameIcon,
  XpBoltIcon,
  FreezeShieldIcon,
  TrophyIcon,
  ChestIcon,
  BadgeRibbonIcon,
  SeedlingIcon,
  GardenIcon,
} from './rewardIcons';

export { heroIconDecorative, heroIconMonochromeTones, type HeroIconProps } from './heroIconCommon';
export { TodayIcon, TodosIcon, HabitsIcon, FocusIcon, WorkoutIcon, CaloriesIcon } from './tabIcons';
export {
  FlameIcon,
  XpBoltIcon,
  FreezeShieldIcon,
  TrophyIcon,
  ChestIcon,
  BadgeRibbonIcon,
  SeedlingIcon,
  GardenIcon,
} from './rewardIcons';

/** Registry of every hero icon — consumed by the P9 render contract test. */
export const HERO_ICONS = {
  TodayIcon,
  TodosIcon,
  HabitsIcon,
  FocusIcon,
  WorkoutIcon,
  CaloriesIcon,
  FlameIcon,
  XpBoltIcon,
  FreezeShieldIcon,
  TrophyIcon,
  ChestIcon,
  BadgeRibbonIcon,
  SeedlingIcon,
  GardenIcon,
} as const;

export type HeroIconName = keyof typeof HERO_ICONS;
