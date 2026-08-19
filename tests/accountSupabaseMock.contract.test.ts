import { describe, expect, it } from 'vitest';
import type { Route } from '@playwright/test';
import { handleBackupRestRequest } from '../e2e/helpers/accountSupabaseMock';

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

describe('accountSupabaseMock contract - production footprint probe', () => {
  const prodHead = (entity: string, uid: string) =>
    `https://dummy.supabase.co/rest/v1/${entity}?select=user_id&user_id=eq.${uid}`;

  it('default select=user_id footprint returns 0 (content-range 0-0/0)', async () => {
    const r = makeRoute(prodHead('todos', 'temp-T'), 'HEAD');
    expect(await handleBackupRestRequest(r.route)).toBe('handled');
    expect(r.getFulfilled()?.headers?.['content-range']).toBe('0-0/0');
  });

  it('configured entity count N exposes N in content-range for exact production HEAD', async () => {
    const r = makeRoute(prodHead('todos', 'uid-A'), 'HEAD');
    expect(
      await handleBackupRestRequest(r.route, {
        entities: { todos: { count: 3 } },
      }),
    ).toBe('handled');
    expect(r.getFulfilled()?.headers?.['content-range']).toBe('0-0/3');
  });

  it('owner-scoped count isolates T=1 vs A=0 for same entity', async () => {
    const entity = 'habit_completions' as const;
    const tUid = 'uid-temp-T';
    const aUid = 'uid-source-A';
    const opts = {
      entities: {
        [entity]: { countByOwnerUserId: { [tUid]: 1 } },
      },
    } as const;

    const rT = makeRoute(prodHead(entity, tUid), 'HEAD');
    expect(await handleBackupRestRequest(rT.route, opts)).toBe('handled');
    expect(rT.getFulfilled()?.headers?.['content-range']).toBe('0-0/1');

    const rA = makeRoute(prodHead(entity, aUid), 'HEAD');
    expect(await handleBackupRestRequest(rA.route, opts)).toBe('handled');
    expect(rA.getFulfilled()?.headers?.['content-range']).toBe('0-0/0');
  });

  it('owner-scoped count takes precedence over entity-level count for matching owner', async () => {
    const tUid = 'uid-T';
    const aUid = 'uid-A';
    const opts = {
      entities: {
        todos: { count: 5, countByOwnerUserId: { [tUid]: 1 } },
      },
    } as const;

    const rT = makeRoute(prodHead('todos', tUid), 'HEAD');
    expect(await handleBackupRestRequest(rT.route, opts)).toBe('handled');
    expect(rT.getFulfilled()?.headers?.['content-range']).toBe('0-0/1');

    const rA = makeRoute(prodHead('todos', aUid), 'HEAD');
    expect(await handleBackupRestRequest(rA.route, opts)).toBe('handled');
    expect(rA.getFulfilled()?.headers?.['content-range']).toBe('0-0/5');
  });

  it('weekly_reviews can carry non-zero footprint (entity count)', async () => {
    const r = makeRoute(prodHead('weekly_reviews', 'uid-T'), 'HEAD');
    expect(
      await handleBackupRestRequest(r.route, {
        entities: { weekly_reviews: { count: 1 } },
      }),
    ).toBe('handled');
    expect(r.getFulfilled()?.headers?.['content-range']).toBe('0-0/1');
  });

  it('weekly_reviews owner-scoped footprint isolates T=1 vs A=0', async () => {
    const tUid = 'uid-T-weekly';
    const aUid = 'uid-A-weekly';
    const opts = {
      entities: {
        weekly_reviews: { countByOwnerUserId: { [tUid]: 1 } },
      },
    } as const;
    const rT = makeRoute(prodHead('weekly_reviews', tUid), 'HEAD');
    expect(await handleBackupRestRequest(rT.route, opts)).toBe('handled');
    expect(rT.getFulfilled()?.headers?.['content-range']).toBe('0-0/1');

    const rA = makeRoute(prodHead('weekly_reviews', aUid), 'HEAD');
    expect(await handleBackupRestRequest(rA.route, opts)).toBe('handled');
    expect(rA.getFulfilled()?.headers?.['content-range']).toBe('0-0/0');
  });

  it('synthetic entities remain recognized and expose configured count via content-range', async () => {
    for (const entity of ['user_backup_settings', 'backup_manifest'] as const) {
      const rDefault = makeRoute(prodHead(entity, 'uid-x'), 'HEAD');
      expect(await handleBackupRestRequest(rDefault.route)).toBe('handled');
      expect(rDefault.getFulfilled()?.headers?.['content-range']).toBe('0-0/0');

      const rConfigured = makeRoute(prodHead(entity, 'uid-x'), 'HEAD');
      expect(
        await handleBackupRestRequest(rConfigured.route, {
          entities: { [entity]: { count: 2 } },
        }),
      ).toBe('handled');
      expect(rConfigured.getFulfilled()?.headers?.['content-range']).toBe('0-0/2');
    }
  });

  it('unknown table remains not-handled (strict)', async () => {
    const r = makeRoute(prodHead('ghost_table', 'uid-x'), 'HEAD');
    expect(await handleBackupRestRequest(r.route)).toBe('not-handled');
    expect(r.getFulfilled()).toBeNull();

    const rGet = makeRoute(
      'https://dummy.supabase.co/rest/v1/totally_unknown_table?select=*',
      'GET',
    );
    expect(await handleBackupRestRequest(rGet.route)).toBe('not-handled');
  });

  it('POST capture remains intact and echoes rows with 201', async () => {
    const captured: { entity: string; rows: unknown[] }[] = [];
    const payload = [{ id: 'todo_1', user_id: 'uid-T' }];
    const r = makeRoute('https://dummy.supabase.co/rest/v1/todos', 'POST', payload);
    expect(
      await handleBackupRestRequest(r.route, {
        onPostRows: (entity, rows) => captured.push({ entity, rows }),
      }),
    ).toBe('handled');
    expect(captured).toEqual([{ entity: 'todos', rows: payload }]);
    const fulfilled = r.getFulfilled();
    expect(fulfilled?.status).toBe(201);
    expect(fulfilled?.body).toBe(JSON.stringify(payload));
    // POST is not a footprint probe; content-range is not used there but headers remain JSON
    expect(fulfilled?.headers?.['content-type']).toBe('application/json');
  });

  it('generic HEAD (non-select=user_id) honors entity count via content-range', async () => {
    const r = makeRoute('https://dummy.supabase.co/rest/v1/todos', 'HEAD');
    expect(
      await handleBackupRestRequest(r.route, {
        entities: { todos: { count: 4 } },
      }),
    ).toBe('handled');
    expect(r.getFulfilled()?.headers?.['content-range']).toBe('0-0/4');
  });
});
