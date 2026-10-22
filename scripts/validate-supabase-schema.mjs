import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const supabaseRoot = path.join(repoRoot, 'supabase');
const migrationsRoot = path.join(supabaseRoot, 'migrations');
const syncTables = ['todos', 'habits', 'calorie_entries', 'workout_routines'];
const backupTables = [
  'habit_completions',
  'pomodoro_sessions',
  'routine_exercises',
  'routine_exercise_sets',
  'workout_logs',
  'workout_session_exercises',
  'saved_meals',
  'linked_action_rules',
  'user_backup_settings',
  'backup_manifest',
  'custom_exercises',
  'workout_weekly_plan',
  'workout_schedule_overrides',
  'body_weight_entries',
];

const failures = [];

function read(relativePath) {
  const absolutePath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(absolutePath)) {
    failures.push(`${relativePath} is missing`);
    return '';
  }
  return fs.readFileSync(absolutePath, 'utf8');
}

function requireText(label, source, pattern) {
  if (!pattern.test(source)) failures.push(`${label} is missing ${pattern}`);
}

const migrationNames = fs.existsSync(migrationsRoot)
  ? fs
      .readdirSync(migrationsRoot)
      .filter((name) => name.endsWith('.sql'))
      .sort()
  : [];

const requiredMigrations = [
  '20260810130000_add_habits_rule_history.sql',
  '20260814140000_sync_schema_baseline.sql',
  '20260814150000_ai_request_quota.sql',
];
for (const migration of requiredMigrations) {
  if (!migrationNames.includes(migration)) failures.push(`missing migration ${migration}`);
}

const ownershipMigrationName = migrationNames.find((name) =>
  /_secure_sync_row_ownership\.sql$/.test(name),
);
const v2MigrationName = migrationNames.find((name) =>
  /_add_backup_completeness_v2\.sql$/.test(name),
);
const remediationMigrationName = migrationNames.find((name) =>
  /_backup_v2_closure_remediation\.sql$/.test(name),
);
const gymMigrationName = migrationNames.find((name) =>
  /_add_gym_training_v2_backup_scope\.sql$/.test(name),
);
const deepGymMigrationName = migrationNames.find((name) =>
  /_add_gym_workout_deep_expansion\.sql$/.test(name),
);
const ownerScopedRemediationName = migrationNames.find((name) =>
  /_habit_completions_owner_scoped_uniqueness\.sql$/.test(name),
);
if (!ownershipMigrationName) {
  failures.push('missing secure sync ownership migration');
}
if (!v2MigrationName) {
  failures.push('missing backup completeness v2 migration');
}
if (!remediationMigrationName) {
  failures.push('missing backup v2 closure remediation migration');
}
if (!gymMigrationName) failures.push('missing Gym V2 backup scope migration');
if (!deepGymMigrationName) failures.push('missing Gym Workout V2 deep expansion migration');
if (!ownerScopedRemediationName) {
  failures.push('missing habit_completions owner-scoped uniqueness remediation migration');
}
if (migrationNames.join('\n') !== [...migrationNames].sort().join('\n')) {
  failures.push('migration filenames are not lexically ordered');
}

const baseline = read('supabase/migrations/20260814140000_sync_schema_baseline.sql');
const quota = read('supabase/migrations/20260814150000_ai_request_quota.sql');
const ownership = ownershipMigrationName
  ? read(`supabase/migrations/${ownershipMigrationName}`)
  : '';
const v2Migration = v2MigrationName ? read(`supabase/migrations/${v2MigrationName}`) : '';
const remediationMigration = remediationMigrationName
  ? read(`supabase/migrations/${remediationMigrationName}`)
  : '';
const gymMigration = gymMigrationName ? read(`supabase/migrations/${gymMigrationName}`) : '';
const deepGymMigration = deepGymMigrationName
  ? read(`supabase/migrations/${deepGymMigrationName}`)
  : '';
const ownerScopedRemediation = ownerScopedRemediationName
  ? read(`supabase/migrations/${ownerScopedRemediationName}`)
  : '';
const fixture = read('simulation/backend/schema.sql');

