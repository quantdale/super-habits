/**
 * Hermetic web export for E2E / simulation / verification lanes.
 *
 * WHY THIS EXISTS (J8 oracle incident, 2026-09-24): a plain `npm run build:web`
 * inlines whatever `.env*` files exist on the machine. On a dev box with real
 * `EXPO_PUBLIC_SUPABASE_*` values, the test export boots against the LIVE
 * Supabase project: the app bootstraps an anonymous session, flush drains the
 * sync_outbox mid-journey, and UI-created test rows are pushed to production
 * under throwaway accounts. CI runners were hermetic only by accident (no
 * `.env` present). `scripts/build-dist-sync.mjs` already uses EXPO_NO_DOTENV
 * for the dummy-Supabase lane; this script gives the STANDARD lane the same
 * guarantee, plus a post-build leak guard so a future env leak fails loudly
 * instead of silently re-attaching local E2E to production.
 *
 * The build envelope and the leak guard now live in the shared module
 * `scripts/hermetic-build.mjs`, which the native APK lane calls too: two
 * copies of a credential-leak guard drift, and the drift direction is exactly
 * the failure this guard exists to prevent
 * (`harden-native-evidence-and-release-posture`, task 1.1).
 *
 * Contract: dist/ produced here must contain NO Supabase host at all
 * (boundaryDetected=false → @sync steps stay fixme-gated, exactly like CI).
 */
import fs from 'node:fs';
import path from 'node:path';
import { runHermeticBuild, scanDirectoryForNeedle } from './hermetic-build.mjs';

const root = process.cwd();
const distDir = path.join(root, 'dist');
const SUPABASE_HOST = 'supabase.co';

function fail(message) {
  console.error(`ABORT[build:e2e]: ${message}`);
  process.exit(1);
}

// 1. Hermetic export: block dotenv files AND strip ALL ambient EXPO_PUBLIC_*
// (exact CI parity: runners export none of them; public-by-design flags
// still change app behavior between local and CI builds). Pre-clean first: a
// stale file from a prior plain `build:web` export must never survive into the
// guarded scan window (fails-closed either way, but a clean tree makes the leak
// verdict exact).
fs.rmSync(distDir, { recursive: true, force: true });

console.log(
  '[build:e2e] exporting dist/ with EXPO_NO_DOTENV=1 (no .env, no ambient Supabase env)…',
);
try {
  runHermeticBuild({
    label: 'build:e2e',
    command: 'npx',
    args: ['expo', 'export', '-p', 'web', '--clear'],
  });
} catch (error) {
  fail(
    error?.code === 'HERMETIC_REMOTE_ENV' ? error.message : 'expo export failed (exit non-zero).',
  );
}

// 2. Leak guard: no Supabase host may survive into the test export — scan
// EVERY file (any extension, buffers; the previous js/html/json/css filter
// missed .map/.wasm/extensionless carriers).
if (!fs.existsSync(path.join(distDir, 'index.html'))) {
  fail('dist/index.html missing after export.');
}
const leakFiles = scanDirectoryForNeedle(distDir, root, SUPABASE_HOST);
if (leakFiles.length > 0) {
  fail(
    `Supabase host leaked into the E2E export (${leakFiles.length} file(s): ` +
      `${leakFiles.slice(0, 5).join(', ')}${leakFiles.length > 5 ? ', …' : ''}). ` +
      `Local E2E must never target a live project. Check EXPO_PUBLIC_SUPABASE_* ` +
      `sources (dotenv should be blocked by EXPO_NO_DOTENV=1).`,
  );
}
console.log('[build:e2e] OK — hermetic export (0 Supabase hosts in dist/).');
