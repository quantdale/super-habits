import type { Route } from '@playwright/test';

/** Stable signed-in anonymous identity for the disposable sync-boundary lane. */
export const DUMMY_SUPABASE_USER_ID = '00000000-0000-0000-0000-000000000001';

const DUMMY_USER = {
  id: DUMMY_SUPABASE_USER_ID,
  aud: 'authenticated',
  role: 'authenticated',
  email: 'dummy-anonymous@example.invalid',
  is_anonymous: true,
};

const JSON_HEADERS = {
  'content-type': 'application/json',
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-expose-headers': 'content-range',
};

/**
 * Fulfil Supabase Auth calls for the disposable remote-boundary journeys.
 * This is intentionally a signed-in anonymous Auth user: the app must use
 * the `authenticated` path and derive this UID before the mock REST backend
 * accepts any sync push.
 */
export async function fulfillDummySupabaseAuth(route: Route): Promise<void> {
  const request = route.request();
  const url = new URL(request.url());

  if (request.method() === 'OPTIONS') {
    await route.fulfill({
      status: 204,
      headers: {
        ...JSON_HEADERS,
        'access-control-allow-methods': 'GET, POST, PATCH, DELETE, PUT, OPTIONS',
      },
    });
    return;
  }

  if (url.pathname.endsWith('/user')) {
    await route.fulfill({ status: 200, headers: JSON_HEADERS, body: JSON.stringify(DUMMY_USER) });
    return;
  }

  const now = Math.floor(Date.now() / 1000);
  await route.fulfill({
    status: 200,
    headers: JSON_HEADERS,
    body: JSON.stringify({
      access_token: 'dummy-access-token',
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: now + 3600,
      refresh_token: 'dummy-refresh-token',
      user: DUMMY_USER,
    }),
  });
}
