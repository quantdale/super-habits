import { useCallback, useEffect, useState } from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';

import type { AppSection } from '@/core/providers/navigationContext';
import { useAppNavigation } from '@/core/providers/navigationContext';
import { useAppTheme } from '@/core/providers/themeContext';
import type { SectionKey } from '@/constants/sectionColors';
import { Button } from '@/core/ui/Button';
import { Card } from '@/core/ui/Card';
import { addHabit } from '@/features/habits/habits.data';
import { addTodo } from '@/features/todos/todos.data';

import { loadOnboardingCompleted, saveOnboardingCompleted } from './onboarding.storage';

/**
 * Lightweight non-blocking first-run onboarding (docs/ui-ux/03-feature-
 * blueprints.md §13). Renders as an ordinary card at the BOTTOM of the
 * overview scroll — never a modal, never a wizard. Shows only while the
 * `superhabits.onboarding.v1` flag is unset and the user has essentially no
 * data yet; any successful starter action, Skip, or X persists the flag so it
 * never nags again.
 */

type OnboardingAreaId = 'habits' | 'todos' | 'focus' | 'workout' | 'nutrition';

type OnboardingArea = {
  id: OnboardingAreaId;
  label: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  /** Accent namespace for chips/buttons. */
  sectionKey: SectionKey;
  /** Navigation target (`focus` maps to the canonical `pomodoro` section). */
  navSection: AppSection;
};

const ONBOARDING_AREAS: readonly OnboardingArea[] = [
  { id: 'habits', label: 'Habits', icon: 'repeat', sectionKey: 'habits', navSection: 'habits' },
  { id: 'todos', label: 'Tasks', icon: 'check-circle', sectionKey: 'todos', navSection: 'todos' },
  { id: 'focus', label: 'Focus', icon: 'timer', sectionKey: 'focus', navSection: 'pomodoro' },
  {
    id: 'workout',
    label: 'Workout',
    icon: 'fitness-center',
    sectionKey: 'workout',
    navSection: 'workout',
  },
  {
    id: 'nutrition',
    label: 'Nutrition',
    icon: 'restaurant',
    sectionKey: 'calories',
    navSection: 'calories',
  },
] as const;

/**
 * Starter habits are curated here (the overview layer) because
 * features/habits/habitPresets.ts only exports icon/color constants — but
 * creation itself rides the existing `addHabit` data function, no new plumbing.
 */
const STARTER_HABITS: readonly string[] = [
  'Drink a glass of water',
  'Read for 10 minutes',
  'Take a short walk',
];

const DEEP_LINK_WHY: Record<Exclude<OnboardingAreaId, 'habits' | 'todos'>, string> = {
  focus: 'A simple timer turns focused minutes into a weekly picture.',
  workout: 'Log one session and your strength trends start to build.',
  nutrition: 'Record a meal and your calories take shape on their own.',
};

type FirstRunOnboardingCardProps = {
  /** True once the dashboard shows tracked data — the card stays out of the way. */
  hasAnyData: boolean;
  /** Called after the card creates local data so the parent can refresh summaries. */
  onDataChanged?: () => void;
};

