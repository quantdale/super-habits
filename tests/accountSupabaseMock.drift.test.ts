import { describe, expect, it } from 'vitest';
import type { Route } from '@playwright/test';
import { BACKUP_ENTITIES, BACKUP_SYNTHETIC_ENTITIES } from '@/core/backup/backup.types';
import { BACKUP_REST_ENTITIES, isBackupRestEntity } from '../e2e/helpers/accountBackupEntities';
import { handleBackupRestRequest } from '../e2e/helpers/accountSupabaseMock';

describe('account backup REST boundary drift guard', () => {
  it('recognizes exactly the production backup contract (all entities + synthetics)', () => {
    const expected = [...BACKUP_ENTITIES, ...BACKUP_SYNTHETIC_ENTITIES].sort();
    const actual = [...BACKUP_REST_ENTITIES].sort();
    expect(actual).toEqual(expected);
  });

  it('recognizes weekly_reviews (added by Weekly Review V1)', () => {
    expect(BACKUP_REST_ENTITIES).toContain('weekly_reviews');
    expect(isBackupRestEntity('weekly_reviews')).toBe(true);
  });

  it('recognizes the synthetic backup records', () => {
    expect(BACKUP_REST_ENTITIES).toContain('user_backup_settings');
    expect(BACKUP_REST_ENTITIES).toContain('backup_manifest');
    expect(isBackupRestEntity('user_backup_settings')).toBe(true);
    expect(isBackupRestEntity('backup_manifest')).toBe(true);
  });

  it('does not silently accept an arbitrary unknown REST table', () => {
    expect(isBackupRestEntity('totally_unknown_table')).toBe(false);
  });
});

function makeRoute(url: string, method: string, postData?: unknown) {
  let fulfilled: { status?: number; headers?: Record<string, string>; body?: string } | null = null;
  const route = {
    request: () => ({
      url: () => url,
      method: () => method,
      postDataJSON: () => postData,
    }),
    fulfill: async (arg: { status?: number; headers?: Record<string, string>; body?: string }) => {
      fulfilled = arg;
    },
  };
  return {
    route: route as unknown as Route,
    getFulfilled: () => fulfilled,
  };
}

describe('handleBackupRestRequest', () => {
  it('handles a known backup entity and ignores unknown tables', async () => {
    const known = makeRoute(
      'https://dummy.supabase.co/rest/v1/todos?select=user_id&user_id=eq.x',
      'HEAD',
    );
    expect(await handleBackupRestRequest(known.route)).toBe('handled');

    const unknown = makeRoute('https://dummy.supabase.co/rest/v1/ghost_table', 'GET');
    expect(await handleBackupRestRequest(unknown.route)).toBe('not-handled');
  });

  it('returns an empty footprint count for the fingerprint probe', async () => {
    const r = makeRoute(
      'https://dummy.supabase.co/rest/v1/habit_completions?select=user_id&user_id=eq.x',
      'HEAD',
    );
    expect(await handleBackupRestRequest(r.route)).toBe('handled');
    const fulfilled = r.getFulfilled();
    expect(fulfilled?.headers?.['content-range']).toBe('0-0/0');
  });

  it('captures pushed rows on POST', async () => {
    const captured: unknown[] = [];
    const r = makeRoute('https://dummy.supabase.co/rest/v1/todos', 'POST', [
      { id: 'todo_x', user_id: 'u1' },
    ]);
    expect(
      await handleBackupRestRequest(r.route, {
        onPostRows: (_entity, rows) => captured.push(...rows),
      }),
    ).toBe('handled');
    expect(captured).toEqual([{ id: 'todo_x', user_id: 'u1' }]);
  });
});
