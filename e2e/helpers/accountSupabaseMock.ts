import type { Route } from '@playwright/test';
import {
  BACKUP_REST_ENTITIES,
  isBackupRestEntity,
  type BackupRestEntity,
} from './accountBackupEntities';

export { BACKUP_REST_ENTITIES };
export type { BackupRestEntity };

const JSON_HEADERS = {
  'content-type': 'application/json',
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-expose-headers': 'content-range',
};

/** Deterministic per-entity override for the backup REST boundary. */
export type BackupEntityMockState = {
  /** Owner-scoped count returned for count/HEAD probes. Default 0. */
  count?: number;
  /** Rows returned for read queries (select=* / select=updated_at / etc). */
  rows?: unknown[];
};

export type BackupRestMockOptions = {
  /** Per-entity overrides. Absent entities behave as empty remote backup state. */
  entities?: Partial<Record<BackupRestEntity, BackupEntityMockState>>;
  /** Capture pushed rows (POST) so journeys can assert outbox ownership. */
  onPostRows?: (entity: BackupRestEntity, rows: unknown[]) => void;
};

function normalizePostedRows(body: unknown): unknown[] {
  if (body == null) return [];
  if (Array.isArray(body)) return body;
  return [body];
}

/**
 * Handle a Supabase REST request for a known account/recovery backup entity.
 *
 * Returns `'handled'` when the route was a recognized backup entity and was
 * fulfilled, or `'not-handled'` when it was not a backup REST entity so the
 * caller can apply its own default (e.g. a strict 404 for unknown REST tables).
 *
 * Recognized behavior:
 * - `POST` — capture pushed rows (via `onPostRows`) and echo `201`.
 * - Fingerprint probe (`select=user_id`, emitted by
 *   `AccountCoordinator.getRemoteFingerprint`) — deterministic empty count
 *   (`content-range: 0-0/0`). The coordinator treats a missing count as 0, so an
 *   empty/unknown footprint never fails closed.
 * - `HEAD`/count or read queries (`select=*` / `select=updated_at`) — use the
 *   per-entity override (rows + count), defaulting to empty.
 *
 * Unknown REST tables are intentionally NOT handled here: they must fail loudly
 * so new unmodeled backend dependencies are visible rather than silently
 * swallowed by a permissive catch-all.
 */
export async function handleBackupRestRequest(
  route: Route,
  options: BackupRestMockOptions = {},
): Promise<'handled' | 'not-handled'> {
  const request = route.request();
  const url = new URL(request.url());
  const pathname = url.pathname;
  const method = request.method();

  const tableMatch = pathname.match(/^\/rest\/v1\/([^/?]+)/);
  if (!tableMatch) return 'not-handled';
  const entity = tableMatch[1];
  if (!isBackupRestEntity(entity)) return 'not-handled';

  const state = options.entities?.[entity] ?? {};
  const select = url.searchParams.get('select');

  if (method === 'POST') {
    const rows = normalizePostedRows(request.postDataJSON());
    options.onPostRows?.(entity, rows);
    await route.fulfill({
      status: 201,
      headers: JSON_HEADERS,
      body: JSON.stringify(rows),
    });
    return 'handled';
  }

  // Owner-scoped footprint probe: the Account Coordinator always uses
  // select('user_id', { count: 'exact', head: true }). An empty count keeps a
  // temporary/anonymous account from failing closed.
  if (select === 'user_id') {
    await route.fulfill({
      status: 200,
      headers: { ...JSON_HEADERS, 'content-range': '0-0/0' },
      body: '[]',
    });
    return 'handled';
  }

  if (method === 'HEAD') {
    const count = state.count ?? 0;
    await route.fulfill({
      status: 200,
      headers: { ...JSON_HEADERS, 'content-range': `0-0/${count}` },
      body: '[]',
    });
    return 'handled';
  }

  const rows = state.rows ?? [];
  if (select === '*') {
    const n = rows.length;
    await route.fulfill({
      status: 200,
      headers: {
        ...JSON_HEADERS,
        'content-range': n > 0 ? `0-${n - 1}/${n}` : '0--1/0',
      },
      body: JSON.stringify(rows),
    });
    return 'handled';
  }

  // Other read shapes (e.g. select=updated_at) return the configured rows.
  await route.fulfill({ status: 200, headers: JSON_HEADERS, body: JSON.stringify(rows) });
  return 'handled';
}
