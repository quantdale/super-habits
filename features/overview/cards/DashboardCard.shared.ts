import { useAppNavigation, type AppSection } from '@/core/providers/navigationContext';

import type { OverviewCardMeta } from '../overviewCards';

/** Card sections use color keys; translate to navigation sections. */
const APP_SECTION_BY_CARD_SECTION: Record<string, AppSection> = {
  todos: 'todos',
  habits: 'habits',
  focus: 'pomodoro',
  workout: 'workout',
  calories: 'calories',
};

type CardNavigation = ReturnType<typeof useAppNavigation>;

/**
 * Deep-link a card/hero target exactly like DashboardCard does on press —
 * shared by the customizable cards, the Next Best Action hero, and the
 * Today progress strip so all entry points navigate identically.
 */
export function openCardTarget(
  navigation: CardNavigation,
  meta: Pick<OverviewCardMeta, 'section' | 'planningHubView'>,
) {
  if (meta.section) {
    const appSection = APP_SECTION_BY_CARD_SECTION[meta.section];
    if (appSection) {
      navigation.setActiveSection(appSection);
    } else if (meta.planningHubView) {
      navigation.openPlanningHub(meta.planningHubView);
    }
  } else if (meta.planningHubView) {
    navigation.openPlanningHub(meta.planningHubView);
  }
}
