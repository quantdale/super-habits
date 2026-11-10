import { useCallback, useState } from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';
import { useAppTheme } from '@/core/providers/themeContext';
import { useAppNavigation, type AppSection } from '@/core/providers/navigationContext';
import { useDayRolloverGeneration } from '@/core/providers/dayRolloverContext';
import { Card } from '@/core/ui/Card';
import { Screen } from '@/core/ui/Screen';
import { Text } from '@/core/ui/Text';
import { PageHeader } from '@/core/ui/PageHeader';
import { IconButton } from '@/core/ui/IconButton';
import { ListGroup } from '@/core/ui/ListGroup';
import { radius, spacing } from '@/core/theme/designTokens';
import { listWorkoutLogsForRange } from '@/features/workout/workout.data';
import { getCalorieGoal, listCalorieEntries } from '@/features/calories/calories.data';
import { caloriesTotal } from '@/features/calories/calories.domain';
import { kcalGoalDeltaLabel } from '@/features/health/health.domain';
import {
  HEALTH_TILE_SIZE,
  healthEntryTileVisual,
  healthHeroVisual,
  healthStatusMarkVisual,
} from '@/features/health/health.visual';
import { toDateKey } from '@/lib/time';
import { useActiveForegroundRefresh } from '@/lib/useForegroundRefresh';

/**
 * Health parent surface (V3 five-destination phone model).
 *
 * Deliberately NOT a dashboard (campaign §22): its job is to route to the two
 * health halves — Workout and Nutrition — in one tap, and to show the day's
 * health state compactly. Workout and Nutrition remain one tap away from here
 * and from each other via the rail on wide screens.
 *
 * v2 (P21b, §5.1): Health is the one surface that owns the Lagoon hue, so it
 * takes the single hero the brief grants every screen — a Lagoon `hero` card
 * carrying today's state — and one `depth.flat` `ListGroup` of two routing
 * rows whose leading tiles take each CHILD section's own accent (Coral for
 * Workout, Berry for Calories). Every ink on the hero is resolved against the
 * fixed Lagoon fill (`healthHeroVisual`), never against the active theme.
 */
export function HealthScreen({ isActive }: { isActive: boolean }) {
  const { tokens, sectionAccents } = useAppTheme();
  const navigation = useAppNavigation();
  // Day rollover: today's totals must follow the local day across midnight,
  // matching every other section screen's refresh wiring.
  const dayGeneration = useDayRolloverGeneration();
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

  useActiveForegroundRefresh(isActive, refresh, dayGeneration);

  const openSection = (section: AppSection) => navigation.setActiveSection(section);

  const hero = healthHeroVisual({ text: tokens.text, textMuted: tokens.textMuted });
  const workoutTile = healthEntryTileVisual(sectionAccents.workout, tokens.surface);
  const caloriesTile = healthEntryTileVisual(sectionAccents.calories, tokens.surface);
  const statusMark = healthStatusMarkVisual({
    done: Boolean(workoutToday),
    accentText: tokens.successText,
    fill: hero.fill,
  });

  return (
    <Screen scroll>
      <PageHeader
        eyebrow="HEALTH"
        title="Health"
        actions={
          <IconButton
            icon="settings"
            accessibilityLabel="Open settings"
            variant="flat"
            onPress={navigation.openSettings}
          />
        }
      />

      {/* The screen's one hero: today's health state, in Lagoon. Every ink on
          it is resolved against the fixed #22CCB8 face — the theme's own text
          lands at 1.87–2.02:1 there. */}
      <Card variant="hero" accentColor={hero.fill} className="mt-4">
        <View className="flex-row items-start" style={{ gap: spacing.md }}>
          <View className="min-w-0 flex-1">
            <Text
              variant="label"
              style={{ color: hero.ink, textTransform: 'uppercase', letterSpacing: 0.8 }}
            >
              Today
            </Text>
            <Text variant="titleMd" style={{ color: hero.ink, marginTop: spacing.xs }}>
              {workoutToday === null
                ? 'Workout —'
                : workoutToday
                  ? 'Workout done ✓'
                  : 'Workout not logged yet'}
            </Text>
            <Text
              variant="bodyMd"
              style={{ color: hero.mutedInk, marginTop: spacing.xs, fontVariant: ['tabular-nums'] }}
            >
              {kcalState
                ? `${kcalState.eaten} / ${kcalState.goal} kcal eaten · ${kcalGoalDeltaLabel(kcalState.eaten, kcalState.goal)}`
                : 'Nutrition —'}
            </Text>
          </View>
          <MaterialIcons
            name={statusMark.icon}
            size={28}
            color={statusMark.ink}
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
        </View>
      </Card>

      {/* The two halves — one tap each, generous targets. Focus stays a
          top-level destination; duplicating it here would turn Health into a
          misc dashboard (W4.5 Fix D). Static list rows, so the group claims
          `depth.flat` rather than a second pressable-card layer. */}
      <View style={{ marginTop: spacing.xl }}>
        <ListGroup>
          <HealthEntryRow
            label="Workout"
            description="Train, log sets, review progress"
            glyph="fitness-center"
            tileFace={workoutTile.tile}
            tileInk={workoutTile.ink}
            onPress={() => openSection('workout')}
          />
          <HealthEntryRow
            label="Calories"
            description="Log meals, track calories and macros"
            glyph="restaurant"
            tileFace={caloriesTile.tile}
            tileInk={caloriesTile.ink}
            onPress={() => openSection('calories')}
          />
        </ListGroup>
      </View>
    </Screen>
  );
}

/**
 * One routing row (64pt): a 40px tinted tile in the CHILD section's hue, then
 * the name and a caption, then a chevron hint. The whole row is the target, so
 * the chevron is decoration rather than the only affordance (§6 `ListRow`).
 *
 * Rows inside a `ListGroup` do not carry their own lip: the group owns the 2px
 * ring and the hairline dividers, and a per-row slab would draw five stacked
 * lips (§5.7 "never a nested-card look"). Press feedback is the same
 * momentary dim the surface shipped with.
 */
function HealthEntryRow({
  label,
  description,
  glyph,
  tileFace,
  tileInk,
  onPress,
}: {
  label: string;
  description: string;
  glyph: keyof typeof MaterialIcons.glyphMap;
  tileFace: string;
  tileInk: string;
  onPress: () => void;
}) {
  const { tokens } = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open ${label}`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: 64,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        gap: spacing.md,
      }}
    >
      <View
        style={{
          width: HEALTH_TILE_SIZE,
          height: HEALTH_TILE_SIZE,
          borderRadius: radius.sm,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: tileFace,
        }}
      >
        <MaterialIcons name={glyph} size={22} color={tileInk} />
      </View>
      <View className="min-w-0 flex-1">
        <Text variant="titleMd" style={{ color: tokens.text, fontSize: 17, lineHeight: 22 }}>
          {label}
        </Text>
        <Text variant="caption" tone="muted" numberOfLines={1} style={{ marginTop: 2 }}>
          {description}
        </Text>
      </View>
      <MaterialIcons name="chevron-right" size={22} color={tokens.iconMuted} />
    </Pressable>
  );
}
