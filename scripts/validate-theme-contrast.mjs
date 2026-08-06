/**
 * WCAG 2.1 contrast validation for the live theme registry.
 *
 * The registry is TypeScript (core/theme/registry.ts), so this script bundles
 * it on the fly with esbuild — a pinned transitive dependency (vitest → vite)
 * — and evaluates the bundle in memory. The script itself stays plain node
 * with no direct dependencies, and the registry is the single source of
 * truth: there is no embedded catalog to drift.
 *
 * Run with:
 *   node scripts/validate-theme-contrast.mjs
 *   npm run validate:themes
 *
 * Exit code is non-zero when any check fails, so this can be a CI gate.
 *
 * Checks (all AA thresholds; AAA reported where achieved):
 *   - text          vs background / surface / surfaceElevated  >= 4.5
 *   - textMuted     vs surface / surfaceElevated               >= 4.5
 *   - buttonText    vs button / buttonHover / buttonActive     >= 4.5
 *   - accent        vs surface                                 >= 4.5
 *   - primary       vs surface (non-text UI, WCAG 1.4.11)      >= 3.0
 */
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const REGISTRY_ENTRY = join(ROOT, 'core/theme/registry.ts');
const ROOT_TSCONFIG = join(ROOT, 'tsconfig.json');

// Same math as core/theme/contrast.ts (which mirrors this function).
function luminance(hex) {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const AA = 4.5;
const AAA = 7;
const NON_TEXT = 3;

// Token roles checked per theme — the same matrix as
// createTheme.assertContrast() and tests/theme.registry.test.ts.
const CHECKS = [
  ['text on background', 'text', 'background', AA],
  ['text on surface', 'text', 'surface', AA],
  ['text on surfaceElevated', 'text', 'surfaceElevated', AA],
  ['textMuted on surface', 'textMuted', 'surface', AA],
  ['textMuted on surfaceElevated', 'textMuted', 'surfaceElevated', AA],
  ['buttonText on button', 'buttonText', 'button', AA],
  ['buttonText on buttonHover', 'buttonText', 'buttonHover', AA],
  ['buttonText on buttonActive', 'buttonText', 'buttonActive', AA],
  ['accent on surface', 'accent', 'surface', AA],
  ['primary on surface (non-text)', 'primary', 'surface', NON_TEXT],
];

async function loadRegistry() {
  // Bundles the TS registry (+ createTheme derivation) into one self-contained
  // ESM file. The root tsconfig's `@/*` path alias is honored via `tsconfig`.
  const esbuild = await import('esbuild');
  const result = await esbuild.build({
    entryPoints: [REGISTRY_ENTRY],
    bundle: true,
    platform: 'node',
    format: 'esm',
    write: false,
    absWorkingDir: ROOT,
    tsconfig: ROOT_TSCONFIG,
    // Metro-only global; the app inlines it. Prevents a ReferenceError when
    // createTheme's dev-only assertContrast guard is evaluated under node.
    define: { __DEV__: 'false' },
    logLevel: 'silent',
  });
  const code = result.outputFiles[0].text;
  const mod = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
  return mod.THEME_REGISTRY;
}

let registry;
try {
  registry = await loadRegistry();
} catch (err) {
  console.error(
    `validate-theme-contrast: failed to load the theme registry from core/theme/registry.ts:`,
  );
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
}

let failures = 0;
let checksRun = 0;

for (const [id, theme] of Object.entries(registry)) {
  const t = theme.tokens;
  console.log(`\n== ${id} (${theme.appearance}) ==`);
  for (const [label, fgKey, bgKey, min] of CHECKS) {
    const r = contrast(t[fgKey], t[bgKey]);
    checksRun += 1;
    const pass = r >= min;
    if (!pass) failures += 1;
    const grade = !pass ? 'FAIL' : min === NON_TEXT ? 'OK  ' : r >= AAA ? 'AAA ' : 'AA  ';
    console.log(`  ${grade} ${label.padEnd(30)} ${r.toFixed(2)}:1 (min ${min})`);
  }
}

console.log(
  failures === 0
    ? `\nAll ${checksRun} contrast checks pass.`
    : `\n${failures} of ${checksRun} contrast checks FAILED.`,
);
process.exit(failures === 0 ? 0 : 1);
