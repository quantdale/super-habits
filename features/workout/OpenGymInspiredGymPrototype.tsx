import { MaterialIcons } from '@expo/vector-icons';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Card } from '@/core/ui/Card';
import { PageHeader } from '@/core/ui/PageHeader';
import { Screen } from '@/core/ui/Screen';
import { ScreenSection } from '@/core/ui/ScreenSection';
import { Button } from '@/core/ui/Button';
import { useAppTheme } from '@/core/providers/themeContext';
import { SECTION_COLORS } from '@/constants/sectionColors';

const COLOR = SECTION_COLORS.workout;

const WEEK = [
  { day: 'M', date: '17', state: 'done' },
  { day: 'T', date: '18', state: 'done' },
  { day: 'W', date: '19', state: 'plan' },
  { day: 'T', date: '20', state: 'rest' },
  { day: 'F', date: '21', state: 'plan' },
  { day: 'S', date: '22', state: 'rest' },
  { day: 'S', date: '23', state: 'today' },
] as const;

const ROUTINES = [
  {
    name: 'Push',
    detail: '6 exercises · chest, shoulders, triceps',
    icon: 'fitness-center' as const,
  },
  { name: 'Pull', detail: '6 exercises · back, rear delts, biceps', icon: 'rowing' as const },
  {
    name: 'Legs',
    detail: '7 exercises · quads, hamstrings, calves',
    icon: 'directions-run' as const,
  },
];

const EXERCISES = [
  { name: 'Bench Press', meta: 'Chest · Barbell', best: '82.5 kg' },
  { name: 'Incline Dumbbell Press', meta: 'Chest · Dumbbell', best: '30 kg' },
  { name: 'Cable Fly', meta: 'Chest · Cable', best: '17.5 kg' },
];

function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
  const { tokens } = useAppTheme();
  return (
    <View className="mb-3">
      <Text className="text-base font-semibold" style={{ color: tokens.text }}>
        {title}
      </Text>
      <Text className="mt-1 text-sm" style={{ color: tokens.textMuted }}>
        {subtitle}
      </Text>
    </View>
  );
}

function MiniMetric({
  icon,
  value,
  label,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  value: string;
  label: string;
}) {
  const { tokens, sectionAccents } = useAppTheme();
  return (
    <View
      className="min-w-[98px] flex-1 rounded-2xl border px-3 py-3"
      style={{ borderColor: tokens.border, backgroundColor: tokens.surface }}
    >
      <MaterialIcons name={icon} size={18} color={sectionAccents.workout.text} />
      <Text className="mt-2 text-lg font-bold" style={{ color: tokens.text }}>
        {value}
      </Text>
      <Text className="mt-0.5 text-xs" style={{ color: tokens.textMuted }}>
        {label}
      </Text>
    </View>
  );
}

function WeekStrip() {
  const { tokens, sectionAccents } = useAppTheme();
  return (
    <View className="flex-row gap-2">
      {WEEK.map((item, index) => {
        const emphasized = item.state === 'today';
        const completed = item.state === 'done';
        const planned = item.state === 'plan';
        return (
          <View
            key={`${item.day}-${index}`}
            className="min-w-0 flex-1 items-center rounded-xl border py-2"
            style={{
              borderColor: emphasized ? COLOR : tokens.border,
              backgroundColor: emphasized ? tokens.surfaceElevated : tokens.surface,
            }}
          >
            <Text className="text-[10px] font-semibold" style={{ color: tokens.textMuted }}>
              {item.day}
            </Text>
            <Text className="mt-1 text-sm font-semibold" style={{ color: tokens.text }}>
              {item.date}
            </Text>
            <View
              className="mt-2 h-1.5 w-1.5 rounded-full"
              style={{
                backgroundColor: completed
                  ? sectionAccents.workout.text
                  : planned
                    ? COLOR
                    : emphasized
                      ? tokens.text
                      : tokens.border,
              }}
            />
          </View>
        );
      })}
    </View>
  );
}

