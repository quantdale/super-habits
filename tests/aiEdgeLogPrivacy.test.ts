import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type EdgeHandler = (request: Request) => Promise<Response>;

const envValues: Record<string, string> = {
  SUPABASE_URL: 'https://supabase.test',
  SUPABASE_ANON_KEY: 'anon-test',
  SUPABASE_SERVICE_ROLE_KEY: 'service-test',
  OPENAI_API_KEY: 'openai-test',
  AI_COMMAND_MODEL: 'parse-test',
  DEEPSEEK_API_KEY: 'deepseek-test',
  AI_COMMAND_INTERNAL_ROLLOUT: 'true',
  AI_ASK_INTERNAL_ROLLOUT: 'true',
  AI_INTERNAL_USER_IDS: 'user-test',
};

let edgeHandler: EdgeHandler;

async function loadEdgeFunction(path: string) {
  vi.resetModules();
  vi.stubGlobal('Deno', {
    env: { get: (name: string) => envValues[name] },
    serve: (handler: EdgeHandler) => {
      edgeHandler = handler;
    },
  });
  await import(/* @vite-ignore */ path);
  return edgeHandler;
}

function stubAuthQuotaAndProvider(providerResponse: Response) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith('/auth/v1/user')) {
      return new Response(JSON.stringify({ id: 'user-test' }), { status: 200 });
    }
    if (url.endsWith('/rest/v1/rpc/consume_ai_request_quota')) {
      return new Response(JSON.stringify([{ allowed: true, remaining: 1 }]), { status: 200 });
    }
    return providerResponse;
  });
}

function authenticatedRequest(body: Record<string, unknown>) {
  return new Request('https://supabase.test/functions/v1/ai', {
    method: 'POST',
    headers: { authorization: 'Bearer test-token', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const dateContext = {
  nowIso: '2026-09-25T09:00:00.000Z',
  locale: 'en-US',
  timeZone: 'Asia/Manila',
  todayDateKey: '2026-09-25',
  tomorrowDateKey: '2026-09-26',
};

describe('AI Edge operational logs', () => {
  let logs: string[];

  beforeEach(() => {
    envValues.AI_COMMAND_INTERNAL_ROLLOUT = 'true';
    envValues.AI_ASK_INTERNAL_ROLLOUT = 'true';
    envValues.AI_INTERNAL_USER_IDS = 'user-test';
    logs = [];
    vi.spyOn(console, 'log').mockImplementation((message) => logs.push(String(message)));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('keeps parse provider error text and command content out of server logs', async () => {
    const secret = 'PRIVATE_COMMAND_SENTINEL';
    const providerEcho = 'PROVIDER_ECHO_SENTINEL';
    const fetchMock = stubAuthQuotaAndProvider(new Response(providerEcho, { status: 400 }));
    vi.stubGlobal('fetch', fetchMock);
    const handler = await loadEdgeFunction('../supabase/functions/parse-ai-command/index.js');

    const response = await handler(
      authenticatedRequest({
        rawText: `Create a todo ${secret}`,
        ...dateContext,
      }),
    );

    expect(response.status).toBe(502);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(logs.join('\n')).toContain('parse_ai_command_upstream_error');
    expect(logs.join('\n')).toContain('"status":400');
    expect(logs.join('\n')).not.toContain(secret);
    expect(logs.join('\n')).not.toContain(providerEcho);
  });

  it('keeps Ask provider error text and question content out of server logs', async () => {
    const secret = 'PRIVATE_QUESTION_SENTINEL';
    const providerEcho = 'PROVIDER_ECHO_SENTINEL';
    const fetchMock = stubAuthQuotaAndProvider(new Response(providerEcho, { status: 400 }));
    vi.stubGlobal('fetch', fetchMock);
    const handler = await loadEdgeFunction('../supabase/functions/user-ai-ask/index.js');

    const response = await handler(
      authenticatedRequest({
        stage: 'classify',
        question: `How many tasks? ${secret}`,
        ...dateContext,
      }),
    );

    expect(response.status).toBe(500);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(logs.join('\n')).toContain('user_ai_ask_upstream_error');
    expect(logs.join('\n')).toContain('"status":400');
    expect(logs.join('\n')).not.toContain(secret);
    expect(logs.join('\n')).not.toContain(providerEcho);
  });

  it('keeps model-derived invalid intents out of Ask failure logs', async () => {
    const secret = 'MODEL_OUTPUT_SENTINEL';
    const providerResponse = new Response(
      JSON.stringify({
        choices: [
          { message: { content: JSON.stringify({ outcome: 'classified', intent: secret }) } },
        ],
      }),
      { status: 200 },
    );
    vi.stubGlobal('fetch', stubAuthQuotaAndProvider(providerResponse));
    const handler = await loadEdgeFunction('../supabase/functions/user-ai-ask/index.js');

    const response = await handler(
      authenticatedRequest({
        stage: 'classify',
        question: 'How many tasks?',
        ...dateContext,
      }),
    );

    expect(response.status).toBe(500);
    expect(logs.join('\n')).toContain('classify_error');
    expect(logs.join('\n')).not.toContain(secret);
  });

  it.each([
    ['parse-ai-command', 'AI_COMMAND_INTERNAL_ROLLOUT'],
    ['user-ai-ask', 'AI_ASK_INTERNAL_ROLLOUT'],
  ])('blocks a direct %s call before quota or provider work by default', async (name, flag) => {
    delete envValues[flag];
    const fetchMock = stubAuthQuotaAndProvider(new Response('provider must not run'));
    vi.stubGlobal('fetch', fetchMock);
    const handler = await loadEdgeFunction(`../supabase/functions/${name}/index.js`);
    const body =
      name === 'parse-ai-command'
        ? { rawText: 'private command', ...dateContext }
        : { stage: 'classify', question: 'private question', ...dateContext };

    const response = await handler(authenticatedRequest(body));

    expect(response.status).toBe(403);
    expect(fetchMock).toHaveBeenCalledTimes(1); // auth only
    expect(logs.join('\n')).toContain('rollout_rejected');
    expect(logs.join('\n')).not.toContain('private');
  });

  it.each([
    ['parse-ai-command', 'AI_COMMAND_INTERNAL_ROLLOUT'],
    ['user-ai-ask', 'AI_ASK_INTERNAL_ROLLOUT'],
  ])('blocks %s when enabled but the authenticated owner is not allowed', async (name, flag) => {
    envValues[flag] = 'true';
    envValues.AI_INTERNAL_USER_IDS = 'some-other-owner';
    const fetchMock = stubAuthQuotaAndProvider(new Response('provider must not run'));
    vi.stubGlobal('fetch', fetchMock);
    const handler = await loadEdgeFunction(`../supabase/functions/${name}/index.js`);
    const body =
      name === 'parse-ai-command'
        ? { rawText: 'private command', ...dateContext }
        : { stage: 'classify', question: 'private question', ...dateContext };

    const response = await handler(authenticatedRequest(body));

    expect(response.status).toBe(403);
    expect(fetchMock).toHaveBeenCalledTimes(1); // auth only
  });
});
