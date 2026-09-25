import { describe, expect, it } from 'vitest';
import { main, parseClientKeys, parseProjectName } from '@/simulation/backend/certify';

describe('disposable certification launcher', () => {
  it('requires exact project identity from the CLI response', () => {
    const ref = 'slvctfwphtpeymzghyoc';
    expect(
      parseProjectName(
        JSON.stringify({ projects: [{ id: ref, ref, name: 'superhabits-disposable-probe' }] }),
        ref,
      ),
    ).toBe('superhabits-disposable-probe');
    expect(() =>
      parseProjectName(
        JSON.stringify({
          projects: [{ id: ref, ref: 'other', name: 'superhabits-disposable-probe' }],
        }),
        ref,
      ),
    ).toThrow('identity');
  });

  it('uses only public client and cleanup keys, and rejects a missing cleanup key', () => {
    const entries = [
      { name: 'anon', type: 'legacy', api_key: 'legacy-public' },
      { name: 'default', type: 'publishable', api_key: 'publishable-public' },
      { name: 'default', type: 'secret', api_key: 'do-not-use' },
      { name: 'service_role', type: 'legacy', api_key: 'cleanup-only' },
    ];
    expect(parseClientKeys(JSON.stringify(entries))).toEqual({
      publicKey: 'publishable-public',
      serviceKey: 'cleanup-only',
    });
    expect(() => parseClientKeys(JSON.stringify(entries.slice(0, 3)))).toThrow('unavailable');
  });

  it('rejects a production target before contacting the CLI', async () => {
    await expect(
      main([
        '--project-ref',
        'kruubbynsmxzxfdunaal',
        '--production-host',
        'kruubbynsmxzxfdunaal.supabase.co',
      ]),
    ).rejects.toThrow('production-host');
  });
});
