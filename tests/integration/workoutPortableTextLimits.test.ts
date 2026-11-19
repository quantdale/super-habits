import { describe, expect, it, vi } from 'vitest';
import { freshDatabase, type TestDatabase } from './helpers/db';

vi.mock('expo-constants', () => ({ default: { expoConfig: { version: '1.0.0' } } }));
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async () => null),
    setItem: vi.fn(async () => undefined),
    removeItem: vi.fn(async () => undefined),
  },
}));

type WorkoutData = typeof import('@/features/workout/workout.data');
const workoutTables = [
  'workout_routines',
  'routine_exercises',
  'routine_exercise_sets',
  'workout_logs',
  'workout_session_exercises',
  'workout_session_sets',
  'custom_exercises',
  'workout_weekly_plan',
  'workout_schedule_overrides',
  'body_weight_entries',
] as const;
type WorkoutTable = (typeof workoutTables)[number];

async function dumpWorkout(db: TestDatabase) {
  return Object.fromEntries(
    await Promise.all(
      workoutTables.map(async (table) => [
        table,
        await db.getAllAsync(`SELECT * FROM ${table} ORDER BY id`),
      ]),
    ),
  );
}

async function addRoutine(workout: WorkoutData, name = 'Routine') {
  await workout.addRoutine(name, '');
  return (await workout.listRoutines()).find((row) => row.name === name)!.id;
}

const customDefaults = {
  name: 'Custom exercise',
  primaryArea: 'back',
  modality: 'bodyweight',
} as const;
const paddedName = `${' '.repeat(301)}${'n'.repeat(100)}${' '.repeat(301)}`;
// All aliases are at the old 100-character item limit, but escaping makes
// their serialized JSON exceed the old 5,000-character array limit.
const escapedAliases = Array.from(
  { length: 12 },
  (_, index) => `${index}\u0001${'\u0001'.repeat(97)}`,
);

type TextCase = {
  name: string;
  table: WorkoutTable;
  expected: Record<string, unknown>;
  write: (workout: WorkoutData, routineId: string) => Promise<unknown>;
};

const textCases: TextCase[] = [
  {
    name: 'custom instructions above 1,000 characters',
    table: 'custom_exercises',
    expected: { instructions: 'i'.repeat(1_001) },
    write: (w) => w.createCustomExercise({ ...customDefaults, instructions: 'i'.repeat(1_001) }),
  },
  {
    name: 'alias above 100 characters',
    table: 'custom_exercises',
    expected: { aliases: JSON.stringify(['a'.repeat(101)]) },
    write: (w) => w.createCustomExercise({ ...customDefaults, aliases: ['a'.repeat(101)] }),
  },
  {
    name: 'escaped alias JSON above 5,000 characters',
    table: 'custom_exercises',
    expected: { aliases: JSON.stringify(escapedAliases) },
    write: (w) => w.createCustomExercise({ ...customDefaults, aliases: escapedAliases }),
  },
  {
    name: 'secondary area above 100 characters',
    table: 'custom_exercises',
    expected: { secondary_areas: JSON.stringify(['s'.repeat(101)]) },
    write: (w) => w.createCustomExercise({ ...customDefaults, secondaryAreas: ['s'.repeat(101)] }),
  },
  ...(
    [
      ['description', 'description', 5_001],
      ['primary_area', 'primaryArea', 1_001],
      ['equipment', 'equipment', 1_001],
    ] as const
  ).map(([column, input, length]): TextCase => ({
    name: `custom ${column} above the recovery limit`,
    table: 'custom_exercises',
    expected: { [column]: 'c'.repeat(length) },
    write: (w) => w.createCustomExercise({ ...customDefaults, [input]: 'c'.repeat(length) }),
  })),
  {
    name: 'raw routine name with writer-valid trimmed length',
    table: 'workout_routines',
    expected: { name: paddedName },
    write: (w) => addRoutine(w, paddedName),
  },
  {
    name: 'routine name snapshot retains raw whitespace',
    table: 'workout_logs',
    expected: { routine_name: paddedName },
    write: async (w) => w.completeRoutine(await addRoutine(w, paddedName)),
  },
  {
    name: 'raw exercise name with writer-valid trimmed length',
    table: 'routine_exercises',
    expected: { name: paddedName },
    write: (w, routineId) => w.addExercise({ routineId, name: paddedName }),
  },
  {
    name: 'routine description above 5,000 characters',
    table: 'workout_routines',
    expected: { description: 'd'.repeat(5_001) },
    write: (w, id) => w.updateRoutine(id, { description: 'd'.repeat(5_001) }),
  },
  {
    name: 'routine goal tag above 300 characters',
    table: 'workout_routines',
    expected: { goal_tag: 'g'.repeat(301) },
    write: (w, id) => w.updateRoutine(id, { goalTag: 'g'.repeat(301) }),
  },
  {
    name: 'exercise notes above 10,000 characters',
    table: 'routine_exercises',
    expected: { notes: 'n'.repeat(10_001) },
    write: (w, routineId) =>
      w.addExercise({ routineId, name: 'Exercise', notes: 'n'.repeat(10_001) }),
  },
  {
    name: 'superset group above 300 characters',
    table: 'routine_exercises',
    expected: { superset_group: 'g'.repeat(301) },
    write: (w, routineId) =>
      w.addExercise({ routineId, name: 'Exercise', supersetGroup: 'g'.repeat(301) }),
  },
  {
    name: 'session notes above 10,000 characters',
    table: 'workout_logs',
    expected: { notes: 'n'.repeat(10_001) },
    write: (w, routineId) =>
      w.logWorkoutSession({ routineId, notes: 'n'.repeat(10_001), exercises: [] }),
  },
  {
    name: 'session exercise name snapshot above 300 characters',
    table: 'workout_session_exercises',
    expected: { exercise_name: 'e'.repeat(301) },
    write: (w, routineId) =>
      w.logWorkoutSession({
        routineId,
        exercises: [{ exerciseName: 'e'.repeat(301), setsCompleted: 0, sets: [] }],
      }),
  },
  {
    name: 'weekly plan note above 500 characters',
    table: 'workout_weekly_plan',
    expected: { note: 'n'.repeat(501) },
    write: (w, routineId) =>
      w.upsertWeeklyPlanEntry({
        weekday: 1,
        routineId,
        planKind: 'workout',
        note: 'n'.repeat(501),
      }),
  },
  {
    name: 'schedule override note above 500 characters',
    table: 'workout_schedule_overrides',
    expected: { note: 'n'.repeat(501) },
    write: (w, routineId) =>
      w.setWorkoutScheduleOverride({
        dateKey: '2026-11-16',
        routineId,
        overrideKind: 'workout',
        note: 'n'.repeat(501),
      }),
  },
  {
    name: 'body-weight note above 500 characters',
    table: 'body_weight_entries',
    expected: { note: 'n'.repeat(501) },
    write: (w) => w.addBodyWeightEntry({ weight: 180.5, unit: 'lb', note: 'n'.repeat(501) }),
  },
];

