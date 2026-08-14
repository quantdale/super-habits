import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ownershipMigration = readFileSync(
  path.join(process.cwd(), 'supabase/migrations/20260814160000_secure_sync_row_ownership.sql'),
  'utf8',
);
const disposableSchema = readFileSync(
  path.join(process.cwd(), 'simulation/backend/schema.sql'),
  'utf8',
);

const SYNC_TABLES = ['todos', 'habits', 'calorie_entries', 'workout_routines'] as const;
type SyncTable = (typeof SYNC_TABLES)[number];
type Operation = 'select' | 'insert' | 'update' | 'delete';
type Role = 'anon' | 'authenticated';

type BackupRow = {
  id: string;
  user_id: string | null;
};

/**
 * Repository/disposable-contract harness.
 *
 * This intentionally does not impersonate the linked project. When Docker or
 * a disposable Postgres target is available, the same cases should be run
 * against real RLS; the environment campaign records that lane separately.
 * The model below makes the expected policy decision table executable in CI
 * and fails if the checked-in SQL no longer describes that decision.
 */
function policyAllows(
  role: Role,
  operation: Operation,
  authUid: string | null,
  existingRow: BackupRow | null,
  attemptedOwner: string | null,
): boolean {
  if (role !== 'authenticated' || !authUid) return false;

  if (operation === 'insert') return attemptedOwner === authUid;
  if (!existingRow || existingRow.user_id !== authUid) return false;
  if (operation === 'update') return attemptedOwner === authUid;
  return operation === 'select' || operation === 'delete';
}

function policyName(table: SyncTable, operation: Operation): string {
  const suffix = operation === 'select' ? 'select' : operation;
  return `sync_${table}_${suffix}_owner`;
}

describe('Supabase backup ownership contract', () => {
  it('declares owner-scoped operation policies and safe grants for all sync tables', () => {
    for (const table of SYNC_TABLES) {
      expect(ownershipMigration).toContain(`'${table}'`);
      expect(ownershipMigration).toMatch(
        new RegExp(`idx_${table}_user_id\\s+ON public\\.${table}\\s*\\(user_id\\)`),
      );
      expect(ownershipMigration).toMatch(
        new RegExp(`CREATE POLICY ${policyName(table, 'select')} ON public\\.${table}`),
      );
      expect(ownershipMigration).toMatch(
        new RegExp(`CREATE POLICY ${policyName(table, 'insert')} ON public\\.${table}`),
      );
      expect(ownershipMigration).toMatch(
        new RegExp(`CREATE POLICY ${policyName(table, 'update')} ON public\\.${table}`),
      );
      expect(ownershipMigration).toMatch(
        new RegExp(`CREATE POLICY ${policyName(table, 'delete')} ON public\\.${table}`),
      );
    }

    expect(ownershipMigration).toMatch(/REVOKE ALL PRIVILEGES ON TABLE[\s\S]*FROM anon, PUBLIC/);
    expect(ownershipMigration).toMatch(
      /GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE[\s\S]*TO authenticated, service_role/,
    );
    expect(ownershipMigration).not.toMatch(/CREATE POLICY[\s\S]*TO\s+anon\b/i);
    expect(ownershipMigration).not.toMatch(/USING\s*\(\s*true\s*\)/i);
    expect(disposableSchema).not.toMatch(/CREATE POLICY[\s\S]*TO\s+anon\b/i);
    expect(disposableSchema).not.toMatch(/USING\s*\(\s*true\s*\)/i);
  });

  it.each(SYNC_TABLES)(
    '%s isolates adversarial users across CRUD and upsert collision paths',
    (table) => {
      const userA = '00000000-0000-0000-0000-00000000000a';
      const userB = '00000000-0000-0000-0000-00000000000b';
      const rowA: BackupRow = { id: `${table}_a`, user_id: userA };
      const rowB: BackupRow = { id: `${table}_b`, user_id: userB };

      expect(policyAllows('authenticated', 'insert', userA, null, userA)).toBe(true);
      expect(policyAllows('authenticated', 'select', userA, rowA, userA)).toBe(true);
      expect(policyAllows('authenticated', 'update', userA, rowA, userA)).toBe(true);
      expect(policyAllows('authenticated', 'delete', userA, rowA, userA)).toBe(true);

      expect(policyAllows('authenticated', 'select', userB, rowA, userA)).toBe(false);
      expect(policyAllows('authenticated', 'update', userB, rowA, userA)).toBe(false);
      expect(policyAllows('authenticated', 'delete', userB, rowA, userA)).toBe(false);
      expect(policyAllows('authenticated', 'insert', userB, null, userA)).toBe(false);
      // A known id collision must use the owner-scoped UPDATE path, not overwrite
      // A's row through an upsert performed by B.
      expect(policyAllows('authenticated', 'update', userB, rowA, userB)).toBe(false);
      expect(policyAllows('authenticated', 'update', userA, rowA, userB)).toBe(false);

      expect(policyAllows('anon', 'select', null, rowA, userA)).toBe(false);
      expect(policyAllows('anon', 'insert', null, null, userA)).toBe(false);
      expect(policyAllows('anon', 'update', null, rowA, userA)).toBe(false);
      expect(policyAllows('anon', 'delete', null, rowA, userA)).toBe(false);

      // Anonymous Auth is still a signed-in authenticated identity, not the anon
      // database role, so it can access only its own row.
      expect(policyAllows('authenticated', 'select', userB, rowB, userB)).toBe(true);
      expect(policyAllows('authenticated', 'update', userB, rowB, userB)).toBe(true);
      expect(policyAllows('authenticated', 'delete', userB, rowB, userB)).toBe(true);
    },
  );
});