function RoutineRow({ name, detail, icon }: (typeof ROUTINES)[number]) {
  const { tokens, sectionAccents } = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Preview ${name} routine`}
      className="mb-2 flex-row items-center rounded-2xl border px-3 py-3"
      style={{ borderColor: tokens.border, backgroundColor: tokens.surface }}
    >
      <View
        className="h-10 w-10 items-center justify-center rounded-xl"
        style={{ backgroundColor: tokens.surfaceElevated }}
      >
        <MaterialIcons name={icon} size={21} color={sectionAccents.workout.text} />
      </View>
      <View className="ml-3 min-w-0 flex-1">
        <Text className="text-sm font-semibold" style={{ color: tokens.text }}>
          {name}
        </Text>
        <Text className="mt-0.5 text-xs" numberOfLines={1} style={{ color: tokens.textMuted }}>
          {detail}
        </Text>
      </View>
      <View
        className="rounded-full px-3 py-1.5"
        style={{ backgroundColor: tokens.surfaceElevated }}
      >
        <Text className="text-xs font-semibold" style={{ color: sectionAccents.workout.text }}>
          Start
        </Text>
      </View>
    </Pressable>
  );
}

function SetPreview({
  set,
  weight,
  reps,
  done,
}: {
  set: number;
  weight: string;
  reps: string;
  done?: boolean;
}) {
  const { tokens, sectionAccents } = useAppTheme();
  return (
    <View className="mb-2 flex-row items-center gap-2">
      <Text className="w-7 text-center text-xs font-semibold" style={{ color: tokens.textMuted }}>
        {set}
      </Text>
      <View className="flex-1 rounded-xl border px-3 py-2" style={{ borderColor: tokens.border }}>
        <Text className="text-center text-sm font-semibold" style={{ color: tokens.text }}>
          {weight}
        </Text>
      </View>
      <View className="flex-1 rounded-xl border px-3 py-2" style={{ borderColor: tokens.border }}>
        <Text className="text-center text-sm font-semibold" style={{ color: tokens.text }}>
          {reps}
        </Text>
      </View>
      <View
        className="h-9 w-9 items-center justify-center rounded-full border"
        style={{
          borderColor: done ? COLOR : tokens.border,
          backgroundColor: done ? COLOR : 'transparent',
        }}
      >
        <MaterialIcons
          name="check"
          size={18}
          color={done ? tokens.textOnAccent : sectionAccents.workout.text}
        />
      </View>
    </View>
  );
}

export function OpenGymInspiredGymPrototype() {
  const { tokens, sectionAccents } = useAppTheme();
  const accentText = sectionAccents.workout.text;

  return (
    <Screen scroll>
      <ScreenSection>
        <PageHeader
          title="Gym · Prototype"
          subtitle="Clean-room SuperHabits adaptation of OpenGym's training-first information architecture."
        />
      </ScreenSection>

      <ScreenSection>
        <Card accentColor={COLOR} className="mb-0">
          <View className="flex-row items-start justify-between gap-3">
            <View className="min-w-0 flex-1">
              <Text
                className="text-xs font-semibold uppercase tracking-wide"
                style={{ color: accentText }}
              >
                Today · Sunday
              </Text>
              <Text className="mt-1 text-2xl font-bold" style={{ color: tokens.text }}>
                Push · in progress
              </Text>
              <Text className="mt-1 text-sm" style={{ color: tokens.textMuted }}>
                3 of 18 working sets complete · 24 min elapsed
              </Text>
            </View>
            <View className="rounded-2xl p-3" style={{ backgroundColor: tokens.surfaceElevated }}>
              <MaterialIcons name="timer" size={24} color={accentText} />
            </View>
          </View>
          <View className="mt-5">
            <Button label="Resume workout" onPress={() => {}} color={COLOR} />
          </View>
          <View className="mt-3">
            <WeekStrip />
          </View>
        </Card>
      </ScreenSection>

      <ScreenSection>
        <View className="flex-row flex-wrap gap-3">
          <MiniMetric icon="local-fire-department" value="6 wk" label="Training streak" />
          <MiniMetric icon="fitness-center" value="42" label="Workouts" />
          <MiniMetric icon="monitor-weight" value="80.4" label="Body weight kg" />
        </View>
      </ScreenSection>

      <ScreenSection>
        <SectionTitle
          title="Quick start"
          subtitle="The OpenGym pattern: today's session first, then alternative routines without digging through menus."
        />
        {ROUTINES.map((routine) => (
          <RoutineRow key={routine.name} {...routine} />
        ))}
        <Button label="Freestyle workout" variant="ghost" onPress={() => {}} />
      </ScreenSection>

      <ScreenSection>
        <Card
          variant="header"
          accentColor={COLOR}
          headerTitle="Weekly plan"
          headerSubtitle="Assign a routine to each weekday; rescheduling becomes an override rather than destructive editing."
          headerRight={
            <MaterialIcons name="calendar-month" size={22} color={tokens.textOnAccent} />
          }
          className="mb-0"
        >
          {[
            ['Monday', 'Push'],
            ['Tuesday', 'Pull'],
            ['Wednesday', 'Legs'],
            ['Thursday', 'Rest'],
            ['Friday', 'Push'],
          ].map(([day, routine]) => (
            <View
              key={day}
              className="flex-row items-center border-b py-3"
              style={{ borderBottomColor: tokens.border }}
            >
              <Text className="flex-1 text-sm font-medium" style={{ color: tokens.text }}>
                {day}
              </Text>
              <Text
                className="text-sm font-semibold"
                style={{ color: routine === 'Rest' ? tokens.textMuted : accentText }}
              >
                {routine}
              </Text>
              <MaterialIcons name="chevron-right" size={20} color={tokens.textMuted} />
            </View>
          ))}
        </Card>
      </ScreenSection>

      <ScreenSection>
        <Card
          variant="header"
          accentColor={COLOR}
          headerTitle="Exercise library"
          headerSubtitle="Search first; then narrow by body part and equipment."
          headerRight={<MaterialIcons name="search" size={22} color={tokens.textOnAccent} />}
          className="mb-0"
        >
          <View
            className="mb-3 flex-row items-center rounded-2xl border px-3"
            style={{ borderColor: tokens.border, backgroundColor: tokens.surface }}
          >
            <MaterialIcons name="search" size={20} color={tokens.textMuted} />
            <TextInput
              editable={false}
              value="bench"
              className="ml-2 flex-1 py-3 text-sm"
              style={{ color: tokens.text }}
            />
          </View>
          <View className="mb-3 flex-row flex-wrap gap-2">
            {['All', 'Chest', 'Back', 'Legs', 'Shoulders', 'Arms'].map((chip, index) => (
              <View
                key={chip}
                className="rounded-full border px-3 py-1.5"
                style={{
                  borderColor: index === 1 ? COLOR : tokens.border,
                  backgroundColor: index === 1 ? tokens.surfaceElevated : tokens.surface,
                }}
              >
                <Text
                  className="text-xs font-semibold"
                  style={{ color: index === 1 ? accentText : tokens.textMuted }}
                >
                  {chip}
                </Text>
              </View>
            ))}
          </View>
          {EXERCISES.map((exercise) => (
            <View
              key={exercise.name}
              className="mb-2 flex-row items-center rounded-2xl border p-3"
              style={{ borderColor: tokens.border }}
            >
              <View
                className="h-11 w-11 items-center justify-center rounded-xl"
                style={{ backgroundColor: tokens.surfaceElevated }}
              >
                <MaterialIcons name="fitness-center" size={20} color={accentText} />
              </View>
              <View className="ml-3 min-w-0 flex-1">
                <Text className="text-sm font-semibold" style={{ color: tokens.text }}>
                  {exercise.name}
                </Text>
                <Text className="mt-0.5 text-xs" style={{ color: tokens.textMuted }}>
                  {exercise.meta}
                </Text>
              </View>
              <Text className="text-xs font-semibold" style={{ color: accentText }}>
                {exercise.best}
              </Text>
            </View>
          ))}
        </Card>
      </ScreenSection>

      <ScreenSection>
        <Card
          variant="header"
          accentColor={COLOR}
          headerTitle="Guided workout"
          headerSubtitle="Previous performance, current prescription and set completion stay in one glanceable block."
          headerRight={<MaterialIcons name="play-circle" size={22} color={tokens.textOnAccent} />}
          className="mb-0"
        >
          <View className="mb-3 flex-row items-start justify-between gap-3">
            <View className="min-w-0 flex-1">
              <Text className="text-lg font-bold" style={{ color: tokens.text }}>
                Bench Press
              </Text>
              <Text className="mt-1 text-xs" style={{ color: tokens.textMuted }}>
                Last time: 80 × 8, 80 × 8, 80 × 7 · Best 82.5 kg
              </Text>
              <Text className="mt-1 text-xs font-semibold" style={{ color: accentText }}>
                Linear progression · +2.5 kg after completed target
              </Text>
            </View>
            <View
              className="rounded-full px-3 py-1.5"
              style={{ backgroundColor: tokens.surfaceElevated }}
            >
              <Text className="text-xs font-semibold" style={{ color: accentText }}>
                Chest
              </Text>
            </View>
          </View>
          <View className="mb-2 flex-row items-center gap-2">
            <Text
              className="w-7 text-center text-[10px] font-semibold"
              style={{ color: tokens.textMuted }}
            >
              SET
            </Text>
            <Text
              className="flex-1 text-center text-[10px] font-semibold"
              style={{ color: tokens.textMuted }}
            >
              WEIGHT
            </Text>
            <Text
              className="flex-1 text-center text-[10px] font-semibold"
              style={{ color: tokens.textMuted }}
            >
              REPS
            </Text>
            <Text
              className="w-9 text-center text-[10px] font-semibold"
              style={{ color: tokens.textMuted }}
            >
              DONE
            </Text>
          </View>
          <SetPreview set={1} weight="82.5" reps="8" done />
          <SetPreview set={2} weight="82.5" reps="8" />
          <SetPreview set={3} weight="82.5" reps="8" />
          <View className="mt-2 flex-row gap-2">
            <View className="flex-1">
              <Button label="Add set" variant="ghost" onPress={() => {}} />
            </View>
            <View className="flex-1">
              <Button label="Rest · 1:45" onPress={() => {}} color={COLOR} />
            </View>
          </View>
        </Card>
      </ScreenSection>

      <ScreenSection>
        <SectionTitle
          title="Progress & history"
          subtitle="Deep analytics are separate from the training flow so the landing screen stays action-oriented."
        />
        <View className="flex-row flex-wrap gap-3">
          <MiniMetric icon="trending-up" value="+4.2%" label="Estimated 1RM" />
          <MiniMetric icon="bar-chart" value="57" label="Sets this week" />
          <MiniMetric icon="schedule" value="4h 18m" label="Training time" />
        </View>
        <Card accentColor={COLOR} className="mb-0 mt-3">
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-base font-semibold" style={{ color: tokens.text }}>
                Muscle balance
              </Text>
              <Text className="mt-1 text-xs" style={{ color: tokens.textMuted }}>
                Most trained this week
              </Text>
            </View>
            <MaterialIcons name="accessibility-new" size={25} color={accentText} />
          </View>
          <View className="mt-4 gap-3">
            {(
              [
                ['Chest', 88],
                ['Back', 74],
                ['Quads', 62],
                ['Hamstrings', 45],
              ] as [string, number][]
            ).map(([name, width]) => (
              <View key={String(name)} className="flex-row items-center gap-3">
                <Text className="w-20 text-xs" style={{ color: tokens.textMuted }}>
                  {name}
                </Text>
                <View
                  className="h-2 flex-1 overflow-hidden rounded-full"
                  style={{ backgroundColor: tokens.surfaceElevated }}
                >
                  <View
                    className="h-full rounded-full"
                    style={{ width: `${width}%`, backgroundColor: COLOR }}
                  />
                </View>
              </View>
            ))}
          </View>
        </Card>
      </ScreenSection>

      <ScreenSection className="mb-0">
        <Card accentColor={COLOR} className="mb-0">
          <View className="flex-row items-center gap-3">
            <MaterialIcons name="science" size={22} color={accentText} />
            <View className="min-w-0 flex-1">
              <Text className="text-sm font-semibold" style={{ color: tokens.text }}>
                Phase-0 design slice
              </Text>
              <Text className="mt-1 text-xs" style={{ color: tokens.textMuted }}>
                This route intentionally uses representative data. Production phases will bind each
                surface to SuperHabits SQLite/domain APIs and preserve offline-first behavior.
              </Text>
            </View>
          </View>
        </Card>
      </ScreenSection>
    </Screen>
  );
}