/** Actual writer → successful export → preview → confirm → exact SQLite rows. */
async function roundTrip(
  write: (workout: WorkoutData, routineId: string) => Promise<unknown>,
  expected?: { table: WorkoutTable; values: Record<string, unknown> },
) {
  const source = await freshDatabase();
  let json: string;
  let fileName: string;
  let rows: Awaited<ReturnType<typeof dumpWorkout>>;
  let preferences: Awaited<ReturnType<WorkoutData['getWorkoutPreferences']>>;
  try {
    const workout = await import('@/features/workout/workout.data');
    const routineId = await addRoutine(workout);
    await write(workout, routineId);
    rows = await dumpWorkout(source);
    if (expected) {
      expect(rows[expected.table]).toEqual(
        expect.arrayContaining([expect.objectContaining(expected.values)]),
      );
    }
    preferences = await workout.getWorkoutPreferences();
    const { exportPortableBackup } = await import('@/core/portable/portableExport');
    const exported = await exportPortableBackup();
    expect(exported.ok).toBe(true);
    if (!exported.ok) throw new Error(exported.error);
    ({ json, fileName } = exported);
  } finally {
    await source.closeAsync();
  }
  const target = await freshDatabase();
  try {
    const { preparePortableImport, confirmPortableImport } =
      await import('@/core/portable/portableImport');
    const prepared = await preparePortableImport({ fileName, text: json });
    expect(
      prepared.status,
      prepared.status === 'ready' ? undefined : JSON.stringify(prepared),
    ).toBe('ready');
    if (prepared.status !== 'ready') throw new Error('Import was rejected');
    expect((await confirmPortableImport({ file: prepared.file })).status).toBe('restored');
    expect(await dumpWorkout(target)).toEqual(rows);
    const workout = await import('@/features/workout/workout.data');
    expect(await workout.getWorkoutPreferences()).toEqual(preferences);
  } finally {
    await target.closeAsync();
  }
}

