import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { EventEmitter } from 'node:events';
import { expect, it, vi } from 'vitest';

it.each(['success', 'child failure', 'bind failure'])(
  'stops its exact server after %s and never adopts a foreign response',
  async (mode) => {
    const failed = mode === 'child failure';
    const source = readFileSync(path.resolve(__dirname, '../scripts/qa-simulation.mjs'), 'utf8')
      .replace(/^import .*;\r?$/gm, '')
      .replace('main().catch', 'globalThis.completion = main().catch');
    const server = Object.assign(new EventEmitter(), {
      exitCode: null as number | null,
      signalCode: null as string | null,
      kill: vi.fn(),
      stdout: new EventEmitter(),
    });
    server.kill.mockImplementation(() => {
      server.signalCode = 'SIGTERM';
      queueMicrotask(() => server.emit('exit', null, 'SIGTERM'));
      return true;
    });
    let invocation = 0;
    const spawnSync = vi.fn(() => ({ status: failed && ++invocation === 3 ? 17 : 0 }));
    const processMock = {
      platform: 'win32',
      execPath: 'C:/Program Files/nodejs/node.exe',
      argv: ['node', 'qa-simulation.mjs'],
      env: {},
      exitCode: 0,
      stdout: { write: vi.fn() },
    };
    const context: Record<string, unknown> = {
      process: processMock,
      spawnSync,
      spawn: vi.fn(() => {
        queueMicrotask(() => {
          if (mode === 'bind failure') {
            server.exitCode = 1;
            server.emit('exit', 1);
          } else
            server.stdout.emit('data', Buffer.from('E2E static server: http://localhost:8081'));
        });
        return server;
      }),
      setTimeout,
      clearTimeout,
      URL,
      console: { log: vi.fn(), error: vi.fn() },
      http: {
        get: (_url: string, callback: (response: unknown) => void) => {
          queueMicrotask(() => callback({ statusCode: 200, resume: () => {} }));
          return Object.assign(new EventEmitter(), { setTimeout: () => {}, destroy: () => {} });
        },
      },
    };
    vm.runInNewContext(source, context);
    await context.completion;
    if (mode === 'bind failure') {
      expect(server.kill).not.toHaveBeenCalled();
      expect(processMock.exitCode).toBe(1);
      expect(spawnSync).toHaveBeenCalledTimes(1); // build only; no runner/validation
      return;
    }
    expect(server.kill).toHaveBeenCalledOnce();
    expect(processMock.exitCode).toBe(failed ? 1 : 0);
    const nodeCall = spawnSync.mock.calls[2] as unknown as [string, string[], { shell: boolean }];
    expect(nodeCall[0]).toBe(processMock.execPath);
    expect(nodeCall[1][0]).toBe('simulation/.build/simulation/runner/cli.js');
    expect(nodeCall[2].shell).toBe(false);
  },
);
