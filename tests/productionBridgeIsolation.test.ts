import { mkdtempSync, writeFileSync, rmSync, existsSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { scanDirectoryForNeedle } from '../scripts/hermetic-build.mjs';
import {
  createSimBridgeResolver,
  isDataBridgeSpecifier,
  isSimBridgeArmed,
} from '../scripts/metro-sim-bridge-resolver';

const root = path.resolve(__dirname, '..');

describe('production simulation-bridge isolation (AUD-SH19-B)', () => {
  describe('the production stub exposes no mutation surface', () => {
    const stub = readFileSync(path.join(root, 'core/simulation/dataBridge.stub.ts'), 'utf8');

    it('contains no bridge global and no mutation API', () => {
      expect(stub).not.toContain('__shDataBridge');
      expect(stub).not.toContain('invokeBridgeOperation');
      expect(stub).not.toContain('BRIDGE_OPERATIONS');
      expect(stub).not.toContain('globalThis.__sh');
      expect(stub).not.toContain('= { operations');
    });

    it('installs nothing (returns false)', () => {
      expect(stub).toMatch(/export function installSimulationDataBridge\(\): boolean/);
      expect(stub).toMatch(/installSimulationDataBridge\(\): boolean \{\s*return false;/);
    });
  });

  describe('the build scripts enforce isolation and keep the guard fail-closed', () => {
    const prod = readFileSync(path.join(root, 'scripts/build-dist-web.mjs'), 'utf8');
    const e2e = readFileSync(path.join(root, 'scripts/build-dist-e2e.mjs'), 'utf8');

    it('production build forces the stub and neutralizes the arming flag', () => {
      expect(prod).toContain(`productionEnv.SH_SIM_BRIDGE = 'disabled'`);
      expect(prod).toContain('delete productionEnv.EXPO_PUBLIC_SIM_DATA_BRIDGE');
    });

    it('production guard still scans for the bridge identifier and aborts', () => {
      // The guard must remain broad and fail-closed — never deleted or narrowed
      // to a string the mutation API could avoid.
      expect(prod).toContain(`scanDirectoryForNeedle(distDir, root, '__shdatabridge')`);
      expect(prod).toMatch(
        /ABORT\[build:web\]: the simulation data bridge reached a PRODUCTION export/,
      );
    });

    it('hermetic sim build arms the module; standard export does not', () => {
      expect(e2e).toContain(`SH_SIM_BRIDGE: 'armed'`);
      expect(e2e).toContain(`SH_SIM_BRIDGE: 'disabled'`);
      expect(e2e).toMatch(/!bridgeRequested && bridgeModule\.length > 0/);
    });
  });

  describe('the resolver routes the mutation module by build authorization', () => {
    it('arms only for the explicit hermetic simulation build', () => {
      expect(isSimBridgeArmed('armed')).toBe(true);
      expect(isSimBridgeArmed('disabled')).toBe(false);
      expect(isSimBridgeArmed(undefined)).toBe(false);
      expect(isSimBridgeArmed('true')).toBe(false);
    });

    it('matches every spelling of the dataBridge specifier but not the stub', () => {
      expect(isDataBridgeSpecifier('@/core/simulation/dataBridge')).toBe(true);
      expect(isDataBridgeSpecifier('core/simulation/dataBridge')).toBe(true);
      expect(isDataBridgeSpecifier('../../core/simulation/dataBridge')).toBe(true);
      expect(isDataBridgeSpecifier('@/core/simulation/dataBridge.ts')).toBe(true);
      expect(isDataBridgeSpecifier('@/core/simulation/dataBridge.stub')).toBe(false);
      expect(isDataBridgeSpecifier('@/features/todos/todos.data')).toBe(false);
    });

    it('substitutes the stub when unarmed and delegates when armed', () => {
      const calls: string[] = [];
      const prior = (_ctx: unknown, name: string) => {
        calls.push(name);
        return { type: 'sourceFile', filePath: `/resolved/${name}` };
      };

      const unarmed = createSimBridgeResolver({
        projectRoot: root,
        shSimBridge: 'disabled',
        priorResolveRequest: prior,
      });
      const stubbed = unarmed({}, '@/core/simulation/dataBridge', 'web') as {
        type: string;
        filePath: string;
      };
      expect(stubbed.type).toBe('sourceFile');
      expect(stubbed.filePath.endsWith(path.join('core', 'simulation', 'dataBridge.stub.ts'))).toBe(
        true,
      );
      // Non-bridge modules pass through untouched.
      const passthrough = unarmed({}, '@/features/todos/todos.data', 'web') as {
        filePath: string;
      };
      expect(passthrough.filePath).toBe('/resolved/@/features/todos/todos.data');

      const armed = createSimBridgeResolver({
        projectRoot: root,
        shSimBridge: 'armed',
        priorResolveRequest: prior,
      });
      const real = armed({}, '@/core/simulation/dataBridge', 'web') as { filePath: string };
      expect(real.filePath).toBe('/resolved/@/core/simulation/dataBridge');
    });
  });

  describe('the artifact guard detects an intentional bridge-injection fixture', () => {
    it('flags a fixture that smuggles the bridge identifier and passes a clean tree', () => {
      const dir = mkdtempSync(path.join(os.tmpdir(), 'sh-bridge-scan-'));
      try {
        expect(scanDirectoryForNeedle(dir, root, '__shdatabridge')).toEqual([]);

        // Negative control: a deliberate injection fixture must be detected.
        writeFileSync(
          path.join(dir, 'entry-injected.js'),
          'window.__shDataBridge = { invoke: () => {} };',
        );
        const hits = scanDirectoryForNeedle(dir, root, '__shdatabridge');
        expect(hits).toEqual([path.relative(root, path.join(dir, 'entry-injected.js'))]);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });
  });

  describe('built production artifact (when present) is bridge-free', () => {
    const distDir = path.join(root, 'dist');
    const built = existsSync(distDir);

    it.runIf(built)('dist/ contains no __shDataBridge identifier', () => {
      expect(scanDirectoryForNeedle(distDir, root, '__shdatabridge')).toEqual([]);
    });

    it.runIf(!built)('skipped: dist/ not built in this run (guard + build gate cover it)', () => {
      expect(built).toBe(false);
    });
  });
});
