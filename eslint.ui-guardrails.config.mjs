// Playful Momentum v2 (UI overhaul) P0 guardrails — OPT-IN config (P0..P21),
// folded into the main eslint.config.mjs at error severity in P22.
//
// Run with:
//   npx eslint -c eslint.ui-guardrails.config.mjs core/ui features
//
// Why opt-in: the repo lint gate (`npm run lint` = `eslint . --max-warnings 0`)
// must stay green, so these warn-severity guardrails live here instead of the
// main config until P22 clears the violations and tightens them to error.
// docs/ui-ux/16-playful-momentum.md (§13 ledger) records the per-rule counts;
// openspec/changes/ui-v2-playful-momentum carries the capability delta.
// (Renamed from eslint.v4-guardrails.config.mjs when the neutral V4 direction
// was superseded by the v2 "Playful Momentum" brief; selectors unchanged.)
//
// The rules forbid the three literal classes the v2 spec retires from core/ui
// + features TSX: raw `text-[Npx]` sizes, raw Tailwind palette color
// utilities, and emoji literals in UI chrome. Built-in no-restricted-syntax
// with selector regexes only — no new deps or plugins. User content strings
// are exempt by design (emoji allowed in what the user typed, never in app
// chrome).
import baseConfig from './eslint.config.mjs';

export default [
  ...baseConfig,
  {
    files: ['core/ui/**/*.tsx', 'features/**/*.tsx'],
    rules: {
      'no-restricted-syntax': [
        'warn',
        {
          selector: "JSXAttribute[name.name='className'] Literal[value=/text-\\[[0-9]+px\\]/]",
          message:
            'UI P0 guardrail: raw text-[Npx] className size literal — use core/ui/Text typography roles instead.',
        },
        {
          selector:
            "JSXAttribute[name.name='className'] Literal[value=/(?:^|[^\\w-])(?:bg|text|border|ring|fill|stroke)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-[0-9]{2,3}(?![\\w-])/]",
          message:
            'UI P0 guardrail: raw Tailwind palette color utility — use section/theme color tokens instead.',
        },
        {
          selector:
            'JSXText[value=/\\p{Extended_Pictographic}/u], JSXAttribute Literal[value=/\\p{Extended_Pictographic}/u], JSXExpressionContainer Literal[value=/\\p{Extended_Pictographic}/u]',
          message:
            'UI P0 guardrail: emoji literal in UI text/strings — use the hero-icon system; emoji remain allowed only in user content.',
        },
      ],
    },
  },
];