// A local SQLite REAL stores an eight-byte JavaScript number, while remote
// PostgreSQL REAL stores only four bytes. Restore V2 hashes canonical numbers,
// so the remote schema and disposable fixture must preserve every backed-up
// measurement without four-byte rounding.
const precisionMigrationName = '20260925125655_backup_numeric_precision.sql';
if (!migrationNames.includes(precisionMigrationName)) {
  failures.push(`missing migration ${precisionMigrationName}`);
}
if (
  migrationNames.includes(precisionMigrationName) &&
  (migrationNames.indexOf(precisionMigrationName) <= migrationNames.indexOf(gymMigrationName) ||
    migrationNames.indexOf(precisionMigrationName) <= migrationNames.indexOf(deepGymMigrationName))
) {
  failures.push('backup numeric precision migration must follow both Gym V2 migrations');
}
const precisionMigration = read(`supabase/migrations/${precisionMigrationName}`);
const precisionColumns = {
  calorie_entries: ['protein', 'carbs', 'fats', 'fiber'],
  saved_meals: ['protein', 'carbs', 'fats', 'fiber'],
  routine_exercises: ['progression_increment'],
  routine_exercise_sets: ['target_load', 'target_distance', 'target_pace'],
  workout_session_sets: ['weight', 'distance', 'pace', 'effort_value'],
  body_weight_entries: ['weight'],
};
for (const [table, columns] of Object.entries(precisionColumns)) {
  const migrationBlock =
    precisionMigration.match(new RegExp(`ALTER TABLE public\\.${table}\\b([^;]*);`, 'i'))?.[1] ??
    '';
  const fixtureBlock =
    fixture.match(
      new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table}\\s*\\(([^;]*?)\\n\\);`, 'i'),
    )?.[1] ?? '';
  for (const column of columns) {
    requireText(
      `precision migration ${table}.${column}`,
      migrationBlock,
      new RegExp(`ALTER COLUMN ${column} TYPE NUMERIC USING \\(${column}::text\\)::numeric`, 'i'),
    );
    requireText(
      `disposable fixture ${table}.${column} precision`,
      fixtureBlock,
      new RegExp(`\\b${column}\\s+NUMERIC\\b`, 'i'),
    );
  }
}
const config = read('supabase/config.toml');
const clientSource = [
  read('lib/supabase.ts'),
  read('core/sync/supabase.adapter.ts'),
  read('core/sync/restore.coordinator.ts'),
].join('\n');

for (const table of syncTables) {
  requireText(
    `baseline ${table}`,
    baseline,
    new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table}\\b`),
  );
  requireText(
    `baseline ${table} RLS`,
    baseline,
    new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`),
  );
  requireText(
    `fixture ${table}`,
    fixture,
    new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table}\\b`),
  );
  requireText(`ownership ${table}.user_id`, ownership, new RegExp(`['\"]${table}['\"]`, 'i'));
  requireText(
    `ownership ${table} RLS`,
    ownership,
    new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`),
  );
  requireText(`ownership ${table} index`, ownership, new RegExp(`idx_${table}_user_id`));
  requireText(`fixture ${table}.user_id`, fixture, /user_id\s+UUID/i);
}
requireText('ownership UUID owner column migration', ownership, /ADD COLUMN user_id UUID/i);

for (const table of backupTables) {
  const tableMigration = [
    'custom_exercises',
    'workout_weekly_plan',
    'workout_schedule_overrides',
    'body_weight_entries',
  ].includes(table)
    ? gymMigration
    : v2Migration;
  requireText(
    `backup migration ${table}`,
    tableMigration,
    new RegExp(`CREATE TABLE public\\.${table}\\b`),
  );
  requireText(
    `backup migration ${table} RLS`,
    tableMigration,
    new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`),
  );
  requireText(
    `backup migration ${table} owner FK`,
    tableMigration,
    new RegExp(
      `user_id UUID NOT NULL DEFAULT auth\\.uid\\(\\) REFERENCES auth\\.users\\(id\\) ON DELETE CASCADE`,
    ),
  );
  requireText(
    `backup migration ${table} owner predicate`,
    tableMigration,
    new RegExp(
      `CREATE POLICY sync_${table}_[a-z]+_owner ON public\\.${table}[\\s\\S]*?\\(\\s*select\\s+auth\\.uid\\(\\)\\s*\\)\\s*=\\s*user_id`,
      'i',
    ),
  );
  requireText(
    `backup migration ${table} update USING`,
    tableMigration,
    new RegExp(
      `CREATE POLICY sync_${table}_update_owner[\\s\\S]*?USING \\([\\s\\S]*?auth\\.uid\\(\\)[\\s\\S]*?user_id`,
      'i',
    ),
  );
  requireText(
    `backup migration ${table} update WITH CHECK`,
    tableMigration,
    new RegExp(
      `CREATE POLICY sync_${table}_update_owner[\\s\\S]*?WITH CHECK \\([\\s\\S]*?auth\\.uid\\(\\)[\\s\\S]*?user_id`,
      'i',
    ),
  );
  for (const operation of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) {
    const suffix = operation.toLowerCase();
    requireText(
      `backup migration ${table} ${operation} policy`,
      tableMigration,
      new RegExp(
        `CREATE POLICY sync_${table}_${suffix}_owner ON public\\.${table}[\\s\\S]*?FOR ${operation} TO authenticated`,
        'i',
      ),
    );
  }
  requireText(
    `fixture ${table}`,
    fixture,
    new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table}\\b`),
  );
  requireText(`fixture ${table}.user_id`, fixture, /user_id\s+UUID/i);
  requireText(
    `backup migration ${table} no anon grant`,
    tableMigration,
    /^(?![\s\S]*\bTO\s+anon\b)/i,
  );
}

const backupOwnerIndexTables = [
  'habit_completions',
  'pomodoro_sessions',
  'routine_exercises',
  'routine_exercise_sets',
  'workout_logs',
  'workout_session_exercises',
  'saved_meals',
  'linked_action_rules',
  'custom_exercises',
  'workout_weekly_plan',
  'workout_schedule_overrides',
  'body_weight_entries',
];
for (const table of backupOwnerIndexTables) {
  const tableMigration = [
    'custom_exercises',
    'workout_weekly_plan',
    'workout_schedule_overrides',
    'body_weight_entries',
  ].includes(table)
    ? gymMigration
    : v2Migration;
  requireText(`backup migration ${table} owner index`, tableMigration, new RegExp(`idx_${table}`));
}

// ---- Owner-scoped uniqueness guard (tasks 4.1-4.2) -------------------
//
// WHY THIS TABLE: three backup entities once declared a GLOBAL unique
// constraint whose scope was narrower than the owner, so two accounts could
// collide on a key that is only unique per account (and an upsert could
// silently affect zero rows). The `saved_meals` case was fixed by a
// remediation migration and guarded individually; `habit_completions` still
// carries `UNIQUE (habit_id, date_key)` in BOTH the migration SQL and the
// simulation fixture, so the guard has to name it explicitly.
//
// The table is explicit rather than a regex sweep for `UNIQUE` without
// `user_id`: a sweep false-positives on legitimate single-column indexes that
// are not backup entities, and it cannot tell an owner-scoped index from an
// unrelated one. Naming the tables keeps the scope honest — which is the
// property the guard exists to protect.
const OWNER_SCOPED_UNIQUENESS = [
  {
    table: 'saved_meals',
    ownerColumns: ['user_id'],
    globalConstraint: 'saved_meals_food_name_unique',
    remediation:
      'uq_saved_meals_owner_food_name (user_id, lower(food_name)) — see the V2 closure remediation migration',
  },
  {
    table: 'habit_completions',
    ownerColumns: ['user_id'],
    globalConstraint: 'habit_completions_habit_date_unique',
    remediation:
      'uq_habit_completions_owner_habit_date (user_id, habit_id, date_key) — must be declared by an owner-scoped migration and mirrored in the fixture',
  },
];

for (const entry of OWNER_SCOPED_UNIQUENESS) {
  // The global constraint must be ABSENT from the fixture.
  requireText(
    `fixture ${entry.table} has no global ${entry.globalConstraint} constraint`,
    fixture,
    new RegExp(
      `^(?![\\s\\S]*CONSTRAINT\\s+${entry.globalConstraint}\\s+UNIQUE\\s*\\((?![^)]*user_id)[^)]*\\))`,
      'i',
    ),
  );
  // ...and the owner-scoped index must be declared for it.
  const ownerScopedColumns = entry.ownerColumns.join('\\s*,\\s*');
  // Tolerate a wrapped definition (`CREATE UNIQUE INDEX ...\n  ON table (...)`)
  // while staying bounded so the match cannot run into an unrelated statement.
  const scopedIndexPattern = new RegExp(
    `CREATE UNIQUE INDEX[\\s\\S]{0,120}?ON\\s+(?:public\\.)?${entry.table}\\s*\\([^)]*${ownerScopedColumns}[^)]*\\)`,
    'i',
  );
  if (entry.table === 'saved_meals') {
    // The historical case: the remediation migration replaces the constraint.
    requireText(
      'remediation drops global saved_meals food-name constraint',
      remediationMigration,
      /ALTER TABLE public\.saved_meals[\s\S]*DROP CONSTRAINT saved_meals_food_name_unique/i,
    );
    requireText(
      'remediation creates owner-scoped saved_meals unique index',
      remediationMigration,
      /CREATE UNIQUE INDEX IF NOT EXISTS uq_saved_meals_owner_food_name\s+ON public\.saved_meals\s*\(\s*user_id\s*,\s*lower\(\s*food_name\s*\)\s*\)/i,
    );
    requireText(
      'fixture saved_meals has owner-scoped unique index',
      fixture,
      /CREATE UNIQUE INDEX IF NOT EXISTS uq_saved_meals_owner_food_name\s+ON public\.saved_meals\s*\(\s*user_id\s*,\s*lower\(\s*food_name\s*\)\s*\)/i,
    );
  } else {
    // A table whose global constraint is still present must be REMEDIATED, not
    // silently accepted: this is the guard's whole job. The remediation is an
    // ADDITIVE migration (the applied one is historical input), and the fixture
    // must carry the owner-scoped index the migration creates.
    requireText(
      `remediation drops global ${entry.globalConstraint} constraint`,
      ownerScopedRemediation,
      new RegExp(
        `ALTER TABLE (?:public\\.)?${entry.table}[\\s\\S]*DROP CONSTRAINT ${entry.globalConstraint}`,
        'i',
      ),
    );
    requireText(
      `remediation creates an owner-scoped ${entry.table} unique index`,
      ownerScopedRemediation,
      scopedIndexPattern,
    );
    requireText(
      `fixture ${entry.table} declares an owner-scoped unique index`,
      fixture,
      scopedIndexPattern,
    );
  }
}

// ---- Backup V2 closure remediation contract ----
// The global saved_meals food-name uniqueness from the V2 migration must be
// removed and replaced by an owner-scoped, case-insensitive index; the
// manifest must gain settings integrity metadata; and no migration may
// reintroduce global food-name uniqueness afterwards.
requireText(
  'remediation adds manifest settings metadata column',
  remediationMigration,
  /ALTER TABLE public\.backup_manifest[\s\S]*ADD COLUMN IF NOT EXISTS settings_metadata JSONB/i,
);
requireText(
  'fixture manifest has settings_metadata column',
  fixture,
  /CREATE TABLE IF NOT EXISTS public\.backup_manifest\b[\s\S]*?settings_metadata\s+JSONB/,
);
// The v2 migration itself contains the historical global constraint (it is
// immutable applied history); the remediation must be the migration that
// removes it, and nothing after the remediation may reintroduce it.
if (remediationMigrationName) {
  const remediationIndex = migrationNames.indexOf(remediationMigrationName);
  for (const migrationName of migrationNames.slice(remediationIndex)) {
    const source = read(`supabase/migrations/${migrationName}`);
    if (
      /CREATE TABLE IF NOT EXISTS public\.saved_meals\b[\s\S]*UNIQUE\s*\(\s*food_name\s*\)/i.test(
        source,
      )
    ) {
      failures.push(`${migrationName} reintroduces global saved_meals food-name uniqueness`);
    }
  }
}

const backupRequiredColumns = {
  habit_completions: ['habit_id', 'date_key', 'count'],
  pomodoro_sessions: ['started_at', 'ended_at', 'duration_seconds', 'session_type'],
  routine_exercises: ['routine_id', 'name', 'sort_order'],
  routine_exercise_sets: ['exercise_id', 'set_number', 'active_seconds', 'rest_seconds'],
  workout_logs: ['routine_id', 'notes', 'completed_at'],
  workout_session_exercises: ['log_id', 'exercise_name', 'sets_completed'],
  saved_meals: ['food_name', 'use_count', 'last_used_at', 'meal_type'],
  linked_action_rules: [
    'status',
    'direction_policy',
    'effect_type',
    'effect_payload',
    'deleted_at',
  ],
};
for (const [table, columns] of Object.entries(backupRequiredColumns)) {
  for (const column of columns) {
    requireText(`v2 migration ${table}.${column}`, v2Migration, new RegExp(`\\b${column}\\b`));
    requireText(`fixture ${table}.${column}`, fixture, new RegExp(`\\b${column}\\b`));
  }
}

requireText(
  'v2 settings table',
  v2Migration,
  /CREATE TABLE public\.user_backup_settings\b[\s\S]*?settings_version INTEGER[\s\S]*?payload JSONB/,
);
requireText(
  'v2 manifest table',
  v2Migration,
  /CREATE TABLE public\.backup_manifest\b[\s\S]*?backup_schema_version INTEGER[\s\S]*?generation INTEGER[\s\S]*?entity_metadata JSONB/,
);
requireText(
  'v2 migration anon/public revoke',
  v2Migration,
  /REVOKE ALL PRIVILEGES ON TABLE[\s\S]*FROM anon, PUBLIC/i,
);
requireText(
  'v2 migration authenticated grant',
  v2Migration,
  /GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE[\s\S]*TO authenticated, service_role/i,
);
requireText(
  'v2 migration does not use global USING true',
  v2Migration,
  /^(?![\s\S]*USING\s*\(\s*true\s*\))/i,
);
requireText(
  'v2 migration does not grant policy access to anon',
  v2Migration,
  /^(?![\s\S]*CREATE POLICY[\s\S]*TO\s+(?:anon|public)\b)/i,
);

const requiredColumns = {
  todos: ['due_date', 'priority', 'sort_order', 'recurrence', 'recurrence_id'],
  habits: ['category', 'icon', 'color', 'rule_history'],
  calorie_entries: ['fiber'],
  workout_routines: ['description'],
};
for (const [table, columns] of Object.entries(requiredColumns)) {
  for (const column of columns) {
    requireText(`baseline ${table}.${column}`, baseline, new RegExp(`\\b${column}\\b`));
    requireText(`fixture ${table}.${column}`, fixture, new RegExp(`\\b${column}\\b`));
  }
}

for (const table of syncTables) {
  requireText(`baseline ${table} updated index`, baseline, new RegExp(`idx_${table}_updated_at`));
  requireText(
    `ownership ${table} Auth foreign key`,
    ownership,
    new RegExp(
      `ALTER TABLE public\\.%I ADD CONSTRAINT %I FOREIGN KEY \\(user_id\\) REFERENCES auth\\.users\\(id\\) ON DELETE CASCADE`,
    ),
  );

  const policyDefinitions = [
    {
      operation: 'SELECT',
      suffix: 'select',
      predicate: 'USING',
    },
    {
      operation: 'INSERT',
      suffix: 'insert',
      predicate: 'WITH CHECK',
    },
    {
      operation: 'UPDATE',
      suffix: 'update',
      predicate: 'USING',
    },
    {
      operation: 'DELETE',
      suffix: 'delete',
      predicate: 'USING',
    },
  ];

  for (const policy of policyDefinitions) {
    const policyStart = new RegExp(
      `CREATE POLICY sync_${table}_${policy.suffix}_owner ON public\\.${table}[\\s\\S]*?FOR ${policy.operation} TO authenticated`,
      'i',
    );
    requireText(`ownership ${table} ${policy.operation} policy`, ownership, policyStart);
  }

  requireText(
    `ownership ${table} owner predicate`,
    ownership,
    new RegExp(
      `CREATE POLICY sync_${table}_[a-z]+_owner ON public\\.${table}[\\s\\S]*?\\(\\s*select\\s+auth\\.uid\\(\\)\\s*\\)\\s*=\\s*user_id`,
      'i',
    ),
  );
  requireText(
    `ownership ${table} update USING`,
    ownership,
    new RegExp(
      `CREATE POLICY sync_${table}_update_owner[\\s\\S]*?USING \\([\\s\\S]*?auth\\.uid\\(\\)[\\s\\S]*?user_id`,
      'i',
    ),
  );
  requireText(
    `ownership ${table} update WITH CHECK`,
    ownership,
    new RegExp(
      `CREATE POLICY sync_${table}_update_owner[\\s\\S]*?WITH CHECK \\([\\s\\S]*?auth\\.uid\\(\\)[\\s\\S]*?user_id`,
      'i',
    ),
  );
}

requireText('ownership policy cleanup', ownership, /DROP POLICY IF EXISTS/i);
requireText(
  'ownership anon/public revoke',
  ownership,
  /REVOKE ALL PRIVILEGES ON TABLE[\s\S]*FROM anon, PUBLIC/i,
);
requireText(
  'ownership authenticated grant',
  ownership,
  /GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE[\s\S]*TO authenticated, service_role/i,
);
requireText(
  'ownership does not use global USING true',
  ownership,
  /^(?![\s\S]*USING\s*\(\s*true\s*\))/i,
);
requireText(
  'ownership does not grant policy access to anon',
  ownership,
  /^(?![\s\S]*CREATE POLICY[\s\S]*TO\s+(?:anon|public)\b)/i,
);

// The old baseline is immutable historical input. Once the ownership
// migration exists, any later migration that reintroduces a global policy is
// a contract failure. This catches unsafe edits without pretending the old
// migration never contained the vulnerability being repaired.
if (ownershipMigrationName) {
  const ownershipIndex = migrationNames.indexOf(ownershipMigrationName);
  for (const migrationName of migrationNames.slice(ownershipIndex)) {
    const source = read(`supabase/migrations/${migrationName}`);
    if (/\bCREATE POLICY[\s\S]*\bTO\s+(?:anon|public)\b/i.test(source)) {
      failures.push(`${migrationName} reintroduces anon/public backup policy access`);
    }
    if (/\bUSING\s*\(\s*true\s*\)|\bWITH CHECK\s*\(\s*true\s*\)/i.test(source)) {
      failures.push(`${migrationName} contains a global true RLS predicate`);
    }
  }
}

requireText('quota table', quota, /CREATE TABLE IF NOT EXISTS public\.ai_request_quota\b/);
requireText('quota RLS', quota, /ALTER TABLE public\.ai_request_quota ENABLE ROW LEVEL SECURITY/);
requireText(
  'quota client revoke',
  quota,
  /REVOKE ALL ON TABLE public\.ai_request_quota FROM anon, authenticated/,
);
requireText('quota RPC', quota, /CREATE OR REPLACE FUNCTION public\.consume_ai_request_quota/);
requireText('quota security definer', quota, /SECURITY DEFINER/);
requireText('quota pinned search_path', quota, /SET search_path\s*=\s*public/);
requireText(
  'quota function revoke',
  quota,
  /REVOKE ALL ON FUNCTION public\.consume_ai_request_quota[\s\S]*FROM PUBLIC, anon, authenticated/,
);
requireText(
  'quota service grant',
  quota,
  /GRANT EXECUTE ON FUNCTION public\.consume_ai_request_quota[\s\S]*TO service_role/,
);

requireText(
  'parse function JWT setting',
  config,
  /\[functions\.parse-ai-command\][\s\S]*?verify_jwt = true/,
);
requireText(
  'ask function JWT setting',
  config,
  /\[functions\.user-ai-ask\][\s\S]*?verify_jwt = true/,
);

// ---- Backup scope version migration + fixture (production closure) ----
function req(label, src, sub) {
  if (!src.includes(sub)) failures.push(`${label} is missing: ${sub}`);
}
function reqAbsent(label, src, sub) {
  if (src.includes(sub)) failures.push(`${label} must be absent but found: ${sub}`);
}

const backupScopeVersionMigrationName = migrationNames.find((name) =>
  name.endsWith('_backup_manifest_scope_version.sql'),
);
if (!backupScopeVersionMigrationName)
  failures.push('missing backup_manifest scope version migration');
const backupScopeVersionMigration = backupScopeVersionMigrationName
  ? read(`supabase/migrations/${backupScopeVersionMigrationName}`)
  : '';
req(
  'backup scope version migration alters backup_manifest',
  backupScopeVersionMigration,
  'ALTER TABLE public.backup_manifest',
);
req(
  'backup scope version migration adds backup_scope_version',
  backupScopeVersionMigration,
  'ADD COLUMN IF NOT EXISTS backup_scope_version',
);
req('fixture backup_manifest has backup_scope_version', fixture, 'backup_scope_version');

// ---- Planning schema convergence (production closure) ----
const planningMigrationName = migrationNames.find((name) =>
  name.endsWith('_planning_schema_convergence.sql'),
);
if (!planningMigrationName) failures.push('missing planning schema convergence migration');
const planningMigration = planningMigrationName
  ? read(`supabase/migrations/${planningMigrationName}`)
  : '';

const planningTables = ['projects', 'goals', 'daily_plans'];
for (const table of planningTables) {
  req(`planning ${table} table`, planningMigration, `CREATE TABLE public.${table} (`);
  req(
    `planning ${table} RLS`,
    planningMigration,
    `ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`,
  );
  req(
    `planning ${table} owner FK`,
    planningMigration,
    'user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE',
  );
  req(`fixture planning ${table} table`, fixture, `CREATE TABLE IF NOT EXISTS public.${table} (`);
  for (const operation of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) {
    const suffix = operation.toLowerCase();
    req(
      `planning ${table} ${operation} policy`,
      planningMigration,
      `CREATE POLICY sync_${table}_${suffix}_owner ON public.${table}`,
    );
    req(
      `planning ${table} ${operation} policy target`,
      planningMigration,
      `FOR ${operation} TO authenticated`,
    );
  }
  req(`planning ${table} owner predicate`, planningMigration, '(select auth.uid()) = user_id');
  req(`planning ${table} update USING`, planningMigration, 'USING ((select auth.uid()) = user_id)');
  req(
    `planning ${table} update WITH CHECK`,
    planningMigration,
    'WITH CHECK ((select auth.uid()) = user_id)',
  );
}

const planningRequiredColumns = {
  todos: ['project_id', 'goal_id', 'completed_at'],
  habits: ['project_id', 'goal_id'],
};
for (const [table, columns] of Object.entries(planningRequiredColumns)) {
  for (const column of columns) {
    req(`planning ${table}.${column}`, planningMigration, column);
    req(`fixture ${table}.${column}`, fixture, column);
  }
}

// Habits are ongoing scheduled entities with no terminal completion state: the
// resolved contract must NOT add completed_at to habits (neither the remote
// migration nor the fixture), keeping the Habit backup/remote contract aligned
// with the authoritative local SQLite schema.
const mHabitsAlterStart = planningMigration.indexOf('ALTER TABLE public.habits');
const mHabitsAlterEnd = planningMigration.indexOf(';', mHabitsAlterStart);
const mHabitsAlter = planningMigration.slice(mHabitsAlterStart, mHabitsAlterEnd);
reqAbsent(
  'planning migration habits alter must not add completed_at',
  mHabitsAlter,
  'completed_at',
);
const fHabitsStart = fixture.indexOf('public.habits (');
const fHabitsEnd = fixture.indexOf(');', fHabitsStart);
const fHabitsBlock = fixture.slice(fHabitsStart, fHabitsEnd);
reqAbsent('fixture habits table must not contain completed_at', fHabitsBlock, 'completed_at');

req(
  'planning goals -> projects owner FK',
  planningMigration,
  'FOREIGN KEY (project_id, user_id) REFERENCES public.projects (id, user_id)',
);
req(
  'planning todos -> projects owner FK',
  planningMigration,
  'FOREIGN KEY (project_id, user_id) REFERENCES public.projects (id, user_id)',
);
req(
  'planning todos -> goals owner FK',
  planningMigration,
  'FOREIGN KEY (goal_id, user_id) REFERENCES public.goals (id, user_id)',
);
req(
  'planning habits -> projects owner FK',
  planningMigration,
  'FOREIGN KEY (project_id, user_id) REFERENCES public.projects (id, user_id)',
);
req(
  'planning habits -> goals owner FK',
  planningMigration,
  'FOREIGN KEY (goal_id, user_id) REFERENCES public.goals (id, user_id)',
);
req(
  'planning projects id/user unique',
  planningMigration,
  'CREATE UNIQUE INDEX IF NOT EXISTS uq_projects_id_user',
);
req(
  'planning goals id/user unique',
  planningMigration,
  'CREATE UNIQUE INDEX IF NOT EXISTS uq_goals_id_user',
);

req(
  'planning daily_plans owner-scoped active uniqueness',
  planningMigration,
  'CREATE UNIQUE INDEX IF NOT EXISTS uq_daily_plans_owner_date_active',
);
req(
  'planning daily_plans owner-scoped active uniqueness cols',
  planningMigration,
  '(user_id, date_key) WHERE deleted_at IS NULL',
);
req(
  'fixture daily_plans owner-scoped active uniqueness',
  fixture,
  'CREATE UNIQUE INDEX IF NOT EXISTS uq_daily_plans_owner_date_active',
);
req(
  'fixture daily_plans owner-scoped active uniqueness cols',
  fixture,
  '(user_id, date_key) WHERE deleted_at IS NULL',
);
reqAbsent('planning daily_plans no global date uniqueness', planningMigration, 'UNIQUE (date_key)');
reqAbsent('fixture daily_plans no global date uniqueness', fixture, 'UNIQUE (date_key)');

req('planning migration anon/public revoke', planningMigration, 'REVOKE ALL PRIVILEGES ON TABLE');
req('planning migration anon/public revoke target', planningMigration, 'FROM anon, PUBLIC');
req(
  'planning migration authenticated grant',
  planningMigration,
  'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE',
);
req(
  'planning migration authenticated grant target',
  planningMigration,
  'TO authenticated, service_role',
);
reqAbsent('planning migration does not use global USING true', planningMigration, 'USING (true)');
reqAbsent('planning migration does not grant policy access to anon', planningMigration, 'TO anon');
reqAbsent(
  'planning migration does not grant policy access to public',
  planningMigration,
  'TO public',
);

// ---- Hardening wave v2 (Backup Scope V5 closure) ----
const weeklyReviewsMigrationName = migrationNames.find((name) =>
  name.endsWith('_weekly_reviews_remote_table.sql'),
);
if (!weeklyReviewsMigrationName) failures.push('missing weekly_reviews remote table migration');
const weeklyReviewsMigration = weeklyReviewsMigrationName
  ? read(`supabase/migrations/${weeklyReviewsMigrationName}`)
  : '';
const hardeningColumnsMigrationName = migrationNames.find((name) =>
  name.endsWith('_hardening_wave_v2_durable_columns.sql'),
);
if (!hardeningColumnsMigrationName)
  failures.push('missing hardening wave v2 durable columns migration');
const hardeningColumnsMigration = hardeningColumnsMigrationName
  ? read(`supabase/migrations/${hardeningColumnsMigrationName}`)
  : '';

// weekly_reviews is a full backup-scope citizen: table + RLS + four owner
// policies + owner index + grant hygiene, mirrored in the disposable fixture.
req(
  'weekly_reviews migration table',
  weeklyReviewsMigration,
  'CREATE TABLE public.weekly_reviews (',
);
req(
  'weekly_reviews migration owner FK',
  weeklyReviewsMigration,
  'user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE',
);
req(
  'weekly_reviews migration RLS',
  weeklyReviewsMigration,
  'ALTER TABLE public.weekly_reviews ENABLE ROW LEVEL SECURITY',
);
for (const operation of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) {
  const suffix = operation.toLowerCase();
  req(
    `weekly_reviews migration ${operation} policy`,
    weeklyReviewsMigration,
    `CREATE POLICY sync_weekly_reviews_${suffix}_owner ON public.weekly_reviews`,
  );
  req(
    `weekly_reviews migration ${operation} policy target`,
    weeklyReviewsMigration,
    `FOR ${operation} TO authenticated`,
  );
}
req(
  'weekly_reviews migration owner predicate',
  weeklyReviewsMigration,
  '(select auth.uid()) = user_id',
);
req('weekly_reviews migration owner index', weeklyReviewsMigration, 'idx_weekly_reviews_user_id');
req(
  'weekly_reviews migration owner-scoped active week uniqueness',
  weeklyReviewsMigration,
  'uq_weekly_reviews_owner_week_active',
);
req('weekly_reviews migration revoke', weeklyReviewsMigration, 'FROM anon, PUBLIC');
req(
  'weekly_reviews migration authenticated grant',
  weeklyReviewsMigration,
  'TO authenticated, service_role',
);
reqAbsent('weekly_reviews migration no USING true', weeklyReviewsMigration, 'USING (true)');
reqAbsent('weekly_reviews migration no anon policy', weeklyReviewsMigration, 'TO anon');
req('fixture weekly_reviews table', fixture, 'CREATE TABLE IF NOT EXISTS public.weekly_reviews (');
req(
  'fixture weekly_reviews RLS',
  fixture,
  'ALTER TABLE public.weekly_reviews ENABLE ROW LEVEL SECURITY',
);
req('fixture weekly_reviews owner index', fixture, 'idx_weekly_reviews_user_id');
const weeklyReviewColumns = [
  'week_key',
  'week_start_date',
  'week_end_date',
  'next_week_start_date',
  'completed_at',
  'status',
  'summary_payload',
  'plan_payload',
  'reflection',
  'deleted_at',
];
for (const column of weeklyReviewColumns) {
  req(`weekly_reviews migration ${column}`, weeklyReviewsMigration, column);
  req(`fixture weekly_reviews ${column}`, fixture, column);
}

// Scope V5 durable columns on existing entities (local counterpart: SQLite
// migration 20). Nullable additions keep historical remote rows valid.
const hardeningRequiredColumns = {
  habits: ['status', 'lifecycle_history'],
  pomodoro_sessions: ['linked_todo_id', 'linked_todo_title', 'note'],
  workout_logs: ['started_at', 'ended_at', 'duration_seconds'],
};
for (const [table, columns] of Object.entries(hardeningRequiredColumns)) {
  for (const column of columns) {
    req(`hardening ${table}.${column}`, hardeningColumnsMigration, column);
    req(`fixture ${table}.${column}`, fixture, column);
  }
}
req(
  'hardening habits.status default active',
  hardeningColumnsMigration,
  "ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'",
);

// Gym V2 scope-6 parity: additive workout prescription/session columns and
// the four new owner-scoped user-data tables.
const gymExtendedColumns = {
  workout_routines: ['goal_tag'],
  routine_exercises: [
    'catalog_exercise_id',
    'modality',
    'notes',
    'superset_group',
    'progression_mode',
    'progression_increment',
    'progression_min_reps',
    'progression_max_reps',
  ],
  routine_exercise_sets: [
    'target_reps_min',
    'target_reps_max',
    'target_load',
    'target_duration_seconds',
    'target_distance',
    'target_pace',
  ],
  workout_logs: ['routine_name'],
  workout_session_exercises: ['catalog_exercise_id', 'modality'],
  workout_session_sets: ['duration_seconds', 'distance', 'pace', 'effort_value', 'effort_scale'],
};
for (const [table, columns] of Object.entries(gymExtendedColumns)) {
  for (const column of columns) {
    req(`Gym V2 migration ${table}.${column}`, gymMigration, column);
    req(`Gym V2 fixture ${table}.${column}`, fixture, column);
  }
}
for (const table of [
  'custom_exercises',
  'workout_weekly_plan',
  'workout_schedule_overrides',
  'body_weight_entries',
]) {
  req(`Gym V2 migration ${table} table`, gymMigration, `CREATE TABLE public.${table} (`);
  req(
    `Gym V2 migration ${table} RLS`,
    gymMigration,
    `ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`,
  );
  req(`Gym V2 fixture ${table} table`, fixture, `CREATE TABLE IF NOT EXISTS public.${table} (`);
  req(
    `Gym V2 fixture ${table} RLS`,
    fixture,
    `ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`,
  );
  for (const operation of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) {
    const suffix = operation.toLowerCase();
    req(
      `Gym V2 migration ${table} ${operation} policy`,
      gymMigration,
      `CREATE POLICY sync_${table}_${suffix}_owner ON public.${table}`,
    );
    req(
      `Gym V2 fixture ${table} ${operation} policy`,
      fixture,
      `CREATE POLICY "sync_${table}_${suffix}_owner" ON public.${table}`,
    );
  }
}
req('Gym V2 migration no anon policy', gymMigration, 'FROM anon, PUBLIC');
reqAbsent('Gym V2 migration no USING true', gymMigration, 'USING (true)');

// Gym Workout V2 deep-expansion parity: migration 23/scope 7 metadata must
// exist in the production ALTER migration and in the disposable fixture.
const deepGymColumns = {
  routine_exercises: ['unilateral', 'supports_external_load'],
  workout_session_exercises: ['unilateral', 'supports_external_load'],
  custom_exercises: ['aliases', 'instructions', 'supports_external_load'],
};
for (const [table, columns] of Object.entries(deepGymColumns)) {
  for (const column of columns) {
    req(`Gym Workout V2 deep migration ${table}.${column}`, deepGymMigration, column);
    req(`Gym Workout V2 fixture ${table}.${column}`, fixture, column);
  }
}

// Daily-plan priority title snapshots (local counterpart: SQLite migration 21).
// Strictly additive nullable column; legacy rows and pre-v21 backups stay valid.
const titleSnapshotsMigrationName = migrationNames.find((name) =>
  name.endsWith('_daily_plan_priority_title_snapshots.sql'),
);
if (!titleSnapshotsMigrationName)
  failures.push('missing daily plan priority title snapshots migration');
const titleSnapshotsMigration = titleSnapshotsMigrationName
  ? read(`supabase/migrations/${titleSnapshotsMigrationName}`)
  : '';
req(
  'daily plan title snapshots migration column',
  titleSnapshotsMigration,
  'ADD COLUMN IF NOT EXISTS top_todo_titles TEXT',
);
req('fixture daily_plans.top_todo_titles', fixture, 'top_todo_titles');

// workout_session_sets: per-set load/reps provenance table with composite
// owner FK, RLS, policies, grants, and fixture mirror.
req(
  'hardening workout_session_sets table',
  hardeningColumnsMigration,
  'CREATE TABLE public.workout_session_sets (',
);
req(
  'hardening workout_session_sets owner FK',
  hardeningColumnsMigration,
  'user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE',
);
req(
  'hardening workout_session_sets composite owner FK',
  hardeningColumnsMigration,
  'FOREIGN KEY (session_exercise_id, user_id) REFERENCES public.workout_session_exercises (id, user_id)',
);
req(
  'hardening workout_session_sets parent unique index',
  hardeningColumnsMigration,
  'uq_workout_session_exercises_id_user',
);
req(
  'hardening workout_session_sets RLS',
  hardeningColumnsMigration,
  'ALTER TABLE public.workout_session_sets ENABLE ROW LEVEL SECURITY',
);
for (const operation of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) {
  const suffix = operation.toLowerCase();
  req(
    `hardening workout_session_sets ${operation} policy`,
    hardeningColumnsMigration,
    `CREATE POLICY sync_workout_session_sets_${suffix}_owner ON public.workout_session_sets`,
  );
}
req(
  'hardening workout_session_sets revoke',
  hardeningColumnsMigration,
  'REVOKE ALL PRIVILEGES ON TABLE public.workout_session_sets FROM anon, PUBLIC',
);
req(
  'hardening workout_session_sets grant',
  hardeningColumnsMigration,
  'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.workout_session_sets TO authenticated, service_role',
);
reqAbsent('hardening migration no USING true', hardeningColumnsMigration, 'USING (true)');
reqAbsent('hardening migration no anon policy', hardeningColumnsMigration, 'TO anon');
req(
  'fixture workout_session_sets table',
  fixture,
  'CREATE TABLE IF NOT EXISTS public.workout_session_sets (',
);
const sessionSetColumns = [
  'session_exercise_id',
  'set_number',
  'weight',
  'reps',
  'weight_unit',
  'completed',
];
for (const column of sessionSetColumns) {
  req(`fixture workout_session_sets ${column}`, fixture, column);
}

// Disposable-lane parity: the fixture must carry the same owner-pair unique
// indexes and composite owner FKs as production so remote-boundary journeys
// cannot pass in sim while failing against prod.
const fixtureParityMarkers = [
  'uq_habits_id_user',
  'uq_workout_routines_id_user',
  'uq_routine_exercises_id_user',
  'uq_workout_logs_id_user',
  'uq_workout_session_exercises_id_user',
  'uq_projects_id_user',
  'uq_goals_id_user',
  'habit_completions_habit_owner_fkey',
  'routine_exercises_routine_owner_fkey',
  'routine_exercise_sets_exercise_owner_fkey',
  'workout_logs_routine_owner_fkey',
  'workout_session_exercises_log_owner_fkey',
  'workout_session_sets_exercise_owner_fkey',
  'goals_project_owner_fkey',
  'todos_project_owner_fkey',
  'todos_goal_owner_fkey',
  'habits_project_owner_fkey',
  'habits_goal_owner_fkey',
];
for (const marker of fixtureParityMarkers) {
  req(`fixture parity ${marker}`, fixture, marker);
}

// ---- Negative coverage: the planning checks must actually reject unsafe variants ----
function expectPlanningRejection(badSource, label) {
  const badFailures = [];
  const badReq = (l, cond) => {
    if (!cond) badFailures.push(l);
  };
  badReq(
    'owner-scoped active uniqueness present',
    badSource.includes(
      'uq_daily_plans_owner_date_active ON public.daily_plans (user_id, date_key) WHERE deleted_at IS NULL',
    ),
  );
  badReq('no global date uniqueness', !badSource.includes('UNIQUE (date_key)'));
  badReq('anon/public revoke present', badSource.includes('FROM anon, PUBLIC'));
  badReq('no anon policy grant', !badSource.includes('TO anon'));
  if (badFailures.length === 0)
    failures.push(`negative coverage failed: unsafe planning variant was NOT rejected (${label})`);
}
const unsafeGlobalDateUniqueness = `
CREATE TABLE public.daily_plans (id TEXT PRIMARY KEY, user_id UUID, date_key TEXT NOT NULL, UNIQUE (date_key));
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.daily_plans TO anon, authenticated;
`;
expectPlanningRejection(unsafeGlobalDateUniqueness, 'global date uniqueness + anon grant');

// ---- Backup generation protocol (WS-03) ----
// These five tables plus the two privileged functions carry the whole
// validate-before-publish backup protocol, and until now NOTHING in this
// validator referenced them: a policy drop, a widened grant, or a definer
// function losing its pinned search_path could regress the single most
// security-sensitive surface in the schema while `supabase:schema:validate`
// stayed green. The checks below pin the FINAL post-chain state, which is what
// a freshly-migrated project actually serves.
const generationMigrationNames = migrationNames.filter((name) =>
  /_backup_generation|_verify_and_reserve_backup_generations|_enforce_backup_publication_provenance/.test(
    name,
  ),
);
if (generationMigrationNames.length < 4) {
  failures.push(
    `expected >= 4 backup-generation migration files, found ${generationMigrationNames.length}`,
  );
}
const generationSource = generationMigrationNames
  .map((name) => read(`supabase/migrations/${name}`))
  .join(String.fromCharCode(10));
// The final provenance migration is authoritative for the post-chain state.
const publicationMigration =
  migrationNames.find((name) => name.endsWith('_enforce_backup_publication_provenance.sql')) ?? '';
const publicationSource = publicationMigration
  ? read(`supabase/migrations/${publicationMigration}`)
  : '';
const allMigrationsSource = migrationNames
  .map((name) => read(`supabase/migrations/${name}`))
  .join(String.fromCharCode(10));
// Per-function definition blocks of the authoritative migration, split at each
// CREATE FUNCTION so a pin in one block can never vouch for a sibling.
const publicationFunctionBlocks = publicationSource
  .split(/(?=CREATE (OR REPLACE )?FUNCTION)/i)
  .filter((block) => /CREATE (OR REPLACE )?FUNCTION/i.test(block));

// Every generation table must have RLS enabled. There is no exception here —
// unlike ai_request_quota there are no deny-all-by-omission tables: these all
// serve the owner-scoped client path.
for (const table of [
  'backup_generation',
  'backup_generation_chunk',
  'backup_generation_head',
  'backup_generation_sequence_reservation',
  'backup_generation_publication',
]) {
  req(
    `generation RLS ${table}`,
    generationSource,
    `ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`,
  );
}

// Owner-scoped policies only: the cross-tenant bug class is a policy that never
// constrains the row to the caller's uid.
for (const policy of [
  'backup_generation_select_owner',
  'backup_generation_insert_owner',
  'backup_generation_update_owner',
  'backup_generation_chunk_select_owner',
  'backup_generation_chunk_insert_owner',
  'backup_generation_chunk_update_owner',
  'backup_generation_head_select_owner',
  'backup_generation_reservation_select_owner',
  'backup_generation_publication_select_owner',
]) {
  req(`generation policy ${policy}`, generationSource, policy);
  // The policy NAME existing is not owner scoping: the predicate must actually
  // constrain the row to the caller's uid (a renamed predicate like
  // `USING (user_id IS NOT NULL)` passes a name-only check while opening the
  // table to every authenticated user).
  {
    const policyBlockMatch = generationSource.match(
      new RegExp(`CREATE POLICY ${policy}\\b[\\s\\S]*?;`),
    );
    const policyBlock = policyBlockMatch ? policyBlockMatch[0] : '';
    if (!/auth\.uid\(\)/.test(policyBlock) || !/user_id/.test(policyBlock)) {
      failures.push(
        `generation policy ${policy} must constrain rows to the caller's uid (auth.uid() vs user_id); found predicate: ${
          policyBlock ? policyBlock.replace(/\s+/g, ' ').slice(0, 160) : '<missing>'
        }`,
      );
    }
  }
}
// A `USING (true)` policy would silently make a generation row world-readable.
reqAbsent('generation policies must not be blanket', generationSource, 'USING (true)');
reqAbsent('generation policies must not target anon', generationSource, 'TO anon');

// The provenance migration must revoke default Supabase grants (notably
// TRUNCATE, which bypasses RLS) and re-grant only owner DML. Scoped to the
// provenance migration specifically: a generic REVOKE anywhere else in the
// chain (e.g. the baseline's table-level revoke) must not satisfy this — the
// check is about the final migration's five-table reset block.
{
  const resetBlock =
    publicationSource.match(/REVOKE ALL PRIVILEGES ON TABLE[\s\S]{0,600}?FROM[^;]*;/i)?.[0] ?? '';
  const resetCoversAllTables = [
    'backup_generation',
    'backup_generation_chunk',
    'backup_generation_head',
    'backup_generation_sequence_reservation',
    'backup_generation_publication',
  ].every((table) => resetBlock.includes(`public.${table}`));
  if (!resetBlock || !resetCoversAllTables) {
    failures.push(
      'generation privilege reset is missing or incomplete: the provenance migration must contain one REVOKE ALL PRIVILEGES ON TABLE block covering all five generation tables (TRUNCATE bypasses RLS).',
    );
  }
}
req(
  'generation client DML grant',
  generationSource,
  'GRANT SELECT, INSERT, UPDATE ON TABLE public.backup_generation TO authenticated',
);
req(
  'generation chunk DML grant',
  generationSource,
  'GRANT SELECT, INSERT, UPDATE ON TABLE public.backup_generation_chunk TO authenticated',
);
// Head/reservation/publication are server-side only from the client's view.
for (const table of [
  'backup_generation_head',
  'backup_generation_sequence_reservation',
  'backup_generation_publication',
]) {
  req(
    `generation read-only grant ${table}`,
    generationSource,
    `GRANT SELECT ON TABLE public.${table} TO authenticated`,
  );
  // Any WRITE-shaped grant to any client role is a violation — not only the
  // exact `INSERT, UPDATE` phrasing (single-statement, reordered, or
  // `ALL`-shaped grants must all be caught).
  {
    const writeGrant = new RegExp(
      `GRANT\\s+(?:ALL[^;]*|[^;]*\\b(?:INSERT|UPDATE|DELETE|TRUNCATE)\\b[^;]*)ON TABLE public\\.${table}[^;]*TO\\s+(?:authenticated|anon|PUBLIC)`,
      'i',
    );
    if (writeGrant.test(generationSource)) {
      failures.push(
        `generation must not grant client writes to ${table} (write-shaped GRANT found)`,
      );
    }
  }
}

// The two privileged functions must stay SECURITY DEFINER (they publish/allocate
// across owner boundaries by design) AND must pin search_path, or a definer
// function is a privilege-escalation primitive.
for (const fn of ['publish_backup_generation', 'reserve_backup_generation_sequence']) {
  req(`generation function ${fn}`, generationSource, `public.${fn}`);
  // EXECUTE is granted to the authenticated owner path with PUBLIC/anon
  // revoked first; the function itself MUST be SECURITY DEFINER (it publishes
  // across owner boundaries) and must live in the provenance migration.
  {
    const fnBlock = publicationFunctionBlocks.find((block) =>
      new RegExp(`CREATE (OR REPLACE )?FUNCTION\\s+(?:public\\.)?${fn}\\b`, 'i').test(block),
    );
    if (!fnBlock) {
      failures.push(`generation function ${fn} must be defined in the provenance migration`);
    } else if (!/SECURITY DEFINER/i.test(fnBlock)) {
      failures.push(`generation function ${fn} must be SECURITY DEFINER`);
    }
  }
  req(
    `generation function grant ${fn}`,
    generationSource,
    `GRANT EXECUTE ON FUNCTION public.${fn}`,
  );
}
// No generation function may ever be executable by anonymous clients.
{
  const anonFunctionGrant =
    /GRANT[^;]*EXECUTE[^;]*ON (ALL )?FUNCTION[^;]*backup_generation[^;]*TO\s+anon/i;
  if (anonFunctionGrant.test(allMigrationsSource)) {
    failures.push(
      'generation functions must never be granted to anon (unauthorized anonymous execution)',
    );
  }
}
// Definitions that pin search_path next to the definer marker. Per-FUNCTION
// binding: every SECURITY DEFINER function in the provenance migration must
// pin search_path (in its own definition block or via ALTER FUNCTION) — a
// single surviving pin must not mask an unpinned definer sibling.
for (const block of publicationFunctionBlocks) {
  if (!/SECURITY DEFINER/i.test(block)) continue;
  const nameMatch = block.match(/CREATE (OR REPLACE )?FUNCTION\s+(?:public\.)?([a-z0-9_]+)/i);
  const fnName = nameMatch ? nameMatch[1] : '<unnamed>';
  const pinnedInBlock = /SET search_path\s*=/i.test(block);
  const pinnedByAlter = new RegExp(
    `ALTER FUNCTION[\\s\\S]{0,160}${fnName}[\\s\\S]{0,160}SET search_path`,
    'i',
  ).test(publicationSource);
  if (!pinnedInBlock && !pinnedByAlter) {
    failures.push(
      `generation definer function ${fnName} must pin search_path (SECURITY DEFINER without SET search_path is a privilege-escalation primitive)`,
    );
  }
}
req('provenance migration present', publicationSource, 'SECURITY DEFINER');
req('provenance migration pins search_path', publicationSource, 'SET search_path = pg_catalog');
// The retired v1 publisher must stay revoked — it was replaced precisely because
// it could publish without provenance. It remains callable INTERNALLY by the
// current publisher (definer-to-definer), so only CLIENT grants are banned, and
// the ban applies to the ENTIRE migration chain, not just the final file (a
// re-grant in any later/named-elsewhere migration is the regression).
reqAbsent(
  'legacy v1 publisher must not be executable by clients',
  publicationSource,
  'GRANT EXECUTE ON FUNCTION public.backup_generation_publish_v1',
);
{
  const v1ClientGrant =
    /GRANT[^;]*EXECUTE[^;]*ON (ALL )?FUNCTION[^;]*backup_generation_publish_v1[^;]*TO\s+(?:authenticated|anon|PUBLIC)/i;
  if (v1ClientGrant.test(allMigrationsSource)) {
    failures.push(
      'legacy v1 publisher must not be executable by clients: a client-facing GRANT for backup_generation_publish_v1 exists somewhere in the chain',
    );
  }
  const schemaWideExecute =
    /GRANT[^;]*EXECUTE[^;]*ON ALL FUNCTIONS IN SCHEMA[^;]*TO\s+(?:authenticated|anon|PUBLIC)/i;
  if (schemaWideExecute.test(allMigrationsSource)) {
    failures.push(
      'generation execution grants must stay function-scoped: a schema-wide EXECUTE grant would make the retired v1 publisher callable again',
    );
  }
}

// Negative coverage: prove the generation checks actually reject unsafe
// variants instead of passing vacuously on any input.
function expectGenerationRejection(badSource, label) {
  const badFailures = [];
  const badReq = (l, cond) => {
    if (!cond) badFailures.push(l);
  };
  badReq(
    'RLS present',
    badSource.includes('ALTER TABLE public.backup_generation ENABLE ROW LEVEL SECURITY'),
  );
  badReq('no blanket policy', !badSource.includes('USING (true)'));
  badReq('no anon target', !badSource.includes('TO anon'));
  badReq('privilege reset present', badSource.includes('REVOKE ALL PRIVILEGES ON TABLE'));
  if (badFailures.length === 0)
    failures.push(
      `negative coverage failed: unsafe generation variant was NOT rejected (${label})`,
    );
}
expectGenerationRejection(
  `
CREATE TABLE public.backup_generation (id TEXT PRIMARY KEY, user_id UUID);
CREATE POLICY backup_generation_select_owner ON public.backup_generation FOR SELECT TO anon USING (true);
GRANT SELECT ON TABLE public.backup_generation TO anon;
`,
  'blanket anon policy with no RLS and no revoke',
);

if (/SUPABASE_SERVICE_ROLE_KEY|SERVICE_ROLE_KEY/i.test(clientSource)) {
  failures.push('client Supabase source references a service-role credential');
}

if (failures.length > 0) {
  console.error('Supabase schema contract validation failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(
    `Supabase schema contract PASS (${migrationNames.length} migration files; ` +
      `4 owner-scoped sync tables; ${backupTables.length} owner-scoped backup tables; ` +
      'planning + weekly_reviews + workout_session_sets scope-V5 + Gym V2 scope-V6/7 closure; ' +
      'private AI quota RPC). Static source validation only — NOT hosted certification: ' +
      'applied migrations, live pg_policies/ACLs and PostgREST exposure are verified ' +
      'only by a hosted audit.',
  );
}
