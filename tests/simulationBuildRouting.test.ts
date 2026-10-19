import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';

const root = path.resolve(__dirname, '..');

describe('simulation export isolation and lane routing', () => {
  it.each([false, true])(
    'exports the requested artifact with the matching child flag (%s)',
    async (armed) => {
      const source = readFileSync(path.join(root, 'scripts/build-dist-e2e.mjs'), 'utf8')
        .split('// 2. Leak guard:')[0]
        .replace(/^import .*;\r?$/gm, '');
      const rmSync = vi.fn();
      const runHermeticBuild = vi.fn();
      vm.runInNewContext(source, {
        fs: { rmSync },
        path,
        process: { cwd: () => root, env: armed ? { EXPO_PUBLIC_SIM_DATA_BRIDGE_BUILD: '1' } : {} },
        console: { log: () => {}, error: () => {} },
        runHermeticBuild,
      });
      const options = runHermeticBuild.mock.calls[0][0] as {
        args: string[];
        set: Record<string, string>;
      };
      expect(options.args.slice(-2)).toEqual(['--output-dir', armed ? 'dist-sim' : 'dist']);
      expect(rmSync.mock.calls[0][0]).toBe(path.join(root, armed ? 'dist-sim' : 'dist'));
      const { hermeticBuildEnv } = await import('../scripts/hermetic-build.mjs');
      expect(hermeticBuildEnv({ set: options.set }).env.EXPO_PUBLIC_SIM_DATA_BRIDGE).toBe(
        armed ? 'true' : undefined,
      );
    },
  );

  it('keeps ordinary projects and bridge-dependent projects on separate exports', () => {
    const { scripts } = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };
    expect(scripts.e2e).not.toContain('--project=simulation');
    expect(scripts['e2e:simulation']).toContain('E2E_DIST_DIR=dist-sim');
    expect(scripts['e2e:simulation']).toContain('--project=simulation');
    expect(scripts['e2e:full']).toMatch(/build:e2e.*e2e.*build:e2e:sim.*e2e:simulation/);
    const qa = readFileSync(path.join(root, 'scripts/qa-simulation.mjs'), 'utf8');
    expect(qa).toContain("['run', 'build:e2e:sim']");
    expect(qa).toContain("'--dist', 'dist-sim'");
  });

  it.each(['dist', 'dist-sim', 'dist-sync'])(
    'starts the actual configured server against %s',
    (directory) => {
      const source = ts.transpileModule(
        readFileSync(path.join(root, 'playwright.config.ts'), 'utf8'),
        {
          compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
        },
      ).outputText;
      const exports: { default?: { webServer: { command: string } } } = {};
      vm.runInNewContext(source, {
        exports,
        process: { env: { E2E_DIST_DIR: directory } },
        require: () => ({
          defineConfig: (config: unknown) => config,
          devices: new Proxy({}, { get: () => ({}) }),
        }),
      });
      expect(exports.default!.webServer.command).toContain(`--dist ${directory}`);
    },
  );
});
