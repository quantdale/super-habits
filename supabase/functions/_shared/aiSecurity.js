const AUTH_TIMEOUT_MS = 5_000;
const QUOTA_TIMEOUT_MS = 5_000;
export const MAX_REQUEST_BODY_BYTES = 32 * 1024;

export const AI_QUOTA_LIMITS = Object.freeze({
  command_parse: Object.freeze({ limit: 30, windowSeconds: 60 * 60 }),
  ask_classify: Object.freeze({ limit: 20, windowSeconds: 60 * 60 }),
  ask_phrase: Object.freeze({ limit: 20, windowSeconds: 60 * 60 }),
});

function runtimeEnv(name) {
  if (typeof Deno !== 'undefined') return Deno.env.get(name) ?? '';
  return '';
}

function timeoutSignal(milliseconds) {
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(milliseconds);
  }
  return undefined;
}

export function extractBearerToken(headers) {
  const value = headers?.get?.('authorization') ?? '';
  const match = /^Bearer\s+(\S+)$/i.exec(value.trim());
  return match?.[1] ?? null;
}

export function securityFailure(status, error, extra = {}) {
  return { ok: false, status, body: { error, ...extra } };
}

export async function readBoundedJson(request, maxBytes = MAX_REQUEST_BODY_BYTES) {
  const contentLength = request.headers.get('content-length');
  if (contentLength && Number(contentLength) > maxBytes) {
    throw new Error('Request body is too large.');
  }

  const text = await request.text();
  const byteLength = new TextEncoder().encode(text).byteLength;
  if (byteLength > maxBytes) throw new Error('Request body is too large.');
  return JSON.parse(text);
}

export async function authenticateSupabaseUser(request, options = {}) {
  const token = extractBearerToken(request.headers);
  if (!token) return securityFailure(401, 'Authentication required.');

  const supabaseUrl = options.supabaseUrl ?? runtimeEnv('SUPABASE_URL');
  const supabaseAnonKey = options.supabaseAnonKey ?? runtimeEnv('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !supabaseAnonKey) {
    return securityFailure(503, 'Authentication service unavailable.');
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  let response;
  try {
    response = await fetchImpl(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/user`, {
      method: 'GET',
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${token}`,
      },
      signal: timeoutSignal(AUTH_TIMEOUT_MS),
    });
  } catch {
    return securityFailure(503, 'Authentication service unavailable.');
  }

  if (!response.ok) return securityFailure(401, 'Authentication required.');

  let payload;
  try {
    payload = await response.json();
  } catch {
    return securityFailure(401, 'Authentication required.');
  }
  if (!payload || typeof payload.id !== 'string' || payload.id.length === 0) {
    return securityFailure(401, 'Authentication required.');
  }

  return { ok: true, userId: payload.id };
}

export async function consumeAiQuota(userId, requestClass, options = {}) {
  const config = AI_QUOTA_LIMITS[requestClass];
  if (!config || typeof userId !== 'string' || userId.length === 0) {
    return securityFailure(503, 'Request quota unavailable.');
  }

  const supabaseUrl = options.supabaseUrl ?? runtimeEnv('SUPABASE_URL');
  const serviceRoleKey = options.serviceRoleKey ?? runtimeEnv('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return securityFailure(503, 'Request quota unavailable.');
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  let response;
  try {
    response = await fetchImpl(
      `${supabaseUrl.replace(/\/$/, '')}/rest/v1/rpc/consume_ai_request_quota`,
      {
        method: 'POST',
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          p_user_id: userId,
          p_request_class: requestClass,
          p_limit: config.limit,
          p_window_seconds: config.windowSeconds,
        }),
        signal: timeoutSignal(QUOTA_TIMEOUT_MS),
      },
    );
  } catch {
    return securityFailure(503, 'Request quota unavailable.');
  }

  if (!response.ok) return securityFailure(503, 'Request quota unavailable.');

  let payload;
  try {
    payload = await response.json();
  } catch {
    return securityFailure(503, 'Request quota unavailable.');
  }
  const decision = Array.isArray(payload) ? payload[0] : payload;
  if (!decision || typeof decision.allowed !== 'boolean') {
    return securityFailure(503, 'Request quota unavailable.');
  }

  if (!decision.allowed) {
    const retryAfterSeconds = Number.isInteger(decision.retry_after_seconds)
      ? Math.max(1, decision.retry_after_seconds)
      : config.windowSeconds;
    return securityFailure(429, 'Request limit reached.', { retryAfterSeconds });
  }

  return {
    ok: true,
    remaining: Number.isInteger(decision.remaining) ? Math.max(0, decision.remaining) : 0,
  };
}

/**
 * Testable orchestration primitive: provider work is only reached after both
 * user authentication and the durable quota decision succeed.
 */
export async function runAuthorizedAiRequest(request, requestClass, provider, options = {}) {
  const auth = await authenticateSupabaseUser(request, options);
  if (!auth.ok) return auth;
  const quota = await consumeAiQuota(auth.userId, requestClass, options);
  if (!quota.ok) return quota;
  return { ok: true, userId: auth.userId, quota, value: await provider(auth.userId) };
}
