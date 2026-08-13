import { describe, expect, it, vi } from 'vitest';
import {
  extractBearerToken,
  readBoundedJson,
  runAuthorizedAiRequest,
} from '../supabase/functions/_shared/aiSecurity.js';

function requestWithToken(token?: string, body = '{}'): Request {
  return new Request('https://example.test/functions/v1/ai', {
    method: 'POST',
    headers: token ? { authorization: `Bearer ${token}` } : undefined,
    body,
  });
}

function fetchForQuota(decision: Record<string, unknown>) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith('/auth/v1/user')) {
      return new Response(JSON.stringify({ id: 'user_1' }), { status: 200 });
    }
    return new Response(JSON.stringify([decision]), { status: 200 });
  });
}

describe('AI endpoint security boundary', () => {
  it('extracts only a well-formed bearer token', () => {
    expect(extractBearerToken(new Headers({ authorization: 'Bearer token-1' }))).toBe('token-1');
    expect(extractBearerToken(new Headers({ authorization: 'Basic token-1' }))).toBeNull();
    expect(extractBearerToken(new Headers({ authorization: 'Bearer' }))).toBeNull();
  });

  it('rejects missing authorization before any provider work', async () => {
    const provider = vi.fn();
    const result = await runAuthorizedAiRequest(requestWithToken(), 'command_parse', provider, {
      supabaseUrl: 'https://supabase.test',
      supabaseAnonKey: 'anon',
      serviceRoleKey: 'service',
    });

    expect(result).toMatchObject({ ok: false, status: 401 });
    expect(provider).not.toHaveBeenCalled();
  });

  it('rejects malformed authorization before auth, quota, or provider calls', async () => {
    const provider = vi.fn();
    const fetchImpl = vi.fn();
    const request = new Request('https://example.test/functions/v1/ai', {
      method: 'POST',
      headers: { authorization: 'Basic not-a-bearer-token' },
      body: '{}',
    });

    const result = await runAuthorizedAiRequest(request, 'command_parse', provider, {
      supabaseUrl: 'https://supabase.test',
      supabaseAnonKey: 'anon',
      serviceRoleKey: 'service',
      fetchImpl,
    });

    expect(result).toMatchObject({ ok: false, status: 401 });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(provider).not.toHaveBeenCalled();
  });

  it('rejects invalid tokens before quota or provider calls', async () => {
    const provider = vi.fn();
    const fetchImpl = vi.fn(async () => new Response('{}', { status: 401 }));
    const result = await runAuthorizedAiRequest(
      requestWithToken('invalid'),
      'command_parse',
      provider,
      {
        supabaseUrl: 'https://supabase.test',
        supabaseAnonKey: 'anon',
        serviceRoleKey: 'service',
        fetchImpl,
      },
    );

    expect(result).toMatchObject({ ok: false, status: 401 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(provider).not.toHaveBeenCalled();
  });

  it('consumes server quota and invokes the provider only when allowed', async () => {
    const provider = vi.fn(async (userId: string) => ({ userId }));
    const fetchImpl = fetchForQuota({ allowed: true, remaining: 7, retry_after_seconds: 0 });
    const result = await runAuthorizedAiRequest(
      requestWithToken('valid'),
      'ask_classify',
      provider,
      {
        supabaseUrl: 'https://supabase.test',
        supabaseAnonKey: 'anon',
        serviceRoleKey: 'service',
        fetchImpl,
      },
    );

    expect(result).toMatchObject({ ok: true, userId: 'user_1', value: { userId: 'user_1' } });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(provider).toHaveBeenCalledOnce();
  });

  it('returns 429 and suppresses provider invocation when quota is exhausted', async () => {
    const provider = vi.fn();
    const fetchImpl = fetchForQuota({ allowed: false, remaining: 0, retry_after_seconds: 42 });
    const result = await runAuthorizedAiRequest(requestWithToken('valid'), 'ask_phrase', provider, {
      supabaseUrl: 'https://supabase.test',
      supabaseAnonKey: 'anon',
      serviceRoleKey: 'service',
      fetchImpl,
    });

    expect(result).toMatchObject({
      ok: false,
      status: 429,
      body: { error: 'Request limit reached.', retryAfterSeconds: 42 },
    });
    expect(provider).not.toHaveBeenCalled();
  });

  it('uses the server decision for parallel requests instead of process-local state', async () => {
    let quotaCalls = 0;
    const provider = vi.fn(async () => undefined);
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith('/auth/v1/user')) {
        return new Response(JSON.stringify({ id: 'user_parallel' }), { status: 200 });
      }
      quotaCalls += 1;
      const allowed = quotaCalls <= 2;
      return new Response(
        JSON.stringify([
          { allowed, remaining: allowed ? 2 - quotaCalls : 0, retry_after_seconds: 60 },
        ]),
        { status: 200 },
      );
    });

    const results = await Promise.all(
      Array.from({ length: 3 }, () =>
        runAuthorizedAiRequest(requestWithToken('valid'), 'command_parse', provider, {
          supabaseUrl: 'https://supabase.test',
          supabaseAnonKey: 'anon',
          serviceRoleKey: 'service',
          fetchImpl,
        }),
      ),
    );

    expect(results.filter((result) => result.ok)).toHaveLength(2);
    expect(
      results.filter((result) => !result.ok && 'status' in result && result.status === 429),
    ).toHaveLength(1);
    expect(provider).toHaveBeenCalledTimes(2);
  });

  it('rejects oversized bodies before JSON/provider handling', async () => {
    const oversized = new Request('https://example.test', {
      method: 'POST',
      headers: { 'content-length': '40000' },
      body: '{}',
    });
    await expect(readBoundedJson(oversized)).rejects.toThrow('too large');
  });
});