export function FirstRunOnboardingCard({ hasAnyData, onDataChanged }: FirstRunOnboardingCardProps) {
  const { tokens, sectionAccents } = useAppTheme();
  const navigation = useAppNavigation();

  const [flagChecked, setFlagChecked] = useState(false);
  const [alreadyCompleted, setAlreadyCompleted] = useState(false);
  // Once the user interacts, keep the card mounted through its thank-you line
  // even if a parent refresh immediately finds new data.
  const [engaged, setEngaged] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [phase, setPhase] = useState<'interests' | 'starters' | 'done'>('interests');
  const [selectedAreas, setSelectedAreas] = useState<OnboardingAreaId[]>([]);
  const [todoDraft, setTodoDraft] = useState('');
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadOnboardingCompleted().then((completed) => {
      if (cancelled) return;
      setAlreadyCompleted(completed);
      setFlagChecked(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const finish = useCallback(() => {
    void saveOnboardingCompleted();
    setPhase('done');
  }, []);

  useEffect(() => {
    if (phase !== 'done') return;
    const timer = setTimeout(() => setDismissed(true), 2600);
    return () => clearTimeout(timer);
  }, [phase]);

  const toggleArea = useCallback((id: OnboardingAreaId) => {
    setEngaged(true);
    setSelectedAreas((prev) =>
      prev.includes(id) ? prev.filter((area) => area !== id) : [...prev, id],
    );
  }, []);

  const handleCreateStarterHabit = useCallback(
    async (name: string) => {
      if (pendingAction) return;
      setPendingAction(name);
      try {
        await addHabit(name, 1);
        onDataChanged?.();
        finish();
      } catch (err) {
        // Stay on the step; the user can retry or skip. No fake success.
        console.error('[FirstRunOnboardingCard] starter habit failed', err);
      } finally {
        setPendingAction(null);
      }
    },
    [finish, onDataChanged, pendingAction],
  );

  const handleAddFirstTodo = useCallback(async () => {
    const title = todoDraft.trim();
    if (!title || title.length > 200 || pendingAction) return;
    setPendingAction('todo');
    try {
      await addTodo({ title });
      setTodoDraft('');
      onDataChanged?.();
      finish();
    } catch (err) {
      console.error('[FirstRunOnboardingCard] first todo failed', err);
    } finally {
      setPendingAction(null);
    }
  }, [finish, onDataChanged, pendingAction, todoDraft]);

  const handleOpenSection = useCallback(
    (area: OnboardingArea) => {
      navigation.setActiveSection(area.navSection);
      finish();
    },
    [finish, navigation],
  );

  if (!flagChecked || alreadyCompleted || dismissed) return null;
  if (!engaged && phase !== 'done' && hasAnyData) return null;

  const renderInterestChip = (area: OnboardingArea) => {
    const active = selectedAreas.includes(area.id);
    const accent = sectionAccents[area.sectionKey];
    return (
      <Pressable
        key={area.id}
        accessibilityRole="button"
        accessibilityLabel={`${area.label}${active ? ', selected' : ''}`}
        accessibilityState={{ selected: active }}
        onPress={() => toggleArea(area.id)}
        className="min-h-[44px] flex-row items-center gap-1.5 rounded-full border px-4 active:opacity-80"
        style={
          active
            ? { backgroundColor: accent.tint, borderColor: accent.text }
            : { backgroundColor: tokens.surfaceElevated, borderColor: tokens.border }
        }
      >
        <MaterialIcons name={area.icon} size={16} color={active ? accent.text : tokens.textMuted} />
        <Text
          className={`text-sm ${active ? 'font-semibold' : 'font-medium'}`}
          style={{ color: active ? accent.text : tokens.text }}
        >
          {area.label}
        </Text>
        {active ? <MaterialIcons name="check" size={14} color={accent.text} /> : null}
      </Pressable>
    );
  };

  const renderStarterRow = (area: OnboardingArea) => {
    const accent = sectionAccents[area.sectionKey];

    if (area.id === 'habits') {
      return (
        <View key={area.id}>
          <Text className="text-sm font-semibold" style={{ color: tokens.text }}>
            Create your first habit
          </Text>
          <Text className="mt-0.5 text-xs" style={{ color: tokens.textMuted }}>
            One tap now, fully editable later.
          </Text>
          <View className="mt-2 flex-row flex-wrap gap-2">
            {STARTER_HABITS.map((name) => (
              <Pressable
                key={name}
                accessibilityRole="button"
                accessibilityLabel={`Add habit ${name}`}
                disabled={pendingAction !== null}
                onPress={() => {
                  void handleCreateStarterHabit(name);
                }}
                className="min-h-[44px] flex-row items-center gap-1.5 rounded-xl border px-3 active:opacity-80"
                style={{
                  backgroundColor: tokens.surfaceElevated,
                  borderColor: tokens.border,
                  opacity: pendingAction && pendingAction !== name ? 0.5 : 1,
                }}
              >
                {pendingAction === name ? (
                  <ActivityIndicator size="small" color={accent.text} />
                ) : (
                  <MaterialIcons name="add" size={16} color={accent.text} />
                )}
                <Text className="text-sm" style={{ color: tokens.text }}>
                  {name}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      );
    }

    if (area.id === 'todos') {
      return (
        <View key={area.id}>
          <Text className="text-sm font-semibold" style={{ color: tokens.text }}>
            Add your first task
          </Text>
          <View className="mt-2 flex-row items-center gap-2">
            <TextInput
              accessibilityLabel="New task title"
              className="flex-1 rounded-2xl border px-4 text-base"
              style={{
                minHeight: 48,
                borderColor: tokens.border,
                backgroundColor: tokens.surfaceElevated,
                color: tokens.text,
              }}
              value={todoDraft}
              onChangeText={setTodoDraft}
              placeholder="e.g. Reply to Alex"
              placeholderTextColor={tokens.textMuted}
              maxLength={200}
              editable={pendingAction === null}
              submitBehavior="submit"
              onSubmitEditing={() => {
                void handleAddFirstTodo();
              }}
            />
            <Button
              label="Add"
              variant="ghost"
              disabled={!todoDraft.trim()}
              loading={pendingAction === 'todo'}
              onPress={() => {
                void handleAddFirstTodo();
              }}
            />
          </View>
        </View>
      );
    }

    return (
      <Pressable
        key={area.id}
        accessibilityRole="button"
        accessibilityLabel={`Open ${area.label}. ${DEEP_LINK_WHY[area.id]}`}
        onPress={() => handleOpenSection(area)}
        className="min-h-[44px] flex-row items-center justify-between gap-2 rounded-xl border px-4 py-2.5 active:opacity-80"
        style={{ backgroundColor: accent.tint, borderColor: `${accent.text}33` }}
      >
        <View className="min-w-0 flex-1 flex-row items-center gap-2">
          <MaterialIcons name={area.icon} size={18} color={accent.text} />
          <View className="min-w-0 flex-1">
            <Text className="text-sm font-semibold" style={{ color: accent.text }}>
              Open {area.label}
            </Text>
            <Text className="text-xs" style={{ color: tokens.textMuted }} numberOfLines={2}>
              {DEEP_LINK_WHY[area.id]}
            </Text>
          </View>
        </View>
        <MaterialIcons name="arrow-forward" size={16} color={accent.text} />
      </Pressable>
    );
  };

  const orderedSelected = ONBOARDING_AREAS.filter((area) => selectedAreas.includes(area.id));

  let body;
  if (phase === 'interests') {
    body = (
      <>
        <View className="flex-row flex-wrap gap-2">{ONBOARDING_AREAS.map(renderInterestChip)}</View>
        <View className="mt-3 flex-row items-center gap-3">
          <View className="shrink">
            <Button
              label="Continue"
              disabled={selectedAreas.length === 0}
              onPress={() => setPhase('starters')}
            />
          </View>
          <Text className="flex-1 text-xs" style={{ color: tokens.textMuted }}>
            No wrong answers — you can change course any time.
          </Text>
        </View>
      </>
    );
  } else if (phase === 'starters') {
    body = <View className="gap-3">{orderedSelected.map(renderStarterRow)}</View>;
  } else {
    body = (
      <View className="flex-row items-center gap-2">
        <MaterialIcons name="check-circle" size={18} color={sectionAccents.habits.text} />
        <Text className="flex-1 text-sm" style={{ color: tokens.text }}>
          You&apos;re all set. Explore at your own pace — this card won&apos;t nag you.
        </Text>
      </View>
    );
  }

  return (
    <Card className="mb-0" innerClassName="p-4">
      <View className="flex-row items-start justify-between gap-2">
        <View className="min-w-0 flex-1 pr-1">
          <Text className="text-base font-semibold" style={{ color: tokens.text }}>
            {phase === 'starters'
              ? 'Start small'
              : phase === 'done'
                ? 'Nice work'
                : 'Getting started'}
          </Text>
          <Text className="mt-0.5 text-sm" style={{ color: tokens.textMuted }}>
            {phase === 'starters'
              ? 'One tiny first step for each pick. Everything else can wait.'
              : phase === 'done'
                ? 'Whatever you do next is up to you.'
                : 'Choose what you\u2019d like help with — or skip this entirely.'}
          </Text>
        </View>
        {phase !== 'done' ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Skip getting-started suggestions"
            onPress={finish}
            className="min-h-[44px] min-w-[44px] items-center justify-center rounded-full active:opacity-80"
            style={{ backgroundColor: tokens.surfaceElevated }}
          >
            <MaterialIcons name="close" size={20} color={tokens.textMuted} />
          </Pressable>
        ) : null}
      </View>
      <View className="mt-3">{body}</View>
    </Card>
  );
}
