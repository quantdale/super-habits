import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const supabaseRoot = path.join(repoRoot, 'supabase');
const migrationsRoot = path.join(supabaseRoot, 'migrations');
const syncTables = ['todos', 'habits', 'calorie_entries', 'workout_routines'];

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
if (!ownershipMigrationName) {
  failures.push('missing secure sync ownership migration');
}
if (migrationNames.join('\n') !== [...migrationNames].sort().join('\n')) {
  failures.push('migration filenames are not lexically ordered');
}

const baseline = read('supabase/migrations/20260814140000_sync_schema_baseline.sql');
const quota = read('supabase/migrations/20260814150000_ai_request_quota.sql');
const ownership = ownershipMigrationName
  ? read(`supabase/migrations/${ownershipMigrationName}`)
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
      '4 owner-scoped sync tables; private AI quota RPC).',
  );
}
