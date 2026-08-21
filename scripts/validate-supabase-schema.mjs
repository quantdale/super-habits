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
if (!ownershipMigrationName) {
  failures.push('missing secure sync ownership migration');
}
if (!v2MigrationName) {
  failures.push('missing backup completeness v2 migration');
}
if (!remediationMigrationName) {
  failures.push('missing backup v2 closure remediation migration');
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
const fixture = read('simulation/backend/schema.sql');
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
  requireText(
    `v2 migration ${table}`,
    v2Migration,
    new RegExp(`CREATE TABLE public\\.${table}\\b`),
  );
  requireText(
    `v2 migration ${table} RLS`,
    v2Migration,
    new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`),
  );
  requireText(
    `v2 migration ${table} owner FK`,
    v2Migration,
    new RegExp(
      `user_id UUID NOT NULL DEFAULT auth\\.uid\\(\\) REFERENCES auth\\.users\\(id\\) ON DELETE CASCADE`,
    ),
  );
  requireText(
    `v2 migration ${table} owner predicate`,
    v2Migration,
    new RegExp(
      `CREATE POLICY sync_${table}_[a-z]+_owner ON public\\.${table}[\\s\\S]*?\\(\\s*select\\s+auth\\.uid\\(\\)\\s*\\)\\s*=\\s*user_id`,
      'i',
    ),
  );
  requireText(
    `v2 migration ${table} update USING`,
    v2Migration,
    new RegExp(
      `CREATE POLICY sync_${table}_update_owner[\\s\\S]*?USING \\([\\s\\S]*?auth\\.uid\\(\\)[\\s\\S]*?user_id`,
      'i',
    ),
  );
  requireText(
    `v2 migration ${table} update WITH CHECK`,
    v2Migration,
    new RegExp(
      `CREATE POLICY sync_${table}_update_owner[\\s\\S]*?WITH CHECK \\([\\s\\S]*?auth\\.uid\\(\\)[\\s\\S]*?user_id`,
      'i',
    ),
  );
  for (const operation of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) {
    const suffix = operation.toLowerCase();
    requireText(
      `v2 migration ${table} ${operation} policy`,
      v2Migration,
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
  requireText(`v2 migration ${table} no anon grant`, v2Migration, /^(?![\s\S]*\bTO\s+anon\b)/i);
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
];
for (const table of backupOwnerIndexTables) {
  requireText(`v2 migration ${table} owner index`, v2Migration, new RegExp(`idx_${table}_user_id`));
}

// ---- Backup V2 closure remediation contract ----
// The global saved_meals food-name uniqueness from the V2 migration must be
// removed and replaced by an owner-scoped, case-insensitive index; the
// manifest must gain settings integrity metadata; and no migration may
// reintroduce global food-name uniqueness afterwards.
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
  'remediation adds manifest settings metadata column',
  remediationMigration,
  /ALTER TABLE public\.backup_manifest[\s\S]*ADD COLUMN IF NOT EXISTS settings_metadata JSONB/i,
);
requireText(
  'fixture saved_meals has owner-scoped unique index',
  fixture,
  /CREATE UNIQUE INDEX IF NOT EXISTS uq_saved_meals_owner_food_name\s+ON public\.saved_meals\s*\(\s*user_id\s*,\s*lower\(\s*food_name\s*\)\s*\)/i,
);
requireText(
  'fixture saved_meals has no global food_name constraint',
  fixture,
  /^(?![\s\S]*CONSTRAINT saved_meals_food_name_unique\s+UNIQUE\s*\(\s*food_name\s*\))/i,
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
      'planning + weekly_reviews + workout_session_sets scope-V5 closure; ' +
      'private AI quota RPC).',
  );
}