describe('workout portable text compatibility', () => {
  it.each(textCases)('$name survives a full import', async ({ write, table, expected }) => {
    await roundTrip(write, { table, values: expected });
  });

  it('preserves long edited values, normalized arrays, prescriptions and kg/lb/bodyweight history', async () => {
    const text = 'cue🙂"\n'.repeat(2_000);
    await roundTrip(async (w, routineId) => {
      await w.updateRoutine(routineId, { name: 'r'.repeat(100), description: text, goalTag: text });
      const exerciseId = await w.addExercise({ routineId, name: 'Exercise' });
      await w.updateExercise(exerciseId, {
        name: 'e'.repeat(100),
        notes: text,
        supersetGroup: text,
      });
      const customId = await w.createCustomExercise(customDefaults);
      const aliases = Array.from({ length: 13 }, (_, i) => `ALIAS ${i} ${text}`);
      const areas = Array.from({ length: 9 }, (_, i) => `AREA ${i} ${text}`);
      await w.updateCustomExercise(customId, {
        name: 'c'.repeat(100),
        description: text,
        instructions: text,
        aliases,
        primaryArea: text,
        secondaryAreas: areas,
        equipment: text,
      });
      const [custom] = await w.listCustomExercises();
      expect(JSON.parse(custom.aliases!)).toEqual(
        aliases.slice(0, 12).map((s) => s.trim().toLowerCase()),
      );
      expect(JSON.parse(custom.secondary_areas)).toEqual(
        areas.slice(0, 8).map((s) => s.trim().toLowerCase()),
      );
      const setId = await w.addSet({
        exerciseId,
        activeSeconds: 3_600,
        restSeconds: 1_800,
        targetRepsMin: 1,
        targetRepsMax: 100,
        targetLoad: 0,
        targetDurationSeconds: 0,
        targetDistance: 0,
        targetPace: 0,
      });
      await w.updateSetPrescription(setId, {
        targetRepsMin: null,
        targetRepsMax: null,
        targetLoad: 2.5,
        targetDurationSeconds: 4_000,
        targetDistance: 42.195,
        targetPace: 5.5,
      });
      await w.upsertWeeklyPlanEntry({ weekday: 1, planKind: 'rest' });
      await w.upsertWeeklyPlanEntry({ weekday: 1, planKind: 'workout', routineId, note: text });
      await w.setWorkoutScheduleOverride({ dateKey: '2026-11-16', overrideKind: 'rest' });
      await w.setWorkoutScheduleOverride({
        dateKey: '2026-11-16',
        overrideKind: 'workout',
        routineId,
        note: text,
      });
      const weightId = await w.addBodyWeightEntry({ weight: 80, unit: 'kg' });
      await w.updateBodyWeightEntry(weightId, { weight: 1_000, unit: 'lb', note: text });
      const logged = await w.logWorkoutSession({
        routineId,
        notes: text,
        exercises: [
          {
            exerciseName: text,
            setsCompleted: 2,
            modality: 'weighted_strength',
            sets: [
              { setNumber: 1, weight: 60, weightUnit: 'kg', reps: 8, completed: true },
              { setNumber: 2, weight: 100, weightUnit: 'lb', reps: 8, completed: true },
            ],
          },
          {
            exerciseName: 'Bodyweight',
            setsCompleted: 0,
            modality: 'bodyweight',
            supportsExternalLoad: false,
            sets: [{ setNumber: 1, weight: null, reps: null, completed: false }],
          },
          { exerciseName: 'Empty sets', setsCompleted: 0, sets: [] },
        ],
      });
      expect(logged.status).toBe('applied');
      // True writer boundaries stay unchanged; recovery must not tighten them.
      await expect(w.addRoutine('r'.repeat(101), '')).rejects.toThrow();
      await expect(w.updateRoutine(routineId, { name: 'r'.repeat(101) })).rejects.toThrow();
      await expect(w.addExercise({ routineId, name: 'e'.repeat(101) })).rejects.toThrow();
      await expect(w.updateExercise(exerciseId, { name: 'e'.repeat(101) })).rejects.toThrow();
      await expect(
        w.createCustomExercise({ ...customDefaults, name: 'c'.repeat(101) }),
      ).rejects.toThrow();
      await expect(w.updateCustomExercise(customId, { name: 'c'.repeat(101) })).rejects.toThrow();
      await expect(w.addBodyWeightEntry({ weight: 1_001, unit: 'kg' })).rejects.toThrow();
      await expect(w.updateBodyWeightEntry(weightId, { weight: 1_001 })).rejects.toThrow();
      await expect(
        w.addSet({ exerciseId, activeSeconds: 3_601, restSeconds: 0 }),
      ).rejects.toThrow();
      await expect(w.updateSet(setId, { restSeconds: 1_801 })).rejects.toThrow();
      // Preserve recovery's historical name-content cap while allowing the
      // raw whitespace that create writers persist around a valid name.
      const { validateBackupRow } = await import('@/core/backup/backupValidators');
      expect(
        validateBackupRow('workout_routines', {
          ...(await w.listRoutines())[0],
          name: 'r'.repeat(300),
        }).ok,
      ).toBe(true);
      expect(
        validateBackupRow('routine_exercises', {
          ...(await w.listExercises(routineId))[0],
          name: 'e'.repeat(300),
        }).ok,
      ).toBe(true);
      expect(
        validateBackupRow('workout_routines', {
          ...(await w.listRoutines())[0],
          name: 'r'.repeat(301),
        }).ok,
      ).toBe(false);
      expect(
        validateBackupRow('routine_exercises', {
          ...(await w.listExercises(routineId))[0],
          name: 'e'.repeat(301),
        }).ok,
      ).toBe(false);
    });
  });

  it.each(['kg', 'lb'] as const)(
    'preserves writer-valid goal weights above 1,000 %s',
    async (unit) => {
      await roundTrip(async (w) => {
        await w.saveWorkoutPreferences({
          effortScale: 'rpe',
          goalWeight: { value: 1_000.5, unit },
          workoutReminder: { enabled: false, time: { hour: 23, minute: 59 } },
        });
        expect((await w.getWorkoutPreferences()).goalWeight).toEqual({ value: 1_000.5, unit });
      });
    },
  );
});
