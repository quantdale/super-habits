import { useCallback, useState } from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';
import { SECTION_COLORS, POMODORO_SECTION_KEY } from '@/constants/sectionColors';
import { useAppTheme } from '@/core/providers/themeContext';
import { useAppNavigation, type AppSection } from '@/core/providers/navigationContext';
import { Card } from '@/core/ui/Card';
import { Screen } from '@/core/ui/Screen';
import { SectionLabel } from '@/core/ui/SectionLabel';
import { Text } from '@/core/ui/Text';
import { PageHeader } from '@/core/ui/PageHeader';
import { listWorkoutLogsForRange } from '@/features/workout/workout.data';
import { getCalorieGoal, listCalorieEntries } from '@/features/calories/calories.data';
import { caloriesTotal } from '@/features/calories/calories.domain';
import { toDateKey } from '@/lib/time';
import { useActiveForegroundRefresh } from '@/lib/useForegroundRefresh';

/**
 * Health parent surface (V3 five-destination phone model).
 *
 * Deliberately NOT a dashboard (campaign §22): its job is to route to the two
 * health halves — Workout and Nutrition — in one tap, and to show the day's
 * health state compactly. Workout and Nutrition remain one tap away from here
 * and from each other via the rail on wide screens.
 */
export function HealthScreen({ isActive }: { isActive: boolean }) {
  const { tokens, sectionAccents } = useAppTheme();
  const navigation = useAppNavigation();
  const [workoutToday, setWorkoutToday] = useState<boolean | null>(null);
  const [kcalState, setKcalState] = useState<{ eaten: number; goal: number } | null>(null);

  const refresh = useCallback(async () => {
    try {
      const today = toDateKey();
      const logs = await listWorkoutLogsForRange(today, today);
      setWorkoutToday(logs.length > 0);
      const [entries, goal] = await Promise.all([listCalorieEntries(today), getCalorieGoal()]);
      const eaten = caloriesTotal(entries);
      setKcalState({ eaten: Math.round(eaten), goal: goal.calories });
    } catch {
      // Health summary is best-effort; the entries below never depend on it.
      setWorkoutToday(null);
      setKcalState(null);
    }
  }, []);

  useActiveForegroundRefresh(isActive, refresh);

  const openSection = (section: AppSection) => navigation.setActiveSection(section);

  const kcalLeft = kcalState ? Math.max(kcalState.goal - kcalState.eaten, 0) : null;

  return (
    <Screen scroll>
      <PageHeader
        eyebrow="HEALTH"
        title="Health"
        actions={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open settings"
            onPress={navigation.openSettings}
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: tokens.surface,
              borderWidth: 1,
              borderColor: tokens.border,
            }}
          >
            <MaterialIcons name="settings" size={22} color={tokens.iconMuted} />
          </Pressable>
        }
      />

      {/* Today's health state — one quiet line, not a stat wall. */}
      <Card className="mt-4">
        <SectionLabel>Today</SectionLabel>
        <View style={{ flexDirection: 'row', gap: 24, alignItems: 'center' }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="bodyMd">
              {workoutToday === null
                ? 'Workout —'
                : workoutToday
                  ? 'Workout done ✓'
                  : 'Workout not logged yet'}
            </Text>
            <Text variant="caption" tone="muted">
              {kcalState
                ? `${kcalState.eaten} / ${kcalState.goal} kcal eaten · ${kcalLeft} left`
                : 'Nutrition —'}
            </Text>
          </View>
          <MaterialIcons
            name={workoutToday ? 'check-circle' : 'radio-button-unchecked'}
            size={22}
            color={workoutToday ? sectionAccents.workout.fill : tokens.iconMuted}
          />
        </View>
      </Card>

      {/* The two halves — one tap each, generous targets. */}
      <View style={{ gap: 12, marginTop: 16 }}>
        <HealthEntry
          label="Workout"
          description="Train, log sets, review progress"
          icon="fitness-center"
          accent={sectionAccents.workout.fill}
          onPress={() => openSection('workout')}
        />
        <HealthEntry
          label="Calories"
          description="Log meals, track calories and macros"
          icon="restaurant"
          accent={sectionAccents.calories.fill}
          onPress={() => openSection('calories')}
        />
        <HealthEntry
          label="Focus"
          description="Guided focus sessions and breaks"
          icon="timer"
          accent={sectionAccents[POMODORO_SECTION_KEY].fill}
          onPress={() => openSection('pomodoro')}
        />
      </View>
    </Screen>
  );
}

function HealthEntry({
  label,
  description,
  icon,
  accent,
  onPress,
}: {
  label: string;
  description: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  accent: string;
  onPress: () => void;
}) {
  const { tokens } = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${label}`}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        minHeight: 64,
        padding: 16,
        borderRadius: 16,
        backgroundColor: tokens.surface,
        borderWidth: 1,
        borderColor: tokens.border,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: `${accent}1F`,
        }}
      >
        <MaterialIcons name={icon} size={22} color={accent} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="titleMd" numberOfLines={1}>
          {label}
        </Text>
        <Text variant="caption" tone="muted" numberOfLines={1}>
          {description}
        </Text>
      </View>
      <MaterialIcons name="chevron-right" size={22} color={tokens.iconMuted} />
    </Pressable>
  );
}

// SECTION_COLORS is re-exported for the shell's accent lookup symmetry.
export { SECTION_COLORS };
