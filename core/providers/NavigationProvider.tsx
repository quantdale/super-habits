import { useCallback, useEffect, useRef, useState, type PropsWithChildren } from 'react';
import {
  NavigationContext,
  type AppSection,
  type PlanningHubView,
} from '@/core/providers/navigationContext';

export type { AppSection, PlanningHubView } from '@/core/providers/navigationContext';

const KNOWN_SECTIONS: readonly string[] = [
  'overview',
  'todos',
  'habits',
  'pomodoro',
  'workout',
  'calories',
  'health',
];

/**
 * URL-hash stamp for the section a history entry represents (web only).
 *
 * The hash — not `history.state` — is deliberate: expo-router's
 * `createMemoryHistory.replace` rewrites `history.state` to `{ id }` on startup
 * and on every popstate (its `onStateChange` else-branch), silently dropping
 * any extra state keys, while it preserves `location.hash` verbatim
 * (`pathWithHash = path + location.hash`). The URL survives that rewriting,
 * reloads, and SW-update reloads, and it makes sections deep-linkable
 * (`/#habits`). Back/forward between sections depends on this stamp.
 */
function readHistorySection(): AppSection | null {
  if (typeof window === 'undefined') return null;
  const hash = window.location.hash.replace(/^#/, '');
  return KNOWN_SECTIONS.includes(hash) ? (hash as AppSection) : null;
}

function stampHistorySection(section: AppSection): void {
  if (typeof window === 'undefined') return;
  window.history.pushState(window.history.state, '', `#${section}`);
}

export function NavigationProvider({ children }: PropsWithChildren) {
  const [activeSection, setActiveSectionState] = useState<AppSection>('overview');
  const [mountedSections, setMountedSections] = useState<Record<AppSection, boolean>>({
    overview: true,
    todos: false,
    habits: false,
    pomodoro: false,
    workout: false,
    calories: false,
    health: false,
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isWeeklyReviewOpen, setIsWeeklyReviewOpen] = useState(false);
  const [isPlanningHubOpen, setIsPlanningHubOpen] = useState(false);
  const [planningHubInitialView, setPlanningHubInitialView] = useState<PlanningHubView>('today');
  const [isQuickCaptureOpen, setIsQuickCaptureOpen] = useState(false);
  const [isAchievementsOpen, setIsAchievementsOpen] = useState(false);
  const [pendingHabitFocusId, setPendingHabitFocusId] = useState<string | null>(null);

  const openSettings = useCallback(() => setIsSettingsOpen(true), []);
  const closeSettings = useCallback(() => setIsSettingsOpen(false), []);
  // The review is a full-screen overlay stacked in the same modal layer as the
  // Plan hub and Settings drawers — opening it must dismiss those, or their
  // content paints over the review's own controls (same convention as openHabit
  // closing Settings).
  const openWeeklyReview = useCallback(() => {
    setIsPlanningHubOpen(false);
    setIsSettingsOpen(false);
    setIsWeeklyReviewOpen(true);
  }, []);
  const closeWeeklyReview = useCallback(() => setIsWeeklyReviewOpen(false), []);
  const openPlanningHub = useCallback((initialView: PlanningHubView = 'today') => {
    setPlanningHubInitialView(initialView);
    setIsPlanningHubOpen(true);
  }, []);
  const closePlanningHub = useCallback(() => setIsPlanningHubOpen(false), []);
  const openQuickCapture = useCallback(() => setIsQuickCaptureOpen(true), []);
  const closeQuickCapture = useCallback(() => setIsQuickCaptureOpen(false), []);
  // The achievements overlay is a full-screen modal in the same layer as
  // Settings/Plan: opening it must dismiss those so their content cannot paint
  // over its own controls (same convention as openWeeklyReview).
  const openAchievements = useCallback(() => {
    setIsSettingsOpen(false);
    setIsPlanningHubOpen(false);
    setIsQuickCaptureOpen(false);
    setIsAchievementsOpen(true);
  }, []);
  const closeAchievements = useCallback(() => setIsAchievementsOpen(false), []);
  const activeSectionRef = useRef<AppSection>(activeSection);
  const applySection = useCallback((section: AppSection) => {
    activeSectionRef.current = section;
    setMountedSections((current) => (current[section] ? current : { ...current, [section]: true }));
    setActiveSectionState(section);
  }, []);
  const setActiveSection = useCallback(
    (section: AppSection) => {
      const changed = activeSectionRef.current !== section;
      applySection(section);
      // Browser back/forward must walk between sections instead of leaving the
      // app: each real section change is a history entry. Re-selecting the
      // current section and popstate restores never push.
      if (changed) stampHistorySection(section);
    },
    [applySection],
  );
  // Web history mirror (native has no window/history): adopt the stamped
  // section after hydration (the prerendered shell always renders `overview`,
  // so this must not run during render — also makes `/#habits` a deep link)
  // and restore the stamped section on back/forward.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stamped = readHistorySection();
    if (stamped && stamped !== activeSectionRef.current) applySection(stamped);
    // Stamp THIS entry too, so the entry the session started on carries its
    // section like every pushed one. Without it, going back from `#todos`
    // lands on a hash-less `/`, which expo-router's linking layer treats as a
    // route change and which remounts the bootstrap (probe-proven: the gate
    // then reports "already open in another tab" for a lock this same tab
    // still holds). replaceState keeps the entry count intact.
    if (!readHistorySection()) {
      window.history.replaceState(window.history.state, '', `#${activeSectionRef.current}`);
    }
    const handlePopState = () => {
      applySection(readHistorySection() ?? 'overview');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [applySection]);
  const openHabit = useCallback(
    (habitId: string) => {
      setPendingHabitFocusId(habitId);
      setActiveSection('habits');
      setIsSettingsOpen(false);
    },
    [setActiveSection],
  );
  const consumePendingHabitFocus = useCallback(() => {
    let pending = pendingHabitFocusId;
    setPendingHabitFocusId((current) => {
      pending = current;
      return null;
    });
    return pending;
  }, [pendingHabitFocusId]);

  return (
    <NavigationContext.Provider
      value={{
        activeSection,
        mountedSections,
        setActiveSection,
        openHabit,
        consumePendingHabitFocus,
        isSettingsOpen,
        openSettings,
        closeSettings,
        isWeeklyReviewOpen,
        openWeeklyReview,
        closeWeeklyReview,
        isPlanningHubOpen,
        planningHubInitialView,
        openPlanningHub,
        closePlanningHub,
        isQuickCaptureOpen,
        openQuickCapture,
        closeQuickCapture,
        isAchievementsOpen,
        openAchievements,
        closeAchievements,
      }}
    >
      {children}
    </NavigationContext.Provider>
  );
}
