import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const source = readFileSync(resolve(__dirname, '../public/sw.js'), 'utf8');
const currentCache = 'superhabits-shell-__SUPERHABITS_CACHE_VERSION__';

function worker() {
  const listeners = new Map<string, (event: Record<string, unknown>) => void>();
  const cache = { put: vi.fn(async (): Promise<void> => undefined) };
  const caches = {
    keys: vi.fn(async () => [currentCache, 'superhabits-shell-old', 'unrelated-app-cache']),
    delete: vi.fn(async () => true),
    match: vi.fn(async (): Promise<Response | undefined> => undefined),
    open: vi.fn(async () => cache),
  };
  const fetch = vi.fn(async () => new Response('network asset'));
  const claim = vi.fn(async () => undefined);
  runInNewContext(source, {
    URL,
    caches,
    fetch,
    self: {
      location: { origin: 'https://app.example.test' },
      clients: { claim },
      addEventListener: (type: string, listener: (event: Record<string, unknown>) => void) =>
        listeners.set(type, listener),
    },
  });
  function dispatch(type: string) {
    let response: Promise<Response> | undefined;
    const lifetime: Promise<unknown>[] = [];
    listeners.get(type)!({
      request: new Request('https://app.example.test/asset.js'),
      respondWith: (value: Promise<Response>) => {
        response = value;
      },
      waitUntil: (value: Promise<unknown>) => lifetime.push(value),
    });
    return {
      get response() {
        return response;
      },
      lifetime,
    };
  }
  return { caches, cache, fetch, claim, dispatch };
}

describe('service-worker cache ownership and failure boundaries', () => {
  it('activation removes only obsolete app shell caches, not other same-origin caches', async () => {
    const w = worker();
    const event = w.dispatch('activate');
    await Promise.all(event.lifetime);
    expect(w.caches.delete.mock.calls).toEqual([['superhabits-shell-old']]);
    expect(w.claim).toHaveBeenCalledOnce();
  });

  it('keeps the event alive until a network asset has been written to cache', async () => {
    const w = worker();
    let finishWrite!: () => void;
    w.cache.put.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finishWrite = resolve;
        }),
    );
    const event = w.dispatch('fetch');
    // waitUntil must be registered during event dispatch, not after a fetch.
    expect(event.lifetime).toHaveLength(1);
    expect(await (await event.response!).text()).toBe('network asset');
    let completed = false;
    const lifetime = Promise.all(event.lifetime).then(() => {
      completed = true;
    });
    await Promise.resolve();
    expect(w.cache.put).toHaveBeenCalledOnce();
    expect(completed).toBe(false);
    finishWrite();
    await lifetime;
    expect(completed).toBe(true);
  });

  it('falls back to network when cache storage cannot be read or opened', async () => {
    const w = worker();
    w.caches.match.mockRejectedValue(new Error('cache storage unavailable'));
    w.caches.open.mockRejectedValue(new Error('quota exceeded'));
    const event = w.dispatch('fetch');
    expect(await (await event.response!).text()).toBe('network asset');
    await Promise.all(event.lifetime);
    expect(w.fetch).toHaveBeenCalledOnce();
  });

  it('does not retry a failed network request without a cached fallback', async () => {
    const w = worker();
    w.fetch.mockRejectedValue(new Error('offline'));
    const event = w.dispatch('fetch');
    await expect(event.response).rejects.toThrow('offline');
    await Promise.all(event.lifetime);
    expect(w.fetch).toHaveBeenCalledOnce();
  });

  it('returns an existing shell response without network or cache rewrites', async () => {
    const w = worker();
    w.caches.match.mockResolvedValue(new Response('cached asset'));
    const event = w.dispatch('fetch');
    expect(await (await event.response!).text()).toBe('cached asset');
    await Promise.all(event.lifetime);
    expect(w.fetch).not.toHaveBeenCalled();
    expect(w.cache.put).not.toHaveBeenCalled();
    expect(w.caches.match).toHaveBeenCalledWith(expect.any(Request), { cacheName: currentCache });
  });
});
